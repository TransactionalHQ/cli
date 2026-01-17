/**
 * CLI Configuration
 *
 * Manages CLI configuration settings including API URLs and output preferences.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CliConfig, OutputFormat, StoredCredentials, OrganizationInfo } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.transactional');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

const DEFAULT_CONFIG: CliConfig = {
  apiUrl: 'https://api.usetransactional.com',
  webUrl: 'https://usetransactional.com',
  outputFormat: 'table',
  color: true,
};

// In-memory state
let currentConfig: CliConfig = { ...DEFAULT_CONFIG };
let currentCredentials: StoredCredentials | null = null;

// =============================================================================
// DIRECTORY MANAGEMENT
// =============================================================================

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

// =============================================================================
// CONFIG FILE
// =============================================================================

/**
 * Load configuration from file
 */
export function loadConfig(): CliConfig {
  ensureConfigDir();

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const loaded = JSON.parse(content) as Partial<CliConfig>;
      currentConfig = { ...DEFAULT_CONFIG, ...loaded };
    } catch {
      currentConfig = { ...DEFAULT_CONFIG };
    }
  } else {
    currentConfig = { ...DEFAULT_CONFIG };
  }

  // Apply environment overrides
  if (process.env.TRANSACTIONAL_API_URL) {
    currentConfig.apiUrl = process.env.TRANSACTIONAL_API_URL;
  }
  if (process.env.TRANSACTIONAL_WEB_URL) {
    currentConfig.webUrl = process.env.TRANSACTIONAL_WEB_URL;
  }
  if (process.env.NO_COLOR || process.env.TRANSACTIONAL_NO_COLOR) {
    currentConfig.color = false;
  }

  return currentConfig;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<CliConfig>): void {
  ensureConfigDir();
  currentConfig = { ...currentConfig, ...config };

  const { apiUrl, webUrl, outputFormat, color } = currentConfig;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiUrl, webUrl, outputFormat, color }, null, 2), {
    mode: 0o600,
  });
}

/**
 * Get the current configuration
 */
export function getConfig(): CliConfig {
  return currentConfig;
}

/**
 * Get the API URL
 */
export function getApiUrl(): string {
  return currentConfig.apiUrl;
}

/**
 * Get the Web URL
 */
export function getWebUrl(): string {
  return currentConfig.webUrl;
}

/**
 * Get the output format
 */
export function getOutputFormat(): OutputFormat {
  return currentConfig.outputFormat;
}

/**
 * Check if color output is enabled
 */
export function isColorEnabled(): boolean {
  return currentConfig.color;
}

// =============================================================================
// CREDENTIALS FILE
// =============================================================================

/**
 * Load credentials from file
 */
export function loadCredentials(): StoredCredentials {
  ensureConfigDir();

  if (currentCredentials) {
    return currentCredentials;
  }

  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      currentCredentials = JSON.parse(content) as StoredCredentials;
    } catch {
      currentCredentials = {
        version: 1,
        organizations: {},
      };
    }
  } else {
    currentCredentials = {
      version: 1,
      organizations: {},
    };
  }

  return currentCredentials;
}

/**
 * Save credentials to file
 */
export function saveCredentials(credentials: StoredCredentials): void {
  ensureConfigDir();
  currentCredentials = credentials;
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });
}

/**
 * Get the current organization slug
 */
export function getCurrentOrganization(): string | undefined {
  const credentials = loadCredentials();
  return credentials.currentOrganization;
}

/**
 * Set the current organization
 */
export function setCurrentOrganization(orgSlug: string): void {
  const credentials = loadCredentials();
  credentials.currentOrganization = orgSlug;
  saveCredentials(credentials);
}

/**
 * Get token for an organization
 */
export function getOrganizationToken(orgSlug?: string): string | undefined {
  const credentials = loadCredentials();
  const slug = orgSlug || credentials.currentOrganization;
  if (!slug) return undefined;

  const orgCreds = credentials.organizations[slug];
  if (!orgCreds) return undefined;

  // Check if token is expired
  if (orgCreds.expiresAt && new Date(orgCreds.expiresAt) < new Date()) {
    return undefined;
  }

  return orgCreds.token;
}

/**
 * Store token for an organization
 */
export function storeOrganizationToken(
  orgSlug: string,
  token: string,
  expiresAt?: string
): void {
  const credentials = loadCredentials();
  credentials.organizations[orgSlug] = { token, expiresAt };
  saveCredentials(credentials);
}

/**
 * Remove token for an organization
 */
export function removeOrganizationToken(orgSlug: string): void {
  const credentials = loadCredentials();
  delete credentials.organizations[orgSlug];
  if (credentials.currentOrganization === orgSlug) {
    credentials.currentOrganization = undefined;
  }
  saveCredentials(credentials);
}

/**
 * Get all authenticated organizations
 */
export function getAuthenticatedOrganizations(): string[] {
  const credentials = loadCredentials();
  return Object.keys(credentials.organizations);
}

/**
 * Check if user is logged in to any organization
 */
export function isLoggedIn(): boolean {
  const credentials = loadCredentials();
  return Object.keys(credentials.organizations).length > 0;
}

/**
 * Clear all credentials (logout)
 */
export function clearCredentials(): void {
  ensureConfigDir();
  currentCredentials = {
    version: 1,
    organizations: {},
  };
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

/**
 * Store user info
 */
export function storeUserInfo(user: { id: string; email: string; name?: string }): void {
  const credentials = loadCredentials();
  credentials.user = user;
  saveCredentials(credentials);
}

/**
 * Get stored user info
 */
export function getUserInfo(): { id: string; email: string; name?: string } | undefined {
  const credentials = loadCredentials();
  return credentials.user;
}

/**
 * Switch to a different organization
 */
export function switchOrganization(orgSlug: string): boolean {
  const credentials = loadCredentials();
  if (credentials.organizations[orgSlug]) {
    credentials.currentOrganization = orgSlug;
    saveCredentials(credentials);
    return true;
  }
  return false;
}

/**
 * Get config directory path
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Get credentials file path
 */
export function getCredentialsFile(): string {
  return CREDENTIALS_FILE;
}

/**
 * Initialize config (call on CLI start)
 */
export function initConfig(): CliConfig {
  return loadConfig();
}
