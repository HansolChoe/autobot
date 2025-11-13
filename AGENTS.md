# AGENTS.md

## Project Overview

This is the Continue project - an open-source AI code agent that works across IDEs, terminal, and CI. The project has been migrated from "Continue" to "Autobot" branding at the UI level while maintaining internal API compatibility.

## Migration Context

- **UI Branding**: Changed from "Continue" to "Autobot"
- **Internal APIs**: Continue naming preserved for compatibility
- **Package Names**: @continuedev/\* maintained
- **Extension ID**: continue maintained

## Setup Commands

- Install dependencies: `npm install`
- Install GUI dependencies: `cd gui && npm install`
- Install VS Code extension dependencies: `cd extensions/vscode && npm install`
- Install IntelliJ extension dependencies: `cd extensions/intellij && ./gradlew build`

## Development Commands

- Start core dev server: `cd binary && npm run dev`
- Start GUI dev server: `cd gui && npm run dev`
- Build GUI: `cd gui && npm run build`
- Build VS Code extension: `cd extensions/vscode && npm run build`
- Build IntelliJ extension: `cd extensions/intellij && ./gradlew build`

## Testing Commands

- Run core tests: `cd core && npm test`
- Run binary tests: `cd binary && npm test`
- Run GUI tests: `cd gui && npm test`
- Run all tests: `npm test`

## Code Style

- TypeScript strict mode enabled
- Use single quotes, no semicolons
- Prefer functional patterns where possible
- Follow existing naming conventions

## Migration Guidelines

### UI Components

- Use "Autobot" for all user-facing text
- Component names: `AutobotLogo`, `AutobotInputBox`, `AutobotFeaturesMenu`
- HTML titles: `<title>Autobot</title>`
- Logo: Use ETRI logo (`/logos/etri_logo.png`)

### Internal Code

- Keep "Continue" naming for APIs and core classes
- Package names: `@continuedev/*` (never change)
- Extension ID: `autobot` (UI 브랜딩에 맞춰 변경됨)
- Core classes: `ContinueProxy`, `ContinueHubClient` (never change)
- Core types: `ContinueError`, `ContinueConfig` (never change)

### Files to Never Modify

- Package names in package.json files
- Extension IDs in manifest files
- Core API class names
- Protocol identifiers
- Internal system logic

### Changed Files Reference

- Logo components: `ContinueLogo.tsx` → `AutobotLogo.tsx`
- UI components: `ContinueInputBox.tsx` → `AutobotInputBox.tsx`
- HTML files: All title tags changed to "Autobot"
- VS Code extension: Display name and sidebar text updated
- User messages: All "Continue" → "Autobot" in UI text

## Build Instructions

### GUI Build

```bash
cd gui
npm install
npm run build
```

### VS Code Extension Build

```bash
cd extensions/vscode
npm install
npm run build
```

### IntelliJ Extension Build

```bash
cd extensions/intellij
./gradlew build
```

## Testing Instructions

- Always run tests before committing
- Fix any test or type errors until the whole suite is green
- Add or update tests for code changes
- Run linting: `npm run lint` (where available)

## Security Considerations

- Never expose API keys or sensitive data
- Follow secure coding practices
- Validate all user inputs
- Use proper error handling

## Common Issues

- **Build errors**: Check import paths and dependencies
- **Image load failures**: Verify file paths and permissions
- **Type errors**: Ensure TypeScript compilation passes
- **Migration conflicts**: Follow UI vs Internal code guidelines
- **Handlebars import errors**: Use fallback pattern for esbuild compatibility

## File Structure

- `core/` - Core functionality and APIs
  - `core/tools/implementations/autofl/` - AutoFL bug localization tool implementation
  - `core/tools/implementations/autoflTool.ts` - AutoFL tool integration
