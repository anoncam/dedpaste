# DedPaste Release Workflow

This document explains how the automated release workflow operates and how to set it up properly.

## How It Works

The automated release workflow consists of two main parts:

1. **Auto Version Bump Workflow**:
   - Triggered when a PR is merged to `main`
   - Analyzes PR labels, title, and commits to determine version bump type (major, minor, patch)
   - Updates the version in `package.json` and commits the change to `main`
   - Directly triggers the Release workflow using repository_dispatch event

2. **Release Workflow**:
   - Triggered through multiple mechanisms (in order of preference):
     - Direct repository_dispatch event from the Auto Version Bump workflow
     - The `package.json` file is changed on the `main` branch (fallback)
     - The Auto Version Bump workflow completes successfully (backup)
     - Manually triggered via GitHub Actions UI

   When triggered, the workflow:
   - Verifies the version in `package.json` doesn't already have a release
   - Builds and tests the package
   - Generates a Software Bill of Materials (SBOM)
   - Creates detailed release notes
   - Creates a GitHub release with the new version tag
   - Attaches the SBOM to the GitHub release
   - Publishes the package to npm with provenance

## Setting Up the Workflow

### 1. Required Secrets

The workflow requires the following GitHub secrets:

- `NPM_TOKEN`: An npm access token with publish permissions

To generate an npm token:
1. Go to npmjs.com and log in to your account
2. Click on your profile picture and select "Access Tokens"
3. Click "Generate New Token" and select "Automation" token type
4. Copy the token that is generated

To add the token to GitHub:
1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: [Your npm token]
6. Click "Add secret"

### 2. Required Permissions

The workflow requires the following GitHub permissions:
- `contents: write` - To create releases
- `id-token: write` - To generate provenance statements for npm

These permissions are already configured in the workflow file.

## Creating a Release

There are two ways to create a new release:

### Method 1: Automated Version Bumping (Recommended)

1. Create a feature branch and make your changes:
   ```bash
   git checkout -b feature/my-feature
   # Make your changes
   ```

2. Use conventional commit messages when possible:
   ```bash
   # For minor version bump (new feature)
   git commit -m "feat: add new feature"
   
   # For patch version bump (bug fix)
   git commit -m "fix: resolve issue with X"
   
   # For major version bump (breaking change)
   git commit -m "feat!: completely redesign API"
   # or
   git commit -m "BREAKING CHANGE: redesign API"
   ```

3. Create a Pull Request to `main` with an appropriate title:
   - Use conventional commit format in the PR title when possible
   - Optionally add a label to explicitly set the version bump type:
     - `major`: For breaking changes
     - `minor`: For new features (backward compatible)
     - `patch`: For bug fixes, documentation updates, etc.

4. When the PR is merged, the auto-version-bump workflow will:
   - Determine the appropriate version bump based on PR labels, title, or commits
   - Update the version in `package.json`
   - Commit the change to `main`
   - Trigger the release workflow

5. The release workflow will automatically:
   - Build the package
   - Run tests
   - Generate an SBOM
   - Create a GitHub release with detailed notes
   - Publish to npm with provenance

### Method 2: Manual Version Update

If you need to set a specific version:

1. Update the version in `package.json` following Semantic Versioning:
   - MAJOR: Breaking changes
   - MINOR: New features, no breaking changes
   - PATCH: Bug fixes, no breaking changes

2. Commit the change to a feature branch:
   ```bash
   git checkout -b version/bump-to-X.Y.Z
   git add package.json
   git commit -m "Bump version to X.Y.Z"
   git push origin version/bump-to-X.Y.Z
   ```

3. Create a Pull Request to `main` and merge it.

4. The release workflow will automatically:
   - Detect the version change
   - Build the package
   - Run tests
   - Create a GitHub release
   - Publish to npm

## Troubleshooting

### Workflow Not Running

If the workflow doesn't run when expected:

1. Check that you modified the version in `package.json`
2. Verify that the PR was merged to the `main` branch
3. Check the Actions tab for any error messages
4. Ensure that the required secrets are properly configured

### NPM Publish Failures

If the npm publish step fails:

1. Check that the `NPM_TOKEN` secret is correct and has publish permissions
2. Verify that the version in `package.json` doesn't already exist on npm
3. Ensure the package name in `package.json` is available on npm

## Testing the Workflow

To test the workflow without actually publishing:

1. Use the test workflow:
   ```bash
   # Go to Actions > "Test Release Workflow" > "Run workflow"
   # Select "Simulate a package.json version change" and run
   ```

2. This will simulate the version check logic without actual releases or publishing.

## Additional Resources

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [npm publish documentation](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
