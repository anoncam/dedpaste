---
name: deploy-check
description: Build, type-check, test, and deploy to Cloudflare Workers with verification
disable-model-invocation: true
---

# Deploy Check

Run the full pre-deploy validation pipeline and deploy to Cloudflare Workers.
Stop immediately if any step fails and report the error.

## Steps

1. **Type check** — Run `npx tsc --noEmit` to catch type errors without emitting files
2. **Build** — Run `npm run build` to compile TypeScript for both worker and CLI
3. **Lint** — Run `npm run lint` to check for code quality issues
4. **Test** — Run `npm test` to run the test suite
5. **Deploy** — Run `npm run deploy` to deploy to Cloudflare Workers
6. **Verify** — After deployment, run `curl -s -o /dev/null -w "%{http_code}" https://dedpaste.com` to confirm the worker is responding (expect 200 or 404 for root)

## Failure Handling

- If type check fails: Report the type errors and suggest fixes
- If build fails: Report compilation errors
- If lint fails: Run `npm run format` first, then re-lint. If lint still fails, report remaining issues
- If tests fail: Report which tests failed and why
- If deploy fails: Check wrangler output for auth or config issues
- If verification fails: Check Cloudflare dashboard status

## Output

Provide a summary table:

| Step | Status | Duration |
|------|--------|----------|
| Type check | ✅/❌ | Xs |
| Build | ✅/❌ | Xs |
| Lint | ✅/❌ | Xs |
| Test | ✅/❌ | Xs |
| Deploy | ✅/❌ | Xs |
| Verify | ✅/❌ | Xs |
