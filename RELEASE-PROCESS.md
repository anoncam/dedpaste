# Release Process

This document explains how the automated release process works for this project.

## Automated Version Bumping and Releases

The project includes an automated workflow that:
1. Bumps the version in package.json when PRs are merged to main
2. Triggers the release process
3. Creates a GitHub release
4. Publishes to npm

### How It Works

1. **Pull Request Merging**
   - When a PR is merged to the `main` branch, it triggers the `auto-version-bump.yml` workflow

2. **Version Bump Type**
   - The workflow checks for labels on the PR to determine how to bump the version:
     - `major`: Increments the major version (e.g., 1.0.0 → 2.0.0)
     - `minor`: Increments the minor version (e.g., 1.0.0 → 1.1.0)
     - No label or any other label: Increments the patch version (e.g., 1.0.0 → 1.0.1)

3. **Version Update**
   - The workflow updates `package.json` with the new version
   - Commits the change back to the `main` branch

4. **Release Workflow**
   - The version change in `package.json` triggers the `release.yml` workflow
   - This workflow:
     - Builds and tests the package
     - Creates a GitHub release with the new version tag
     - Publishes the package to npm with provenance

### How to Use This Process

As a contributor:

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Your Changes**
   - Implement features or fix bugs
   - Add tests if appropriate

3. **Create a Pull Request**
   - Push your branch and open a PR to `main`
   - Add the appropriate label based on the change:
     - `major`: Breaking changes
     - `minor`: New features (backward compatible)
     - No label: Bug fixes, documentation updates, etc.

4. **After Merge**
   - When your PR is merged, the version will be automatically bumped
   - A new release will be created on GitHub
   - The package will be published to npm

### Manual Override

If you need to manually set a specific version:

1. Update `package.json` directly in a PR
2. The release workflow will respect your manually set version

### Troubleshooting

If the automated process fails:

1. Check the GitHub Actions logs for details
2. Common issues include:
   - Test failures
   - Version conflicts
   - npm publishing issues

In case of problems, you can manually trigger the test workflow:

1. Go to Actions → "Test Release" workflow
2. Click "Run workflow"
3. This will test the release process without actually publishing

## Version Numbering Conventions

This project follows [Semantic Versioning](https://semver.org/):

- **Major** (x.0.0): Breaking changes that require significant updates from users
- **Minor** (0.x.0): New features that are backward compatible
- **Patch** (0.0.x): Bug fixes and minor improvements that don't change the API