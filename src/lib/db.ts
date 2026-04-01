import { CosmosClient, Container } from '@azure/cosmos';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tracker, UserSettings } from './types';

// ─── Storage mode: Cosmos DB if configured, otherwise local JSON files ─

const useCosmosDB = !!(process.env.COSMOS_DB_ENDPOINT && process.env.COSMOS_DB_KEY);
const DATA_DIR = join(process.cwd(), 'data');

// ─── Local JSON helpers ────────────────────────────────────────────

function readJSON<T>(filename: string, fallback: T): T {
  const filepath = join(DATA_DIR, filename);
  if (!existsSync(filepath)) return fallback;
  return JSON.parse(readFileSync(filepath, 'utf-8')) as T;
}

function writeJSON<T>(filename: string, data: T): void {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// ─── Cosmos DB Connection (lazy init) ──────────────────────────────

let _client: CosmosClient | null = null;

function getClient(): CosmosClient {
  if (!_client) {
    _client = new CosmosClient({
      endpoint: process.env.COSMOS_DB_ENDPOINT!,
      key: process.env.COSMOS_DB_KEY!,
    });
  }
  return _client;
}

function container(name: string): Container {
  const databaseId = process.env.COSMOS_DB_DATABASE || 'bms-tracker';
  return getClient().database(databaseId).container(name);
}

// ─── Trackers ──────────────────────────────────────────────────────

export async function getTrackers(): Promise<Tracker[]> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    return trackers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { resources } = await container('trackers').items
    .query('SELECT * FROM c ORDER BY c.createdAt DESC')
    .fetchAll();
  return resources as Tracker[];
}

export async function getActiveTrackers(): Promise<Tracker[]> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    return trackers.filter((t) => t.status === 'polling');
  }
  const { resources } = await container('trackers').items
    .query("SELECT * FROM c WHERE c.status = 'polling'")
    .fetchAll();
  return resources as Tracker[];
}

export async function getTracker(id: string): Promise<Tracker | undefined> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    return trackers.find((t) => t.id === id);
  }
  try {
    const { resource } = await container('trackers').item(id, id).read();
    return resource as Tracker | undefined;
  } catch {
    return undefined;
  }
}

export async function createTracker(tracker: Tracker): Promise<void> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    trackers.push(tracker);
    writeJSON('trackers.json', trackers);
    return;
  }
  await container('trackers').items.create(tracker);
}

export async function updateTracker(id: string, updates: Partial<Tracker>): Promise<Tracker | null> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    const idx = trackers.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    trackers[idx] = { ...trackers[idx], ...updates };
    writeJSON('trackers.json', trackers);
    return trackers[idx];
  }
  const existing = await getTracker(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await container('trackers').items.upsert(updated);
  return updated;
}

export async function deleteTracker(id: string): Promise<boolean> {
  if (!useCosmosDB) {
    const trackers = readJSON<Tracker[]>('trackers.json', []);
    const idx = trackers.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    trackers.splice(idx, 1);
    writeJSON('trackers.json', trackers);
    return true;
  }
  try {
    await container('trackers').item(id, id).delete();
    return true;
  } catch {
    return false;
  }
}

// ─── Settings ──────────────────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  id: 'user-settings',
  notificationEmails: [],
  lastTestEmailSent: null,
};

export async function getSettings(): Promise<UserSettings> {
  if (!useCosmosDB) {
    return readJSON<UserSettings>('settings.json', DEFAULT_SETTINGS);
  }
  try {
    const { resource } = await container('settings').item('user-settings', 'user-settings').read();
    if (!resource) return DEFAULT_SETTINGS;
    return {
      id: resource.id,
      notificationEmails: (resource as UserSettings).notificationEmails || [],
      lastTestEmailSent: (resource as UserSettings).lastTestEmailSent || null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  if (!useCosmosDB) {
    const current = readJSON<UserSettings>('settings.json', DEFAULT_SETTINGS);
    const updated = { ...current, ...updates, id: 'user-settings' };
    writeJSON('settings.json', updated);
    return updated;
  }
  const current = await getSettings();
  const updated = { ...current, ...updates, id: 'user-settings' };
  await container('settings').items.upsert(updated);
  return updated;
}
