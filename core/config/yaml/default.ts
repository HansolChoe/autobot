import { AssistantUnrolled } from "@continuedev/config-yaml";
import {
  AUTOFL_SLASH_COMMAND,
  AUTO_DEBUG_SLASH_COMMAND,
  PYTHON_SLASH_COMMAND,
} from "../prompts";

export const defaultConfigYaml: AssistantUnrolled = {
  models: [],
  context: [],
  name: "Local Agent",
  version: "1.0.0",
  schema: "v1",
  prompts: [
    PYTHON_SLASH_COMMAND,
    AUTOFL_SLASH_COMMAND,
    AUTO_DEBUG_SLASH_COMMAND,
  ],
};
