import json
import time
import argparse
import traceback
import hashlib
import os
import logging
from copy import deepcopy
from dotenv import load_dotenv
from lib import name_utils, llm_utils
from lib.repo_interface import get_repo_interface

RESULT_DIR = './results/'

def setup_logging(log_level='WARNING'):
    """로깅 레벨 설정"""
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f'Invalid log level: {log_level}')
    
    logging.basicConfig(
        level=numeric_level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)

class AutoDebugger(llm_utils.OpenAIEngine):
    def __init__(self, bug_name, model_type, system_file, test_offset=None,
            max_num_tests=None, allow_multi_predictions=False,
            summarize_messages=False, debug=False, logger=None, **ri_kwargs):
        super().__init__()
        self._bug_name = bug_name
        self._model = model_type
        self._logger = logger or logging.getLogger(__name__)
        self._logger.info(f"버그 분석 도구 초기화 중: 프로젝트={bug_name}, 모델={model_type}")
        self._logger.info(f"리포지토리 경로 확인 중: {ri_kwargs.get('repo_path', 'N/A')}")
        self._ri = get_repo_interface(bug_name, **ri_kwargs)
        self._logger.info("리포지토리 인터페이스 준비 완료")
        self._test_offset = test_offset
        self._max_num_tests = max_num_tests
        self._allow_multi_predictions = allow_multi_predictions
        self._summarize_messages = summarize_messages
        self._system_file = system_file
        self._debug = debug

    def _replace_last_with_memo(self, memo):
        self.messages = self.messages[:-1] # replace recent two queries with memo
        self.messages.append({'role': 'assistant', 'content': 'Summary: ' + memo})

    def _append_to_messages(self, message):
        # to easily control debug behavior
        if self._debug:
            self._logger.debug(f"메시지 추가: {message}")
        self.messages.append(message)

    @property
    def _system_message(self):
        with open(self._system_file) as f:
            system_message = f.read().strip()
        if self._allow_multi_predictions:
            system_message += "\n\nAfter providing this diagnosis, you will be prompted to suggest which methods would be the best locations to be fixed. The answers should be in the form of `ClassName.MethodName(ArgType1, ArgType2, ...)` without commentary (one per line), as your answer will be automatically processed before finally being presented to the user."
        else:
            system_message += "\n\nAfter providing this diagnosis, you will be prompted to suggest which method would be the best location to be fixed. You will provide a single answer, in the form of `ClassName.MethodName(ArgType1, ArgType2, ...)`, as your answer will be automatically processed before finally being presented to the user."
        return system_message

    def _init_interaction_records(self):
        self._mid_map = {} # md5_hash -> mid (message id)
        self._message_map = {} # mid -> message
        self._interaction_records = [] # list of dict

    def _append_to_interaction_records(self, prompt_messages, response_message):
        def _save_message_and_get_mid(message):
            s = json.dumps(message).encode('utf-8')
            md5_hash = hashlib.md5(s).digest()
            if md5_hash not in self._mid_map:
                self._mid_map[md5_hash] = f"m{len(self._mid_map) + 1}"
                self._message_map[self._mid_map[md5_hash]] = deepcopy(message)
            return self._mid_map[md5_hash]

        self._interaction_records.append({
            "prompt_messages": [_save_message_and_get_mid(m) for m in prompt_messages],
            "response_message": _save_message_and_get_mid(response_message)
        })

    def startup(self):
        self._logger.info("초기화 중: 상호작용 기록 초기화...")
        self._init_interaction_records()
        self.messages = []

        self._logger.debug("시스템 메시지 로드 중...")
        self._append_to_messages({'role': 'system', 'content': self._system_message})

        self._logger.info(f"실패한 테스트 확인 중... (총 {len(self._ri.failing_test_signatures)}개)")
        fail_test_signatures = [
            signature for signature in self._ri.failing_test_signatures
            if self._ri.get_test_snippet(signature) is not None
        ]

        if not fail_test_signatures:
            # If no test snippets found, use all failing test signatures
            self._logger.warning("테스트 스니펫을 찾을 수 없어 모든 실패 테스트 시그니처 사용")
            fail_test_signatures = self._ri.failing_test_signatures

        if not fail_test_signatures:
            raise ValueError(f'Could not find any failing tests for {self._bug_name}')
        
        self._logger.info(f"사용할 테스트 시그니처: {len(fail_test_signatures)}개")

        if self._test_offset is not None:
            # rotate list
            offset = self._test_offset % len(fail_test_signatures)
            fail_test_signatures = fail_test_signatures[offset:] + fail_test_signatures[:offset]

        if self._max_num_tests is not None:
            fail_test_signatures = fail_test_signatures[:self._max_num_tests]

        if not fail_test_signatures:
            raise ValueError(f'Could not find test snippet for bug {self._bug_name}')

        user_message = f"The test `{fail_test_signatures}` failed.\n"
        
        # Get test snippets (filter out None values)
        test_snippet_list = []
        for signature in fail_test_signatures:
            snippet = self._ri.get_test_snippet(signature)
            if snippet:
                test_snippet_list.append(snippet.rstrip())
        
        if test_snippet_list:
            test_snippets = "\n\n".join(test_snippet_list)
            user_message += f"The test looks like:\n\n```{self._ri.language}\n{test_snippets}\n```\n\n"
        else:
            user_message += "Test code snippet not available.\n\n"
        
        # Get failure information
        failing_traces_list = []
        for signature in fail_test_signatures:
            fail_info = self._ri.get_fail_info(signature, minimize=True)
            if fail_info:
                failing_traces_list.append(fail_info.rstrip())
        
        if failing_traces_list:
            failing_traces = "\n\n".join(failing_traces_list)
            user_message += f"It failed with the following error message and call stack:\n\n```\n{failing_traces}\n```\n\n"
        else:
            user_message += "Error details not available.\n\n"

        user_message += f'Start by calling the `{self._ri.initial_coverage_getter}` function.'

        self._append_to_messages({
            'role': 'user',
            'content': user_message,
        })

        # no-LLM call of first instruction (LLM always calls this anyway)
        initial_desc = self._get_function_description(self._ri.initial_coverage_getter)
        self._logger.info(f"초기 정보 수집: {initial_desc}")
        self._append_to_messages({
            "role": "assistant",
            "content": None,
            "function_call": {
                "name": self._ri.initial_coverage_getter,
                "arguments": "{}"
            }
        })
        initial_function_response = self._ri.fname2func[self._ri.initial_coverage_getter]()
        self._logger.debug(f"초기 정보 수신 완료 (길이: {len(json.dumps(initial_function_response))} 문자)")
        self._append_to_messages({
            "role": "function",
            "name": self._ri.initial_coverage_getter,
            "content": json.dumps(initial_function_response)
        })
        self._logger.info("초기화 완료")

    def _get_function_description(self, function_name):
        """함수 이름을 사용자 친화적인 설명으로 변환"""
        descriptions = {
            "get_covered_packages": "실패한 테스트가 사용하는 패키지/모듈 확인",
            "get_failing_tests_covered_classes": "실패한 테스트가 사용하는 클래스 확인",
            "get_code_snippet": "코드 스니펫 조회",
            "get_comments": "주석 조회",
            "get_failing_tests_covered_methods_for_class": "특정 클래스의 메서드 목록 조회",
            "get_test_snippet": "테스트 코드 조회",
        }
        return descriptions.get(function_name, f"{function_name} 실행")

    def call_function(self, response_message):
        function_name = response_message["function_call"]["name"]
        function_to_call = self._ri.fname2func[function_name]
        function_args = json.loads(response_message["function_call"]["arguments"])
        function_desc = self._get_function_description(function_name)
        
        # 인자가 있으면 표시
        if function_args:
            args_str = ", ".join([f"{k}={v}" for k, v in function_args.items()])
            self._logger.info(f"{function_desc} ({args_str})")
        else:
            self._logger.info(f"{function_desc}")
        
        function_response = function_to_call(**function_args)
        # 응답이 너무 길면 요약
        response_str = json.dumps(function_response)
        if len(response_str) > 200:
            self._logger.debug(f"응답 수신: {len(response_str)} 문자")
        else:
            self._logger.debug(f"응답 수신: {response_str[:200]}")
        return function_name, function_response

    def step(self, function_call_mode="auto"):
        if self._summarize_messages:
            prompt_messages = self.messages + [{'role': 'system', 'content': 'Summarize the important content of the immediate prior message. If you are unsure of the solution, call a function afterwards. Be concise, but fully qualify all names.'}]
        else:
            prompt_messages = self.messages

        response = self.get_LLM_response(
            model=self._model,
            messages=prompt_messages,
            functions=self._ri.function_descriptions,
            function_call=function_call_mode,  # auto is default, but we'll be explicit #FIXME
        )

        if self._summarize_messages:
            llm_summary = response['choices'][0]['message']['content']
            if llm_summary is not None:
                self._replace_last_with_memo(llm_summary)

        response_message = response["choices"][0]["message"]

        self._append_to_interaction_records(prompt_messages, response_message)

        # check if GPT wanted to call a function
        if response_message.get("function_call"):
            # call the function

            try: # Note: the JSON response may not always be valid; be sure to handle errors
                function_name, function_response = self.call_function(response_message)
            except Exception as e:
                if self._debug or isinstance(e, KeyboardInterrupt):
                    raise e
                else:
                    return (False, None) # drop erroneous response and retry if step budget left

            self._append_to_messages(response_message) # extend conversation with assistant's reply
            # send the info on the function call and function response to GPT
            function_message = {
                "role": "function",
                "name": function_name,
                "content": json.dumps(function_response),
            }
            self._append_to_messages(function_message)
            return (False, function_name) # not done, return function name
        else:
            self._append_to_messages(response_message)  # extend conversation with assistant's reply
            return (True, None) # done

    def finish(self):
        finishing_string = "Based on the available information, provide the signatures of the most likely culprit methods for the bug, ordered by likelihood (most likely first). Your answer will be processed automatically, so make sure to only answer with the accurate signatures of all likely culprits (in `ClassName.MethodName(ArgType1, ArgType2, ...)` format), without commentary (one per line, ordered from most likely to least likely). "
        if not self._allow_multi_predictions:
            finishing_string = finishing_string.replace('signatures', 'signature')
            finishing_string = finishing_string.replace('methods', 'method')
            finishing_string = finishing_string.replace(' (one per line, ordered from most likely to least likely)', '')
            finishing_string = finishing_string.replace('all likely culprits', 'the most likely culprit')

        querying_buggy_methods = {
            'role': 'user',
            'content': finishing_string
        }
        self._append_to_messages(querying_buggy_methods)
        response = self.get_LLM_response(
            model=self._model,
            messages=self.messages,
        )
        response_message = response["choices"][0]["message"]
        self._append_to_messages(response_message)
        return response_message['content'].strip()

    def grade(self, answer):
        if self._allow_multi_predictions:
            pred_exprs = answer.splitlines()
        else:
            pred_exprs = [answer]

        matching_method_signatures = {
            pred_expr: self._ri.get_matching_method_signatures(pred_expr)
            for pred_expr in pred_exprs
        }

        grade_result = {}
        for method in self._ri.buggy_method_signatures:
            pred_match = [
                pred_expr for pred_expr in pred_exprs
                if method in matching_method_signatures[pred_expr]
            ]
            grade_result[method] = {
                'is_found': len(pred_match) > 0,
                'matching_answer': pred_match
            }
        return grade_result

    def run(self, budget=10):
        self._logger.info(f"버그 분석 시작 (최대 {budget}단계)")
        self._logger.info(f"프로젝트: {self._bug_name}, 모델: {self._model}")
        
        self.startup()
        
        self._logger.info("테스트 정보 로드 및 초기 정보 수집 완료")
        
        for i in range(budget):
            if i == budget - 1:
                function_call_mode = "none"
                self._logger.info(f"단계 {i+1}/{budget}: 마지막 단계 - 최종 분석 중...")
            else:
                function_call_mode = "auto"
                self._logger.info(f"단계 {i+1}/{budget}: 정보 수집 중...")
            
            done, function_name = self.step(function_call_mode)
            time.sleep(0.1)
            
            if done:
                self._logger.info(f"단계 {i+1}/{budget}: 충분한 정보를 수집하여 분석을 완료했습니다.")
                break
            else:
                if function_name:
                    function_desc = self._get_function_description(function_name)
                    self._logger.info(f"단계 {i+1}/{budget}: {function_desc} 완료, 다음 단계로 진행합니다.")
                else:
                    self._logger.info(f"단계 {i+1}/{budget}: 정보 수집 중 오류 발생, 재시도합니다.")
        
        self._logger.info("버그 위치 예측 중...")
        
        final_response = self.finish()
        grade_result = self.grade(final_response)
        
        self._logger.info("분석 완료")
        
        return grade_result

