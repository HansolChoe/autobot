# Disabled GitHub Workflows

This directory contains GitHub Actions workflows that have been temporarily disabled.

## Why are these workflows disabled?

These workflows were designed for the original Continue project and may not be suitable for the current Autobot project setup. They have been moved here to preserve the configuration while preventing them from running.

## How to re-enable workflows

To re-enable specific workflows:

1. Move the desired `.yaml` or `.yml` files back to `.github/workflows/`
2. Update the workflow configurations to match your current project needs
3. Test the workflows in a separate branch before merging

## Workflow Categories

- **Build & Release**: `*-release.yaml`, `auto-release.yml`, `beta-release.yml`
- **PR Checks**: `pr-checks.yaml`, `pr-build-upload-vsix.yaml`, `cli-pr-checks.yml`
- **Maintenance**: `auto-fix-failed-tests.yml`, `label-merged-prs.yml`, `stale-issue-helper.yaml`
- **Compliance**: `cla.yaml`, `compliance.yaml`
- **Utilities**: `metrics.yaml`, `similar-issues.yml`, `respond-to-cubic.yaml`

## Notes

- All workflows are preserved with their original configuration
- Some workflows may need updates for the new project structure
- Consider reviewing each workflow before re-enabling
