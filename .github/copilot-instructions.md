# DedPaste Copilot & AI Assistant Instructions

This document provides instructions for GitHub Copilot and other AI coding assistants when working on the DedPaste codebase, following GitHub's best practices for optimal results.

## 1. Repository Context and Architecture

### Project Overview
DedPaste is a secure, encrypted paste service with:
- **Cloudflare Worker backend** (TypeScript) - Handles API requests and R2 storage
- **CLI tool** (TypeScript) - Command-line interface for paste operations
- **Encryption support** - PGP/GPG encryption with Keybase integration
- **One-time paste capability** - Self-destructing pastes after first view

### Directory Structure
```
dedpaste/
├── src/               # Cloudflare Worker source (TypeScript)
│   ├── index.ts      # Main worker entry point
│   ├── types/        # TypeScript type definitions
│   └── muiStyles.ts  # Material-UI styling utilities
├── cli/              # CLI tool implementation (TypeScript)
│   ├── index.ts      # CLI entry point (2000+ lines)
│   ├── pgpUtils.ts   # PGP encryption utilities
│   ├── keybaseUtils.ts # Keybase integration
│   └── ...           # Other utility modules
├── dist/             # Compiled JavaScript output
├── wrangler.toml     # Cloudflare Worker configuration
└── package.json      # Dependencies and scripts
```

## 2. Code Standards and Conventions

### TypeScript Guidelines
- **Strict type checking** enabled
- **No `any` types** unless absolutely necessary
- **Interfaces over type aliases** for object shapes
- **Explicit return types** for all functions

### Naming Conventions
```typescript
// Variables and functions: camelCase
const pasteContent = "...";
function encryptPaste() { }

// Classes and interfaces: PascalCase
class PasteManager { }
interface PasteOptions { }

// Constants: UPPER_SNAKE_CASE
const MAX_PASTE_SIZE = 10485760;

// File names: camelCase.ts or kebab-case.ts
// Examples: pgpUtils.ts, enhanced-mode.ts
```

### Code Style
- **Indentation**: 2 spaces (not tabs)
- **Line length**: Max 100 characters
- **Imports**: External libraries first, then internal modules
- **Error handling**: Always use try-catch blocks with descriptive messages

## 3. Development Workflow

### Commands
```bash
# Development
npm run dev         # Start local development server
npm run build       # Build TypeScript files
npm run format      # Format with Prettier
npm run lint        # Lint with ESLint

# Deployment
npm run deploy      # Deploy to Cloudflare Workers

# CLI Development
npm link           # Install CLI locally for testing
dedpaste --help    # Test CLI commands
```

### Testing Requirements
Before marking any task as complete:
1. Run `npm run lint` - Must pass without errors
2. Run `npm run build` - Must compile successfully
3. Test the specific feature/fix locally
4. Verify no breaking changes to existing functionality

## 4. Task-Specific Guidelines

### Bug Fixes
When fixing bugs:
```typescript
// BAD: Generic error handling
try {
  // code
} catch (e) {
  console.error(e);
}

// GOOD: Specific error handling with context
try {
  // code
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to encrypt paste: ${message}`);
  throw new EncryptionError(`Encryption failed: ${message}`);
}
```

### Feature Implementation
When adding new features:
1. Check existing patterns in similar files
2. Update TypeScript types in `src/types/index.ts`
3. Follow existing error handling patterns
4. Add appropriate logging using the logger utility

Example from codebase:
```typescript
// From cli/encryptionUtils.ts - Follow this pattern
export async function encryptContent(
  content: string,
  recipient?: string,
  options: EncryptOptions = {}
): Promise<EncryptedResult> {
  // Validate inputs first
  if (!content) {
    throw new ValidationError('Content cannot be empty');
  }
  
  // Use existing utilities
  const keyManager = await getKeyManager();
  
  // Implement feature with proper error handling
  try {
    const encrypted = await performEncryption(content, recipient);
    return { success: true, data: encrypted };
  } catch (error) {
    logger.error('Encryption failed', error);
    throw new EncryptionError(`Failed to encrypt: ${error.message}`);
  }
}
```

### API Endpoint Updates
When modifying the Worker API:
```typescript
// src/index.ts pattern to follow
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Route handling pattern
    if (url.pathname === '/api/paste' && request.method === 'POST') {
      return handleCreatePaste(request, env);
    }
    
    // Always return proper error responses
    return new Response('Not Found', { status: 404 });
  }
};
```

## 5. Common Pitfalls to Avoid

### ❌ DON'T Do This:
1. **Don't create new files unnecessarily** - Edit existing files when possible
2. **Don't add console.log in production code** - Use the logger utility
3. **Don't ignore TypeScript errors** - Fix them properly
4. **Don't commit API keys or secrets** - Use environment variables
5. **Don't create documentation files proactively** - Only when requested

### ✅ DO This Instead:
1. **Use existing utilities and patterns** from the codebase
2. **Follow the established error handling patterns**
3. **Update types when changing interfaces**
4. **Test locally before marking complete**
5. **Keep commits focused and atomic**

## 6. Issue Templates

### Good Issue Example
```markdown
### Bug: Encryption fails for large files