if __name__ == '__main__':
    # Load environment variables from .env file
    load_dotenv()
    
    # Get default model from .env or use gpt-4.1 as fallback
    default_model = os.getenv('OPENAI_MODEL', 'gpt-4.1')
    
    parser = argparse.ArgumentParser(
        description='AutoFL: LLM-based Explainable Fault Localization Tool'
    )
    parser.add_argument('-m', '--model', default=default_model,
                        help=f'LLM model to use (default: {default_model}, can be set via OPENAI_MODEL in .env)')
    parser.add_argument('-b', '--bug_name', default='my_project',
                        help='Name/identifier for the project (default: my_project)')
    parser.add_argument('-o', '--out', default='test.json',
                        help='Output file path (default: test.json)')
    parser.add_argument('-p', '--prompt', default='prompts/system_msg_expbug.txt',
                        help='Path to system prompt file')
    
    # Repository and test configuration
    parser.add_argument('--repo_path', type=str, required=True,
                        help='Path to repository root directory (required)')
    parser.add_argument('--test_command', type=str, required=True,
                        help='Command to run tests (e.g., "pytest", "mvn test", "python -m pytest") (required)')
    parser.add_argument('--language', type=str, default='auto',
                        choices=['auto', 'java', 'python'],
                        help='Programming language: auto, java, or python (default: auto)')
    parser.add_argument('--buggy_methods', type=str, nargs='*', default=[],
                        help='Optional list of buggy method signatures for evaluation')
    
    # Test configuration
    parser.add_argument('-t', '--max_num_tests', default=None, type=int,
                        help='Maximum number of tests to use')
    parser.add_argument('--test_offset', default=0, type=int,
                        help='Offset for test selection')
    
    # Execution configuration
    parser.add_argument('--max_budget', default=10, type=int,
                        help='Maximum number of API calls (default: 10)')
    
    # Options
    parser.add_argument('--allow_multi_predictions', action="store_true",
                        help='Allow multiple method predictions')
    parser.add_argument('--summarize_messages', action="store_true",
                        help='Summarize messages to reduce token usage')
    parser.add_argument('--show_line_number', action="store_true",
                        help='Show line numbers in code snippets')
    parser.add_argument('--postprocess_test_snippet', action="store_true",
                        help='Post-process test snippets')
    parser.add_argument('--debug', action="store_true",
                        help='Enable debug mode')
    parser.add_argument('--log-level', default='INFO',
                        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                        help='Set logging level (default: INFO)')
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.log_level)
    logger.info("=" * 60)
    logger.info("AutoFL 시작")
    logger.info("=" * 60)

    ad = AutoDebugger(
        args.bug_name, 
        args.model, 
        args.prompt,
        test_offset=args.test_offset,
        max_num_tests=args.max_num_tests,
        allow_multi_predictions=args.allow_multi_predictions,
        summarize_messages=args.summarize_messages,
        show_line_number=args.show_line_number,
        postprocess_test_snippet=args.postprocess_test_snippet,
        debug=args.debug,
        logger=logger,
        # Pass repository configuration to get_repo_interface
        repo_path=args.repo_path,
        test_command=args.test_command,
        language=args.language,
        buggy_methods=args.buggy_methods
    )

    result = {
        'time': time.time(),
        'success': False,
        'error': None,
        'messages': None,
        'interaction_records': None,
        'buggy_methods': None,
        'predictions': None
    }

    try:
        grade = ad.run(args.max_budget)
        final_response = ad.messages[-1]['content'] if ad.messages else None
        
        result['success'] = True
        result['messages'] = ad.messages
        result['interaction_records'] = {
            "step_histories": ad._interaction_records,
            "mid_to_message": ad._message_map
        }
        result['buggy_methods'] = grade
        
        # Parse predictions with ranking
        if final_response:
            predictions_list = [p.strip() for p in final_response.splitlines() if p.strip()]
            result['predictions'] = final_response
            result['predictions_list'] = predictions_list
            result['prediction_count'] = len(predictions_list)
            result['top_prediction'] = predictions_list[0] if predictions_list else None
        else:
            result['predictions'] = None
            result['predictions_list'] = []
            result['prediction_count'] = 0
            result['top_prediction'] = None
        
        logger.info("Analysis completed successfully.")
        if final_response:
            logger.info(f"Predictions: {final_response[:200]}...")  # Show first 200 chars
            print("Analysis completed successfully.")
            print(f"Predictions: {final_response[:200]}...")  # Show first 200 chars
                
    except Exception as e:
        error_msg = traceback.format_exc()
        result['error'] = error_msg
        logger.error("Analysis failed with error:")
        logger.error(error_msg)
        print("Analysis failed with error:")
        print(error_msg)
        if args.debug:
            raise e

    # Save result
    with open(args.out, "w") as f:
        json.dump(result, f, indent=4)
    print(f"Result saved to: {args.out}")
