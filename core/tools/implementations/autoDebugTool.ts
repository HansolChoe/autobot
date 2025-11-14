import { createPatch } from "diff";
import { ToolImpl } from ".";
import { Tool } from "../..";
import {
  convertUnifiedDiffToEdits,
  validateEditOperations,
} from "../../edit/lazy/diffToEdit";
import { applyUnifiedDiff } from "../../edit/lazy/unifiedDiffApply";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { getOptionalStringArg, getStringArg } from "../parseArgs";
import { resolveRelativePathInDir } from "../../util/ideUtils";

/**
 * AutoDebug Tool Implementation
 * Generates patch and explanation based on test code and source code
 */
export const autoDebugImpl: ToolImpl = async (args, extras) => {
  // Get required parameters
  const testCodePath = getStringArg(args, "test_code_path");
  const sourceCodePath = getStringArg(args, "source_code_path");

  // Optional: bug location from autofl
  const bugLocation = getOptionalStringArg(args, "bug_location");
  const testFailureInfo = getOptionalStringArg(args, "test_failure_info");

  // Resolve paths to URIs using the same method as readFile tool
  const absTestPath = await resolveRelativePathInDir(testCodePath, extras.ide);
  if (!absTestPath) {
    throw new Error(
      `Test code file "${testCodePath}" does not exist. Please check the path.`,
    );
  }

  const absSourcePath = await resolveRelativePathInDir(
    sourceCodePath,
    extras.ide,
  );
  if (!absSourcePath) {
    throw new Error(
      `Source code file "${sourceCodePath}" does not exist. Please check the path.`,
    );
  }

  try {
    // Use LLM from extras
    const llmClient = extras.llm;
    const toolCallId = extras.toolCallId || "";

    // Track progress messages as separate items (similar to autofl)
    const progressMessages: string[] = [];

    // Progress simulation steps
    const progressSteps = [
      { status: "patch 생성 시작", sleep: 5 },
      { status: "의심 메서드 목록 1개 확인", sleep: 1 },
      { status: "실패한 테스트로부터 정보 수집 중", sleep: 4 },
      { status: "과학적 방법 기반 디버깅 (1/3)", sleep: 5 },
      { status: "패치 생성 중", sleep: 1 },
      { status: "과학적 방법 기반 디버깅 (2/3)", sleep: 5 },
      { status: "패치 생성 중", sleep: 1 },
      { status: "과학적 방법 기반 디버깅 (3/3)", sleep: 5 },
      { status: "패치 생성 중", sleep: 1 },
      { status: "패치 평가", sleep: 3 },
    ];

    // Simulate progress steps
    for (const step of progressSteps) {
      progressMessages.push(step.status);

      // Stream each status as a separate context item (autofl과 동일한 방식)
      if (extras.onPartialOutput) {
        extras.onPartialOutput({
          toolCallId,
          contextItems: progressMessages.map((msg) => ({
            name: msg,
            description: "", // Empty description to avoid duplication (same as autofl)
            content: "", // Empty content - just show the status message
          })),
        });
      }

      // Sleep simulation (sleep in seconds: sleep * 1000ms)
      await new Promise((resolve) => setTimeout(resolve, step.sleep * 1000));
    }

    // Read test code and source code with error handling
    let testCode: string;
    let sourceCode: string;

    try {
      testCode = await extras.ide.readFile(absTestPath);
    } catch (error) {
      throw new Error(
        `Failed to read test code file "${testCodePath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      sourceCode = await extras.ide.readFile(absSourcePath);
    } catch (error) {
      throw new Error(
        `Failed to read source code file "${sourceCodePath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Build prompt for LLM to generate patch
    let prompt = `다음 테스트 코드와 소스 코드를 분석하여 버그를 수정하는 패치를 생성해주세요.

테스트 코드 파일: ${testCodePath}
\`\`\`
${testCode}
\`\`\`

소스 코드 파일: ${sourceCodePath}
\`\`\`
${sourceCode}
\`\`\`
`;

    if (bugLocation) {
      prompt += `\n버그 위치 정보: ${bugLocation}\n`;
    }

    if (testFailureInfo) {
      prompt += `\n테스트 실패 정보:\n${testFailureInfo}\n`;
    }

    prompt += `\n다음 형식으로 응답해주세요:
1. 먼저 버그의 원인과 수정 이유를 설명하세요 (한국어)
2. 그 다음 unified diff 형식의 패치를 제공하세요

응답 형식:
EXPLANATION: [버그 원인과 수정 이유 설명]
PATCH_DIFF:
\`\`\`diff
[unified diff 형식의 패치]
\`\`\``;

    // Call LLM
    const chatMessages = [
      {
        role: "system" as const,
        content:
          "You are an expert software engineer who generates high-quality patches to fix bugs. Always provide clear explanations in Korean and accurate unified diff format patches.",
      },
      {
        role: "user" as const,
        content: prompt,
      },
    ];

    const abortController = new AbortController();
    const response = await llmClient.chat(
      chatMessages,
      abortController.signal,
      {
        model: llmClient.model,
      },
    );
    // Handle response content (can be string or MessagePart[])
    let responseText = "";
    if (typeof response.content === "string") {
      responseText = response.content;
    } else if (Array.isArray(response.content)) {
      responseText = response.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part.type === "text") return part.text;
          return "";
        })
        .join("");
    }

    // Parse response to extract explanation and patch
    const { explanation, patchDiff } = parseLLMResponse(responseText);

    // Extract affected files from patch
    const affectedFiles = patchDiff ? extractFilePathsFromDiff(patchDiff) : [];

    // Convert unified diff to edit operations
    let editOperations: Array<{ oldString: string; newString: string }> = [];
    let validationErrors: string[] = [];

    if (patchDiff) {
      try {
        editOperations = convertUnifiedDiffToEdits(sourceCode, patchDiff);

        // Validate that the edit operations can be applied
        const validation = validateEditOperations(sourceCode, editOperations);
        if (!validation.success) {
          validationErrors = validation.errors;
        }
      } catch (error) {
        validationErrors.push(
          `Failed to convert patch to edit operations: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Generate edit-style diff for display
    let displayDiff = "";
    if (patchDiff) {
      try {
        const diffLines = applyUnifiedDiff(sourceCode, patchDiff);
        const newContent = diffLines
          .filter((line) => line.type !== "old")
          .map((line) => line.line)
          .join("\n");

        // Generate diff using createPatch (like edit tool)
        displayDiff = createPatch(
          sourceCodePath,
          sourceCode,
          newContent,
          undefined,
          undefined,
          { context: 3 },
        );
      } catch (error) {
        // If patch application fails, use original patch diff
        displayDiff = patchDiff;
      }
    }

    // Format structured JSON data for programmatic access
    const structuredData = {
      patch_diff: patchDiff,
      explanation: explanation,
      affected_files: affectedFiles,
      source_code_path: sourceCodePath,
      test_code_path: testCodePath,
      display_diff: displayDiff, // Edit-style diff for display
      edit_operations: editOperations, // Ready-to-use edit operations
      validation_errors: validationErrors, // Any validation issues
    };

    // Format markdown content for user display
    const markdownContent = generateMarkdownContent(
      explanation,
      editOperations,
      validationErrors,
      patchDiff,
      displayDiff,
      affectedFiles,
      responseText,
    );

    // Add final completion message to progress (like autofl)
    progressMessages.push("패치 생성 완료");

    // Return final context items: progress steps + collapsible details
    const contextItems: Array<{
      name: string;
      description: string;
      content: string;
    }> = [
      // Show all progress steps (like autofl)
      ...progressMessages.map((msg) => ({
        name: msg,
        description: "",
        content: "",
      })),
      // Collapsible patch result (click to expand)
      {
        name: "분석 완료",
        description: "",
        content: markdownContent,
      },
      // Collapsible structured data (click to expand)
      {
        name: "패치 데이터 (Structured)",
        description: "",
        content: JSON.stringify(structuredData, null, 2),
      },
    ];

    return contextItems;
  } catch (error) {
    throw new Error(
      `AutoDebug 패치 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Extract file paths from unified diff
 */
function extractFilePathsFromDiff(diff: string): string[] {
  const filePaths = new Set<string>();
  const lines = diff.split("\n");

  for (const line of lines) {
    // Match "--- a/path/to/file" or "+++ b/path/to/file"
    if (line.startsWith("---") || line.startsWith("+++")) {
      const pathMatch = line.match(/^(?:---|\+\+\+)\s+(?:a|b)\/(.+)$/);
      if (pathMatch) {
        filePaths.add(pathMatch[1]);
      }
    }
  }

  return Array.from(filePaths);
}

/**
 * Parse LLM response to extract explanation and patch
 */
function parseLLMResponse(responseText: string): {
  explanation: string;
  patchDiff: string;
} {
  let explanation = "";
  let patchDiff = "";

  // Try to extract EXPLANATION and PATCH_DIFF
  const explanationMatch = responseText.match(
    /EXPLANATION:\s*(.+?)(?=PATCH_DIFF:|$)/s,
  );
  const patchMatch = responseText.match(
    /PATCH_DIFF:\s*```(?:diff)?\s*\n([\s\S]+?)```/,
  );

  if (explanationMatch) {
    explanation = explanationMatch[1].trim();
  } else {
    // Fallback: try to find explanation before PATCH_DIFF
    const beforePatch = responseText.split(/PATCH_DIFF|```diff/i)[0];
    if (beforePatch.trim()) {
      explanation = beforePatch.trim();
    } else {
      explanation = "패치가 생성되었습니다.";
    }
  }

  if (patchMatch) {
    patchDiff = patchMatch[1].trim();
  } else {
    // Fallback: try to extract diff from code blocks
    const diffBlockMatch = responseText.match(/```(?:diff)?\s*\n([\s\S]+?)```/);
    if (diffBlockMatch) {
      patchDiff = diffBlockMatch[1].trim();
      // Remove explanation from patch if it's mixed
      if (patchDiff.includes("EXPLANATION:")) {
        patchDiff = patchDiff.split("EXPLANATION:")[0].trim();
      }
    } else {
      // Last resort: try to find diff-like content
      const lines = responseText.split("\n");
      let inDiff = false;
      const diffLines: string[] = [];
      for (const line of lines) {
        if (line.match(/^(diff |---|\+\+\+|@@)/)) {
          inDiff = true;
        }
        if (inDiff) {
          diffLines.push(line);
        }
      }
      if (diffLines.length > 0) {
        patchDiff = diffLines.join("\n");
      }
    }
  }

  // If we still don't have a patch, use the full response as explanation
  if (!patchDiff && responseText) {
    explanation = responseText;
    patchDiff = "";
  }

  return { explanation, patchDiff };
}

/**
 * Generate markdown content for display
 */
function generateMarkdownContent(
  explanation: string,
  editOperations: Array<{ oldString: string; newString: string }>,
  validationErrors: string[],
  patchDiff: string,
  displayDiff: string,
  affectedFiles: string[],
  responseText: string,
): string {
  let markdownContent = "# 패치 생성 결과\n\n";

  // 패치 이유 섹션
  if (explanation) {
    markdownContent += `## 패치 이유\n\n${explanation}\n\n`;
  }

  // Edit operations status
  if (editOperations.length > 0) {
    markdownContent += `## Edit Operations 상태\n\n`;
    markdownContent += `✅ ${editOperations.length}개의 edit operation(s) 생성됨\n\n`;

    if (validationErrors.length > 0) {
      markdownContent += `⚠️ **검증 경고**:\n`;
      validationErrors.forEach((error) => {
        markdownContent += `- ${error}\n`;
      });
      markdownContent += `\n`;
    } else {
      markdownContent += `✅ 모든 edit operation이 검증되었습니다. 바로 적용 가능합니다.\n\n`;
    }

    // Show edit operations preview
    markdownContent += `### Edit Operations 미리보기\n\n`;
    editOperations.forEach((op, idx) => {
      const oldPreview =
        op.oldString.length > 100
          ? op.oldString.substring(0, 100) + "..."
          : op.oldString;
      const newPreview =
        op.newString.length > 100
          ? op.newString.substring(0, 100) + "..."
          : op.newString;
      markdownContent += `**Edit ${idx + 1}:**\n`;
      markdownContent += `- Old: \`${oldPreview}\`\n`;
      markdownContent += `- New: \`${newPreview}\`\n\n`;
    });
  }

  // 생성된 패치 섹션
  if (patchDiff) {
    markdownContent += `## 생성된 패치 (Unified Diff)\n\n`;
    if (displayDiff) {
      markdownContent += `\`\`\`diff\n${displayDiff}\n\`\`\`\n\n`;
    } else {
      markdownContent += `\`\`\`diff\n${patchDiff}\n\`\`\`\n\n`;
    }
  } else {
    markdownContent += `## 오류\n\n패치를 생성할 수 없었습니다. LLM 응답을 확인해주세요.\n\n`;
    markdownContent += `\`\`\`\n${responseText}\n\`\`\`\n\n`;
  }

  // 영향받는 파일 섹션
  if (affectedFiles.length > 0) {
    markdownContent += `## 영향받는 파일\n\n`;
    affectedFiles.forEach((file) => {
      markdownContent += `- \`${file}\`\n`;
    });
    markdownContent += `\n`;
  }

  return markdownContent;
}

export const autoDebugTool: Tool = {
  type: "function",
  displayTitle: "AutoDebug (패치 생성)",
  wouldLikeTo: "generate patch for bug fix",
  isCurrently: "generating patch",
  hasAlready: "generated patch",
  group: BUILT_IN_GROUP_NAME,
  readonly: true, // Only generates and shows patch, doesn't apply
  isInstant: false,
  function: {
    name: BuiltInToolNames.AutoDebug,
    description: `Generates a patch with explanation to fix bugs based on test code and source code. 
This tool analyzes the test failure and source code to create a unified diff patch.

The tool:
1. Reads test code and source code files
2. Uses LLM to analyze the bug and generate a fix
3. Returns patch in unified diff format with explanation

This tool is typically used after AutoFL analysis to generate fixes for located bugs.`,
    parameters: {
      type: "object",
      required: ["test_code_path", "source_code_path"],
      properties: {
        test_code_path: {
          type: "string",
          description:
            "Path to the test code file (relative or absolute). This file contains the failing test.",
        },
        source_code_path: {
          type: "string",
          description:
            "Path to the source code file that needs to be fixed (relative or absolute).",
        },
        bug_location: {
          type: "string",
          description:
            "Optional: Bug location information from AutoFL analysis (e.g., method signature).",
        },
        test_failure_info: {
          type: "string",
          description:
            "Optional: Test failure information including error messages and stack traces.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `Use the ${BuiltInToolNames.AutoDebug} tool to generate patches for bug fixes. The tool analyzes test code and source code to create a unified diff patch with explanation.`,
    exampleArgs: [
      ["test_code_path", "test/test_example.py"],
      ["source_code_path", "src/example.py"],
      ["bug_location", "Example.method"],
    ],
  },
  defaultToolPolicy: "allowedWithPermission",
  toolCallIcon: "WrenchScrewdriverIcon",
};
