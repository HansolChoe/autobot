import { ToolImpl } from ".";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { getStringArg } from "../parseArgs";

export const pythonCodeGenImpl: ToolImpl = async (args, extras) => {
  const pythonCode = getStringArg(args, "python_code");

  try {
    // 1분 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초

    const response = await fetch("http://129.254.222.36:8000/generate/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "codellama/CodeLlama-7b-Python-hf",
        mode: "uv_open",
        language: "python",
        prompt: pythonCode,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}`,
      );
    }

    // 스트리밍 응답 처리
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let generatedCode = "";
    let lastChunkTime = Date.now();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 청크를 받았으므로 시간 업데이트
        lastChunkTime = Date.now();

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.result) {
                generatedCode += data.result;
              }
            } catch (parseError) {
              // JSON 파싱 실패 시 무시하고 계속 진행
              continue;
            }
          }
        }

        // 1분 이상 청크가 없으면 타임아웃
        if (Date.now() - lastChunkTime > 60000) {
          throw new Error("Timeout: No data received for more than 1 minute");
        }
      }
    } finally {
      reader.releaseLock();
    }

    return [
      {
        name: "Python Code Generation Result",
        description: "Generated Python code",
        content: `Input Python code:\n\`\`\`python\n${pythonCode}\n\`\`\`\n\nGenerated completed code:\n\`\`\`python\n${generatedCode}\n\`\`\``,
      },
    ];
  } catch (error) {
    throw new Error(
      `Failed to generate Python code: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
