// Key diagnostics utility
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { loadKeyDatabase, DEFAULT_KEY_DIR, FRIENDS_KEY_DIR, PGP_KEY_DIR, KEYBASE_KEY_DIR } from './keyManager.js';
import { validatePgpKey } from './pgpUtils.js';
/**
 * Run diagnostics on the key database and file structure
 * @returns Diagnostics results
 */
async function runKeyDiagnostics() {
    const results = {
        status: 'ok',
        errors: [],
        warnings: [],
        keyDatabase: null,
        filesystemChecks: {
            directories: {},
            files: {
                friends: {},
                pgp: {},
                keybase: {}
            }
        },
        keyStats: {
            self: false,
            friends: 0,
            pgp: 0,
            keybase: 0,
            total: 0
        },
        gpgKeyring: {
            available: false,
            version: null,
            keys: []
        }
    };
    // Check directories
    const dirPaths = [
        DEFAULT_KEY_DIR,
        FRIENDS_KEY_DIR,
        PGP_KEY_DIR,
        KEYBASE_KEY_DIR
    ];
    for (const dir of dirPaths) {
        try {
            const exists = fs.existsSync(dir);
            results.filesystemChecks.directories[dir] = {
                exists,
                writable: exists ? await isDirectoryWritable(dir) : false
            };
            if (!exists) {
                results.warnings.push(`Directory not found: ${dir}`);
            }
            else if (!results.filesystemChecks.directories[dir].writable) {
                results.warnings.push(`Directory not writable: ${dir}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.errors.push(`Error checking directory ${dir}: ${errorMessage}`);
        }
    }
    // Load and check key database
    try {
        const db = await loadKeyDatabase();
        results.keyDatabase = db;
        // Check stats
        results.keyStats.self = db.keys.self !== null;
        results.keyStats.friends = Object.keys(db.keys.friends || {}).length;
        results.keyStats.pgp = Object.keys(db.keys.pgp || {}).length;
        results.keyStats.keybase = Object.keys(db.keys.keybase || {}).length;
        results.keyStats.total =
            results.keyStats.friends +
                results.keyStats.pgp +
                results.keyStats.keybase +
                (results.keyStats.self ? 1 : 0);
        // Verify self key files
        if (db.keys.self) {
            const selfKey = db.keys.self;
            const privateKeyPath = typeof selfKey.path === 'object' ? selfKey.path.private : selfKey.private || '';
            const publicKeyPath = typeof selfKey.path === 'object' ? selfKey.path.public : selfKey.public || '';
            results.filesystemChecks.files.self = {
                private: {
                    path: privateKeyPath,
                    exists: fs.existsSync(privateKeyPath),
                    readable: fs.existsSync(privateKeyPath) ?
                        await isFileReadable(privateKeyPath) : false
                },
                public: {
                    path: publicKeyPath,
                    exists: fs.existsSync(publicKeyPath),
                    readable: fs.existsSync(publicKeyPath) ?
                        await isFileReadable(publicKeyPath) : false
                }
            };
            if (!results.filesystemChecks.files.self.private.exists) {
                results.errors.push(`Self private key file not found: ${privateKeyPath}`);
            }
            if (!results.filesystemChecks.files.self.public.exists) {
                results.errors.push(`Self public key file not found: ${publicKeyPath}`);
            }
        }
        // Verify friend keys
        results.filesystemChecks.files.friends = {};
        for (const [name, info] of Object.entries(db.keys.friends || {})) {
            const keyPath = typeof info.path === 'string' ? info.path : info.public || '';
            const fileInfo = {
                path: keyPath,
                exists: fs.existsSync(keyPath),
                readable: fs.existsSync(keyPath) ?
                    await isFileReadable(keyPath) : false
            };
            results.filesystemChecks.files.friends[name] = fileInfo;
            if (!fileInfo.exists) {
                results.warnings.push(`Friend public key file not found: ${keyPath} (${name})`);
            }
        }
        // Verify PGP keys
        results.filesystemChecks.files.pgp = {};
        for (const [name, info] of Object.entries(db.keys.pgp || {})) {
            const keyPath = typeof info.path === 'string' ? info.path : '';
            const fileInfo = {
                path: keyPath,
                exists: fs.existsSync(keyPath),
                readable: fs.existsSync(keyPath) ?
                    await isFileReadable(keyPath) : false,
                valid: false
            };
            results.filesystemChecks.files.pgp[name] = fileInfo;
            if (!fileInfo.exists) {
                results.warnings.push(`PGP key file not found: ${keyPath} (${name})`);
            }
            else if (fileInfo.readable) {
                try {
                    const content = await fsPromises.readFile(keyPath, 'utf8');
                    const validationResult = await validatePgpKey(content);
                    fileInfo.valid = typeof validationResult === 'boolean' ? validationResult : validationResult.valid;
                    if (!fileInfo.valid) {
                        results.warnings.push(`Invalid PGP key format: ${keyPath} (${name})`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.warnings.push(`Error reading PGP key: ${keyPath} (${name}): ${errorMessage}`);
                }
            }
        }
        // Verify Keybase keys
        results.filesystemChecks.files.keybase = {};
        for (const [name, info] of Object.entries(db.keys.keybase || {})) {
            const keyPath = typeof info.path === 'string' ? info.path : '';
            const fileInfo = {
                path: keyPath,
                exists: fs.existsSync(keyPath),
                readable: fs.existsSync(keyPath) ?
                    await isFileReadable(keyPath) : false,
                valid: false
            };
            results.filesystemChecks.files.keybase[name] = fileInfo;
            if (!fileInfo.exists) {
                results.warnings.push(`Keybase key file not found: ${keyPath} (${name})`);
            }
            else if (fileInfo.readable) {
                try {
                    const content = await fsPromises.readFile(keyPath, 'utf8');
                    const validationResult = await validatePgpKey(content);
                    fileInfo.valid = typeof validationResult === 'boolean' ? validationResult : validationResult.valid;
                    if (!fileInfo.valid) {
                        results.warnings.push(`Invalid Keybase key format: ${keyPath} (${name})`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.warnings.push(`Error reading Keybase key: ${keyPath} (${name}): ${errorMessage}`);
                }
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error loading key database: ${errorMessage}`);
    }
    // Check GPG keyring
    try {
        const gpgInfo = await checkGpgKeyring();
        results.gpgKeyring = gpgInfo;
        if (gpgInfo.available) {
            results.warnings = results.warnings.filter(warning => {
                // Remove warnings about missing PGP keys if they're in the GPG keyring
                if (warning.includes('PGP key file not found')) {
                    const keyId = warning.match(/fingerprint: ([A-F0-9]+)/i);
                    if (keyId && gpgInfo.keys.some(k => k.id.includes(keyId[1]))) {
                        return false; // Remove the warning
                    }
                }
                return true;
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.warnings.push(`Error checking GPG keyring: ${errorMessage}`);
    }
    // Set final status
    if (results.errors.length > 0) {
        results.status = 'error';
    }
    else if (results.warnings.length > 0) {
        results.status = 'warning';
    }
    return results;
}
/**
 * Check if a directory is writable
 * @param directory - Directory path
 * @returns True if writable
 */
async function isDirectoryWritable(directory) {
    try {
        // Try to write a temporary file
        const testFile = path.join(directory, `.test-${Date.now()}`);
        await fsPromises.writeFile(testFile, 'test');
        await fsPromises.unlink(testFile);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Check if a file is readable
 * @param filePath - File path
 * @returns True if readable
 */
async function isFileReadable(filePath) {
    try {
        await fsPromises.access(filePath, fs.constants.R_OK);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Check GPG keyring status and get key list
 * @returns GPG keyring info
 */
async function checkGpgKeyring() {
    const result = {
        available: false,
        version: null,
        keys: []
    };
    try {
        // Import child_process dynamically
        const childProcess = await import('child_process');
        const { execFile } = childProcess;
        // Promisify execFile with timeout and kill functionality
        const execFilePromise = (cmd, args, timeout = 5000) => {
            return new Promise((resolve) => {
                let procKilled = false;
                let proc;
                // Set a timeout to avoid hanging
                const timeoutId = setTimeout(() => {
                    procKilled = true;
                    if (proc && proc.pid) {
                        try {
                            // Force kill the process if it doesn't respond
                            process.kill(proc.pid, 'SIGKILL');
                        }
                        catch (killError) {
                            // Ignore kill errors - process might have already exited
                        }
                    }
                    resolve({
                        error: new Error('Command timed out after ' + timeout + 'ms'),
                        stdout: '',
                        stderr: 'Timeout - process killed to prevent hanging',
                        timedOut: true
                    });
                }, timeout);
                try {
                    proc = execFile(cmd, args, { timeout: timeout - 500 }, (error, stdout, stderr) => {
                        if (procKilled)
                            return; // Already handled by timeout
                        clearTimeout(timeoutId);
                        resolve({ error, stdout: stdout || '', stderr: stderr || '', timedOut: false });
                    });
                    // Additional safeguards for unresponsive processes
                    proc.on('error', (err) => {
                        if (procKilled)
                            return; // Already handled by timeout
                        clearTimeout(timeoutId);
                        resolve({ error: err, stdout: '', stderr: err.message, timedOut: false });
                    });
                }
                catch (execError) {
                    if (procKilled)
                        return; // Already handled by timeout
                    clearTimeout(timeoutId);
                    const error = execError instanceof Error ? execError : new Error(String(execError));
                    resolve({ error, stdout: '', stderr: error.message, timedOut: false });
                }
            });
        };
        // Check if GPG is available
        const versionCheck = await execFilePromise('gpg', ['--version']);
        if (versionCheck.error) {
            return result; // GPG not available
        }
        // Extract version
        const versionMatch = versionCheck.stdout.match(/gpg \(GnuPG\) ([\d.]+)/);
        if (versionMatch) {
            result.version = versionMatch[1];
            result.available = true;
        }
        // List keys with a longer timeout for slow GPG agents
        const keyList = await execFilePromise('gpg', ['--list-keys', '--with-colons'], 8000);
        if (!keyList.error && keyList.stdout) {
            // Parse colon format
            const lines = keyList.stdout.split('\n');
            let currentKey = null;
            for (const line of lines) {
                const fields = line.split(':');
                if (fields[0] === 'pub') {
                    // Start a new key
                    currentKey = {
                        id: fields[4] || '',
                        type: 'public',
                        created: fields[5] ? new Date(parseInt(fields[5]) * 1000).toISOString() : null,
                        expires: fields[6] && fields[6] !== '' ? new Date(parseInt(fields[6]) * 1000).toISOString() : null,
                        trust: fields[1] || '',
                        uids: []
                    };
                    result.keys.push(currentKey);
                }
                else if (fields[0] === 'uid' && currentKey) {
                    // Add a user ID to the current key
                    currentKey.uids.push({
                        uid: fields[9] || '',
                        trust: fields[1] || ''
                    });
                }
            }
        }
    }
    catch (error) {
        // GPG integration not available
    }
    return result;
}
/**
 * Generate a user-friendly report from diagnostics results
 * @param results - Diagnostics results
 * @returns Formatted report
 */
function formatDiagnosticsReport(results) {
    let report = `# DedPaste Key System Diagnostic Report\n\n`;
    // Status summary
    report += `## Status: ${results.status.toUpperCase()}\n\n`;
    if (results.errors.length > 0) {
        report += `### Errors (${results.errors.length}):\n`;
        results.errors.forEach(error => {
            report += `- ❌ ${error}\n`;
        });
        report += '\n';
    }
    if (results.warnings.length > 0) {
        report += `### Warnings (${results.warnings.length}):\n`;
        results.warnings.forEach(warning => {
            report += `- ⚠️ ${warning}\n`;
        });
        report += '\n';
    }
    // Key statistics
    report += `## Key Statistics\n\n`;
    report += `- Self key: ${results.keyStats.self ? '✅ Present' : '❌ Missing'}\n`;
    report += `- Friend keys: ${results.keyStats.friends}\n`;
    report += `- PGP keys: ${results.keyStats.pgp}\n`;
    report += `- Keybase keys: ${results.keyStats.keybase}\n`;
    report += `- Total keys: ${results.keyStats.total}\n\n`;
    // GPG keyring
    report += `## GPG Keyring\n\n`;
    if (results.gpgKeyring.available) {
        report += `- ✅ GPG available (version ${results.gpgKeyring.version})\n`;
        report += `- Found ${results.gpgKeyring.keys.length} keys in keyring\n`;
        if (results.gpgKeyring.keys.length > 0) {
            report += '\n### GPG Keys:\n';
            results.gpgKeyring.keys.forEach(key => {
                const uid = key.uids.length > 0 ? key.uids[0].uid : 'No user ID';
                report += `- Key: ${key.id}\n  - User: ${uid}\n  - Created: ${key.created ? new Date(key.created).toLocaleString() : 'unknown'}\n`;
            });
        }
    }
    else {
        report += `- ❌ GPG not available or not in path\n`;
        report += `  Consider installing GPG for improved key management\n`;
    }
    // Directory checks
    report += `\n## Directory Checks\n\n`;
    for (const [dir, info] of Object.entries(results.filesystemChecks.directories)) {
        const status = info.exists && info.writable ? '✅' : info.exists ? '⚠️' : '❌';
        report += `- ${status} ${dir}: ${info.exists ? (info.writable ? 'OK' : 'Not writable') : 'Not found'}\n`;
    }
    // File checks (simplified)
    if (results.filesystemChecks.files.self) {
        report += `\n## Self Key Files\n\n`;
        const privateStatus = results.filesystemChecks.files.self.private.exists ? '✅' : '❌';
        const publicStatus = results.filesystemChecks.files.self.public.exists ? '✅' : '❌';
        report += `- ${privateStatus} Private key: ${results.filesystemChecks.files.self.private.path}\n`;
        report += `- ${publicStatus} Public key: ${results.filesystemChecks.files.self.public.path}\n`;
    }
    // Return the formatted report
    return report;
}
/**
 * Find key by criteria in any key collection
 * @param db - Key database
 * @param criteria - Search criteria
 * @returns Matching keys
 */
function findKeysMatchingCriteria(db, criteria) {
    const matches = [];
    // Function to check if a key matches criteria
    const isMatch = (key, info, type, name) => {
        for (const [field, value] of Object.entries(criteria)) {
            // Handle regex pattern
            if (typeof value === 'object' && value instanceof RegExp) {
                const fieldValue = info[field];
                if (!fieldValue || !value.test(fieldValue.toString())) {
                    return false;
                }
            }
            // Handle exact matches
            else if (info[field] !== value) {
                return false;
            }
        }
        // All criteria matched
        return {
            type,
            name,
            info: { ...info }
        };
    };
    // Check self key
    if (db.keys.self) {
        const match = isMatch(db.keys.self, db.keys.self, 'self', 'self');
        if (match)
            matches.push(match);
    }
    // Check friend keys
    for (const [name, info] of Object.entries(db.keys.friends)) {
        const match = isMatch(info, info, 'friend', name);
        if (match)
            matches.push(match);
    }
    // Check PGP keys
    for (const [name, info] of Object.entries(db.keys.pgp || {})) {
        const match = isMatch(info, info, 'pgp', name);
        if (match)
            matches.push(match);
    }
    // Check Keybase keys
    for (const [name, info] of Object.entries(db.keys.keybase || {})) {
        const match = isMatch(info, info, 'keybase', name);
        if (match)
            matches.push(match);
    }
    return matches;
}
export { runKeyDiagnostics, formatDiagnosticsReport, findKeysMatchingCriteria, checkGpgKeyring };
