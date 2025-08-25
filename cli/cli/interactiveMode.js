// Interactive mode for key management and encryption
import inquirer from 'inquirer';
import { listKeys, addFriendKey, removeKey, getKey } from './keyManager.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { homedir } from 'os';
/**
 * Interactive key management
 */
async function interactiveKeyManagement() {
    const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: 'List all keys', value: 'list' },
                { name: 'Add a friend\'s key', value: 'add' },
                { name: 'Remove a key', value: 'remove' },
                { name: 'Export your public key', value: 'export' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }]);
    switch (action) {
        case 'list':
            return interactiveListKeys();
        case 'add':
            return interactiveAddFriend();
        case 'remove':
            return interactiveRemoveKey();
        case 'export':
            return interactiveExportKey();
        case 'cancel':
            return { success: true, message: 'Operation cancelled' };
    }
}
/**
 * Interactive list keys
 */
async function interactiveListKeys() {
    const db = await listKeys();
    console.log('\nAvailable keys:');
    // Self key
    if (db.keys.self) {
        console.log(`  - You (self)`);
        console.log(`    Fingerprint: ${db.keys.self.fingerprint}`);
        if (db.keys.self.created) {
            console.log(`    Created: ${new Date(db.keys.self.created).toLocaleString()}`);
        }
    }
    else {
        console.log('  - No personal key found. Generate one with --gen-key');
    }
    // Friend keys
    const friendNames = Object.keys(db.keys.friends);
    if (friendNames.length > 0) {
        console.log('\n  Friends:');
        for (const name of friendNames) {
            const friend = db.keys.friends[name];
            const lastUsed = friend.lastUsed ? new Date(friend.lastUsed).toLocaleString() : 'Never';
            console.log(`  - ${name} (last used: ${lastUsed})`);
            console.log(`    Fingerprint: ${friend.fingerprint}`);
        }
    }
    else {
        console.log('\n  No friend keys found. Add one with "dedpaste keys add-friend"');
    }
    // PGP keys
    const pgpNames = Object.keys(db.keys.pgp || {});
    if (pgpNames.length > 0) {
        console.log('\n  PGP Keys:');
        for (const name of pgpNames) {
            const pgp = db.keys.pgp[name];
            const lastUsed = pgp.lastUsed ? new Date(pgp.lastUsed).toLocaleString() : 'Never';
            console.log(`  - ${name} (PGP, last used: ${lastUsed})`);
            console.log(`    Fingerprint: ${pgp.fingerprint}`);
            if (pgp.email) {
                console.log(`    Email: ${pgp.email}`);
            }
        }
    }
    // Keybase keys
    const keybaseNames = Object.keys(db.keys.keybase || {});
    if (keybaseNames.length > 0) {
        console.log('\n  Keybase Keys:');
        for (const name of keybaseNames) {
            const kb = db.keys.keybase[name];
            const lastUsed = kb.lastUsed ? new Date(kb.lastUsed).toLocaleString() : 'Never';
            console.log(`  - ${name} (Keybase, last used: ${lastUsed})`);
            console.log(`    Username: ${kb.username}`);
            console.log(`    Fingerprint: ${kb.fingerprint}`);
            if (kb.email) {
                console.log(`    Email: ${kb.email}`);
            }
        }
    }
    if (friendNames.length === 0 && pgpNames.length === 0 && keybaseNames.length === 0) {
        console.log('\n  No recipient keys found. Add keys using:');
        console.log('  - dedpaste keys --add-friend <name> --key-file <path>');
        console.log('  - dedpaste keys --pgp-key <email-or-id>');
        console.log('  - dedpaste keys --keybase <username>');
    }
    return { success: true };
}
/**
 * Interactive add friend
 */
