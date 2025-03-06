# DedPaste Release Workflow

This document explains how the automated release workflow operates and how to set it up properly.

## How It Works

The automated release workflow is triggered when:
1. A PR that changes the version in `package.json` is merged to `main`
2. The `package.json` file is directly changed on the `main` branch

When triggered, the workflow:
1. Compares the old and new version in `package.json`
2. If a version change is detected, it runs the build and test process
3. Creates a GitHub release with the new version number
4. Publishes the package to npm with provenance

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

To create a new release:

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

4. The workflow will automatically:
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