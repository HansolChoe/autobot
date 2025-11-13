import * as path from "path";
import { fileURLToPath } from "url";
import { ToolImpl } from ".";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";
import { analyzeFailures } from "./autofl";

/**
 * AutoFL Tool Implementation
 * Analyzes failing tests and predicts buggy methods using LLM
 */
export const autoflImpl: ToolImpl = async (args, extras) => {
  let repoPath = getStringArg(args, "repo_path");

  // Convert relative path to absolute path if needed
  if (!path.isAbsolute(repoPath)) {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    if (workspaceDirs.length > 0) {
      const workspaceRoot = fileURLToPath(workspaceDirs[0]);
      repoPath = path.resolve(workspaceRoot, repoPath);
    } else {
      // Fallback to process.cwd() if no workspace is available
      repoPath = path.resolve(process.cwd(), repoPath);
    }
  }

  const testCommand = getStringArg(args, "test_command");
  const language = getOptionalStringArg(args, "language") || "auto";
  const bugName = getOptionalStringArg(args, "bug_name") || "project";
  const maxBudget = args.max_budget ? parseInt(args.max_budget) : 10;

  try {
    // Use the LLM from extras
    const llmClient = extras.llm;
    const toolCallId = extras.toolCallId || "";

    // Track progress messages as separate items
    const progressMessages: string[] = [];

    const result = await analyzeFailures(
      {
        bugName,
        model: llmClient.model || "gpt-4.1",
        systemPromptPath: "", // Use default
        repoPath,
        testCommand,
        language: language as "auto" | "java" | "python",
        maxBudget,
        allowMultiPredictions: true,
        debug: false,
        onProgress: (message: string) => {
          // Add each status as a separate message
          progressMessages.push(message.trim());

          // Stream each status as a separate context item
          if (extras.onPartialOutput) {
            // Send all progress messages as separate items
            extras.onPartialOutput({
              toolCallId,
              contextItems: progressMessages.map((msg) => ({
                name: msg,
                description: "",
                content: "", // Empty content - just show the status message
              })),
            });
          }
        },
      },
      llmClient,
    );

    if (!result.success) {
      throw new Error(result.error || "Analysis failed");
    }

    // Format the analysis result
    let content = "# AutoFL Analysis Result\n\n";

    if (result.topPrediction) {
      content += `## Top Prediction\n\`\`\`\n${result.topPrediction}\n\`\`\`\n\n`;
    }

    if (result.predictionsList.length > 1) {
      content += `## All Predictions (${result.predictionCount})\n`;
      result.predictionsList.forEach((pred, idx) => {
        content += `${idx + 1}. \`${pred}\`\n`;
      });
      content += "\n";
    }

    if (result.buggyMethods) {
      content += "## Evaluation\n";
      for (const [method, gradeInfo] of Object.entries(result.buggyMethods)) {
        const status = gradeInfo.isFound ? "✅ Found" : "❌ Not found";
        content += `- ${status}: \`${method}\`\n`;
        if (gradeInfo.matchingAnswer.length > 0) {
          content += `  Matched by: ${gradeInfo.matchingAnswer.join(", ")}\n`;
        }
      }
      content += "\n";
    }

    content += `## Analysis Details\n`;
    content += `- Total LLM interactions: ${result.interactionRecords?.stepHistories.length || 0}\n`;
    content += `- Analysis timestamp: ${new Date(result.time).toISOString()}\n`;

    return [
      {
        name: "AutoFL Analysis",
        description: `Bug localization analysis for ${bugName}`,
        content,
      },
    ];
  } catch (error) {
    throw new Error(
      `AutoFL analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const autoflTool: Tool = {
  type: "function",
  displayTitle: "AutoFL (Bug Localization)",
  wouldLikeTo: "analyze failing tests and locate bugs",
  isCurrently: "analyzing tests for bug localization",
  hasAlready: "completed bug localization analysis",
  group: BUILT_IN_GROUP_NAME,
  readonly: true,
  isInstant: false,
  function: {
    name: BuiltInToolNames.AutoFL,
    description: `Analyzes failing tests using LLM to predict which methods are most likely to contain bugs. This tool:
1. Runs tests in the repository to identify failures
2. Collects test code, error messages, and stack traces
3. Uses LLM to systematically analyze the codebase
4. Predicts buggy method locations with confidence ranking

The tool returns a ranked list of methods most likely to contain the bug.`,
    parameters: {
      type: "object",
      required: ["repo_path", "test_command"],
      properties: {
        repo_path: {
          type: "string",
          description:
            "Path to the repository root directory (prefer absolute path, but relative paths are also accepted and will be automatically resolved to absolute paths based on the workspace root). This is where the code to be analyzed is located.",
        },
        test_command: {
          type: "string",
          description:
            'Command to run tests (e.g., "pytest", "npm test", "mvn test"). The command will be executed in the repo_path directory.',
        },
        language: {
          type: "string",
          description:
            'Programming language: "auto" (default, auto-detect), "java", or "python". Auto-detection looks for .java or .py files.',
        },
        bug_name: {
          type: "string",
          description:
            'Optional project/bug identifier for logging (default: "project")',
        },
        max_budget: {
          type: "number",
          description:
            "Maximum number of LLM API calls to make during analysis (default: 10). Higher values allow more thorough investigation.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `Use the ${BuiltInToolNames.AutoFL} tool when you need to analyze failing tests and locate bugs automatically. The tool uses LLM to understand test failures and predict buggy methods.`,
    exampleArgs: [
      ["repo_path", "/path/to/repository"],
      ["test_command", "pytest"],
      ["language", "python"],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
  toolCallIcon: "BugAntIcon",
};
