# AGENTS.md

## Project Overview

This is the Continue project - an open-source AI code agent that works across IDEs, terminal, and CI. The project has been migrated from "Continue" to "Autobot" branding at the UI level while maintaining internal API compatibility.

## Migration Context

- **UI Branding**: Changed from "Continue" to "Autobot"
- **Internal APIs**: Continue naming preserved for compatibility
- **Package Names**: @continuedev/* maintained
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

## Important Notes

- This project uses a monorepo structure
- Each package has its own package.json
- Build commands vary by package
- Migration is UI-level only - internal APIs unchanged