- `gui/` - Web-based user interface
- `extensions/vscode/` - VS Code extension
- `extensions/intellij/` - IntelliJ extension
- `binary/` - Binary distribution
- `packages/` - Shared packages
- `autofl_python/` - Original Python implementation reference (for reference only, not used in production)

## Default Configuration Files

### Core Default Configuration

The project uses several default configuration files that define the base settings for different agent types:

#### `core/config/default.ts` (Legacy)

- **Purpose**: Legacy default configuration for file generation
- **Type**: `ConfigYaml` interface
- **Usage**: Used only when generating default config.yaml files (legacy)
- **Key Properties**:
  - `name`: "Local Agent"
  - `version`: "1.0.0"
  - `schema`: "v1"
  - `models`: Empty array (user must add models)
  - `prompts`: Empty array (legacy file, not used in actual config loading)

#### `core/config/yaml/default.ts`

- **Purpose**: Defines default YAML configuration for all platforms
- **Types**: `AssistantUnrolled` interface
- **Exports**:
  - `defaultConfigYaml`: Default config for all IDEs (VS Code, JetBrains, etc.)
- **Usage**: Used by the YAML loading system to provide base configurations
- **Key Properties**:
  - `name`: "Local Agent"
  - `version`: "1.0.0"
  - `schema`: "v1"
  - `models`: Empty array (user must add models)
  - `prompts`: Array of default slash commands (includes Python command)
- **Note**: JetBrains-specific differences are handled at runtime in `loadContextProviders.ts` (e.g., filtering out unsupported context providers)

#### `core/config/prompts.ts`

- **Purpose**: Centralized definition of common slash commands and prompts
- **Exports**:
  - `PYTHON_SLASH_COMMAND`: TypeScript object format for programmatic use
  - `AUTOFL_SLASH_COMMAND`: AutoFL bug localization slash command
  - `KAIST_AUTO_DEBUG_SLASH_COMMAND`: Auto debug slash command
- **Usage**: Imported by all configuration files to ensure consistency
- **Benefits**:
  - Eliminates code duplication
  - Ensures consistent prompt definitions across all files
  - Single source of truth for prompt modifications

### Default Slash Commands

The default YAML configuration (`core/config/yaml/default.ts`) includes built-in slash commands:

#### Python Command

```yaml
prompts:
  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      Please use the python_code_gen tool to generate the Python code. Use the generated code exactly as-is without any modifications.
```

#### AutoFL Command

```yaml
prompts:
  - name: autofl
    description: Analyze failing tests and locate bugs using autofl tool (AutoFL Bug Localization)
    prompt: |
      {{{ input }}}

      Analyze my request and use the autofl tool to locate bugs. The autofl tool requires:
      - repo_path: Project root path (prefer absolute path)
      - test_command: Command to run tests (e.g., "pytest", "npm test", "mvn test")
      Optional: language, bug_name, max_budget
```

These commands are also included when creating new assistant files via `createNewAssistantFile.ts`.

### Modifying Default Configurations

When adding new default slash commands or modifying existing ones:

1. **Update prompts.ts first**: Add new commands to `core/config/prompts.ts` with both TypeScript and YAML formats
2. **Update all config files**: Import and use the new prompts in:
   - `core/config/yaml/default.ts` - **Main system** (TypeScript object format)
   - `core/config/createNewAssistantFile.ts` - **New assistant templates** (YAML format)
   - ⚠️ `core/config/default.ts` - **Legacy file, prompts not used** (only used for file generation)
3. **Test thoroughly**: Ensure changes work across all supported IDEs
4. **Maintain consistency**: All files should import from `prompts.ts` to ensure consistency

### File Relationships

- `core/config/prompts.ts` → **Central source** for all prompt definitions
- `core/config/yaml/default.ts` → **Main system** - Uses prompts from `prompts.ts` for YAML loading
- `core/config/createNewAssistantFile.ts` → Uses YAML prompts for new assistant templates
- `core/config/default.ts` → **Legacy** - Only used for file generation, prompts not included
- All active files import from `prompts.ts` to ensure consistency
- Changes to `prompts.ts` automatically propagate to all dependent files

