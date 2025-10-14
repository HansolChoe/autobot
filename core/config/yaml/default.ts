import { AssistantUnrolled } from "@continuedev/config-yaml";
import { PYTHON_SLASH_COMMAND } from "../prompts";

// TODO
export const defaultConfigYaml: AssistantUnrolled = {
  models: [],
  context: [],
  name: "Local Agent",
  version: "1.0.0",
  schema: "v1",
  prompts: [PYTHON_SLASH_COMMAND],
};

export const defaultConfigYamlJetBrains: AssistantUnrolled = {
  models: [],
  context: [],
  name: "Local Agent",
  version: "1.0.0",
  schema: "v1",
  prompts: [PYTHON_SLASH_COMMAND],
};