**Problem**: When encrypting files larger than 5MB, the CLI hangs and eventually times out.

**Steps to Reproduce**:
1. Create a 6MB test file: `dd if=/dev/zero of=test.txt bs=1M count=6`
2. Run: `dedpaste -e test.txt`
3. Observe timeout after 30 seconds

**Expected**: File should encrypt successfully or show clear error message

**Acceptance Criteria**:
- [ ] Large files (up to 10MB) encrypt successfully
- [ ] Clear error message if file exceeds limits
- [ ] Update MAX_FILE_SIZE constant if needed
- [ ] Add test case for large file handling

**Files to modify**:
- cli/encryptionUtils.ts - Update encryption logic
- cli/index.ts - Add file size validation
- src/types/index.ts - Update type definitions if needed
```

### Poor Issue Example
```markdown
"Make encryption better"
```

## 7. Security Considerations

### Always:
- Validate all user inputs
- Use parameterized queries for any database operations
- Sanitize content before displaying
- Keep encryption keys in secure storage
- Use environment variables for secrets

### Never:
- Log sensitive information (keys, passwords, tokens)
- Hardcode credentials
- Trust user input without validation
- Store unencrypted sensitive data

## 8. Performance Guidelines

### Optimize for Cloudflare Workers:
- Keep bundle size small (current: ~325KB)
- Use streaming for large files
- Implement proper caching headers
- Minimize external API calls

### CLI Performance:
- Use async/await properly
- Stream large file operations
- Show progress indicators for long operations
- Cache Keybase lookups when possible

## 9. MCP (Model Context Protocol) Integration

When implementing MCP servers or tools:
1. Follow the pattern in the proposed `mcp-server-design.md`
2. Use TypeScript with strict typing
3. Implement proper error handling
4. Document tool schemas clearly
5. Test with Claude Desktop configuration

## 10. Quick Reference

### Environment Variables
```bash
DEDPASTE_URL        # API endpoint
DEDPASTE_API_KEY    # Authentication key
OPENAI_API_KEY      # For AI features
GPG_PATH           # Custom GPG binary path
```

### Key Files
- `CLAUDE.md` - Project-specific AI instructions
- `TODOs.md` - Current task list and roadmap
- `wrangler.toml` - Worker configuration
- `tsconfig.json` - TypeScript configuration

### Common Tasks
```bash
# Check what needs doing
cat TODOs.md | grep "\[ \]"

# Run full validation
npm run lint && npm run build && npm test

# Deploy after changes
npm run deploy

# Test CLI changes
npm link && dedpaste --version
```

## Summary

When working on DedPaste:
1. **Understand the context** - It's a security-focused paste service
2. **Follow existing patterns** - Check similar code before implementing
3. **Test thoroughly** - Encryption and security features must work correctly
4. **Keep it simple** - Don't over-engineer solutions
5. **Document when needed** - But only when explicitly requested

This instruction file helps GitHub Copilot and other AI assistants generate better, more contextual code for the DedPaste project.