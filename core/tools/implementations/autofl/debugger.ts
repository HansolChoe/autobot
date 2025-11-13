import * as crypto from "crypto";
import * as fs from "fs";
import { GenericRepositoryInterface } from "./repository";
import {
  AutoFLConfig,
  AutoFLResult,
  GradeResult,
  InteractionRecord,
  LLMMessage,
} from "./types";

interface LLMResponse {
  choices: Array<{
    message: LLMMessage;
  }>;
}

/**
 * Auto Debugger for Fault Localization
 * Uses LLM to analyze failing tests and predict buggy methods
 */
export class AutoDebugger {
  private config: AutoFLConfig;
  private ri: GenericRepositoryInterface;
  private messages: LLMMessage[] = [];
  private midMap: Map<string, string> = new Map();
  private messageMap: Map<string, LLMMessage> = new Map();
  private interactionRecords: InteractionRecord[] = [];
  private llmClient: any; // Will be injected

  constructor(config: AutoFLConfig, llmClient: any) {
    this.config = config;
    this.llmClient = llmClient;

    // Create repository interface
    this.ri = new GenericRepositoryInterface(
      config.bugName,
      config.repoPath,
      config.testCommand,
      config.language,
      config.buggyMethods,
    );
  }

  /**
   * Initialize the debugger
   */
  async initialize(): Promise<void> {
    // Initialize repository interface
    await this.ri.initialize();

    // Initialize interaction records
    this.initInteractionRecords();

    // Add system message
    const systemMessage = await this.getSystemMessage();
    this.appendToMessages({
      role: "system",
      content: systemMessage,
    });

    // Check for failing tests
    const failTestSignatures = this.ri.failingTestSignatures.filter(
      (sig) => this.ri.getTestSnippet(sig) !== null,
    );

    if (failTestSignatures.length === 0) {
      throw new Error(
        `Could not find any failing tests for ${this.config.bugName}`,
      );
    }

    // Report failing test count
    if (this.config.onProgress) {
      this.config.onProgress(
        `실패한 테스트 ${this.ri.failingTestSignatures.length}개 발견`,
      );
    }

    // Apply test offset and limit
    let selectedTests = [...failTestSignatures];
    if (this.config.testOffset !== undefined) {
      const offset = this.config.testOffset % selectedTests.length;
      selectedTests = [
        ...selectedTests.slice(offset),
        ...selectedTests.slice(0, offset),
      ];
    }

    if (this.config.maxNumTests !== undefined) {
      selectedTests = selectedTests.slice(0, this.config.maxNumTests);
    }

    // Create user message with test information
    let userMessage = `The test \`${JSON.stringify(selectedTests)}\` failed.\n`;

    // Get test snippets
    const testSnippets = await Promise.all(
      selectedTests.map((sig) => this.ri.getTestSnippet(sig)),
    );
    const validSnippets = testSnippets.filter((s) => s !== null) as string[];

    if (validSnippets.length > 0) {
      userMessage += `The test looks like:\n\n\`\`\`${this.ri.language}\n${validSnippets.join("\n\n")}\n\`\`\`\n\n`;
    } else {
      userMessage += "Test code snippet not available.\n\n";
    }

    // Get failure information
    const failingTraces = await Promise.all(
      selectedTests.map((sig) => this.ri.getFailInfo(sig, true)),
    );
    const validTraces = failingTraces.filter((t) => t);

    if (validTraces.length > 0) {
      userMessage += `It failed with the following error message and call stack:\n\n\`\`\`\n${validTraces.join("\n\n")}\n\`\`\`\n\n`;
    } else {
      userMessage += "Error details not available.\n\n";
    }

    userMessage += `Start by calling the \`${this.ri.initialCoverageGetter}\` function.`;

    this.appendToMessages({
      role: "user",
      content: userMessage,
    });

    // No-LLM call of first instruction
    this.appendToMessages({
      role: "assistant",
      content: null,
      function_call: {
        name: this.ri.initialCoverageGetter,
        arguments: "{}",
      },
    });

    const initialResponse =
      await this.ri.fname2func[this.ri.initialCoverageGetter]();
    this.appendToMessages({
      role: "function",
      name: this.ri.initialCoverageGetter,
      content: JSON.stringify(initialResponse),
    });
  }

