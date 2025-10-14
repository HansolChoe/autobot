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
- Extension ID: `continue` (never change)
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

## File Structure

- `core/` - Core functionality and APIs
- `gui/` - Web-based user interface
- `extensions/vscode/` - VS Code extension
- `extensions/intellij/` - IntelliJ extension
- `binary/` - Binary distribution
- `packages/` - Shared packages

## Default Configuration Files

### Core Default Configuration

The project uses several default configuration files that define the base settings for different agent types:

#### `core/config/default.ts`

- **Purpose**: Defines the default configuration for Local Agent
- **Type**: `ConfigYaml` interface
- **Usage**: Used when creating new Local Agent instances
- **Key Properties**:
  - `name`: "Local Agent"
  - `version`: "1.0.0"
  - `schema`: "v1"
  - `models`: Empty array (user must add models)
  - `prompts`: Array of default slash commands (includes Python command)

#### `core/config/yaml/default.ts`

- **Purpose**: Defines default YAML configuration for different platforms
- **Types**: `AssistantUnrolled` interface
- **Exports**:
  - `defaultConfigYaml`: Default config for general use
  - `defaultConfigYamlJetBrains`: Default config for JetBrains IDEs
- **Usage**: Used by the YAML loading system to provide base configurations
- **Key Properties**: Same as `default.ts` but in YAML-compatible format

#### `core/config/prompts.ts`

- **Purpose**: Centralized definition of common slash commands and prompts
- **Exports**:
  - `PYTHON_SLASH_COMMAND`: TypeScript object format for programmatic use
  - `PYTHON_SLASH_COMMAND_YAML`: YAML string format for template files
- **Usage**: Imported by all configuration files to ensure consistency
- **Benefits**:
  - Eliminates code duplication
  - Ensures consistent prompt definitions across all files
  - Single source of truth for prompt modifications

### Default Slash Commands

Both default configuration files include a built-in Python slash command:

```yaml
prompts:
  - name: python
    description: Generate Python code using python_code_gen tool (use generated code as-is)
    prompt: |
      {{{ input }}}

      For Python code generation, you MUST use the python_code_gen tool to generate complete, runnable Python code. CRITICAL: Do not modify, change, or rewrite the generated code in any way. Use the generated code exactly as it is - copy and apply it directly without any modifications. Do not add comments, change variable names, alter the structure, remove comments, modify docstrings, or delete test code. The generated code must be used as-is including all comments, docstrings, and test cases.
```

### Modifying Default Configurations

When adding new default slash commands or modifying existing ones:

1. **Update prompts.ts first**: Add new commands to `core/config/prompts.ts` with both TypeScript and YAML formats
2. **Update all config files**: Import and use the new prompts in:
   - `core/config/default.ts`
   - `core/config/yaml/default.ts` (both `defaultConfigYaml` and `defaultConfigYamlJetBrains`)
   - `core/config/createNewAssistantFile.ts`
3. **Test thoroughly**: Ensure changes work across all supported IDEs
4. **Maintain consistency**: All files should import from `prompts.ts` to ensure consistency

### File Relationships

- `core/config/prompts.ts` → **Central source** for all prompt definitions
- `core/config/default.ts` → Uses prompts from `prompts.ts` for Local Agent
- `core/config/yaml/default.ts` → Uses prompts from `prompts.ts` for YAML system
- `core/config/createNewAssistantFile.ts` → Uses YAML prompts for new assistant templates
- All files import from `prompts.ts` to ensure consistency
- Changes to `prompts.ts` automatically propagate to all dependent files

## Important Notes

- This project uses a monorepo structure
- Each package has its own package.json
- Build commands vary by package
- Migration is UI-level only - internal APIs unchanged
