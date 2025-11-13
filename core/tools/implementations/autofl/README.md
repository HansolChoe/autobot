# AutoFL (Automated Fault Localization)

LLM-based tool for analyzing failing tests and automatically predicting buggy method locations.

## Overview

AutoFL uses Large Language Models (LLMs) to systematically analyze failing tests, collect relevant code information, and predict which methods are most likely to contain bugs. It combines:

- **Automated test execution and failure collection**
- **LLM-powered code analysis**
- **Systematic information gathering via function calling**
- **Ranked predictions of buggy method locations**

## Architecture

```
┌─────────────────────────────────────────┐
│         AutoFL Architecture             │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐    │
│  │       AutoDebugger              │    │
│  │  - Main analysis orchestrator   │    │
│  │  - LLM interaction management   │    │
│  │  - Result aggregation           │    │
│  └────────────┬───────────────────┘    │
│               │                         │
│  ┌────────────▼───────────────────┐    │
│  │  GenericRepositoryInterface    │    │
│  │  - Test execution               │    │
│  │  - Code extraction              │    │
│  │  - Method signature matching    │    │
│  └────────────┬───────────────────┘    │
│               │                         │
│  ┌────────────▼───────────────────┐    │
│  │        Repository              │    │
│  │  - Java/Python codebase        │    │
│  │  - Test suites                  │    │
│  └────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Usage

### As a Tool (for agents)

```typescript
import { analyzeFailures } from './core/tools/implementations/autofl';

const result = await analyzeFailures(
  {
    bugName: 'my-project',
    model: 'gpt-4',
    systemPromptPath: './prompts/system.txt',
    repoPath: '/path/to/repository',
    testCommand: 'pytest',
    language: 'python', // or 'java' or 'auto'
    maxBudget: 10, // max LLM calls
  },
  llmClient
);

console.log('Top prediction:', result.topPrediction);
console.log('All predictions:', result.predictionsList);
console.log('Success:', result.success);
```

### Quick Analysis

```typescript
import { quickAnalyze } from './core/tools/implementations/autofl';

const result = await quickAnalyze(
  '/path/to/repository',
  'pytest',
  llmClient,
  {
    bugName: 'my-project',
    model: 'gpt-4',
    language: 'python',
    maxBudget: 10,
  }
);
```

## Configuration

### AutoFLConfig

```typescript
interface AutoFLConfig {
  // Required
  bugName: string;           // Project identifier
  model: string;             // LLM model (e.g., 'gpt-4')
  systemPromptPath: string;  // Path to system prompt (empty for default)
  repoPath: string;          // Repository root path
  testCommand: string;       // Test command (e.g., 'pytest', 'mvn test')

  // Optional
  language?: 'auto' | 'java' | 'python';  // Default: 'auto'
  buggyMethods?: string[];                // For evaluation
  maxNumTests?: number;                   // Limit tests to analyze
  testOffset?: number;                    // Start offset for test selection
  maxBudget?: number;                     // Max LLM calls (default: 10)
  allowMultiPredictions?: boolean;        // Allow multiple predictions
  summarizeMessages?: boolean;            // Reduce token usage
  showLineNumber?: boolean;               // Show line numbers
  postprocessTestSnippet?: boolean;       // Post-process snippets
  debug?: boolean;                        // Debug mode
}
```

## Result Format

```typescript
interface AutoFLResult {
  time: number;              // Analysis timestamp
  success: boolean;          // Whether analysis succeeded
  error?: string;            // Error message if failed
  messages: LLMMessage[];    // All LLM interactions

  // Predictions
  predictions?: string;      // Raw prediction text
  predictionsList: string[]; // List of predictions
  predictionCount: number;   // Number of predictions
  topPrediction?: string;    // Most likely buggy method

  // Evaluation (if buggyMethods provided)
  buggyMethods?: {
    [signature: string]: {
      isFound: boolean;
      matchingAnswer: string[];
    };
  };

