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
