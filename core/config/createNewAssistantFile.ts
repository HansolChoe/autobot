import * as YAML from "yaml";
import { IDE } from "..";
import { joinPathsToUri } from "../util/uri";
import { AUTOFL_SLASH_COMMAND, PYTHON_SLASH_COMMAND } from "./prompts";

/**
 * Indents a multi-line string by adding the specified indentation to each line
 */
function indentString(str: string, indent: string): string {
  return str
    .split("\n")
    .map((line) => (line.trim() === "" ? line : `${indent}${line}`))
    .join("\n");
}

const DEFAULT_ASSISTANT_FILE = `# This is an example agent configuration file
# It is used to define custom AI agents within Continue
# Each agent file can be accessed by selecting it from the agent dropdown

# To learn more, see the full config.yaml reference: https://docs.continue.dev/reference

name: Example Agent
version: 1.0.0
schema: v1

# Models define which AI models this agent can use
# https://docs.continue.dev/customization/models
models:
  - name: openai
    provider: openai
    model: gpt-4.1
    apiKey: YOUR_OPENAI_API_KEY_HERE

# MCP Servers the agent can use
# https://docs.continue.dev/customization/mcp-tools
mcpServers:
  - uses: anthropic/memory-mcp

# Slash commands for this agent
# https://docs.continue.dev/customization/slash-commands
prompts:
${indentString(
  YAML.stringify([PYTHON_SLASH_COMMAND, AUTOFL_SLASH_COMMAND]),
  "  ",
)}
`;

export async function createNewAssistantFile(
  ide: IDE,
  assistantPath: string | undefined,
): Promise<void> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error(
      "No workspace directories found. Make sure you've opened a folder in your IDE.",
    );
  }

  const baseDirUri = joinPathsToUri(
    workspaceDirs[0],
    assistantPath ?? ".continue/agents",
  );

  // Find the first available filename
  let counter = 0;
  let assistantFileUri: string;
  do {
    const suffix = counter === 0 ? "" : `-${counter}`;
    assistantFileUri = joinPathsToUri(baseDirUri, `new-agent${suffix}.yaml`);
    counter++;
  } while (await ide.fileExists(assistantFileUri));

  await ide.writeFile(assistantFileUri, DEFAULT_ASSISTANT_FILE);
  await ide.openFile(assistantFileUri);
}
