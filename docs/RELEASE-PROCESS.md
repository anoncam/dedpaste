# Release Process

This document describes the release process for DedPaste, including our implementation of GitHub's Immutable Releases feature for enhanced supply chain security.

## Overview

DedPaste uses an automated release workflow that creates immutable, cryptographically attested releases. This ensures that all release artifacts are tamper-proof and verifiable.

## Automated Release Workflow

### Version Bumping

When a pull request is merged to the `main` branch:

1. **Auto Version Bump** workflow analyzes the PR:
   - Checks PR labels (`major`, `minor`, `patch`)
   - Analyzes commit messages for conventional commit patterns
   - Determines the appropriate version bump

2. Conventional commit patterns:
   - `feat:` or `feat(scope):` → Minor version bump
   - `fix:` or `fix(scope):` → Patch version bump
   - `BREAKING CHANGE:` or `feat!:` → Major version bump

3. Updates `package.json` with the new version
4. Triggers the release workflow

### Release Creation

The **Release with SBOM and Notes** workflow:

1. **Builds the project**
   - Compiles TypeScript files
   - Runs tests
   - Generates build artifacts

2. **Generates SBOM**
   - Creates a Software Bill of Materials (SBOM) in CycloneDX format
   - Documents all dependencies and their versions

3. **Creates release notes**
   - Lists all commits since the last release
   - Links to relevant pull requests
   - Includes SBOM information
   - Adds verification instructions

4. **Publishes the release**
   - Creates a GitHub release with the tag `vX.Y.Z`
   - Attaches the SBOM file
   - Includes detailed release notes

5. **Generates build provenance attestations** 🔐
   - Creates cryptographic attestations for all release artifacts
   - Signs attestations using GitHub's Sigstore integration
   - Ensures artifacts are immutable and verifiable

6. **Publishes to NPM**
   - Publishes the package with provenance
   - Uses OIDC Trusted Publishers for secure authentication

## Immutable Releases 🔐

### What are Immutable Releases?

Immutable releases are a security feature that makes release artifacts tamper-proof:

- **Immutable assets**: Once published, release artifacts cannot be modified, added, or deleted
- **Protected tags**: Git tags are locked to specific commits and cannot be moved
- **Cryptographic attestations**: Each release includes signed build provenance attestations
- **Verifiable provenance**: Anyone can verify that artifacts were built by the official workflow

### How We Implement It

Our release workflow automatically:

1. **Generates build provenance attestations** for:
   - SBOM file (`bom.json`)
   - Build artifacts (`dist/*`)

2. **Signs attestations** using GitHub's Sigstore integration
   - Uses the GitHub Actions OIDC token
   - Creates tamper-evident signatures
   - Links artifacts to specific workflow runs and commits

3. **Publishes releases with attestations**
   - When immutable releases are enabled in the repository settings (Settings → Code and automation → Releases), all newly created releases become immutable
   - Release artifacts cannot be modified after publication when immutability is enabled
   - Tags cannot be moved or deleted when immutability is enabled

### Verifying Releases

Anyone can verify the authenticity and integrity of our releases using the GitHub CLI:

```bash
# Install GitHub CLI if needed
# See: https://cli.github.com/

# Verify the SBOM file
gh attestation verify bom.json --owner anoncam --repo dedpaste

# Verify build artifacts
gh attestation verify <artifact-path> --owner anoncam --repo dedpaste

# Download and verify a release artifact
gh release download v1.24.0 --pattern "bom.json" --repo anoncam/dedpaste
gh attestation verify bom.json --owner anoncam --repo dedpaste
```

Verification confirms:
- ✅ Artifact was built by the official GitHub Actions workflow
- ✅ Artifact has not been tampered with since publication
- ✅ Artifact is linked to specific commits and workflow runs
- ✅ Build process is traceable and transparent

### Benefits

1. **Supply Chain Security**
   - Prevents tampering with release artifacts
   - Protects against malicious code injection
   - Ensures artifacts match the source code

2. **Transparency**
   - Complete build provenance tracking
   - Verifiable connection between code and artifacts
   - Audit trail for all releases

3. **Trust**
   - Users can verify authenticity of downloads
   - Cryptographic proof of origin
   - Compliance with security best practices

## Manual Release Process

If needed, maintainers can trigger a release manually:

1. Go to the [Actions tab](https://github.com/anoncam/dedpaste/actions)
2. Select "Release with SBOM and Notes" workflow
3. Click "Run workflow"
4. Optionally specify a version to force release

## Troubleshooting

### Release Already Exists

If a release already exists for a version, the workflow will skip creating a duplicate. Check:
- Existing releases: https://github.com/anoncam/dedpaste/releases
- Workflow logs in the Actions tab

### Build Attestation Failures

If attestation generation fails:
- Check that `id-token: write` and `attestations: write` permissions are set
- Verify the workflow is running on a public repository
- Check GitHub Actions logs for detailed error messages

### NPM Publish Failures

If NPM publishing fails:
- Verify the version doesn't already exist on NPM
- Check that OIDC Trusted Publishers are configured correctly
- Review npm provenance documentation

## Security Considerations

- **Never manually modify releases**: All releases should be created by the automated workflow
- **Verify downloads**: Always verify release artifacts using `gh attestation verify`
- **Report issues**: If you find any security concerns, please report them responsibly

## Additional Resources

- [GitHub Immutable Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/creating-releases/immutable-releases)
- [GitHub Actions Artifact Attestation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
- [Sigstore Documentation](https://docs.sigstore.dev/)
- [SLSA Framework](https://slsa.dev/)
