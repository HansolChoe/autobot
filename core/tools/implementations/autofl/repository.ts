import * as fs from "fs";
import * as path from "path";
import { CodeSnippet, FunctionDescription, RepositoryInterface } from "./types";

const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

/**
 * Generic Repository Interface for AutoFL
 * Works with any repository by accepting repository path and test command
 */
export class GenericRepositoryInterface implements RepositoryInterface {
  public language: string;
  public initialCoverageGetter: string;
  public functionDescriptions: FunctionDescription[];
  public fname2func: { [name: string]: (...args: any[]) => any };
  public failingTestSignatures: string[] = [];
  public methodSignatures: string[] = [];
  public buggyMethodSignatures: string[];

  private repoPath: string;
  private testCommand: string;
  private testSnippets: Map<string, string> = new Map();
  private failInfo: Map<string, string> = new Map();
  private codeSnippets: Map<string, CodeSnippet> = new Map();

  constructor(
    bugName: string,
    repoPath: string,
    testCommand: string,
    language: string = "auto",
    buggyMethods: string[] = [],
  ) {
    this.repoPath = path.resolve(repoPath);
    this.testCommand = testCommand;
    this.buggyMethodSignatures = buggyMethods;

    // Auto-detect language
    if (language === "auto") {
      language = this.detectLanguage();
    }
    this.language = language;

    // Set up function descriptions based on language
    if (this.language === "java") {
      this.functionDescriptions = this.getJavaFunctionDescriptions();
      this.initialCoverageGetter = "get_failing_tests_covered_classes";
    } else if (this.language === "python") {
      this.functionDescriptions = this.getPythonFunctionDescriptions();
      this.initialCoverageGetter = "get_covered_packages";
    } else {
      throw new Error(`Unsupported language: ${this.language}`);
    }

    // Map function names to methods
    this.fname2func = {};
    for (const func of this.functionDescriptions) {
      const methodName = this.toCamelCase(func.name);
      if (methodName in this) {
        this.fname2func[func.name] = (this as any)[methodName].bind(this);
      }
    }
  }

  /**
   * Initialize by running tests and collecting failures
   */
  async initialize(): Promise<void> {
    await this.runTests();
    await this.extractAllMethodSignatures();
  }

  /**
   * Detect programming language from repository
   */
  private detectLanguage(): string {
    // Check for Java files
    const javaFiles = this.findFiles("**/*.java", 10);
    if (javaFiles.length > 0) {
      return "java";
    }

    // Check for Python files
    const pythonFiles = this.findFiles("**/*.py", 10);
    if (pythonFiles.length > 0) {
      return "python";
    }

    throw new Error(
      "Could not auto-detect language. Please specify language explicitly.",
    );
  }

  /**
   * Run tests and collect failing test information
   */
  private async runTests(): Promise<void> {
    try {
      // Use shell: true to use system default shell (cmd.exe on Windows, sh on Unix)
      // This avoids ENOENT errors by letting Node.js find the shell automatically
      const execOptions: any = {
        cwd: this.repoPath,
        timeout: 300000, // 5 minutes
        shell: true, // Use system default shell (works on all platforms)
      };

      const { stdout, stderr } = await asyncExec(this.testCommand, execOptions);

      await this.parseTestOutput(stdout, stderr, 0);
    } catch (error: any) {
      // Test command may return non-zero exit code when tests fail
      if (error.stdout || error.stderr) {
        await this.parseTestOutput(
          error.stdout || "",
          error.stderr || "",
          error.code || 1,
        );
      } else {
        throw new Error(`Failed to run tests: ${error.message}`);
      }
    }
  }

  /**
   * Parse test output to extract failing test information
   */
  private async parseTestOutput(
    stdout: string,
    stderr: string,
    returnCode: number,
  ): Promise<void> {
    const output = stdout + "\n" + stderr;

    if (this.language === "python") {
      this.parsePythonTestOutput(output);
    } else if (this.language === "java") {
      this.parseJavaTestOutput(output);
    }
  }

  /**
   * Parse Python test output (pytest/unittest/plain assert)
   */
  private parsePythonTestOutput(output: string): void {
    console.log("[AutoFL] Parsing Python test output:");
    console.log("[AutoFL] Output length:", output.length);
    console.log("[AutoFL] Output preview:", output.substring(0, 500));

    // Look for pytest-style failures: FAILED path/to/test.py::TestClass::test_method
    const pytestPattern = /FAILED\s+([^\s]+::[^\s]+)/g;
    let match;
    while ((match = pytestPattern.exec(output)) !== null) {
      console.log("[AutoFL] Found pytest failure:", match[1]);
      this.failingTestSignatures.push(match[1]);
    }

    // Look for unittest-style failures
    const unittestErrorPattern = /ERROR:\s+\w+\s+\(([^)]+)\)/g;
    while ((match = unittestErrorPattern.exec(output)) !== null) {
      console.log("[AutoFL] Found unittest error:", match[1]);
      this.failingTestSignatures.push(match[1]);
    }

