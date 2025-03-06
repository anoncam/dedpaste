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