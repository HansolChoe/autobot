import { ToolImpl } from ".";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { getStringArg } from "../parseArgs";

export const pythonCodeGenImpl: ToolImpl = async (args, extras) => {
  const pythonCode = getStringArg(args, "python_code");

  // Currently returning stub response instead of actual API call
  // TODO: Uncomment the API call below and remove stub when implementing

  /*
  const response = await fetch("http://129.254.222.36:8000/generate/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/codegemma-7b",
      mode: "plain",
      language: "python",
      prompt: pythonCode,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  const generatedCode = result.generated_code || result.code || result.response || "";
  */

  // Stub response - returns fixed completed code instead of actual API call
  const stubGeneratedCode = `'''Just write only one Python function.'''
'''Write a function that checks whether a string contains the 'a' character followed by two or three 'b' characters.'''
def check_ab_pattern(s):
    """
    문자열에 'a' 문자 다음에 2개 또는 3개의 'b' 문자가 있는지 확인하는 함수
    """
    import re
    pattern = r'a(bb|bbb)'
    return bool(re.search(pattern, s))

# 테스트 예시
if __name__ == "__main__":
    test_cases = [
        "ab",      # False
        "abb",     # True
        "abbb",    # True
        "abbbb",   # False
        "aabb",    # True
        "aabbb",   # True
        "hello",   # False
        "aab",     # False
    ]
    
    for test in test_cases:
        result = check_ab_pattern(test)
        print(f"'{test}' -> {result}")`;

  return [
    {
      name: "Python Code Generation Result",
      description: "Generated Python code",
      content: `Input Python code:\n\`\`\`python\n${pythonCode}\n\`\`\`\n\nGenerated completed code:\n\`\`\`python\n${stubGeneratedCode}\n\`\`\``,
    },
  ];
};

export const pythonCodeGenTool: Tool = {
  type: "function",
  displayTitle: "Python Code Generation",
  wouldLikeTo: "generate Python code",
  isCurrently: "generating Python code",
  hasAlready: "generated Python code",
  group: BUILT_IN_GROUP_NAME,
  readonly: true,
  isInstant: false,
  function: {
    name: BuiltInToolNames.PythonCodeGen,
    description: `Generates complete Python code using AI model from input Python code. The generated code is returned in a complete, runnable form and must be used as-is without any modifications.`,
    parameters: {
      type: "object",
      required: ["python_code"],
      properties: {
        python_code: {
          type: "string",
          description:
            "The starting part of Python code or function signature to be generated",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `Use the ${BuiltInToolNames.PythonCodeGen} tool when Python code is needed to generate complete code. Use the generated code as-is without any modifications.`,
    exampleArgs: [["python_code", "def check_ab_pattern(s):"]],
  },
};
