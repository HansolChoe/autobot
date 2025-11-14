import { applyUnifiedDiff } from "./unifiedDiffApply";

/**
 * Edit operation representing a single old -> new string replacement
 */
export interface EditOperation {
  oldString: string;
  newString: string;
}

/**
 * Converts a unified diff patch to a list of edit operations
 * that can be used with the Edit or MultiEdit tools.
 *
 * This ensures exact string matching by preserving the original
 * source code formatting and extracting the exact old/new strings.
 *
 * @param sourceCode - Original source code content
 * @param unifiedDiff - Unified diff patch string
 * @returns Array of edit operations with exact old/new strings
 */
export function convertUnifiedDiffToEdits(
  sourceCode: string,
  unifiedDiff: string,
): EditOperation[] {
  try {
    // Parse the unified diff using the existing parser
    const diffLines = applyUnifiedDiff(sourceCode, unifiedDiff);

    const editOperations: EditOperation[] = [];
    let currentOldLines: string[] = [];
    let currentNewLines: string[] = [];
    let inChangeBlock = false;

    for (let i = 0; i < diffLines.length; i++) {
      const diffLine = diffLines[i];

      if (diffLine.type === "old") {
        // Start or continue a change block
        inChangeBlock = true;
        currentOldLines.push(diffLine.line);
      } else if (diffLine.type === "new") {
        // Continue change block
        inChangeBlock = true;
        currentNewLines.push(diffLine.line);
      } else if (diffLine.type === "same") {
        // Context line - if we were in a change block, finalize it
        if (inChangeBlock && (currentOldLines.length > 0 || currentNewLines.length > 0)) {
          // Create edit operation from accumulated lines
          const oldString = currentOldLines.join("\n");
          const newString = currentNewLines.join("\n");

          // Only add if there's actually a change
          if (oldString !== newString) {
            editOperations.push({
              oldString,
              newString,
            });
          }

          // Reset for next change block
          currentOldLines = [];
          currentNewLines = [];
          inChangeBlock = false;
        }
      }
    }

    // Handle any remaining change block at the end
    if (currentOldLines.length > 0 || currentNewLines.length > 0) {
      const oldString = currentOldLines.join("\n");
      const newString = currentNewLines.join("\n");

      if (oldString !== newString) {
        editOperations.push({
          oldString,
          newString,
        });
      }
    }

    return editOperations;
  } catch (error) {
    throw new Error(
      `Failed to convert unified diff to edit operations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validates that edit operations can be applied to the source code
 *
 * @param sourceCode - Original source code content
 * @param editOperations - Array of edit operations to validate
 * @returns Validation result with success status and error details if any
 */
export function validateEditOperations(
  sourceCode: string,
  editOperations: EditOperation[],
): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < editOperations.length; i++) {
    const { oldString } = editOperations[i];

    // Check if the old string exists in the source code
    if (!sourceCode.includes(oldString)) {
      errors.push(
        `Edit operation ${i}: old string not found in source code.\n` +
          `Old string preview: "${oldString.substring(0, 100)}..."`,
      );
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
