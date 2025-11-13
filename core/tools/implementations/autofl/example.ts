/**
 * Example usage of AutoFL
 *
 * This file demonstrates how to use the AutoFL tool to analyze failing tests
 * and automatically locate bugs in your codebase.
 */

import { analyzeFailures, quickAnalyze, AutoFLConfig } from './index';

// Example 1: Full configuration
async function exampleFullAnalysis(llmClient: any) {
  const config: AutoFLConfig = {
    bugName: 'my-project',
    model: 'gpt-4',
    systemPromptPath: '', // Empty string uses default prompt
    repoPath: '/path/to/your/repository',
    testCommand: 'pytest tests/',
    language: 'python',
    maxBudget: 10, // Maximum 10 LLM API calls
    allowMultiPredictions: true, // Allow multiple buggy method predictions
    summarizeMessages: false, // Don't summarize messages (use more tokens but more accurate)
    debug: false,
  };

  console.log('Starting AutoFL analysis...');
  const result = await analyzeFailures(config, llmClient);

  if (result.success) {
    console.log('\n✅ Analysis completed successfully!\n');

    console.log('Top Prediction:');
    console.log(`  ${result.topPrediction}\n`);

    if (result.predictionsList.length > 1) {
      console.log(`All Predictions (${result.predictionCount}):`);
      result.predictionsList.forEach((pred, idx) => {
        console.log(`  ${idx + 1}. ${pred}`);
      });
      console.log();
    }

    console.log('Analysis Details:');
    console.log(`  - Total interactions: ${result.interactionRecords?.stepHistories.length || 0}`);
    console.log(`  - Timestamp: ${new Date(result.time).toISOString()}`);

    return result;
  } else {
    console.error('❌ Analysis failed:');
    console.error(result.error);
    return null;
  }
}

// Example 2: Quick analysis (minimal configuration)
async function exampleQuickAnalysis(llmClient: any) {
  console.log('Starting quick AutoFL analysis...');

  const result = await quickAnalyze(
    '/path/to/your/repository',
    'pytest tests/',
    llmClient,
    {
      bugName: 'quick-test',
      model: 'gpt-4',
      language: 'python',
      maxBudget: 8,
    }
  );

  if (result.success) {
    console.log('\n✅ Quick analysis completed!\n');
    console.log('Top Prediction:', result.topPrediction);
    return result;
  } else {
    console.error('❌ Quick analysis failed:', result.error);
    return null;
  }
}

// Example 3: Analysis with evaluation
async function exampleWithEvaluation(llmClient: any) {
  const config: AutoFLConfig = {
    bugName: 'evaluated-project',
    model: 'gpt-4',
    systemPromptPath: '',
    repoPath: '/path/to/your/repository',
    testCommand: 'pytest tests/',
    language: 'python',

    // Provide known buggy methods for evaluation
    buggyMethods: [
      'UserService.authenticate(username, password)',
      'PaymentProcessor.processPayment(amount, currency)',
    ],

    maxBudget: 15,
    allowMultiPredictions: true,
  };

  console.log('Starting AutoFL analysis with evaluation...');
  const result = await analyzeFailures(config, llmClient);

  if (result.success && result.buggyMethods) {
    console.log('\n✅ Analysis with evaluation completed!\n');

    console.log('Predictions:');
    result.predictionsList.forEach((pred, idx) => {
      console.log(`  ${idx + 1}. ${pred}`);
    });
    console.log();

    console.log('Evaluation Results:');
    for (const [method, grade] of Object.entries(result.buggyMethods)) {
      const status = grade.isFound ? '✅ Found' : '❌ Not found';
      console.log(`  ${status}: ${method}`);
      if (grade.matchingAnswer.length > 0) {
        console.log(`    Matched by: ${grade.matchingAnswer.join(', ')}`);
      }
    }

    // Calculate accuracy
    const totalBuggy = Object.keys(result.buggyMethods).length;
    const foundBuggy = Object.values(result.buggyMethods).filter(g => g.isFound).length;
    const accuracy = (foundBuggy / totalBuggy) * 100;
    console.log(`\nAccuracy: ${accuracy.toFixed(1)}% (${foundBuggy}/${totalBuggy})`);

    return result;
  } else {
    console.error('❌ Analysis failed:', result.error);
    return null;
  }
}

