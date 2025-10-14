import { Tool } from "../..";
import { EDIT_CODE_INSTRUCTIONS } from "../../llm/defaultSystemMessages";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface EditToolArgs {
  filepath: string;
  changes: string;
}

export const NO_PARALLEL_TOOL_CALLING_INSTRUCTION =
  "This tool CANNOT be called in parallel with other tools.";

const CHANGES_DESCRIPTION =
  "The complete modified file content with ALL original comments, docstrings, and documentation preserved. Do NOT wrap this in a codeblock or write anything besides the code changes. CRITICAL: You must include ALL existing comments from the original file. Do not remove or omit any comments, docstrings, or documentation. Only use placeholders like '// ... existing code ...' for sections that contain no meaningful comments or documentation.";

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.EditExistingFile,
    description: `Use this tool to edit an existing file. If you don't know the contents of the file, read it first.

CRITICAL: When providing the 'changes' parameter, you MUST include ALL existing comments, docstrings, and documentation from the original file. Do not remove or omit any comments. The 'changes' parameter should contain the complete modified code with all original comments preserved.

IMPORTANT: When editing files, preserve ALL existing comments, docstrings, and documentation. Do not remove or modify comments unless explicitly requested. Only use placeholders like '// ... existing code ...' for sections that contain no meaningful comments or documentation.

${EDIT_CODE_INSTRUCTIONS}
${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}`,
    parameters: {
      type: "object",
      required: ["filepath", "changes"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to edit, relative to the root of the workspace.",
        },
        changes: {
          type: "string",
          description: CHANGES_DESCRIPTION,
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To edit an EXISTING file, use the ${BuiltInToolNames.EditExistingFile} tool with
- filepath: the relative filepath to the file.
- changes: ${CHANGES_DESCRIPTION}

CRITICAL: The 'changes' parameter must contain the COMPLETE modified code with ALL original comments, docstrings, and documentation preserved. Do not remove or omit any comments from the original file. Include all existing comments in your changes.

Only use this tool if you already know the contents of the file. Otherwise, use the ${BuiltInToolNames.ReadFile} or ${BuiltInToolNames.ReadCurrentlyOpenFile} tool to read it first.
For example:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.ts"],
      [
        "changes",
        "// ... existing code ...\nfunction subtract(a: number, b: number): number {\n  return a - b;\n}\n// ... rest of code ...",
      ],
    ],
  },
};