  /**
   * Run one step of the analysis
   */
  async step(functionCallMode: "auto" | "none" = "auto"): Promise<{
    done: boolean;
    functionName: string | null;
  }> {
    let promptMessages = this.messages;

    if (this.config.summarizeMessages) {
      promptMessages = [
        ...this.messages,
        {
          role: "system",
          content:
            "Summarize the important content of the immediate prior message. If you are unsure of the solution, call a function afterwards. Be concise, but fully qualify all names.",
        },
      ];
    }

    // Call LLM
    const response = await this.getLLMResponse(
      promptMessages,
      this.ri.functionDescriptions,
      functionCallMode,
    );

    if (this.config.summarizeMessages) {
      const llmSummary = response.choices[0].message.content;
      if (llmSummary) {
        this.replaceLastWithMemo(llmSummary);
      }
    }

    const responseMessage = response.choices[0].message;

    this.appendToInteractionRecords(promptMessages, responseMessage);

    // Check if LLM wanted to call a function
    if (responseMessage.function_call) {
      try {
        const { functionName, functionResponse } =
          await this.callFunction(responseMessage);

        this.appendToMessages(responseMessage);
        this.appendToMessages({
          role: "function",
          name: functionName,
          content: JSON.stringify(functionResponse),
        });

        return { done: false, functionName };
      } catch (error) {
        if (this.config.debug) {
          throw error;
        }
        return { done: false, functionName: null };
      }
    } else {
      this.appendToMessages(responseMessage);
      return { done: true, functionName: null };
    }
  }

  /**
   * Finish the analysis and get final prediction
   */
  async finish(): Promise<string> {
    // Report prediction phase
    if (this.config.onProgress) {
      this.config.onProgress("버그 위치 예측 중...");
    }

    let finishingString =
      "Based on the available information, provide the signatures of the most likely culprit methods for the bug, ordered by likelihood (most likely first). Your answer will be processed automatically, so make sure to only answer with the accurate signatures of all likely culprits (in `ClassName.MethodName(ArgType1, ArgType2, ...)` format), without commentary (one per line, ordered from most likely to least likely). ";

    if (!this.config.allowMultiPredictions) {
      finishingString = finishingString
        .replace("signatures", "signature")
        .replace("methods", "method")
        .replace(
          " (one per line, ordered from most likely to least likely)",
          "",
        )
        .replace("all likely culprits", "the most likely culprit");
    }

    this.appendToMessages({
      role: "user",
      content: finishingString,
    });

    const response = await this.getLLMResponse(this.messages, [], "none");
    const responseMessage = response.choices[0].message;

    this.appendToMessages(responseMessage);

    return responseMessage.content?.trim() || "";
  }

  /**
   * Grade the prediction
   */
  async grade(answer: string): Promise<GradeResult> {
    const predExprs = this.config.allowMultiPredictions
      ? answer.split("\n")
      : [answer];

    const matchingMethodSignatures: { [key: string]: string[] } = {};
    for (const predExpr of predExprs) {
      matchingMethodSignatures[predExpr] =
        await this.ri.getMatchingMethodSignatures(predExpr);
    }

    const gradeResult: GradeResult = {};
    for (const method of this.ri.buggyMethodSignatures) {
      const predMatch = predExprs.filter((predExpr) =>
        matchingMethodSignatures[predExpr].includes(method),
      );

      gradeResult[method] = {
        isFound: predMatch.length > 0,
        matchingAnswer: predMatch,
      };
    }

    return gradeResult;
  }