    // Look for plain AssertionError in simple Python scripts
    // If we have AssertionError but no test signatures yet, treat the whole file as a failing test
    if (
      this.failingTestSignatures.length === 0 &&
      output.includes("AssertionError")
    ) {
      console.log(
        "[AutoFL] Found AssertionError, treating as simple script failure",
      );
      // Extract file path from traceback
      const filePattern = /File "([^"]+)", line (\d+)/;
      const fileMatch = filePattern.exec(output);
      if (fileMatch) {
        const filePath = fileMatch[1];
        const fileName = path.basename(filePath);
        this.failingTestSignatures.push(fileName);
        console.log("[AutoFL] Added failing test:", fileName);
      }
    }

    console.log(
      "[AutoFL] Total failing test signatures:",
      this.failingTestSignatures.length,
    );

    // Extract traceback information
    this.extractPythonTracebacks(output);
  }

  /**
   * Parse Java test output (JUnit/Maven)
   */
  private parseJavaTestOutput(output: string): void {
    // Look for test failures
    const testPattern = /(\w+Test(?:Case)?)\.(\w+)/g;
    let match;
    while ((match = testPattern.exec(output)) !== null) {
      const testSig = `${match[1]}.${match[2]}`;
      if (!this.failingTestSignatures.includes(testSig)) {
        this.failingTestSignatures.push(testSig);
      }
    }

    // Extract stack traces
    this.extractJavaStackTraces(output);
  }

  /**
   * Extract Python traceback information
   */
  private extractPythonTracebacks(output: string): void {
    for (const testSig of this.failingTestSignatures) {
      // Try to find traceback for this test
      const escapedSig = testSig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(${escapedSig}[\\s\\S]*?)(?=\\n\\w|$)`);
      const match = pattern.exec(output);
      if (match) {
        this.failInfo.set(testSig, match[1]);
      } else {
        this.failInfo.set(testSig, "Test failed (traceback not found)");
      }
    }
  }

  /**
   * Extract Java stack trace information
   */
  private extractJavaStackTraces(output: string): void {
    for (const testSig of this.failingTestSignatures) {
      // Try to find stack trace for this test
      const escapedSig = testSig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(${escapedSig}[\\s\\S]*?)(?=\\n\\w|$)`);
      const match = pattern.exec(output);
      if (match) {
        this.failInfo.set(testSig, match[1]);
      } else {
        this.failInfo.set(testSig, "Test failed (stack trace not found)");
      }
    }
  }

  /**
   * Get test code snippet for a test signature
   */
  async getTestSnippet(signature: string): Promise<string | null> {
    if (this.testSnippets.has(signature)) {
      return this.testSnippets.get(signature)!;
    }

    const snippet = await this.findTestCode(signature);
    if (snippet) {
      this.testSnippets.set(signature, snippet);
    }
    return snippet;
  }

  /**
   * Find test code in repository
   */
  private async findTestCode(signature: string): Promise<string | null> {
    if (this.language === "python") {
      // Format: test_file.py::TestClass::test_method
      const parts = signature.split("::");
      if (parts.length >= 2) {
        const testFile = parts[0];
        const testName = parts[parts.length - 1];

        // Find test file
        const testPath = this.findFile(testFile);
        if (!testPath) return null;

        // Read and extract test method
        try {
          const content = await fs.promises.readFile(testPath, "utf-8");
          // Simple extraction - find function/method definition
          const pattern = new RegExp(
            `((?:async )?def ${testName}\\([^)]*\\):[\\s\\S]*?)(?=\\n(?:def |class |$))`,
          );
          const match = pattern.exec(content);
          return match ? match[1].trim() : null;
        } catch (error) {
          return null;
        }
      }
    } else if (this.language === "java") {
      // Format: TestClass.testMethod
      const parts = signature.split(".");
      if (parts.length >= 2) {
        const className = parts[0];
        const methodName = parts[1];

        // Find test file
        const testPath = this.findFile(`${className}.java`);
        if (!testPath) return null;

        // Read and extract test method
        try {
          const content = await fs.promises.readFile(testPath, "utf-8");
          const pattern = new RegExp(
            `(@Test\\s+)?(public\\s+)?void\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`,
            "s",
          );
          const match = pattern.exec(content);
          return match ? match[0] : null;
        } catch (error) {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Get failure information for a test
   */
  async getFailInfo(signature: string, minimize = true): Promise<string> {
    return this.failInfo.get(signature) || "Test failed";
  }

  /**
   * Get matching method signatures for a prediction expression
   */
  async getMatchingMethodSignatures(predExpr: string): Promise<string[]> {
    const matches: string[] = [];
    const predMethodName = this.getMethodName(predExpr, true);

    for (const sig of this.methodSignatures) {
      const sigMethodName = this.getMethodName(sig, true);
      if (predMethodName.toLowerCase() === sigMethodName.toLowerCase()) {
        matches.push(sig);
      }
    }

    return matches;
  }

  /**
   * Extract all method signatures from repository
   */
  private async extractAllMethodSignatures(): Promise<void> {
    if (this.language === "python") {
      await this.extractPythonMethods();
    } else if (this.language === "java") {
      await this.extractJavaMethods();
    }
  }

  /**
   * Extract method signatures from Python files
   */
  private async extractPythonMethods(): Promise<void> {
    const pyFiles = this.findFiles("**/*.py");

    for (const file of pyFiles) {
      // Skip test files
      if (file.includes("test") || file.includes("__pycache__")) continue;

      try {
        const content = await fs.promises.readFile(file, "utf-8");
        // Simple pattern matching - find def statements
        const defPattern = /(?:async )?def\s+(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = defPattern.exec(content)) !== null) {
          const methodName = match[1];
          const params = match[2].split(",").map((p) => p.trim().split(":")[0]);
          this.methodSignatures.push(`${methodName}(${params.join(", ")})`);
        }
      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Extract method signatures from Java files
   */
  private async extractJavaMethods(): Promise<void> {
    const javaFiles = this.findFiles("**/*.java");

    for (const file of javaFiles) {
      // Skip test files
      if (file.includes("test") || file.includes("Test")) continue;

      try {
        const content = await fs.promises.readFile(file, "utf-8");
        // Simple pattern matching - find method declarations
        const methodPattern =
          /(public|private|protected)?\s+(?:static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = methodPattern.exec(content)) !== null) {
          const methodName = match[3];
          const params = match[4]
            .split(",")
            .map((p) => {
              const parts = p.trim().split(/\s+/);
              return parts.length > 0 ? parts[0] : "";
            })
            .filter((p) => p);
          this.methodSignatures.push(`${methodName}(${params.join(", ")})`);
        }
      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Get packages covered by failing tests (Python)
   */
  async getCoveredPackages(): Promise<{ [pkg: string]: any }> {
    if (this.language !== "python") return {};

    const packages = new Set<string>();
    for (const testSig of this.failingTestSignatures) {
      const testCode = await this.getTestSnippet(testSig);
      if (testCode) {
        // Extract imports
        const importPattern = /(?:from\s+(\S+)|import\s+(\S+))/g;
        let match;
        while ((match = importPattern.exec(testCode)) !== null) {
          const pkg = (match[1] || match[2]).split(".")[0];
          packages.add(pkg);
        }
      }
    }

    return Object.fromEntries([...packages].map((pkg) => [pkg, {}]));
  }

  /**
   * Get classes covered by failing tests (Java)
   */
  async getFailingTestsCoveredClasses(): Promise<{ [cls: string]: any }> {
    if (this.language !== "java") return {};

    const classes = new Set<string>();
    for (const testSig of this.failingTestSignatures) {
      const parts = testSig.split(".");
      if (parts.length >= 1) {
        classes.add(parts[0]);
      }
    }

    return Object.fromEntries([...classes].map((cls) => [cls, {}]));
  }

  /**
   * Get methods covered by failing tests for a class (Java)
   */
  async getFailingTestsCoveredMethodsForClass(
    className: string,
  ): Promise<string[]> {
    if (this.language !== "java") return [];

    return this.methodSignatures.filter((sig) =>
      sig.startsWith(`${className}.`),
    );
  }

  /**
   * Get code snippet for a method signature
   */
  async getCodeSnippet(signature: string): Promise<CodeSnippet | null> {
    if (this.codeSnippets.has(signature)) {
      return this.codeSnippets.get(signature)!;
    }

    const snippet = await this.findMethodCode(signature);
    if (snippet) {
      this.codeSnippets.set(signature, snippet);
    }
    return snippet;
  }

  /**
   * Find method code in repository
   */
  private async findMethodCode(signature: string): Promise<CodeSnippet | null> {
    const methodName = this.getMethodName(signature, true);

    const files =
      this.language === "python"
        ? this.findFiles("**/*.py")
        : this.findFiles("**/*.java");

    for (const file of files) {
      // Skip test files
      if (file.includes("test") || file.includes("Test")) continue;

      try {
        const content = await fs.promises.readFile(file, "utf-8");
        const lines = content.split("\n");

        // Simple search for method name
        let pattern: RegExp;
        if (this.language === "python") {
          pattern = new RegExp(`def\\s+${methodName}\\s*\\(`);
        } else {
          pattern = new RegExp(`\\s+${methodName}\\s*\\(`);
        }

        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            // Found method, extract code
            const startLine = i;
            let endLine = i;

            // Find end of method (simplified)
            if (this.language === "python") {
              // Find next def or class
              for (let j = i + 1; j < lines.length; j++) {
                if (/^(def |class |$)/.test(lines[j])) {
                  endLine = j - 1;
                  break;
                }
                endLine = j;
              }
            } else {
              // Find matching brace for Java
              let braceCount = 0;
              let inMethod = false;
              for (let j = i; j < lines.length; j++) {
                for (const char of lines[j]) {
                  if (char === "{") {
                    braceCount++;
                    inMethod = true;
                  } else if (char === "}") {
                    braceCount--;
                    if (inMethod && braceCount === 0) {
                      endLine = j;
                      break;
                    }
                  }
                }
                if (inMethod && braceCount === 0) break;
              }
            }

            const code = lines.slice(startLine, endLine + 1).join("\n");

            return {
              signature,
              file,
              code,
              startLine: startLine + 1,
              endLine: endLine + 1,
            };
          }
        }
      } catch (error) {
        continue;
      }
    }

    return {
      signature,
      file: "",
      code: `// Method ${signature} code not found`,
      startLine: 0,
    };
  }

  /**
   * Get comments for a method
   */
  async getComments(signature: string): Promise<string | null> {
    // Placeholder implementation
    return null;
  }

  // Utility methods

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Get method name from signature
   */
  private getMethodName(signature: string, simpleName = false): string {
    // Extract method name from signature like "ClassName.methodName(args)"
    const match = /(?:(\w+)\.)?(\w+)\(/.exec(signature);
    if (match) {
      return simpleName ? match[2] : match[0];
    }
    return signature;
  }

  /**
   * Find files matching a pattern
   */
  private findFiles(pattern: string, limit?: number): string[] {
    const files: string[] = [];
    const glob = pattern.replace("**", "");
    const ext = path.extname(glob);

    const walk = (dir: string) => {
      if (limit && files.length >= limit) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (limit && files.length >= limit) break;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // Skip common non-source directories
            if (
              [
                "node_modules",
                ".git",
                "__pycache__",
                "venv",
                "target",
              ].includes(entry.name)
            ) {
              continue;
            }
            walk(fullPath);
          } else if (entry.isFile() && fullPath.endsWith(ext)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(this.repoPath);
    return files;
  }

  /**
   * Find a specific file
   */
  private findFile(filename: string): string | null {
    const walk = (dir: string): string | null => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (
              [
                "node_modules",
                ".git",
                "__pycache__",
                "venv",
                "target",
              ].includes(entry.name)
            ) {
              continue;
            }
            const result = walk(fullPath);
            if (result) return result;
          } else if (entry.isFile() && entry.name === filename) {
            return fullPath;
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
      return null;
    };

    return walk(this.repoPath);
  }

  /**
   * Get Java function descriptions
   */
  private getJavaFunctionDescriptions(): FunctionDescription[] {
    return [
      {
        name: "get_failing_tests_covered_classes",
        description: "Get classes covered by failing tests",
        parameters: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_failing_tests_covered_methods_for_class",
        description: "Get methods covered by failing tests for a class",
        parameters: {
          type: "object",
          properties: {
            class_name: { type: "string", description: "Class name" },
          },
          required: ["class_name"],
        },
      },
      {
        name: "get_code_snippet",
        description: "Get code snippet for a method",
        parameters: {
          type: "object",
          properties: {
            signature: { type: "string", description: "Method signature" },
          },
          required: ["signature"],
        },
      },
      {
        name: "get_comments",
        description: "Get comments for a method",
        parameters: {
          type: "object",
          properties: {
            signature: { type: "string", description: "Method signature" },
          },
          required: ["signature"],
        },
      },
    ];
  }

  /**
   * Get Python function descriptions
   */
  private getPythonFunctionDescriptions(): FunctionDescription[] {
    return [
      {
        name: "get_covered_packages",
        description: "Get packages covered by failing tests",
        parameters: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_code_snippet",
        description: "Get code snippet for a method",
        parameters: {
          type: "object",
          properties: {
            signature: { type: "string", description: "Method signature" },
          },
          required: ["signature"],
        },
      },
      {
        name: "get_comments",
        description: "Get comments for a method",
        parameters: {
          type: "object",
          properties: {
            signature: { type: "string", description: "Method signature" },
          },
          required: ["signature"],
        },
      },
    ];
  }
}
