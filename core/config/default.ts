import { ConfigYaml } from "@continuedev/config-yaml";
import { PYTHON_SLASH_COMMAND } from "./prompts";

export const defaultConfig: ConfigYaml = {
  name: "Local Agent",
  version: "1.0.0",
  schema: "v1",
  models: [],
  prompts: [PYTHON_SLASH_COMMAND],
};
