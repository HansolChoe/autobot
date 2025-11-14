/**
 * Common prompt definitions used across different configuration files
 */

export const PYTHON_SLASH_COMMAND = {
  name: "python",
  description:
    "Generate Python code using python_code_gen tool (use generated code as-is)",
  prompt: `{{{ input }}}

Please use the python_code_gen tool to generate the Python code. Use the generated code exactly as-is without any modifications.`,
};

export const KAIST_AUTO_DEBUG_SLASH_COMMAND = {
  name: "kaist_auto_debug",
  description: "Generate Patch for given test code and source code",
  prompt: `{{{ input }}}

Use the auto_debug tool to generate a patch based on my request. The auto_debug tool requires the following parameters:
- testCodePath: Test code file path
- sourceCodePath: Source code file path

If paths are not explicitly provided:
1. Check the currently open file using the read_currently_open_file tool
2. If you can infer from the filename or context, ask the user for confirmation
3. Verify that the file actually exists using the read_file or ls tool
4. After confirmation, call the auto_debug tool`,
};

export const AUTO_DEBUG_SLASH_COMMAND = {
  name: "autodebug",
  description:
    "Generate patch for bug fix based on test code and source code (AutoDebug Patch Generation)",
  prompt: `{{{ input }}}

Analyze my request and use the auto_debug tool to generate a patch. The auto_debug tool requires the following parameters:

[Required Parameters]
- test_code_path: Path to the test code file (relative or absolute)
- source_code_path: Path to the source code file that needs to be fixed (relative or absolute)

[Optional Parameters]
- bug_location: Bug location information from AutoFL analysis (e.g., method signature)
- test_failure_info: Test failure information including error messages and stack traces

[Workflow]
1. Extract test_code_path and source_code_path from my input
2. If information is missing:
   - Check the currently open file path (use read_currently_open_file or ls tool)
   - If you can infer from the filename or context, ask me for confirmation
   - Verify that the file actually exists using the read_file or ls tool
3. Once all required information is gathered, call the auto_debug tool

[Important Notes]
- If test_code_path or source_code_path are not explicitly provided, you must confirm with me before calling
- The auto_debug tool analyzes test code and source code to generate a patch with explanation
- The tool returns two context items:
  1. **Markdown display**: Human-readable format with explanation, edit operations preview, and patch visualization
  2. **Structured JSON data**: Contains edit_operations (ready-to-use), patch_diff, explanation, affected_files, source_code_path, test_code_path, display_diff, and validation_errors fields

[Patch Application Workflow - SIMPLIFIED]
After the tool generates the patch, you MUST follow these exact steps:

1. **Parse Structured JSON Data**
   - Find the context item named "패치 데이터 (Structured)"
   - Parse the JSON content to extract the structured data object
   - Extract the edit_operations field (this contains READY-TO-USE edit operations with exact old/new strings)
   - Extract the source_code_path field (this is the file to modify)
   - Extract the explanation field (for user explanation)
   - Extract the validation_errors field (check for any issues)

2. **Check Validation Status**
   - If validation_errors array is NOT empty, report the errors to the user
   - These errors indicate that the generated patch may not apply cleanly
   - Ask the user if they want to proceed or regenerate the patch

3. **Apply Patch Using multiEditTool**
   - Use the multi_edit tool (NOT edit_existing_file tool)
   - Parameters:
     - filepath: Use the source_code_path from structured JSON (relative to workspace root)
     - edits: Use the edit_operations array directly from structured JSON
   - The edit_operations are already formatted correctly with:
     - old_string: Exact string to find (with proper formatting and whitespace)
     - new_string: Exact replacement string (with proper formatting and whitespace)
   - NO NEED to parse unified diff or extract old/new strings manually!

4. **User Communication & Review**
   - First explain the reason for the patch using the explanation field
   - Show the display_diff or patch_diff to the user in a diff code block
   - Show the number of edit operations that will be applied
   - Ask the user to review and confirm before applying
   - Wait for user confirmation (e.g., "apply it", "proceed", "yes")
   - After user confirms, then apply the patch using multiEditTool

[CRITICAL RULES]
- **NEVER use edit_existing_file tool** - it requires the entire file content and can overwrite the whole file
- **ALWAYS use multi_edit tool** - it only modifies the specified parts
- **ALWAYS use edit_operations from structured JSON** - these are already validated and formatted correctly
- **NEVER manually parse the patch_diff** - the edit_operations field is already processed for you
- **ALWAYS check validation_errors** - report any issues to the user before applying
- **Verify file path** - ensure source_code_path is relative to workspace root before using multiEditTool
- **Trust the edit_operations** - they are generated with exact string matching and proper formatting

Use Korean for the response.
`,
};

export const AUTOFL_SLASH_COMMAND = {
  name: "autofl",
  description:
    "Analyze failing tests and locate bugs using autofl tool (AutoFL Bug Localization)",
  prompt: `{{{ input }}}

Analyze my request and use the autofl tool to locate bugs. The autofl tool requires the following parameters:

[Required Parameters]
- repo_path: The project root path where tests should be executed (prefer absolute path)
- test_command: The command to run tests (e.g., "pytest", "npm test", "mvn test", "python -m pytest")

[Optional Parameters]
- language: Programming language ("auto", "java", "python") - default: "auto"
- bug_name: Project/bug identifier - default: "project"
- max_budget: Maximum number of LLM API calls - default: 10

[Workflow]
1. Extract repo_path and test_command from my input
2. If information is missing:
   - Check the currently open file path (use read_currently_open_file or ls tool)
   - Understand the project structure (check package.json, pom.xml, requirements.txt, etc.)
   - Ask me clearly for confirmation before proceeding
3. Once all required information is gathered, call the autofl tool

[Important Notes]
- If repo_path or test_command are not explicitly provided, you must confirm with me before calling
- The autofl tool analyzes failing tests and predicts methods with high probability of containing bugs
- Provide results in a clear manner that addresses my question

Use Korean for the response.
`,
};
