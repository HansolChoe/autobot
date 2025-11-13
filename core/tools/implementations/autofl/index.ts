/**
 * AutoFL (Automated Fault Localization)
 *
 * LLM-based tool for analyzing failing tests and predicting buggy methods.
 *
 * Usage:
 * ```typescript
 * import { analyzeFailures } from './autofl';
 *
 * const result = await analyzeFailures({
 *   bugName: 'my-project',
 *   model: 'gpt-4',
 *   systemPromptPath: './prompts/system.txt',
 *   repoPath: '/path/to/repo',
 *   testCommand: 'pytest',
 *   language: 'python',
 * }, llmClient);
 *
 * console.log(result.topPrediction); // Most likely buggy method
 * console.log(result.predictionsList); // All predictions
 * ```
 */

export { AutoDebugger } from "./debugger";
export { GenericRepositoryInterface } from "./repository";
export * from "./types";

import { AutoDebugger } from "./debugger";
import { AutoFLConfig, AutoFLResult } from "./types";

/**
 * Analyze failing tests and predict buggy methods
 *
 * @param config - AutoFL configuration
 * @param llmClient - LLM client for making API calls
 * @returns Analysis result with predictions
 */
export async function analyzeFailures(
  config: AutoFLConfig,
  llmClient: any,
): Promise<AutoFLResult> {
  const autoDebugger = new AutoDebugger(config, llmClient);
  return await autoDebugger.analyze();
}

/**
 * Quick analysis with default settings
 *
 * @param repoPath - Path to repository
 * @param testCommand - Command to run tests
 * @param llmClient - LLM client
 * @param options - Additional options
 * @returns Analysis result
 */
export async function quickAnalyze(
  repoPath: string,
  testCommand: string,
  llmClient: any,
  options: {
    bugName?: string;
    model?: string;
    language?: "auto" | "java" | "python";
    maxBudget?: number;
  } = {},
): Promise<AutoFLResult> {
  const config: AutoFLConfig = {
    bugName: options.bugName || "project",
    model: options.model || "gpt-4.1",
    systemPromptPath: "", // Will use default
    repoPath,
    testCommand,
    language: options.language || "auto",
    maxBudget: options.maxBudget || 10,
  };

  return analyzeFailures(config, llmClient);
}
