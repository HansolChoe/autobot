# Local Agent에 Python Slash Command 자동 추가 구현 가이드

## 현재 상황

### 문제점
- Local Agent가 생성될 때 기본 템플릿에서 `name: Local Agent, version: 1.0.0, schema: v1, models: []`만 포함됨
- Python slash command가 YAML 파일에 포함되지 않음
- `core/config/yaml/loadYaml.ts`에서 런타임에만 Python command 추가됨

### 현재 파일 상태
```yaml
# extensions/.continue-debug/config.yaml
name: Local Agent
version: 1.0.0
schema: v1
models: []
```

## 해결 방법

### 1. Local Agent 생성 시 Python Slash Command 자동 추가

#### 수정할 파일: `core/config/yaml/loadYaml.ts`

**현재 코드 (169-179번째 줄):**
```typescript
const continueConfig: ContinueConfig = {
  slashCommands: [
    {
      name: "python",
      description: "Generate Python code using python_code_gen tool (use generated code as-is)",
      source: "built-in",
      run: async function* (_sdk) {
        const prompt = `{{{ input }}}\n\nFor Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.`;
        yield prompt;
      }
    }
  ],
  tools: getBaseToolDefinitions(),
```

#### 추가할 기능: Local Agent YAML 파일에 Python Command 추가

**새로운 함수 추가:**
```typescript
async function addPythonCommandToLocalAgent(ide: IDE, configPath: string): Promise<void> {
  try {
    const currentContent = await ide.readFile(configPath);
    
    // Python command가 이미 있는지 확인
    if (currentContent.includes('name: python')) {
      return; // 이미 있으면 추가하지 않음
    }
    
    const pythonCommand = `
# Slash commands for this agent
# https://docs.continue.dev/customization/slash-commands
prompts:
  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      For Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.
`;
    
    const updatedContent = currentContent + pythonCommand;
    await ide.writeFile(configPath, updatedContent);
  } catch (error) {
    console.warn('Failed to add Python command to Local Agent:', error);
  }
}
```

**configYamlToContinueConfig 함수 수정:**
```typescript
export async function configYamlToContinueConfig(options: {
  config: AssistantUnrolled;
  ide: IDE;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
}): Promise<{ config: ContinueConfig; errors: ConfigValidationError[] }> {
  let { config, ide, ideInfo, uniqueId, llmLogger } = options;

  const localErrors: ConfigValidationError[] = [];

  // Local Agent인 경우 Python command 추가
  if (config.name === "Local Agent" && config.version === "1.0.0") {
    const workspaceDirs = await ide.getWorkspaceDirs();
    if (workspaceDirs.length > 0) {
      const localAgentPath = joinPathsToUri(workspaceDirs[0], ".continue-debug/config.yaml");
      await addPythonCommandToLocalAgent(ide, localAgentPath);
    }
  }

  const continueConfig: ContinueConfig = {
    slashCommands: [
      {
        name: "python",
        description: "Generate Python code using python_code_gen tool (use generated code as-is)",
        source: "built-in",
        run: async function* (_sdk) {
          const prompt = `{{{ input }}}\n\nFor Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.`;
          yield prompt;
        }
      }
    ],
    tools: getBaseToolDefinitions(),
    // ... 나머지 코드
  };
  
  // ... 나머지 함수 내용
}
```

### 2. 필요한 Import 추가

**파일 상단에 추가:**
```typescript
import { joinPathsToUri } from "../../util/uri";
```

### 3. 최종 Local Agent YAML 파일 형태

**수정 후 예상 결과:**
```yaml
name: Local Agent
version: 1.0.0
schema: v1
models: []

# Slash commands for this agent
# https://docs.continue.dev/customization/slash-commands
prompts:
  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      For Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.
```

## 테스트 방법

1. **`.continue-debug` 폴더 삭제**
2. **Continue 재시작**
3. **Local Agent 확인** - `extensions/.continue-debug/config.yaml` 파일에 Python command가 포함되어야 함
4. **Python slash command 테스트** - `/python` 명령어가 작동하는지 확인

## 추가 고려사항

- **중복 방지**: 이미 Python command가 있는 경우 추가하지 않음
- **에러 처리**: 파일 읽기/쓰기 실패 시 경고만 출력하고 계속 진행
- **성능**: Local Agent가 아닌 경우 불필요한 파일 작업 수행하지 않음

## 구현 순서

1. `core/config/yaml/loadYaml.ts`에 `addPythonCommandToLocalAgent` 함수 추가
2. `configYamlToContinueConfig` 함수에 Local Agent 감지 로직 추가
3. 필요한 import 문 추가
4. 테스트 및 검증

이 구현을 통해 Local Agent가 생성될 때 자동으로 Python slash command가 YAML 파일에 포함됩니다.
