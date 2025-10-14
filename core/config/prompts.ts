/**
 * Common prompt definitions used across different configuration files
 */

export const PYTHON_SLASH_COMMAND = {
  name: "python",
  description: "Generate Python code using python_code_gen tool (use generated code as-is)",
  prompt: `{{{ input }}}

For Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.`
};

export const PYTHON_SLASH_COMMAND_YAML = `  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      For Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.`;
