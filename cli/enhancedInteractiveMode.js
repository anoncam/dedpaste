// Enhanced interactive mode for key management and encryption
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
// Dynamic imports - these will be loaded at runtime
let modules = {};
// Function to initialize all required modules
async function initModules() {
    try {
        // Import modules dynamically
        const keyManagerModule = await import('./unifiedKeyManager.js');
        modules.unifiedKeyManager = keyManagerModule;
        const diagnosticsModule = await import('./keyDiagnostics.js');
        modules.runKeyDiagnostics = diagnosticsModule.runKeyDiagnostics;
        modules.formatDiagnosticsReport = diagnosticsModule.formatDiagnosticsReport;
        const encryptionModule = await import('./encryptionUtils.js');
        modules.encryptContent = encryptionModule.encryptContent;
        modules.decryptContent = encryptionModule.decryptContent;
        const helpersModule = await import('./encryptionHelpers.js');
        modules.continueWithEncryption = helpersModule.continueWithEncryption;
        modules.safeCheckGpgKeyring = helpersModule.safeCheckGpgKeyring;
        return true;
    }
    catch (error) {
        console.error(`Module initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Show enhanced interactive key management menu
 */
export async function enhancedKeyManagement() {
    try {
        console.log(chalk.blue('Initializing key management system...'));
        // Initialize modules first
        const modulesLoaded = await initModules();
        if (!modulesLoaded) {
            return {
                success: false,
                message: 'Failed to load required modules. Please try again.'
            };
        }
        // Initialize the key manager
        const init = await modules.unifiedKeyManager?.initialize();
        if (!init?.success) {
            return {
                success: false,
                message: `Failed to initialize key system: ${init?.error || 'Unknown error'}`
            };
        }
        // Main menu loop
        let exitMenu = false;
        while (!exitMenu) {
            const answers = await inquirer.prompt([{
                    type: 'list',
                    name: 'action',
                    message: chalk.magenta('🔑') + ' DedPaste Key Management',
                    choices: [
                        { name: chalk.green('List and search keys'), value: 'search' },
                        { name: chalk.green('Add or import key'), value: 'add' },
                        { name: chalk.green('Generate a new key'), value: 'generate' },
                        { name: chalk.green('View key details'), value: 'view' },
                        { name: chalk.green('Export keys'), value: 'export' },
                        { name: chalk.green('Remove keys'), value: 'remove' },
                        { name: chalk.green('Run diagnostics'), value: 'diagnostics' },
                        { name: chalk.red('Exit'), value: 'exit' }
                    ]
                }]);
            switch (answers.action) {
                case 'search':
                    await searchAndListKeys();
                    break;
                case 'add':
                    await addOrImportKey();
                    break;
                case 'generate':
                    await generateNewKey();
                    break;
                case 'view':
                    await viewKeyDetails();
                    break;
                case 'export':
                    await exportKeys();
                    break;
                case 'remove':
                    await removeKeys();
                    break;
                case 'diagnostics':
                    await runDiagnostics();
                    break;
                case 'exit':
                    exitMenu = true;
                    break;
            }
        }
        return {
            success: true,
            message: 'Key management session completed'
        };
    }
    catch (error) {
        return {
            success: false,
            message: `Error in key management: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
/**
 * Search and list keys
 */
export async function searchAndListKeys() {
    try {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'searchMode',
                message: 'How would you like to find keys?',
                choices: [
                    { name: 'List all keys', value: 'all' },
                    { name: 'Search by name', value: 'name' },
                    { name: 'Search by email', value: 'email' },
                    { name: 'Search by fingerprint', value: 'fingerprint' }
                ]
            },
            {
                type: 'input',
                name: 'query',
                message: 'Enter search term:',
                when: (currentAnswers) => currentAnswers.searchMode !== 'all'
            }
        ]);
        // Set up search options
        const searchOptions = {
            includeGpg: true
        };
        // Get keys based on search mode
        let keys;
        if (answers.searchMode === 'all') {
            keys = await modules.unifiedKeyManager?.searchKeys('', searchOptions) || [];
        }
        else {
            keys = await modules.unifiedKeyManager?.searchKeys(answers.query || '', searchOptions) || [];
        }
        if (keys.length === 0) {
            console.log(chalk.yellow('\nNo keys found matching your criteria'));
            return;
        }
        // Group keys by type
        const groupedKeys = {
            self: [],
            friend: [],
            pgp: [],
            keybase: [],
            gpg: []
        };
        for (const key of keys) {
            if (key.source === 'self') {
                groupedKeys.self.push(key);
            }
            else if (key.source === 'friend') {
                groupedKeys.friend.push(key);
            }
            else if (key.source === 'pgp') {
                groupedKeys.pgp.push(key);
            }
            else if (key.source === 'keybase') {
                groupedKeys.keybase.push(key);
            }
            else if (key.source === 'gpg') {
                groupedKeys.gpg.push(key);
            }
        }
        // Print results in a formatted way
        console.log(chalk.bold.green('\n===== Key Search Results ====='));
        // Print self key
        if (groupedKeys.self.length > 0) {
            console.log(chalk.bold.blue('\nSelf Keys:'));
            for (const key of groupedKeys.self) {
                console.log(`- ${chalk.green('Name:')} Self`);
                console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
                console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
                if (key.created) {
                    console.log(`  ${chalk.green('Created:')} ${key.created.toLocaleString()}`);
                }
            }
        }
        // Print friend keys
        if (groupedKeys.friend.length > 0) {
            console.log(chalk.bold.blue('\nFriend Keys:'));
            for (const key of groupedKeys.friend) {
                console.log(`- ${chalk.green('Name:')} ${key.name}`);
                console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
                console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
                if (key.lastUsed) {
                    console.log(`  ${chalk.green('Last Used:')} ${key.lastUsed.toLocaleString()}`);
                }
            }
        }
        // Print PGP keys
        if (groupedKeys.pgp.length > 0) {
            console.log(chalk.bold.blue('\nPGP Keys:'));
            for (const key of groupedKeys.pgp) {
                console.log(`- ${chalk.green('Name:')} ${key.name}`);
                console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
                console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
                if (key.email) {
                    console.log(`  ${chalk.green('Email:')} ${key.email}`);
                }
                if (key.lastUsed) {
                    console.log(`  ${chalk.green('Last Used:')} ${key.lastUsed.toLocaleString()}`);
                }
            }
        }
        // Print Keybase keys
        if (groupedKeys.keybase.length > 0) {
            console.log(chalk.bold.blue('\nKeybase Keys:'));
            for (const key of groupedKeys.keybase) {
                console.log(`- ${chalk.green('Name:')} ${key.name}`);
                console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
                console.log(`  ${chalk.green('Username:')} ${key.username || 'unknown'}`);
                console.log(`  ${chalk.green('Fingerprint:')} ${key.fingerprint}`);
                if (key.email) {
                    console.log(`  ${chalk.green('Email:')} ${key.email}`);
                }
                if (key.lastUsed) {
                    console.log(`  ${chalk.green('Last Used:')} ${key.lastUsed.toLocaleString()}`);
                }
            }
        }
        // Print GPG keys
        if (groupedKeys.gpg.length > 0) {
            console.log(chalk.bold.blue('\nGPG Keyring Keys:'));
            for (const key of groupedKeys.gpg) {
                console.log(`- ${chalk.green('Key ID:')} ${key.id}`);
                console.log(`  ${chalk.green('Name:')} ${key.name}`);
                console.log(`  ${chalk.green('Type:')} ${key.type.toUpperCase()}`);
                if (key.email) {
                    console.log(`  ${chalk.green('Email:')} ${key.email}`);
                }
                if (key.created) {
                    console.log(`  ${chalk.green('Created:')} ${key.created.toLocaleString()}`);
                }
                if (key.expires) {
                    console.log(`  ${chalk.green('Expires:')} ${key.expires.toLocaleString()}`);
                }
            }
        }
        console.log(chalk.bold.green('\n============================='));
        // Ask if user wants to view details of a specific key
        const detailsAnswer = await inquirer.prompt([{
                type: 'confirm',
                name: 'viewDetails',
                message: 'Would you like to view details of a specific key?',
                default: false
            }]);
        if (detailsAnswer.viewDetails) {
            await viewKeyDetails(keys);
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError searching keys: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Add or import a key
 */
export async function addOrImportKey() {
    try {
        const sourceAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'importSource',
                message: 'How would you like to add a key?',
                choices: [
                    { name: 'Import from file', value: 'file' },
                    { name: 'Fetch from PGP keyserver', value: 'pgp-server' },
                    { name: 'Fetch from Keybase', value: 'keybase' },
                    { name: 'Import from GPG keyring', value: 'gpg-keyring' },
                    { name: 'Import to GPG keyring', value: 'gpg-import' },
                    { name: 'Paste key content', value: 'paste' }
                ]
            }]);
        let options = { source: sourceAnswer.importSource };
        // Handle different import sources
        switch (sourceAnswer.importSource) {
            case 'file': {
                const fileAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'filePath',
                        message: 'Enter the path to the key file:',
                        validate: (input) => {
                            if (!input)
                                return 'Path cannot be empty';
                            if (!fs.existsSync(input))
                                return 'File does not exist';
                            return true;
                        }
                    },
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Enter a name for this key (leave empty to use default):',
                        default: ''
                    }
                ]);
                options.file = fileAnswers.filePath;
                if (fileAnswers.name)
                    options.name = fileAnswers.name;
                break;
            }
            case 'pgp-server': {
                const pgpAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'identifier',
                        message: 'Enter email address or key ID:',
                        validate: (input) => input ? true : 'Identifier cannot be empty'
                    },
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Enter a name for this key (leave empty to use default):',
                        default: ''
                    }
                ]);
                if (pgpAnswers.identifier?.includes('@')) {
                    options.email = pgpAnswers.identifier;
                }
                else {
                    options.keyId = pgpAnswers.identifier;
                }
                if (pgpAnswers.name)
                    options.name = pgpAnswers.name;
                break;
            }
            case 'keybase': {
                const keybaseAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'username',
                        message: 'Enter Keybase username:',
                        validate: (input) => input ? true : 'Username cannot be empty'
                    },
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Enter a name for this key (leave empty to use default):',
                        default: ''
                    },
                    {
                        type: 'confirm',
                        name: 'verify',
                        message: 'Verify Keybase proofs?',
                        default: true
                    }
                ]);
                options.username = keybaseAnswers.username;
                if (keybaseAnswers.name)
                    options.name = keybaseAnswers.name;
                options.verify = keybaseAnswers.verify;
                break;
            }
            case 'gpg-keyring': {
                // Check if GPG is available
                const gpgInfo = await modules.unifiedKeyManager?.initialize();
                if (!gpgInfo?.gpg || !gpgInfo.gpg.available) {
                    console.log(chalk.red('\nGPG is not available on your system'));
                    return;
                }
                // List available GPG keys for selection
                console.log(chalk.blue('\nAvailable GPG keys:'));
                const gpgKeys = gpgInfo.gpg.keys.map((key, index) => {
                    const uid = key.uids.length > 0 ? key.uids[0].uid : 'No user ID';
                    return {
                        name: `${key.id} - ${uid}`,
                        value: key.id,
                        short: key.id
                    };
                });
                if (gpgKeys.length === 0) {
                    console.log(chalk.yellow('No keys found in GPG keyring'));
                    return;
                }
                const gpgAnswers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'keyId',
                        message: 'Select a key from GPG keyring:',
                        choices: gpgKeys
                    },
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Enter a name for this key (leave empty to use default):',
                        default: ''
                    }
                ]);
                options.keyId = gpgAnswers.keyId;
                if (gpgAnswers.name)
                    options.name = gpgAnswers.name;
                break;
            }
            case 'gpg-import': {
                const gpgImportAnswers = await inquirer.prompt([{
                        type: 'editor',
                        name: 'content',
                        message: 'Paste the PGP key to import to GPG keyring:',
                        validate: (input) => {
                            if (!input)
                                return 'Key content cannot be empty';
                            if (!input.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
                                return 'Invalid PGP key format';
                            }
                            return true;
                        }
                    }]);
                options.content = gpgImportAnswers.content;
                break;
            }
            case 'paste': {
                const pasteAnswers = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'content',
                        message: 'Paste the key content:',
                        validate: (input) => input ? true : 'Key content cannot be empty'
                    },
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Enter a name for this key:',
                        validate: (input) => input ? true : 'Name cannot be empty'
                    }
                ]);
                // Change to file source with content
                options.source = 'file';
                options.content = pasteAnswers.content;
                options.name = pasteAnswers.name;
                break;
            }
        }
        // Show a "working" message for operations that might take time
        console.log(chalk.blue('\nImporting key... please wait...'));
        // Import the key
        const result = await modules.unifiedKeyManager?.importKey(options) || { success: false, error: 'Import failed' };
        if (result.success) {
            console.log(chalk.green('\n✓ Key imported successfully!'));
            // Display key details
            console.log(chalk.bold('\nKey details:'));
            console.log(`- ${chalk.green('Type:')} ${result.type || 'Unknown'}`);
            console.log(`- ${chalk.green('Name:')} ${result.name || 'Unknown'}`);
            if (result.fingerprint) {
                console.log(`- ${chalk.green('Fingerprint:')} ${result.fingerprint}`);
            }
            if (result.email) {
                console.log(`- ${chalk.green('Email:')} ${result.email}`);
            }
            if (result.username) {
                console.log(`- ${chalk.green('Username:')} ${result.username}`);
            }
            if (result.path) {
                console.log(`- ${chalk.green('Stored at:')} ${result.path}`);
            }
            if (result.keyId) {
                console.log(`- ${chalk.green('Key ID:')} ${result.keyId}`);
            }
            if (result.output) {
                console.log(`\n${result.output}`);
            }
        }
        else {
            console.log(chalk.red(`\n✗ Import failed: ${result.error || 'Unknown error'}`));
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError importing key: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Generate a new key pair
 */
export async function generateNewKey() {
    try {
        const confirmAnswer = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Generate a new RSA key pair? This will overwrite your existing self key if present.',
                default: false
            }]);
        if (!confirmAnswer.confirm)
            return;
        console.log(chalk.blue('\nGenerating new key pair... please wait...'));
        // Generate the key
        const result = await modules.unifiedKeyManager?.generateKey() || { success: false, error: 'Generation failed' };
        if (result.success) {
            console.log(chalk.green('\n✓ Key generated successfully!'));
            console.log(`- ${chalk.green('Private key:')} ${result.privateKeyPath || 'Unknown'}`);
            console.log(`- ${chalk.green('Public key:')} ${result.publicKeyPath || 'Unknown'}`);
            // Offer to back up the key
            const backupAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'backup',
                    message: 'Would you like to export your keys to a backup location?',
                    default: true
                }]);
            if (backupAnswer.backup) {
                const backupDirAnswer = await inquirer.prompt([{
                        type: 'input',
                        name: 'backupDir',
                        message: 'Enter a directory to save backups:',
                        default: path.join(homedir(), 'dedpaste-backup'),
                        validate: (input) => input ? true : 'Directory cannot be empty'
                    }]);
                // Create backup directory if it doesn't exist
                const backupDir = backupDirAnswer.backupDir || path.join(homedir(), 'dedpaste-backup');
                await fsPromises.mkdir(backupDir, { recursive: true });
                // Copy the keys
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const privateKeyBackup = path.join(backupDir, `private-key-${timestamp}.pem`);
                const publicKeyBackup = path.join(backupDir, `public-key-${timestamp}.pem`);
                if (result.privateKeyPath && result.publicKeyPath) {
                    await fsPromises.copyFile(result.privateKeyPath, privateKeyBackup);
                    await fsPromises.copyFile(result.publicKeyPath, publicKeyBackup);
                    console.log(chalk.green('\n✓ Keys backed up successfully!'));
                    console.log(`- ${chalk.green('Private key backup:')} ${privateKeyBackup}`);
                    console.log(`- ${chalk.green('Public key backup:')} ${publicKeyBackup}`);
                    console.log(chalk.yellow('\nIMPORTANT: Keep your private key backup secure!'));
                }
            }
        }
        else {
            console.log(chalk.red(`\n✗ Key generation failed: ${result.error || 'Unknown error'}`));
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError generating key: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * View key details
 * @param preloadedKeys - Optional preloaded keys
 */
export async function viewKeyDetails(preloadedKeys = null) {
    try {
        // If keys are not preloaded, search for all keys
        const keys = preloadedKeys || await modules.unifiedKeyManager?.searchKeys('', { includeGpg: true }) || [];
        if (keys.length === 0) {
            console.log(chalk.yellow('\nNo keys found'));
            return;
        }
        // Prepare choices for key selection
        const keyChoices = keys.map((key) => {
            let label = '';
            if (key.source === 'self') {
                label = `${key.name} (Self Key)`;
            }
            else if (key.source === 'friend') {
                label = `${key.name} (Friend Key)`;
            }
            else if (key.source === 'pgp') {
                label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
            }
            else if (key.source === 'keybase') {
                label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
            }
            else if (key.source === 'gpg') {
                const uid = key.uids && key.uids.length > 0 ? key.uids[0].uid || 'Unknown' : 'Unknown';
                label = `${key.id} (GPG - ${uid})`;
            }
            return {
                name: label,
                value: key.id || key.fingerprint,
                short: key.id || key.fingerprint
            };
        });
        const keyAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'selectedKeyId',
                message: 'Select a key to view details:',
                choices: keyChoices
            }]);
        // Get detailed key info
        const keyInfo = await modules.unifiedKeyManager?.getKeyById(keyAnswer.selectedKeyId, { includeGpg: true }) || null;
        if (!keyInfo) {
            console.log(chalk.red('\nKey not found'));
            return;
        }
        // Display detailed key information
        console.log(chalk.bold.green('\n===== Key Details ====='));
        console.log(`- ${chalk.green('ID:')} ${keyInfo.id}`);
        console.log(`- ${chalk.green('Name:')} ${keyInfo.name}`);
        console.log(`- ${chalk.green('Type:')} ${keyInfo.type.toUpperCase()}`);
        console.log(`- ${chalk.green('Source:')} ${keyInfo.source}`);
        console.log(`- ${chalk.green('Fingerprint:')} ${keyInfo.fingerprint}`);
        if (keyInfo.email) {
            console.log(`- ${chalk.green('Email:')} ${keyInfo.email}`);
        }
        if (keyInfo.username) {
            console.log(`- ${chalk.green('Username:')} ${keyInfo.username}`);
        }
        if (keyInfo.created) {
            console.log(`- ${chalk.green('Created:')} ${keyInfo.created.toLocaleString()}`);
        }
        if (keyInfo.lastUsed) {
            console.log(`- ${chalk.green('Last Used:')} ${keyInfo.lastUsed.toLocaleString()}`);
        }
        if (keyInfo.expires) {
            console.log(`- ${chalk.green('Expires:')} ${keyInfo.expires.toLocaleString()}`);
        }
        if (keyInfo.trust) {
            console.log(`- ${chalk.green('Trust Level:')} ${keyInfo.trust}`);
        }
        if (keyInfo.uids && keyInfo.uids.length > 0) {
            console.log(chalk.green('- User IDs:'));
            keyInfo.uids.forEach(uid => {
                console.log(`  - ${uid.uid || 'Unknown'}`);
            });
        }
        if (keyInfo.path) {
            if (typeof keyInfo.path === 'object' && keyInfo.path.public && keyInfo.path.private) {
                console.log(`- ${chalk.green('Public Key Path:')} ${keyInfo.path.public}`);
                console.log(`- ${chalk.green('Private Key Path:')} ${keyInfo.path.private}`);
            }
            else {
                console.log(`- ${chalk.green('Key Path:')} ${keyInfo.path}`);
            }
        }
        console.log(chalk.bold.green('\n========================='));
        // Offer to view key content
        const contentAnswer = await inquirer.prompt([{
                type: 'confirm',
                name: 'viewContent',
                message: 'Would you like to view the key content?',
                default: false
            }]);
        if (contentAnswer.viewContent) {
            // Ask about private key for self keys
            let viewPrivate = false;
            if (keyInfo.source === 'self') {
                const privateAnswer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'usePrivate',
                        message: 'View private key? (WARNING: Private keys should be kept secure)',
                        default: false
                    }]);
                viewPrivate = privateAnswer.usePrivate || false;
            }
            const keyContent = await modules.unifiedKeyManager?.readKeyContent(keyInfo, {
                private: viewPrivate
            }) || null;
            if (keyContent) {
                console.log(chalk.bold.green('\n===== Key Content ====='));
                console.log(keyContent);
                console.log(chalk.bold.green('\n========================='));
            }
            else {
                console.log(chalk.red('\nCould not read key content'));
            }
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError viewing key details: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Export keys to files
 */
