// Group management utilities
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';

const KEY_DIR = path.join(os.homedir(), '.dedpaste');
const KEY_DB_PATH = path.join(KEY_DIR, 'keydb.json');

/**
 * Load the key database
 */
async function loadDatabase(): Promise<any> {
  try {
    const data = await fsPromises.readFile(KEY_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Database doesn't exist yet, return empty structure
      return {
        keys: {
          self: null,
          friends: {},
          pgp: {},
          keybase: {},
          github: {}
        },
        groups: {},
        default_friend: null,
        last_used: null
      };
    }
    throw error;
  }
}

/**
 * Save the key database
 */
async function saveDatabase(db: any): Promise<void> {
  await fsPromises.mkdir(KEY_DIR, { recursive: true });
  await fsPromises.writeFile(
    KEY_DB_PATH,
    JSON.stringify(db, null, 2),
    'utf-8'
  );
}

/**
 * Create a new group
 */
export async function createGroup(
  name: string,
  members: string[]
): Promise<void> {
  if (!name || name.trim() === '') {
    throw new Error('Group name cannot be empty');
  }

  if (!members || members.length === 0) {
    throw new Error('Group must have at least one member');
  }

  const db = await loadDatabase();

  // Initialize groups object if it doesn't exist
  if (!db.groups) {
    db.groups = {};
  }

  // Check if group already exists
  if (db.groups[name]) {
    throw new Error(`Group "${name}" already exists. Use addToGroup to add members.`);
  }

  // Create the group
  db.groups[name] = members;

  await saveDatabase(db);
}

/**
 * Add members to an existing group
 */
export async function addToGroup(
  name: string,
  members: string[]
): Promise<void> {
  if (!name || name.trim() === '') {
    throw new Error('Group name cannot be empty');
  }

  if (!members || members.length === 0) {
    throw new Error('Must specify at least one member to add');
  }

  const db = await loadDatabase();

  // Initialize groups object if it doesn't exist
  if (!db.groups) {
    db.groups = {};
  }

  // Check if group exists
  if (!db.groups[name]) {
    throw new Error(`Group "${name}" does not exist. Use createGroup to create it first.`);
  }

  // Add members (avoiding duplicates)
  const existingMembers = new Set(db.groups[name]);
  for (const member of members) {
    existingMembers.add(member);
  }

  db.groups[name] = Array.from(existingMembers);

  await saveDatabase(db);
}

/**
 * Remove members from a group
 */
export async function removeFromGroup(
  name: string,
  members: string[]
): Promise<void> {
  if (!name || name.trim() === '') {
    throw new Error('Group name cannot be empty');
  }

  if (!members || members.length === 0) {
    throw new Error('Must specify at least one member to remove');
  }

  const db = await loadDatabase();

  // Check if groups exist
  if (!db.groups || !db.groups[name]) {
    throw new Error(`Group "${name}" does not exist`);
  }

  // Remove members
  const membersToRemove = new Set(members);
  db.groups[name] = db.groups[name].filter((m: string) => !membersToRemove.has(m));

  // If group is empty after removal, optionally keep it or remove it
  // For now, we'll keep empty groups (user can delete explicitly)

  await saveDatabase(db);
}

/**
 * Delete a group entirely
 */
export async function deleteGroup(name: string): Promise<void> {
  if (!name || name.trim() === '') {
    throw new Error('Group name cannot be empty');
  }

  const db = await loadDatabase();

  if (!db.groups || !db.groups[name]) {
    throw new Error(`Group "${name}" does not exist`);
  }

  delete db.groups[name];

  await saveDatabase(db);
}

/**
 * List all groups
 */
export async function listGroups(): Promise<Record<string, string[]>> {
  const db = await loadDatabase();
  return db.groups || {};
}

/**
 * Get a specific group
 */
export async function getGroup(name: string): Promise<string[] | null> {
  const db = await loadDatabase();
  if (!db.groups) {
    return null;
  }
  return db.groups[name] || null;
}

/**
 * Check if a group exists
 */
export async function groupExists(name: string): Promise<boolean> {
  const db = await loadDatabase();
  return !!(db.groups && db.groups[name]);
}

/**
 * Rename a group
 */
export async function renameGroup(oldName: string, newName: string): Promise<void> {
  if (!oldName || oldName.trim() === '') {
    throw new Error('Old group name cannot be empty');
  }

  if (!newName || newName.trim() === '') {
    throw new Error('New group name cannot be empty');
  }

  const db = await loadDatabase();

  if (!db.groups || !db.groups[oldName]) {
    throw new Error(`Group "${oldName}" does not exist`);
  }

  if (db.groups[newName]) {
    throw new Error(`Group "${newName}" already exists`);
  }

  db.groups[newName] = db.groups[oldName];
  delete db.groups[oldName];

  await saveDatabase(db);
}