// Example 4: Java project analysis
async function exampleJavaProject(llmClient: any) {
  const config: AutoFLConfig = {
    bugName: 'java-service',
    model: 'gpt-4',
    systemPromptPath: '',
    repoPath: '/path/to/java/project',
    testCommand: 'mvn test',
    language: 'java', // Explicitly specify Java
    maxBudget: 12,
    allowMultiPredictions: true,
  };

  console.log('Starting Java project analysis...');
  const result = await analyzeFailures(config, llmClient);

  if (result.success) {
    console.log('\n✅ Java project analysis completed!\n');
    console.log('Top buggy method:', result.topPrediction);

    console.log('\nAll predictions:');
    result.predictionsList.forEach((pred, idx) => {
      console.log(`  ${idx + 1}. ${pred}`);
    });

    return result;
  } else {
    console.error('❌ Java analysis failed:', result.error);
    return null;
  }
}

// Example 5: Auto-detect language
async function exampleAutoDetect(llmClient: any) {
  const config: AutoFLConfig = {
    bugName: 'auto-detect-project',
    model: 'gpt-4',
    systemPromptPath: '',
    repoPath: '/path/to/repository',
    testCommand: 'npm test', // or 'pytest', 'mvn test', etc.
    language: 'auto', // Auto-detect from files
    maxBudget: 10,
  };

  console.log('Starting analysis with auto-detection...');
  const result = await analyzeFailures(config, llmClient);

  if (result.success) {
    console.log('\n✅ Analysis completed!\n');
    console.log('Detected language and analyzed successfully');
    console.log('Top Prediction:', result.topPrediction);
    return result;
  } else {
    console.error('❌ Analysis failed:', result.error);
    return null;
  }
}

// Example 6: Token-efficient analysis
async function exampleTokenEfficient(llmClient: any) {
  const config: AutoFLConfig = {
    bugName: 'token-efficient',
    model: 'gpt-4',
    systemPromptPath: '',
    repoPath: '/path/to/repository',
    testCommand: 'pytest tests/',
    language: 'python',
    maxBudget: 6, // Fewer API calls
    allowMultiPredictions: false, // Single prediction only
    summarizeMessages: true, // Summarize to save tokens
    maxNumTests: 3, // Limit number of tests analyzed
  };

  console.log('Starting token-efficient analysis...');
  const result = await analyzeFailures(config, llmClient);

  if (result.success) {
    console.log('\n✅ Token-efficient analysis completed!\n');
    console.log('Single Prediction:', result.topPrediction);
    console.log('API calls made:', result.interactionRecords?.stepHistories.length || 0);
    return result;
  } else {
    console.error('❌ Analysis failed:', result.error);
    return null;
  }
}

// Export examples for use in tests or documentation
export {
  exampleFullAnalysis,
  exampleQuickAnalysis,
  exampleWithEvaluation,
  exampleJavaProject,
  exampleAutoDetect,
  exampleTokenEfficient,
};

// Example main function (for standalone execution)
async function main() {
  // Mock LLM client for demonstration
  // In real usage, this would be the actual LLM client from Continue
  const mockLlmClient = {
    model: 'gpt-4',
    async complete(params: any) {
      // This is a mock - real implementation would call actual LLM API
      console.log('LLM called with:', JSON.stringify(params, null, 2));
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: 'MockClass.mockMethod(String, int)',
            function_call: undefined,
          }
        }]
      };
    }
  };

  // Run examples (uncomment to test)
  // await exampleQuickAnalysis(mockLlmClient);
  // await exampleFullAnalysis(mockLlmClient);
  // await exampleWithEvaluation(mockLlmClient);
  // await exampleJavaProject(mockLlmClient);
  // await exampleAutoDetect(mockLlmClient);
  // await exampleTokenEfficient(mockLlmClient);
}

// Uncomment to run examples
// main().catch(console.error);
