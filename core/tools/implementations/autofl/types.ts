/**
 * AutoFL (Automated Fault Localization) Type Definitions
 */

export interface AutoFLConfig {
  /** Bug/project name identifier */
  bugName: string;
  /** LLM model to use */
  model: string;
  /** Path to system prompt file */
  systemPromptPath: string;
  /** Path to repository root directory */
  repoPath: string;
  /** Command to run tests */
  testCommand: string;
  /** Programming language (auto-detect if not specified) */
  language?: "auto" | "java" | "python";
  /** Optional list of buggy method signatures for evaluation */
  buggyMethods?: string[];
  /** Maximum number of tests to use */
  maxNumTests?: number;
  /** Test offset for selection */
  testOffset?: number;
  /** Maximum number of API calls */
  maxBudget?: number;
  /** Allow multiple method predictions */
  allowMultiPredictions?: boolean;
  /** Summarize messages to reduce token usage */
  summarizeMessages?: boolean;
  /** Show line numbers in code snippets */
  showLineNumber?: boolean;
  /** Post-process test snippets */
  postprocessTestSnippet?: boolean;
  /** Debug mode */
  debug?: boolean;
  /** Progress callback function */
  onProgress?: (message: string) => void;
}

export interface TestFailure {
  /** Test signature/identifier */
  signature: string;
  /** Test code snippet */
  snippet?: string;
  /** Failure information (traceback/stack trace) */
  failInfo?: string;
}

export interface MethodSignature {
  /** Full method signature */
  signature: string;
  /** Class name */
  className?: string;
  /** Method name */
  methodName: string;
  /** Parameter types */
  parameters?: string[];
}

export interface CodeSnippet {
  /** Method signature */
  signature: string;
  /** File path */
  file: string;
  /** Code content */
  code: string;
  /** Start line number */
  startLine: number;
  /** End line number */
  endLine?: number;
  /** Class name if inside a class */
  className?: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string | null;
  function_call?: {
    name: string;
    arguments: string;
  };
  name?: string;
}

export interface InteractionRecord {
  /** List of prompt message IDs */
  promptMessages: string[];
  /** Response message ID */
  responseMessage: string;
}

export interface GradeResult {
  [methodSignature: string]: {
    /** Whether the buggy method was found */
    isFound: boolean;
    /** Matching prediction expressions */
    matchingAnswer: string[];
  };
}

export interface AutoFLResult {
  /** Timestamp */
  time: number;
  /** Whether analysis was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** All LLM messages */
  messages: LLMMessage[];
  /** Interaction records with message map */
  interactionRecords?: {
    stepHistories: InteractionRecord[];
    midToMessage: { [messageId: string]: LLMMessage };
  };
  /** Grade result for buggy methods */
  buggyMethods?: GradeResult;
  /** Raw prediction string */
  predictions?: string;
  /** List of predictions */
  predictionsList: string[];
  /** Number of predictions */
  predictionCount: number;
  /** Top prediction */
  topPrediction?: string;
}

export interface FunctionDescription {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: { [key: string]: any };
    required: string[];
  };
}

export interface RepositoryInterface {
  /** Programming language */
  language: string;
  /** Initial coverage getter function name */
  initialCoverageGetter: string;
  /** Function descriptions for LLM */
  functionDescriptions: FunctionDescription[];
  /** Map of function names to implementations */
  fname2func: { [name: string]: (...args: any[]) => any };
  /** List of failing test signatures */
  failingTestSignatures: string[];
  /** All method signatures in the repository */
  methodSignatures: string[];
  /** Buggy method signatures (for evaluation) */
  buggyMethodSignatures: string[];

  /** Get test code snippet */
  getTestSnippet(signature: string): Promise<string | null>;
  /** Get failure information for a test */
  getFailInfo(signature: string, minimize?: boolean): Promise<string>;
  /** Get matching method signatures for a prediction */
  getMatchingMethodSignatures(predExpr: string): Promise<string[]>;
  /** Get packages covered by failing tests (Python) */
  getCoveredPackages(): Promise<{ [pkg: string]: any }>;
  /** Get classes covered by failing tests (Java) */
  getFailingTestsCoveredClasses(): Promise<{ [cls: string]: any }>;
  /** Get methods for a class (Java) */
  getFailingTestsCoveredMethodsForClass(className: string): Promise<string[]>;
  /** Get code snippet for a method */
  getCodeSnippet(signature: string): Promise<CodeSnippet | null>;
  /** Get comments for a method */
  getComments(signature: string): Promise<string | null>;
}
