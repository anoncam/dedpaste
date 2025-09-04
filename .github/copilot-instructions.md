# DedPaste - GitHub Copilot Development Instructions

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

DedPaste is a secure, privacy-focused pastebin CLI application powered by Cloudflare Workers and R2 storage with advanced encryption capabilities. It consists of a TypeScript-based Cloudflare Worker backend and a comprehensive CLI with encryption, PGP support, and Keybase integration.

## Working Effectively

### Bootstrap and Dependencies
```bash
# Install all dependencies
npm ci  # Takes ~20 seconds, NEVER CANCEL

# Install missing dev dependencies if needed
npm install prettier eslint  # Only if format/lint commands fail
```

### Build Process
```bash
# Build both Worker and CLI TypeScript code
npm run build  # Takes ~3 seconds, set timeout to 30+ seconds

# The build compiles:
# - src/ → dist/ (Cloudflare Worker)
# - cli/ → cli/*.js (CLI application)
```

### Testing
```bash
# Run the test suite
npm test  # Takes ~32 seconds, NEVER CANCEL, set timeout to 60+ seconds
# NOTE: 2 tests currently fail (existing issues), this is normal and not blocking
```

### CLI Installation and Testing
```bash
# Install CLI globally for development
npm link

# Test CLI functionality (these work offline)
dedpaste --help                    # Verify CLI is working
dedpaste keys --help               # Test key management
dedpaste keys --gen-key            # Generate test keys (offline)
dedpaste keys --list               # List generated keys
dedpaste completion --bash         # Test completion generation
```

### Development Server
```bash
# Start development server (requires Cloudflare credentials)
npm run dev  # NEVER CANCEL: May take 2+ minutes to start, set timeout to 180+ seconds
# Note: Will show network errors in sandbox environment - this is expected
```

### Code Quality
```bash
# Format code (requires prettier installation)
npm run format  # Takes ~1 second

# Lint code (currently broken - needs eslint config fix)
npm run lint  # BROKEN: eslint.config.js missing, document this issue
```

### Deployment
```bash
# Deploy to Cloudflare Workers
npm run deploy  # Takes ~2 minutes, NEVER CANCEL, set timeout to 180+ seconds
# Note: Requires Cloudflare credentials, will fail in development sandbox
```

## Validation Scenarios

**ALWAYS run these complete validation scenarios after making changes:**

### 1. Full Build and Test Validation
```bash
npm ci
npm run build
npm test
npm link
dedpaste --help
```

### 2. CLI Functionality Validation
```bash
# Test offline CLI features
dedpaste keys --gen-key
dedpaste keys --list
dedpaste completion --bash > /tmp/test-completion.bash
echo "test content" > /tmp/test.txt
dedpaste --file /tmp/test.txt --help  # Validate file reading
```

### 3. TypeScript Compilation Validation
```bash
# Verify both TypeScript configurations work
npx tsc --noEmit                    # Check worker TypeScript
npx tsc -p tsconfig.cli.json --noEmit  # Check CLI TypeScript
```

### 4. Key Management Validation (Critical for Encryption Features)
```bash
# Test encryption key workflow
dedpaste keys --gen-key
dedpaste keys --my-key              # Export public key
dedpaste keys --diagnostics         # Run key diagnostics
```

## Repository Structure

### Key Directories
- `src/` - Cloudflare Worker TypeScript source (3 files)
  - `index.ts` - Main worker entry point
  - `muiStyles.ts` - Material-UI styling
  - `types/index.ts` - Shared type definitions
- `cli/` - CLI TypeScript source (14 files)
  - `index.ts` - Main CLI entry point (~2000 lines)
  - `pgpUtils.ts` - PGP encryption utilities (~1400 lines)
  - `enhancedInteractiveMode.ts` - Advanced TUI mode (~1400 lines)
  - Other encryption, key management, and utility modules
- `test/` - Mocha test suite (4 test files)
- `completion/` - Pre-built shell completion scripts
- `dist/` - Compiled Worker JavaScript (generated)

### Configuration Files
- `package.json` - NPM configuration and scripts
- `tsconfig.json` - TypeScript config for Worker
- `tsconfig.cli.json` - TypeScript config for CLI
- `wrangler.toml` - Cloudflare Workers configuration
- `.gitignore` - Git ignore patterns

## Common Issues and Solutions

### Build Issues
- **TypeScript errors**: Check both `tsconfig.json` and `tsconfig.cli.json`
- **Missing dependencies**: Run `npm ci` to reinstall
- **Build artifacts**: Compiled JS files are in-place for CLI, `dist/` for Worker

### CLI Issues
- **Command not found**: Run `npm link` to install globally
- **Network errors**: Expected in sandbox - CLI needs internet for paste operations
- **Key generation fails**: Check `~/.dedpaste/` directory permissions

### Development Server Issues
- **Slow startup**: Normal, can take 2+ minutes
- **Network errors**: Expected without Cloudflare credentials
- **Build loops**: May restart frequently during development

## Important Notes

### Timing Requirements
- **NEVER CANCEL** build or test commands
- Build: 3 seconds (set 30+ second timeout)
- Tests: 32 seconds (set 60+ second timeout)  
- Deploy: 2 minutes (set 180+ second timeout)
- Dev server: 2+ minutes to start (set 180+ second timeout)

### TypeScript Migration Status
- ✅ **COMPLETED**: All CLI files migrated to TypeScript
- ✅ **FUNCTIONAL**: Both Worker and CLI compile successfully
- ✅ **VALIDATED**: CLI tested and working with compiled modules

### Code Style Requirements
- **Always run `npm run build`** before committing
- **Always run `npm test`** to validate functionality
- **Format with 2-space indentation** (spaces not tabs)
- **Use TypeScript types everywhere** - avoid `any`
- **Follow camelCase** for variables, PascalCase for types

### Key Features to Understand
- **End-to-end encryption**: RSA, PGP, and AES support
- **Friend-to-friend encryption**: Key management for trusted contacts
- **PGP integration**: Full GPG keyserver and Keybase support
- **One-time pastes**: Self-destructing content
- **Material-UI interface**: Modern web frontend
- **Shell completion**: Pre-built Bash and Zsh scripts

### Testing Notes
- 2 tests currently fail (friend-encryption and PGP decryption)
- This is a known issue and does not block development
- 23 tests pass, including core encryption functionality
- Manual integration tests documented in test output

### Network Dependencies
- CLI requires internet access for paste operations
- Worker deployment requires Cloudflare credentials
- Local development server works offline with limitations
- Key generation and management work completely offline

## Common Development Tasks

### Adding New Features
1. Always run full validation scenario first
2. Check if changes affect both Worker and CLI
3. Update type definitions in `src/types/index.ts` if needed
4. Add tests in `test/` directory following existing patterns
5. Update documentation in README.md
6. Run `npm run build && npm test` before committing

### Debugging Encryption Issues
1. Use `dedpaste keys --diagnostics` for key debugging
2. Enable verbose logging with `--verbose` or `--debug` flags
3. Check key storage in `~/.dedpaste/` directory
4. Test with `dedpaste keys --gen-key` for fresh keys

### Working with Tests
1. Tests include comprehensive encryption validation
2. Manual integration test instructions are in test output
3. Focus on green tests - 2 failing tests are known issues
4. Add new tests following Mocha patterns in `test/` directory

---

**Remember: This is a TypeScript-first codebase with comprehensive encryption features. Always validate encryption functionality when making changes related to keys, PGP, or secure communication.**