# Contributing to DedPaste

Thank you for considering contributing to DedPaste! This document outlines the process for contributing to the project and ensuring your pull requests pass our CI/CD checks.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior and actual behavior
- Version information (CLI version, operating system, etc.)
- Any additional context or screenshots

### Suggesting Features

Feature suggestions are always welcome. To suggest a feature:

1. Create an issue on GitHub with a clear title and detailed description
2. Explain why this feature would be useful to DedPaste users
3. Outline how you envision the feature working

### Pull Requests

1. Fork the repository
2. Create a new branch from `main` with a descriptive name
   ```bash
   git checkout -b feature/my-feature
   ```
3. Make your changes, following the code style guidelines
4. Write tests for your changes
5. Ensure all tests pass
6. Commit your changes with a clear, descriptive message
7. Push your branch to your fork
8. Create a pull request to the `main` branch of the DedPaste repository

#### PR Labeling

When creating a pull request, please add one of the following labels to indicate the type of change:

- `major`: Breaking changes that require a major version bump
- `minor`: New features that don't break backward compatibility
- No label: Bug fixes and minor improvements

These labels help our automated release process determine the appropriate version bump.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/anoncam/dedpaste.git
   cd dedpaste
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Link the CLI for local development:
   ```bash
   npm link
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Code Style Guidelines

### General

- Use 2-space indentation (spaces, not tabs)
- Use semicolons
- Use single quotes for strings
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Add JSDoc comments for functions

### TypeScript

- Use TypeScript types for all variables and functions
- Avoid using `any` type when possible
- Use interfaces for defining object shapes
- Use enums for defining a set of named constants

### JavaScript

- Use ES6+ features
- Use `const` for variables that won't be reassigned
- Use `let` for variables that will be reassigned
- Destructure objects and arrays when appropriate

### Testing

- Write tests for all new functionality
- Tests should be in the `test/` directory
- Maintain high test coverage

## Testing Your Changes

Before submitting a pull request, run the following commands:

1. Format your code:
   ```bash
   npm run format
   ```

2. Lint your code:
   ```bash
   npm run lint
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## CI/CD Checks

Our CI/CD pipeline performs the following checks on all pull requests:

1. **Formatting**: Uses Prettier to ensure consistent code formatting
2. **Linting**: Uses ESLint to identify and report on patterns in the code
3. **Building**: Compiles TypeScript code to ensure it's valid
4. **Testing**: Runs the test suite to ensure all tests pass
5. **Type Checking**: Verifies TypeScript types

To ensure your PR passes these checks, run the corresponding local commands before submitting.

## Release Process

DedPaste uses an automated release process:

1. When a PR is merged to `main`, a GitHub Action runs to:
   - Determine the version bump (major, minor, patch) based on PR labels
   - Update package.json version
   - Create a git tag
   - Create a GitHub Release
   - Publish to npm

2. The version is determined as follows:
   - PR labeled with `major`: Bump major version (1.0.0 → 2.0.0)
   - PR labeled with `minor`: Bump minor version (1.0.0 → 1.1.0)
   - PR with no label or any other label: Bump patch version (1.0.0 → 1.0.1)

For more details, see [RELEASE-PROCESS.md](./RELEASE-PROCESS.md).

## Additional Resources

- [README.md](./README.md): Main project documentation
- [TESTING.md](./TESTING.md): Detailed testing information
- [RELEASE-PROCESS.md](./RELEASE-PROCESS.md): Detailed release process information

Thank you for contributing to DedPaste!