  // Interaction details
  interactionRecords?: {
    stepHistories: InteractionRecord[];
    midToMessage: { [id: string]: LLMMessage };
  };
}
```

## Supported Languages

### Python
- **Test Frameworks**: pytest, unittest
- **Detection**: Auto-detects `.py` files
- **Functions**:
  - `get_covered_packages()`: Get packages used by failing tests
  - `get_code_snippet(signature)`: Get method code
  - `get_comments(signature)`: Get method comments

### Java
- **Test Frameworks**: JUnit, Maven
- **Detection**: Auto-detects `.java` files
- **Functions**:
  - `get_failing_tests_covered_classes()`: Get classes covered by tests
  - `get_failing_tests_covered_methods_for_class(class_name)`: Get methods
  - `get_code_snippet(signature)`: Get method code
  - `get_comments(signature)`: Get method comments

## How It Works

1. **Test Execution**: Runs tests and collects failures
   - Captures test signatures
   - Extracts error messages and stack traces
   - Identifies affected code

2. **Initial Context**: Provides LLM with:
   - Failing test code
   - Error messages and stack traces
   - Initial coverage information

3. **Iterative Analysis**: LLM systematically:
   - Calls functions to gather code information
   - Examines method implementations
   - Analyzes class structures
   - Reviews related code

4. **Prediction**: LLM predicts:
   - Most likely buggy methods
   - Ranked by confidence
   - Format: `ClassName.methodName(ArgType1, ArgType2, ...)`

5. **Evaluation**: Compares predictions with known bugs (if provided)

## Examples

### Example 1: Python Project with pytest

```typescript
const result = await analyzeFailures({
  bugName: 'user-service',
  model: 'gpt-4',
  systemPromptPath: '',
  repoPath: '/projects/user-service',
  testCommand: 'pytest tests/',
  language: 'python',
  maxBudget: 15,
}, llmClient);

if (result.success) {
  console.log(`Found ${result.predictionCount} potential bugs:`);
  result.predictionsList.forEach((pred, idx) => {
    console.log(`${idx + 1}. ${pred}`);
  });
}
```

### Example 2: Java Project with Maven

```typescript
const result = await analyzeFailures({
  bugName: 'order-processor',
  model: 'gpt-4',
  systemPromptPath: '',
  repoPath: '/projects/order-processor',
  testCommand: 'mvn test',
  language: 'java',
  buggyMethods: ['OrderService.processOrder(Order)'], // For evaluation
  maxBudget: 12,
}, llmClient);

if (result.buggyMethods) {
  for (const [method, grade] of Object.entries(result.buggyMethods)) {
    console.log(`${method}: ${grade.isFound ? '✅ Found' : '❌ Missed'}`);
  }
}
```

## Integration with Continue

AutoFL is integrated as a built-in tool in Continue. Agents can use it automatically:

```typescript
// The tool is available to agents as 'autofl'
// Agents can call it when they need to locate bugs in failing tests

// Example agent usage:
"I found failing tests. Let me use AutoFL to locate the bug..."
// Agent calls autofl tool with repo_path and test_command
// Receives ranked list of buggy methods
"Based on AutoFL analysis, the bug is likely in ClassName.methodName()..."
```

## Performance Considerations

- **Token Usage**: Moderate to high (depends on codebase size)
- **API Calls**: Configurable via `maxBudget` (default: 10)
- **Execution Time**: Depends on test execution and LLM response times
- **Accuracy**: Varies based on:
  - Code complexity
  - Test quality
  - Error message clarity
  - LLM model capabilities

## Limitations

1. **Test Dependency**: Requires runnable tests
2. **Language Support**: Currently Python and Java only
3. **Parsing Simplicity**: Uses regex-based parsing (not full AST)
4. **LLM Dependency**: Quality depends on LLM understanding
5. **No Multi-file Bugs**: Focuses on method-level localization

## Future Improvements

- [ ] Support for more languages (JavaScript, Go, Rust)
- [ ] Full AST-based parsing
- [ ] Multi-file bug detection
- [ ] Integration with code coverage tools
- [ ] Caching for repeated analysis
- [ ] Parallel analysis of multiple bugs
- [ ] Support for more test frameworks

## References

Based on the AutoFL research from the original Python implementation in [autofl_python](../../../../autofl_python/).

## License

Same as Continue project.
