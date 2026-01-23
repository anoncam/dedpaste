# Dependency Security Analysis Report

**Generated:** 2026-01-23  
**Tool:** Sonatype MCP (Model Context Protocol)  
**Repository:** anoncam/dedpaste  
**Version:** 1.22.0

## Executive Summary

This report analyzes all 32 dependencies (19 production + 13 devDependencies) in the dedpaste project using Sonatype's security scanning tools. The analysis identifies security vulnerabilities, licensing information, and end-of-life status for each dependency.

### Key Findings

- **Total Dependencies Analyzed:** 32
- **Vulnerabilities Found:** 1 (Medium Severity)
- **End-of-Life Packages:** 2 (devDependencies only)
- **Malicious Packages:** 0

## Vulnerability Details

### 🔴 MEDIUM SEVERITY: openpgp@6.2.2

**Package:** openpgp@6.2.2  
**Category:** Production Dependency  
**Vulnerability ID:** sonatype-2013-0185  
**CVSS Score:** 4.8 (Medium)  
**Status:** Present in current version and latest version (6.3.0)

**Impact:** The openpgp library is a core dependency used for PGP/GPG encryption functionality in the CLI tool. This vulnerability affects the encryption/decryption capabilities of the application.

**Recommendation:** 
- Monitor for security patches from the openpgp maintainers
- The vulnerability exists in both 6.2.2 and 6.3.0, so updating to latest may not resolve the issue
- Consider reviewing the specific CVE details to assess actual risk in your usage context

## Production Dependencies Analysis

### ✅ No Vulnerabilities Found (18 packages)

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @emotion/react | 11.14.0 | MIT | ✅ Clean |
| @emotion/server | 11.11.0 | MIT | ✅ Clean |
| @emotion/styled | 11.14.1 | MIT | ✅ Clean |
| @mui/material | 7.3.1 | MIT | ✅ Clean |
| clipboardy | 4.0.0 | MIT | ✅ Clean |
| commander | 13.1.0 | MIT | ✅ Clean |
| eslint | 9.34.0 | MIT, BSD-3-Clause | ✅ Clean |
| highlight.js | 11.11.1 | MIT, BSD-3-Clause, CC-BY-SA-4.0 | ✅ Clean |
| inquirer | 12.9.4 | MIT | ✅ Clean |
| keybase-api | 0.0.1 | GPL-3.0, GPL-3.0+ | ✅ Clean |
| marked | 16.2.0 | MIT, BSD-3-Clause | ✅ Clean |
| mime-types | 2.1.35 | MIT | ✅ Clean |
| mixpanel | 0.18.1 | MIT | ✅ Clean |
| node-fetch | 3.3.2 | MIT | ✅ Clean |
| prettier | 3.6.2 | MIT | ✅ Clean |
| uuid | 13.0.0 | MIT | ✅ Clean |

## Development Dependencies Analysis

### ⚠️ End-of-Life Packages (2)

These packages are marked as end-of-life but have no known vulnerabilities:

1. **@types/highlight.js@9.12.4**
   - Status: End of Life
   - License: MIT
   - Vulnerabilities: None
   - Recommendation: Consider updating to a maintained version

2. **@types/marked@5.0.2**
   - Status: End of Life
   - License: MIT
   - Vulnerabilities: None
   - Recommendation: Consider updating to a maintained version

### ✅ No Vulnerabilities Found (11 packages)

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @cloudflare/workers-types | 4.20250303.0 | MIT, Apache-2.0 | ✅ Clean |
| @types/inquirer | 9.0.9 | MIT | ✅ Clean |
| @types/mime-types | 3.0.1 | MIT | ✅ Clean |
| @types/node | 22.13.10 | MIT | ✅ Clean |
| chai | 6.2.2 | MIT | ✅ Clean |
| concurrently | 9.1.2 | MIT | ✅ Clean |
| jest | 29.7.0 | MIT | ✅ Clean |
| mocha | 11.7.5 | MIT | ✅ Clean |
| typescript | 5.8.2 | Apache-2.0 | ✅ Clean |
| wrangler | 4.60.0 | MIT, Apache-2.0-MIT, BSD-3-Clause | ✅ Clean |

## License Compliance

### License Distribution

- **MIT:** 27 packages (84%)
- **Apache-2.0:** 3 packages (9%)
- **BSD-3-Clause:** 3 packages (9%)
- **GPL-3.0:** 1 package (3%)
- **LGPL-3.0:** 1 package (3% - openpgp)
- **CC-BY-SA-4.0:** 1 package (3%)

### License Concerns

**openpgp@6.2.2** uses multiple licenses including LGPL-3.0, which has copyleft requirements. Ensure your project's license (ISC) is compatible with LGPL usage.

## Recommendations

### Immediate Actions

1. **Investigate openpgp vulnerability (sonatype-2013-0185)**
   - Research the specific CVE details
   - Assess whether your usage patterns are affected
   - Monitor for security patches

2. **Update End-of-Life Type Definitions**
   - Update @types/highlight.js to a maintained version
   - Update @types/marked to a maintained version

### Maintenance Actions

3. **Regular Dependency Audits**
   - Schedule quarterly dependency security reviews
   - Enable automated security scanning in CI/CD pipeline
   - Monitor dependency update notifications

4. **License Compliance Review**
   - Review LGPL-3.0 usage implications for openpgp
   - Ensure GPL-3.0 usage of keybase-api is compliant with your distribution model

## Testing Notes

All dependencies were tested against Sonatype's comprehensive security database which includes:
- Known CVEs (Common Vulnerabilities and Exposures)
- Malicious package detection
- License compliance checking
- End-of-life status tracking

## Conclusion

The dedpaste project has a generally healthy dependency profile with only one medium-severity vulnerability identified in the openpgp package. The vulnerability exists in both the current and latest versions, suggesting it may be a known limitation or false positive that requires further investigation.

The presence of two end-of-life type definition packages in devDependencies is a minor concern that should be addressed for long-term maintainability but poses no immediate security risk.

---

**Report Generated by:** Sonatype MCP Security Analysis  
**Next Review Date:** 2026-04-23 (3 months)
