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

export const PYTHON_SLASH_COMMAND_YAML = `  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      Please use the python_code_gen tool to generate the Python code. Use the generated code exactly as-is without any modifications.`;