  /**
   * Run the complete analysis
   */
  async run(budget = 10): Promise<GradeResult> {
    await this.initialize();

    for (let i = 0; i < budget; i++) {
      const functionCallMode = i === budget - 1 ? "none" : "auto";
      const { done, functionName } = await this.step(functionCallMode);

      // Report step progress with function call details
      if (this.config.onProgress && functionName) {
        const stepNum = i + 1;
        const stepMsg = this.getStepMessage(functionName);
        this.config.onProgress(`단계 ${stepNum}/${budget}: ${stepMsg}`);
      }

      if (done) {
        // Report completion with step number
        if (this.config.onProgress) {
          this.config.onProgress(
            `단계 ${i + 1}/${budget}: 충분한 정보 수집 완료`,
          );
        }
        break;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const finalResponse = await this.finish();
    const gradeResult = await this.grade(finalResponse);

    return gradeResult;
  }

  /**
   * Get human-readable step message from function name
   */
  private getStepMessage(functionName: string): string {
    // Extract signature from the last assistant message if it's a code snippet query
    const lastMsg = this.messages[this.messages.length - 2]; // -1 is function response, -2 is assistant call
    if (lastMsg?.function_call?.arguments) {
      try {
        const args = JSON.parse(lastMsg.function_call.arguments);
        if (args.signature) {
          const sig = args.signature;
          if (functionName === "get_code_snippet") {
            return `${sig} 코드 조회 중...`;
          } else if (functionName === "get_comments") {
            return `${sig} 주석 조회 중...`;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Fallback to generic messages
    switch (functionName) {
      case "get_code_snippet":
        return "코드 스니펫 조회 중...";
      case "get_comments":
        return "주석 및 문서 조회 중...";
      case "get_covered_packages":
        return "테스트 커버리지 분석 중...";
      case "get_failing_tests_covered_classes":
        return "실패 테스트 관련 클래스 분석 중...";
      default:
        return `${functionName} 실행 중...`;
    }
  }

  /**
   * Run analysis and return complete result object
   */
  async analyze(): Promise<AutoFLResult> {
    const result: AutoFLResult = {
      time: Date.now(),
      success: false,
      messages: [],
      predictionsList: [],
      predictionCount: 0,
    };

    try {
      const grade = await this.run(this.config.maxBudget || 10);
      const finalResponse =
        this.messages[this.messages.length - 1]?.content || null;

      result.success = true;
      result.messages = this.messages;
      result.interactionRecords = {
        stepHistories: this.interactionRecords,
        midToMessage: Object.fromEntries(this.messageMap),
      };
      result.buggyMethods = grade;

      if (finalResponse) {
        const predictionsList = finalResponse
          .split("\n")
          .map((p) => p.trim())
          .filter((p) => p);
        result.predictions = finalResponse;
        result.predictionsList = predictionsList;
        result.predictionCount = predictionsList.length;
        result.topPrediction = predictionsList[0] || undefined;
      }
    } catch (error: any) {
      result.error = error.stack || error.message;
      if (this.config.debug) {
        throw error;
      }
    }

    return result;
  }

  // Private helper methods

  private initInteractionRecords(): void {
    this.midMap.clear();
    this.messageMap.clear();
    this.interactionRecords = [];
  }

  private appendToMessages(message: LLMMessage): void {
    this.messages.push(message);
  }

  private replaceLastWithMemo(memo: string): void {
    this.messages = this.messages.slice(0, -1);
    this.messages.push({ role: "assistant", content: "Summary: " + memo });
  }

  private appendToInteractionRecords(
    promptMessages: LLMMessage[],
    responseMessage: LLMMessage,
  ): void {
    const saveMessageAndGetMid = (message: LLMMessage): string => {
      const s = JSON.stringify(message);
      const md5Hash = crypto.createHash("md5").update(s).digest("hex");

      if (!this.midMap.has(md5Hash)) {
        const mid = `m${this.midMap.size + 1}`;
        this.midMap.set(md5Hash, mid);
        this.messageMap.set(mid, { ...message });
      }

      return this.midMap.get(md5Hash)!;
    };

    this.interactionRecords.push({
      promptMessages: promptMessages.map(saveMessageAndGetMid),
      responseMessage: saveMessageAndGetMid(responseMessage),
    });
  }

  private async getSystemMessage(): Promise<string> {
    let systemMessage: string;

    if (fs.existsSync(this.config.systemPromptPath)) {
      systemMessage = await fs.promises.readFile(
        this.config.systemPromptPath,
        "utf-8",
      );
      systemMessage = systemMessage.trim();
    } else {
      // Default system message
      systemMessage =
        "You are a helpful assistant that helps developers find bugs in their code.";
    }

    if (this.config.allowMultiPredictions) {
      systemMessage +=
        "\n\nAfter providing this diagnosis, you will be prompted to suggest which methods would be the best locations to be fixed. The answers should be in the form of `ClassName.MethodName(ArgType1, ArgType2, ...)` without commentary (one per line), as your answer will be automatically processed before finally being presented to the user.";
    } else {
      systemMessage +=
        "\n\nAfter providing this diagnosis, you will be prompted to suggest which method would be the best location to be fixed. You will provide a single answer, in the form of `ClassName.MethodName(ArgType1, ArgType2, ...)`, as your answer will be automatically processed before finally being presented to the user.";
    }

    return systemMessage;
  }

  private async callFunction(responseMessage: LLMMessage): Promise<{
    functionName: string;
    functionResponse: any;
  }> {
    const functionName = responseMessage.function_call!.name;
    const functionToCall = this.ri.fname2func[functionName];
    const functionArgs = JSON.parse(responseMessage.function_call!.arguments);

    const functionResponse = await functionToCall(functionArgs);

    return { functionName, functionResponse };
  }

  private async getLLMResponse(
    messages: LLMMessage[],
    functions: any[],
    functionCall: "auto" | "none",
  ): Promise<LLMResponse> {
    // Convert AutoFL messages to Continue ChatMessage format
    const chatMessages = messages.map((msg) => {
      if (msg.role === "function") {
        // Convert function response to tool result for Continue
        return {
          role: "tool" as const,
          content: msg.content || "",
          toolCallId: msg.name || "",
        };
      }
      if (msg.role === "assistant" && msg.function_call) {
        // Convert assistant message with function_call to tool calls
        return {
          role: "assistant" as const,
          content: msg.content || "",
          toolCalls: [
            {
              id: msg.function_call.name,
              type: "function" as const,
              function: {
                name: msg.function_call.name,
                arguments: msg.function_call.arguments,
              },
            },
          ],
        };
      }
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content || "",
      };
    });

    // Convert AutoFL functions to Continue tools format
    const tools =
      functions.length > 0 && functionCall === "auto"
        ? functions.map((func) => ({
            type: "function" as const,
            function: {
              name: func.name,
              description: func.description,
              parameters: func.parameters,
            },
          }))
        : undefined;

    // Use Continue's chat method with tools
    const abortController = new AbortController();
    const chatOptions: any = {
      model: this.config.model,
    };

    // Only set tools and toolChoice if tools are available
    if (tools) {
      chatOptions.tools = tools;
      // Set toolChoice to match functionCall mode
      // "auto" = LLM decides whether to call tools (matches Python's function_call="auto")
      // "none" = No tool calls allowed (matches Python's function_call="none")
      chatOptions.toolChoice = functionCall === "auto" ? "auto" : "none";
    }

    const response = await this.llmClient.chat(
      chatMessages,
      abortController.signal,
      chatOptions,
    );

    // Convert Continue response to AutoFL format
    const toolCalls = response.toolCalls;
    if (toolCalls && toolCalls.length > 0) {
      // LLM wants to call a tool
      const firstToolCall = toolCalls[0];
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: response.content || null,
              function_call: {
                name: firstToolCall.function?.name || "",
                arguments: firstToolCall.function?.arguments || "{}",
              },
            },
          },
        ],
      };
    } else {
      // No tool call, just return the response
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: response.content,
              function_call: undefined,
            },
          },
        ],
      };
    }
  }
}