## VSIX Build Process

### Prerequisites

- GUI must be built first: `cd gui && npm run build`
- All dependencies installed: `cd extensions/vscode && npm install`

### Changing VSIX Version

**VSIX 버전은 `extensions/vscode/package.json`의 `version` 필드만 수정하면 됩니다.**

**중요**: VSIX 버전과 관련 없는 패키지 버전은 변경할 필요가 없습니다:

- ❌ `binary/package.json` - VSIX와 무관
- ❌ `core/package.json` - VSIX와 무관 (로컬 의존성)
- ❌ `extensions/intellij/gradle.properties` - IntelliJ 전용
- ✅ `extensions/vscode/package.json` - **이것만 수정하면 됨**

VSIX 파일명은 자동으로 `autobot-{version}.vsix` 형식으로 생성됩니다.

```bash
# extensions/vscode/package.json에서 version 필드 수정
# 예: "version": "0.0.2"
```

### Build Commands

```bash
cd extensions/vscode
npm run prepackage    # Copy GUI and native modules
npm run vscode:prepublish  # TypeScript compilation + minification
npm run package       # Create VSIX file
```

### Output

- VSIX file: `extensions/vscode/build/autobot-{version}.vsix`
- Version: `extensions/vscode/package.json`의 `version` 필드 사용
- Typical size: ~60-70MB (includes native binaries)
- Target platform: Auto-detected (win32-x64, darwin-arm64, etc.)

### Common Issues

- **PowerShell compatibility**: Use `cd` then separate commands instead of `&&`
- **Large file size**: Normal due to onnxruntime, tree-sitter, and other native modules
- **Build errors**: Ensure GUI is built first and all dependencies are installed
- **Handlebars.registerHelper is not a function**: Use fallback import pattern for esbuild compatibility

## Handlebars Import Issues

### Problem

When building VSIX packages, you may encounter `Handlebars.registerHelper is not a function` errors. This occurs because esbuild has trouble with CommonJS modules when using ESM default imports.

### Solution

Use the fallback import pattern for all Handlebars imports:

```typescript
import * as HandlebarsImport from "handlebars";
// Handle both default export and namespace export for esbuild compatibility
const Handlebars = (HandlebarsImport as any).default || HandlebarsImport;
```

### Files That Need This Pattern

- `core/util/handlebars/handlebarUtils.ts`
- `core/util/handlebars/renderTemplatedString.ts`
- `core/llm/llms/index.ts`
- `core/llm/index.ts`
- `core/nextEdit/templating/NextEditPromptEngine.ts`
- `core/autocomplete/templating/index.ts`
- `gui/src/components/mainInput/TipTapEditor/utils/renderPromptv1.ts`

### Why This Works

- Handlebars is a CommonJS module
- esbuild converts it differently depending on import style
- The fallback pattern handles both `default` export and namespace export
- This ensures compatibility regardless of how esbuild processes the module

## Built-in Tools

### AutoFL (Automated Fault Localization)

- **Tool Name**: `autofl`
- **Purpose**: Analyzes failing tests using LLM to predict buggy method locations
- **Location**: `core/tools/implementations/autofl/`
- **Integration**: Registered in `core/tools/builtIn.ts` and `core/tools/index.ts`
- **Parameters**:
  - `repo_path` (required): Repository root directory path
  - `test_command` (required): Command to run tests (e.g., "pytest", "npm test")
  - `language` (optional): "auto", "java", or "python" (default: "auto")
  - `bug_name` (optional): Project identifier (default: "project")
  - `max_budget` (optional): Maximum LLM API calls (default: 10)
- **Usage**: Available as slash command `/autofl` or as a tool call by agents

## Important Notes

- This project uses a monorepo structure
- Each package has its own package.json
- Build commands vary by package
- Migration is UI-level only - internal APIs unchanged
