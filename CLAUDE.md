# CLAUDE.md - Guidelines for Working in this Repository

## Build & Test Commands
- **Development**: `npm run dev` - Run local development server
- **Deploy**: `npm run deploy` - Deploy to Cloudflare Workers
- **Build**: `npm run build` - Build TypeScript files
- **Format**: `npm run format` - Format code with Prettier
- **Lint**: `npm run lint` - Lint code with ESLint
- **Install CLI**: `npm link` - Install CLI for local development

## Code Style Guidelines
- **Formatting**: Use 2-space indentation (spaces, not tabs)
- **Naming**:
  - camelCase for variables, functions, methods
  - PascalCase for classes, interfaces, types, enums
  - UPPER_SNAKE_CASE for constants
- **Imports**: Group imports by external libraries, then internal modules
- **Error Handling**: Use try/catch blocks with appropriate error messages
- **Types**: Use TypeScript types everywhere, avoid `any` type when possible
- **Documentation**: Add JSDoc comments for functions and complex logic

## Project Structure
- `src/` - TypeScript source code for the Cloudflare Worker
- `cli/` - Command line interface implementation
- `wrangler.toml` - Cloudflare Workers configuration
- when working through the TODOs.md file, always approach each task comprehensively and validate it functions within the application before marking it complete

## TypeScript Migration Progress (2025-08-25)

### Completed
- ✅ Created comprehensive type definitions in `src/types/index.ts` including:
  - Key management types (KeyInfo, KeyDatabase)
  - Encryption/Decryption types (EncryptionResult, DecryptionResult)
  - Paste types (PasteOptions, PasteResponse)
  - PGP and Keybase types
  - Custom error classes (ValidationError, AuthenticationError, etc.)
  - Service interfaces for future service layer
  - Extended types for GPG integration and diagnostics
- ✅ Migrated `cli/index.js` to `cli/index.ts` (2000+ lines)
  - Added comprehensive type definitions for all command options
  - Properly typed all async operations and imports
  - Handled dynamic imports with appropriate typing
- ✅ Migrated `cli/pgpUtils.js` to `cli/pgpUtils.ts` (1445 lines)
  - Added detailed type interfaces for PGP operations
  - Typed all openpgp library interactions
  - Properly handled GPG keyring integration types
- ✅ Migrated `cli/keybaseUtils.js` to `cli/keybaseUtils.ts`
  - Added complete type definitions for Keybase API responses
  - Properly typed all async operations and error handling
- ✅ Migrated `cli/interactiveMode.js` to `cli/interactiveMode.ts`
  - Added interfaces for all inquirer prompts
  - Typed all interactive operations
- ✅ Migrated `cli/enhancedInteractiveMode.js` to `cli/enhancedInteractiveMode.ts` (1474 lines)
  - Comprehensive type definitions for enhanced features
  - Dynamic import handling with proper types
  - Full GPG integration typing
- ✅ Migrated `cli/logger.js` to `cli/logger.ts`
  - TypeScript enum for log levels
  - Comprehensive logging interfaces
- ✅ Migrated remaining utility files:
  - `cli/encryptionHelpers.js` → `cli/encryptionHelpers.ts`
  - `cli/keyDiagnostics.js` → `cli/keyDiagnostics.ts` 
  - `cli/unifiedKeyManager.js` → `cli/unifiedKeyManager.ts`
  - `cli/debug-enhanced.js` → `cli/debug-enhanced.ts`
  - `cli/run-enhanced.js` → `cli/run-enhanced.ts`

### In Progress
- 🔄 Fixing remaining TypeScript compilation errors (41 errors remaining)
  - Import path issues (need .js extensions for ES modules)
  - Type mismatches between null/undefined
  - Buffer vs string type conflicts

### Remaining Tasks
- [ ] Complete fixing all TypeScript compilation errors
- [ ] Update TypeScript configuration for strict mode
- [ ] Run comprehensive tests on migrated files
- [ ] Remove old .js files after successful migration and testing
- [ ] Update package.json scripts if needed

### Notes
- All 14 JavaScript files in the CLI directory have been migrated to TypeScript
- The migration maintains backward compatibility with existing JavaScript imports
- Type definitions are centralized in `src/types/index.ts` for consistency
- Some type assertions (as any) were needed for complex dynamic imports
- Next focus: Resolve compilation errors and ensure build passes