# Release Process

This document explains how the automated release process works for this project.

## Automated Version Bumping and Releases

The project includes an automated workflow that:
1. Bumps the version in package.json when PRs are merged to main
2. Triggers the release process
3. Creates a GitHub release with detailed release notes
4. Generates and publishes a Software Bill of Materials (SBOM)
5. Publishes to npm with provenance

### How It Works

1. **Pull Request Merging**
   - When a PR is merged to the `main` branch, it triggers the `auto-version-bump.yml` workflow

2. **Version Bump Type**
   - The workflow determines how to bump the version through multiple methods:
     - **Explicit PR Labels**:
       - `major`: Increments the major version (e.g., 1.0.0 → 2.0.0)
       - `minor`: Increments the minor version (e.g., 1.0.0 → 1.1.0)
       - `patch`: Increments the patch version (e.g., 1.0.0 → 1.0.1)
     - **Conventional Commits Detection**:
       - PR title with `BREAKING CHANGE:` or using `!` notation → Major bump
       - PR title with `feat:` prefix → Minor bump
       - PR title with `fix:` prefix → Patch bump
     - **PR Commit Analysis**:
       - If PR title doesn't follow conventional commit format, the workflow analyzes the commits in the PR
       - If any commit has breaking changes → Major bump
       - If any commit has new features → Minor bump
       - If any commit has bug fixes → Patch bump

3. **Version Update**
   - The workflow updates `package.json` with the new version
   - Commits the change back to the `main` branch with the PR reference

4. **Release Workflow**
   - The version change in `package.json` triggers the `release-with-sbom.yml` workflow
   - This workflow:
     - Builds and tests the package
     - Generates a comprehensive SBOM using CycloneDX
     - Creates detailed release notes including:
       - All changes since previous release
       - List of merged PRs with authors
       - Documentation links
     - Creates a GitHub release with the new version tag
     - Attaches the SBOM to the GitHub release
     - Publishes the package to npm with provenance and SBOM metadata

### Software Bill of Materials (SBOM)

The automated process generates a CycloneDX SBOM with each release, which:
- Lists all dependencies with their versions
- Identifies dependency licenses
- Provides component metadata
- Is attached to each GitHub release as an asset
- Is embedded in the npm package metadata
- Helps with security auditing and compliance

### Detailed Release Notes

Each release automatically includes comprehensive release notes with:
- A summary of all changes since the last release
- Commit history with author attribution
- List of merged PRs with labels
- Links to documentation

### How to Use This Process

As a contributor:

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Your Changes**
   - Implement features or fix bugs
   - Add tests if appropriate
   - Use conventional commit messages where possible:
     - `feat: add new feature` (Minor version bump)
     - `fix: resolve issue with X` (Patch version bump)
     - `feat!: completely redesign API` or `BREAKING CHANGE: redesign API` (Major version bump)

3. **Create a Pull Request**
   - Push your branch and open a PR to `main`
   - Optionally add an appropriate label based on the change:
     - `major`: Breaking changes
     - `minor`: New features (backward compatible)
     - `patch`: Bug fixes, documentation updates, etc.
   - If no label is added, the version will be determined by analyzing your PR title and commits

4. **After Merge**
   - When your PR is merged, the version will be automatically bumped based on the changes
   - A new release will be created on GitHub with detailed notes
   - An SBOM will be generated and attached to the release
   - The package will be published to npm with provenance

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

In case of problems, you can manually trigger the release workflow:

1. Go to Actions → "Release with SBOM and Notes" workflow
2. Click "Run workflow"
3. Optionally specify a version to force a release
4. This will create a new release even if automated triggers are not working

#### Investigating Version Discrepancies

If there's a disconnect between the package.json version and the latest GitHub release:

1. **Check workflow runs**:
   ```bash
   gh run list --workflow=release-with-sbom.yml
   ```

2. **Force a release of the current version**:
   - Go to Actions → "Release with SBOM and Notes" workflow 
   - Click "Run workflow"
   - Enter the current version from package.json in the "force_version" field
   - Click "Run workflow"

3. **Verify permissions**:
   - Ensure the GitHub Actions have proper permissions to create releases
   - The workflow needs `contents: write` permission

## Version Numbering Conventions

This project follows [Semantic Versioning](https://semver.org/):

- **Major** (x.0.0): Breaking changes that require significant updates from users
- **Minor** (0.x.0): New features that are backward compatible
- **Patch** (0.0.x): Bug fixes and minor improvements that don't change the API