export async function exportKeys() {
    try {
        // Search for all keys
        const keys = await modules.unifiedKeyManager?.searchKeys('', { includeGpg: true }) || [];
        if (keys.length === 0) {
            console.log(chalk.yellow('\nNo keys found to export'));
            return;
        }
        // Prepare choices for key selection
        const keyChoices = keys.map((key) => {
            let label = '';
            if (key.source === 'self') {
                label = `${key.name} (Self Key)`;
            }
            else if (key.source === 'friend') {
                label = `${key.name} (Friend Key)`;
            }
            else if (key.source === 'pgp') {
                label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
            }
            else if (key.source === 'keybase') {
                label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
            }
            else if (key.source === 'gpg') {
                const uid = key.uids && key.uids.length > 0 ? key.uids[0].uid || 'Unknown' : 'Unknown';
                label = `${key.id} (GPG - ${uid})`;
            }
            return {
                name: label,
                value: key.id || key.fingerprint,
                short: key.id || key.fingerprint
            };
        });
        const keyAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'selectedKeyId',
                message: 'Select a key to export:',
                choices: keyChoices
            }]);
        // Get detailed key info
        const keyInfo = await modules.unifiedKeyManager?.getKeyById(keyAnswer.selectedKeyId, { includeGpg: true }) || null;
        if (!keyInfo) {
            console.log(chalk.red('\nKey not found'));
            return;
        }
        // Ask about private key for self keys
        let exportPrivate = false;
        if (keyInfo.source === 'self') {
            const privateAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'usePrivate',
                    message: 'Export private key? (WARNING: Private keys should be kept secure)',
                    default: false
                }]);
            exportPrivate = privateAnswer.usePrivate || false;
        }
        // Get export location
        const exportAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'exportDir',
                message: 'Enter a directory to export the key:',
                default: homedir(),
                validate: (input) => {
                    if (!input)
                        return 'Directory cannot be empty';
                    if (!fs.existsSync(input))
                        return 'Directory does not exist';
                    return true;
                }
            }]);
        // Generate filename based on key type and name
        let filename;
        if (keyInfo.source === 'self') {
            filename = exportPrivate ? 'dedpaste_private_key.pem' : 'dedpaste_public_key.pem';
        }
        else if (keyInfo.type === 'pgp' || keyInfo.type === 'keybase') {
            filename = `${keyInfo.name.replace(/[^a-z0-9_-]/gi, '_')}.asc`;
        }
        else if (keyInfo.type === 'gpg') {
            filename = `gpg_${keyInfo.id.substring(keyInfo.id.length - 8)}.asc`;
        }
        else {
            filename = `${keyInfo.name.replace(/[^a-z0-9_-]/gi, '_')}.pem`;
        }
        const filenameAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'customFilename',
                message: 'Enter a filename (leave empty to use default):',
                default: filename
            }]);
        const exportPath = path.join(exportAnswer.exportDir || path.join(homedir(), 'dedpaste-export'), filenameAnswer.customFilename || filename);
        // Read key content
        const keyContent = await modules.unifiedKeyManager?.readKeyContent(keyInfo, {
            private: exportPrivate
        }) || null;
        if (!keyContent) {
            console.log(chalk.red('\nCould not read key content'));
            return;
        }
        // Write key to file
        await fsPromises.writeFile(exportPath, keyContent);
        console.log(chalk.green(`\n✓ Key exported successfully to: ${exportPath}`));
        if (exportPrivate) {
            console.log(chalk.yellow('\nWARNING: This file contains a private key. Keep it secure!'));
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError exporting key: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Remove keys
 */
export async function removeKeys() {
    try {
        // Search for all keys except GPG (which we can't remove through our interface)
        const keys = await modules.unifiedKeyManager?.searchKeys('', { includeGpg: false }) || [];
        if (keys.length === 0) {
            console.log(chalk.yellow('\nNo keys found to remove'));
            return;
        }
        // Prepare choices for key selection
        const keyChoices = keys.map((key) => {
            let label = '';
            if (key.source === 'self') {
                label = `${key.name} (Self Key)`;
            }
            else if (key.source === 'friend') {
                label = `${key.name} (Friend Key)`;
            }
            else if (key.source === 'pgp') {
                label = `${key.name} (PGP Key${key.email ? ` - ${key.email}` : ''})`;
            }
            else if (key.source === 'keybase') {
                label = `${key.name} (Keybase - ${key.username || 'unknown'})`;
            }
            return {
                name: label,
                value: key.id || key.fingerprint,
                short: key.id || key.fingerprint
            };
        });
        const keyAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'selectedKeyId',
                message: 'Select a key to remove:',
                choices: keyChoices
            }]);
        // Get detailed key info for confirmation
        const keyInfo = await modules.unifiedKeyManager?.getKeyById(keyAnswer.selectedKeyId) || null;
        if (!keyInfo) {
            console.log(chalk.red('\nKey not found'));
            return;
        }
        // Special warning for self key
        let confirmMessage = `Are you sure you want to remove ${keyInfo.name}?`;
        if (keyInfo.source === 'self') {
            confirmMessage = chalk.yellow('WARNING: You are about to remove your personal key. This will prevent decryption of messages sent to you. Are you sure?');
        }
        const confirmAnswer = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: confirmMessage,
                default: false
            }]);
        if (!confirmAnswer.confirm) {
            console.log(chalk.blue('\nOperation cancelled'));
            return;
        }
        // Remove the key
        const result = await modules.unifiedKeyManager?.removeKey(keyAnswer.selectedKeyId) || { success: false, error: 'Removal failed' };
        if (result.success) {
            console.log(chalk.green(`\n✓ Key removed successfully`));
        }
        else {
            console.log(chalk.red(`\n✗ Failed to remove key: ${result.error || 'Unknown error'}`));
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError removing key: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Run key system diagnostics
 */
export async function runDiagnostics() {
    try {
        console.log(chalk.blue('\nRunning key system diagnostics... please wait...'));
        const results = await modules.runKeyDiagnostics?.() || {
            status: 'error',
            errors: ['Diagnostics module not available'],
            warnings: [],
            keyDatabase: null,
            filesystemChecks: { directories: {}, files: {} },
            keyStats: { self: false, friends: 0, pgp: 0, keybase: 0, total: 0 },
            gpgKeyring: { available: false, version: null, keys: [] }
        };
        const report = modules.formatDiagnosticsReport?.(results) || 'Report generation failed';
        console.log('\n' + report);
        // Offer to fix common issues
        if (results.errors.length > 0 || results.warnings.length > 0) {
            const fixAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'fixIssues',
                    message: 'Would you like to attempt to fix issues automatically?',
                    default: true
                }]);
            if (fixAnswer.fixIssues) {
                await fixDiagnosticIssues(results);
            }
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError running diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Fix common diagnostic issues
 * @param diagnosticResults - Results from runKeyDiagnostics
 */
async function fixDiagnosticIssues(diagnosticResults) {
    try {
        // Check for missing directories
        let fixedCount = 0;
        const missingDirs = Object.entries(diagnosticResults.filesystemChecks?.directories || {})
            .filter(([, info]) => !info?.exists)
            .map(([dir]) => dir);
        if (missingDirs.length > 0) {
            console.log(chalk.blue('\nCreating missing directories...'));
            for (const dir of missingDirs) {
                try {
                    await fsPromises.mkdir(dir, { recursive: true });
                    console.log(chalk.green(`✓ Created directory: ${dir}`));
                    fixedCount++;
                }
                catch (error) {
                    console.log(chalk.red(`✗ Failed to create directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            }
        }
        // Check for missing self key
        if (!diagnosticResults.keyStats.self) {
            console.log(chalk.yellow('\nYou have no self key for encryption/decryption.'));
            const generateAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'generateKey',
                    message: 'Would you like to generate a new key?',
                    default: true
                }]);
            if (generateAnswer.generateKey) {
                await generateNewKey();
                fixedCount++;
            }
        }
        // Report results
        if (fixedCount > 0) {
            console.log(chalk.green(`\n✓ Fixed ${fixedCount} issues`));
        }
        else {
            console.log(chalk.yellow('\nNo issues were fixed automatically'));
        }
        // Suggest manual actions for remaining issues
        const remainingIssues = [...diagnosticResults.errors, ...diagnosticResults.warnings];
        if (remainingIssues.length > 0) {
            console.log(chalk.yellow('\nRemaining issues that require manual attention:'));
            remainingIssues.forEach(issue => {
                console.log(`- ${issue}`);
            });
            console.log(chalk.blue('\nSuggested actions:'));
            // Check for permission issues
            const permissionIssues = remainingIssues.some(issue => issue.includes('not writable'));
            if (permissionIssues) {
                console.log('- Check file and directory permissions in the .dedpaste directory');
                console.log(`  Run: chmod -R u+rw ${path.join(homedir(), '.dedpaste')}`);
            }
            // Check for missing/corrupted keys
            const keyIssues = remainingIssues.some(issue => issue.includes('key file not found') ||
                issue.includes('Invalid') ||
                issue.includes('Error reading'));
            if (keyIssues) {
                console.log('- Reimport or regenerate problematic keys');
                console.log('- Check if key files were moved or deleted manually');
            }
        }
    }
    catch (error) {
        console.error(chalk.red(`\nError fixing issues: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
/**
 * Send a message with enhanced interactive features
 */
export async function enhancedInteractiveSend() {
    try {
        console.log(chalk.blue('Initializing interactive send mode...'));
        // Initialize modules first to prevent hanging
        const modulesLoaded = await initModules();
        if (!modulesLoaded) {
            return {
                success: false,
                message: 'Failed to load required modules. Please try again.'
            };
        }
        // Initialize the key manager
        const init = await modules.unifiedKeyManager?.initialize();
        if (!init?.success) {
            return {
                success: false,
                message: `Failed to initialize key system: ${init?.error || 'Unknown error'}`
            };
        }
        // Get message
        const messageAnswer = await inquirer.prompt([{
                type: 'editor',
                name: 'message',
                message: 'Enter your message:',
                validate: (input) => input.trim() !== '' ? true : 'Message cannot be empty'
            }]);
        // Get all recipients (except GPG, which we handle separately)
        const allKeys = await modules.unifiedKeyManager?.searchKeys('', { includeGpg: false }) || [];
        if (allKeys.length === 0) {
            console.log(chalk.yellow('\nNo keys found. Generate a key first with "dedpaste keys --gen-key"'));
            return { success: false, message: 'No keys available' };
        }
        // Filter keys by type for better organization
        const selfKeys = allKeys.filter(key => key.source === 'self');
        const friendKeys = allKeys.filter(key => key.source === 'friend');
        const pgpKeys = allKeys.filter(key => key.source === 'pgp');
        const keybaseKeys = allKeys.filter(key => key.source === 'keybase');
        // Create categorized choices
        const choices = [];
        // Self category
        if (selfKeys.length > 0) {
            choices.push({ name: chalk.bold.blue('--- Self ---'), value: null, disabled: true });
            choices.push(...selfKeys.map(() => ({
                name: 'Self',
                value: null,
                short: 'Self'
            })));
        }
        // Friend category
        if (friendKeys.length > 0) {
            choices.push({ name: chalk.bold.blue('--- Friends ---'), value: null, disabled: true });
            choices.push(...friendKeys.map(key => ({
                name: key.name,
                value: key.id,
                short: key.name
            })));
        }
        // PGP category
        if (pgpKeys.length > 0) {
            choices.push({ name: chalk.bold.blue('--- PGP Keys ---'), value: null, disabled: true });
            choices.push(...pgpKeys.map(key => ({
                name: `${key.name}${key.email ? ` <${key.email}>` : ''}`,
                value: key.id,
                short: key.name
            })));
        }
        // Keybase category
        if (keybaseKeys.length > 0) {
            choices.push({ name: chalk.bold.blue('--- Keybase ---'), value: null, disabled: true });
            choices.push(...keybaseKeys.map(key => ({
                name: `${key.name} (${key.username || 'unknown'})`,
                value: key.id,
                short: key.name
            })));
        }
        // GPG option at the end
        choices.push({ name: chalk.bold.blue('--- Other Options ---'), value: null, disabled: true });
        choices.push({ name: 'Use GPG keyring directly (select a GPG key)', value: 'gpg', short: 'GPG' });
        // Get recipient
        const recipientAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'recipient',
                message: 'Select recipient:',
                choices: choices
            }]);
        let recipientId = recipientAnswer.recipient ?? null;
        // Handle GPG keyring selection with improved error handling
        if (recipientAnswer.recipient === 'gpg') {
            console.log(chalk.blue('Checking GPG keyring (this may take a moment)...'));
            let gpgInfo;
            try {
                // Use the safe GPG check helper function with an increased timeout for better reliability
                gpgInfo = await modules.safeCheckGpgKeyring?.(8000) || { available: false, keys: [], error: 'GPG check failed' }; // 8 second timeout
                // Handle timeout or unavailability
                if (!gpgInfo.available) {
                    let errorMessage = '\nGPG is not available on this system.';
                    if (gpgInfo.timedOut) {
                        errorMessage = '\nGPG check timed out - this may indicate GPG is hanging or not properly configured.';
                    }
                    else if (gpgInfo.error) {
                        errorMessage = `\nGPG error: ${gpgInfo.error}`;
                    }
                    console.log(chalk.yellow(errorMessage));
                    console.log(chalk.blue('Proceeding without GPG integration...'));
                    // Ask if user wants to continue with another encryption option
                    const continueAnswer = await inquirer.prompt([{
                            type: 'confirm',
                            name: 'continueAnyway',
                            message: 'Do you want to continue with another encryption option?',
                            default: true
                        }]);
                    if (!continueAnswer.continueAnyway) {
                        return { success: false, message: 'Operation canceled by user' };
                    }
                    // Provide alternative encryption options
                    const altAnswer = await inquirer.prompt([{
                            type: 'list',
                            name: 'altRecipient',
                            message: 'Select an alternative recipient:',
                            choices: choices.filter(c => c.value !== 'gpg' && !c.disabled)
                        }]);
                    recipientId = altAnswer.altRecipient ?? null;
                    // Continue with the alternative recipient using our helper function
                    return await modules.continueWithEncryption?.(recipientId, messageAnswer.message || '') || { success: false, message: 'Encryption failed' };
                }
            }
            catch (gpgError) {
                console.error(chalk.red(`\nUnexpected error during GPG check: ${gpgError instanceof Error ? gpgError.message : 'Unknown error'}`));
                console.log(chalk.blue('Proceeding without GPG integration...'));
                // Fall back to alternative options due to the error
                const continueAfterErrorAnswer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'continueAfterError',
                        message: 'Would you like to continue with an alternative encryption method?',
                        default: true
                    }]);
                if (!continueAfterErrorAnswer.continueAfterError) {
                    return { success: false, message: 'Operation canceled due to GPG error' };
                }
                // Provide alternative encryption options
                const emergencyAnswer = await inquirer.prompt([{
                        type: 'list',
                        name: 'emergencyRecipient',
                        message: 'Select an alternative recipient:',
                        choices: choices.filter(c => c.value !== 'gpg' && !c.disabled)
                    }]);
                recipientId = emergencyAnswer.emergencyRecipient ?? null;
                return await modules.continueWithEncryption?.(recipientId, messageAnswer.message || '') || { success: false, message: 'Encryption failed' };
            }
            // Add a function to handle alternative encryption options
            const handleAlternativeEncryption = async (reason) => {
                console.log(chalk.yellow(`\n${reason}`));
                // Ask if user wants to continue with another encryption option
                const continueAnswer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'continueWithoutGpg',
                        message: 'Would you like to continue with an alternative encryption method?',
                        default: true
                    }]);
                if (!continueAnswer.continueWithoutGpg) {
                    return { success: false, message: 'Operation canceled by user' };
                }
                // Provide alternative encryption options
                const altMethodAnswer = await inquirer.prompt([{
                        type: 'list',
                        name: 'alternativeMethod',
                        message: 'Select an alternative encryption method:',
                        choices: [
                            { name: 'Password-based encryption', value: 'password' },
                            { name: 'Standard RSA encryption', value: 'default' },
                            { name: 'Create a public paste (no encryption)', value: 'public' }
                        ]
                    }]);
                return await modules.continueWithEncryption?.(altMethodAnswer.alternativeMethod ?? null, messageAnswer.message || '') || { success: false, message: 'Encryption failed' };
            };
            // Normal flow if GPG is available
            if (!gpgInfo || !gpgInfo.available) {
                return await handleAlternativeEncryption('GPG is not available on this system.');
            }
            if (!gpgInfo.keys || gpgInfo.keys.length === 0) {
                console.log(chalk.yellow('\nNo keys found in GPG keyring'));
                // Ask if user wants to continue with another encryption option
                const continueAnswer = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'continueWithoutGpg',
                        message: 'Would you like to continue with an alternative encryption method?',
                        default: true
                    }]);
                if (!continueAnswer.continueWithoutGpg) {
                    return { success: false, message: 'Operation canceled - no GPG keys available' };
                }
                // Provide alternative encryption options
                const altMethodAnswer = await inquirer.prompt([{
                        type: 'list',
                        name: 'alternativeMethod',
                        message: 'Select an alternative encryption method:',
                        choices: [
                            { name: 'Password-based encryption', value: 'password' },
                            { name: 'Create a public paste (no encryption)', value: 'public' }
                        ]
                    }]);
                return await modules.continueWithEncryption?.(altMethodAnswer.alternativeMethod ?? null, messageAnswer.message || '') || { success: false, message: 'Encryption failed' };
            }
            // Create GPG key choices with friendly display names
            // Use try-catch to handle any parsing issues with GPG keys
            let gpgChoices = [];
            try {
                gpgChoices = gpgInfo.keys.map((key) => {
                    // Handle different key UID formats and ensure we always have a readable name
                    let displayName = 'Unknown';
                    if (key.uids && key.uids.length > 0) {
                        const uid = key.uids[0].uid || '';
                        // Extract email if available
                        const emailMatch = uid.match(/<([^>]+)>/);
                        const email = emailMatch ? emailMatch[1] : '';
                        // Extract name if available
                        const nameMatch = uid.match(/^([^<]+)/);
                        const name = nameMatch ? nameMatch[1].trim() : '';
                        displayName = name ? name : email ? email : uid;
                    }
                    return {
                        name: `${displayName} (${key.id})`,
                        value: key.id,
                        short: key.id
                    };
                });
                // Sort keys alphabetically by display name for better UX
                gpgChoices.sort((a, b) => a.name.localeCompare(b.name));
            }
            catch (parseError) {
                console.error('Error parsing GPG keys:', parseError);
                return await handleAlternativeEncryption('Error parsing GPG keys. Please try an alternative method.');
            }
            // Sanity check - make sure we have valid choices
            if (!gpgChoices || gpgChoices.length === 0) {
                return await handleAlternativeEncryption('No valid GPG keys found. Please try an alternative method.');
            }
            const gpgKeyAnswer = await inquirer.prompt([{
                    type: 'list',
                    name: 'gpgKey',
                    message: 'Select a GPG key:',
                    choices: gpgChoices
                }]);
            recipientId = `gpg:${gpgKeyAnswer.gpgKey}`;
        }
        // Get paste options
        const optionsAnswers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isTemp',
                message: 'Create a one-time paste (deleted after first view)?',
                default: false
            },
            {
                type: 'confirm',
                name: 'isPgp',
                message: 'Use PGP encryption? (If no, RSA/AES hybrid encryption will be used)',
                default: recipientAnswer.recipient === 'gpg' || recipientId?.startsWith('gpg:') || false
            }
        ]);
        // Handle different encryption methods
        let encryptedContent;
        if (recipientAnswer.recipient === null) {
            // Encrypt for self
            const result = await modules.encryptContent?.(messageAnswer.message || '', null, optionsAnswers.isPgp);
            encryptedContent = typeof result === 'string' ? result : result?.toString() || '';
        }
        else if (recipientAnswer.recipient === 'gpg' || recipientId?.startsWith('gpg:')) {
            // Export the GPG key and use it directly with timeout protection
            const gpgKeyId = recipientId?.replace(/^gpg:/, '').trim() || '';
            console.log(chalk.blue(`\nPreparing to export GPG key ${gpgKeyId}...`));
            // Use the safe export function that has timeout protection
            const { safeExportGpgKey } = await import('./encryptionHelpers.js');
            const exportResult = await safeExportGpgKey(gpgKeyId, 12000); // 12 second timeout
            if (!exportResult.success) {
                let errorMessage = '\nFailed to export GPG key';
                if (exportResult.timedOut) {
                    errorMessage = '\nGPG key export operation timed out. This could indicate GPG agent is hanging.';
                    console.log(chalk.yellow(errorMessage));
                    console.log(chalk.blue('\nTrying again with alternative encryption...'));
                    // Fall back to standard encryption if GPG export times out
                    const fallbackAnswer = await inquirer.prompt([{
                            type: 'list',
                            name: 'fallbackOption',
                            message: 'Select an alternative encryption method:',
                            choices: [
                                { name: 'Encrypt with password', value: 'password' },
                                { name: 'Cancel operation', value: 'cancel' }
                            ]
                        }]);
                    if (fallbackAnswer.fallbackOption === 'cancel') {
                        return { success: false, message: 'Operation canceled by user' };
                    }
                    // Use password-based encryption as fallback
                    return await modules.continueWithEncryption?.('password', messageAnswer.message || '') || { success: false, message: 'Encryption failed' };
                }
                else if (exportResult.error) {
                    errorMessage = `\nGPG key export error: ${exportResult.error}`;
                }
                console.log(chalk.red(errorMessage));
                return { success: false, message: 'Failed to export GPG key' };
            }
            console.log(chalk.green('\n✓ GPG key exported successfully!'));
            console.log(chalk.blue('\nEncrypting message with PGP...'));
            // Use PGP encryption (always with GPG keys)
            const gpgResult = await modules.encryptContent?.(messageAnswer.message || '', `gpg-user-${gpgKeyId}`, true);
            encryptedContent = typeof gpgResult === 'string' ? gpgResult : gpgResult?.toString() || '';
        }
        else {
            // Encrypt for recipient
            const recipientResult = await modules.encryptContent?.(messageAnswer.message || '', recipientId, optionsAnswers.isPgp);
            encryptedContent = typeof recipientResult === 'string' ? recipientResult : recipientResult?.toString() || '';
        }
        return {
            success: true,
            content: encryptedContent,
            recipient: recipientId,
            temp: optionsAnswers.isTemp,
            pgp: optionsAnswers.isPgp
        };
    }
    catch (error) {
        return {
            success: false,
            message: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
// Add a preload function that can be called from the CLI entry point
// This allows the CLI to avoid hanging on startup
export async function preloadEnhancedMode() {
    // Just check if we're in enhanced mode without loading heavy modules
    const enhancedMode = process.argv.includes('--enhanced');
    if (!enhancedMode) {
        // If not in enhanced mode, don't load anything
        return false;
    }
    // Otherwise, preload the modules we'll need
    console.log(chalk.blue('Loading enhanced mode modules...'));
    return await initModules();
}