async function interactiveAddFriend() {
    const { name } = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'Enter friend\'s name:',
            validate: (input) => input.trim() !== '' ? true : 'Name cannot be empty'
        }]);
    const { method } = await inquirer.prompt([{
            type: 'list',
            name: 'method',
            message: 'How would you like to add the key?',
            choices: [
                { name: 'From a file', value: 'file' },
                { name: 'Paste the key content', value: 'paste' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }]);
    if (method === 'cancel') {
        return { success: true, message: 'Operation cancelled' };
    }
    let keyContent;
    if (method === 'file') {
        const { filePath } = await inquirer.prompt([{
                type: 'input',
                name: 'filePath',
                message: 'Enter path to the public key file:',
                validate: (input) => {
                    if (input.trim() === '')
                        return 'Path cannot be empty';
                    if (!fs.existsSync(input))
                        return 'File does not exist';
                    return true;
                }
            }]);
        keyContent = await fsPromises.readFile(filePath, 'utf8');
    }
    else {
        const { content } = await inquirer.prompt([{
                type: 'editor',
                name: 'content',
                message: 'Paste the public key content:',
                validate: (input) => {
                    if (input.trim() === '')
                        return 'Key content cannot be empty';
                    if (!input.includes('-----BEGIN PUBLIC KEY-----')) {
                        return 'Invalid key format. Must be a PEM format public key';
                    }
                    return true;
                }
            }]);
        keyContent = content;
    }
    try {
        const keyPath = await addFriendKey(name, keyContent);
        return {
            success: true,
            message: `Added ${name}'s public key at ${keyPath}`
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Error adding friend's key: ${message}`
        };
    }
}
/**
 * Interactive remove key
 */
async function interactiveRemoveKey() {
    const db = await listKeys();
    const friendNames = Object.keys(db.keys.friends);
    if (friendNames.length === 0) {
        return {
            success: false,
            message: 'No friend keys found to remove'
        };
    }
    const choices = friendNames.map(name => ({ name, value: name }));
    choices.push({ name: 'Cancel', value: 'cancel' });
    const { friend } = await inquirer.prompt([{
            type: 'list',
            name: 'friend',
            message: 'Select friend to remove:',
            choices: choices
        }]);
    if (friend === 'cancel') {
        return { success: true, message: 'Operation cancelled' };
    }
    const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove ${friend}'s key?`,
            default: false
        }]);
    if (!confirm) {
        return { success: true, message: 'Operation cancelled' };
    }
    try {
        await removeKey('friend', friend);
        return {
            success: true,
            message: `Removed ${friend}'s key successfully`
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Error removing key: ${message}`
        };
    }
}
/**
 * Interactive export key
 */
async function interactiveExportKey() {
    const selfKey = await getKey('self');
    if (!selfKey) {
        return {
            success: false,
            message: 'No personal key found. Generate one with --gen-key'
        };
    }
    const publicKeyContent = await fsPromises.readFile(selfKey.public, 'utf8');
    const { method } = await inquirer.prompt([{
            type: 'list',
            name: 'method',
            message: 'How would you like to export your public key?',
            choices: [
                { name: 'Display on screen', value: 'display' },
                { name: 'Save to file', value: 'file' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }]);
    if (method === 'cancel') {
        return { success: true, message: 'Operation cancelled' };
    }
    if (method === 'display') {
        console.log('\nYour public key:');
        console.log('----------------');
        console.log(publicKeyContent);
        console.log('----------------');
        console.log('\nShare this key with your friends so they can send you encrypted pastes.');
        return { success: true };
    }
    else {
        const { filePath } = await inquirer.prompt([{
                type: 'input',
                name: 'filePath',
                message: 'Enter path to save the public key:',
                default: path.join(homedir(), 'my_dedpaste_public_key.pem'),
                validate: (input) => input.trim() !== '' ? true : 'Path cannot be empty'
            }]);
        try {
            await fsPromises.writeFile(filePath, publicKeyContent);
            return {
                success: true,
                message: `Public key saved to ${filePath}`
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Error saving key: ${message}`
            };
        }
    }
}
/**
 * Interactive send
 */
async function interactiveSend() {
    // Get message
    const { message } = await inquirer.prompt([{
            type: 'editor',
            name: 'message',
            message: 'Enter your message:',
            validate: (input) => input.trim() !== '' ? true : 'Message cannot be empty'
        }]);
    // Get recipient
    const db = await listKeys();
    const choices = [{ name: 'Yourself (self)', value: null }];
    // Add regular friends
    const friendNames = Object.keys(db.keys.friends);
    for (const name of friendNames) {
        choices.push({ name: `Friend: ${name}`, value: name });
    }
    // Add PGP keys if available
    if (db.keys.pgp) {
        const pgpNames = Object.keys(db.keys.pgp);
        for (const name of pgpNames) {
            const email = db.keys.pgp[name].email ? ` (${db.keys.pgp[name].email})` : '';
            choices.push({ name: `PGP: ${name}${email}`, value: name });
        }
    }
    // Add Keybase keys if available
    if (db.keys.keybase) {
        const keybaseNames = Object.keys(db.keys.keybase);
        for (const name of keybaseNames) {
            choices.push({ name: `Keybase: ${name} (${db.keys.keybase[name].username})`, value: name });
        }
    }
    const { recipient } = await inquirer.prompt([{
            type: 'list',
            name: 'recipient',
            message: 'Select recipient:',
            choices: choices
        }]);
    // Get paste options
    const { isTemp } = await inquirer.prompt([{
            type: 'confirm',
            name: 'isTemp',
            message: 'Create a one-time paste (deleted after first view)?',
            default: false
        }]);
    return {
        content: Buffer.from(message),
        recipient: recipient,
        temp: isTemp
    };
}
// Export functions
export { interactiveKeyManagement, interactiveListKeys, interactiveAddFriend, interactiveRemoveKey, interactiveExportKey, interactiveSend };
