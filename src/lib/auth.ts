/**
 * Authentication
 *
 * Handles device authorization flow for CLI login.
 * No local server needed - CLI polls the API until user authorizes.
 */

import open from 'open';
import {
  getWebUrl,
  getApiUrl,
  storeToken,
  storeUserInfo,
  getToken,
  clearCredentials,
  getCurrentOrganization,
  setCurrentOrganization,
} from './config';
import { getApiClient } from './client';
import type { CommandResult, WhoamiResponse, OrganizationInfo } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

interface TokenResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  organizations: Array<{
    id: number;
    role: string;
  }>;
}

interface TokenErrorResponse {
  error: string;
  error_description: string;
}

// =============================================================================
// DEVICE AUTHORIZATION FLOW
// =============================================================================

/**
 * Request a device code from the API
 */
async function requestDeviceCode(
  sessionType: 'CLI' | 'MCP' = 'CLI'
): Promise<DeviceCodeResponse> {
  const webUrl = getWebUrl();

  const response = await fetch(`${webUrl}/api/cli/device-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'transactional-cli/0.1.0',
    },
    body: JSON.stringify({
      sessionType,
      clientInfo: {
        deviceName: process.env.HOSTNAME || 'Unknown',
        osName: process.platform,
        osVersion: process.version,
        hostname: process.env.HOSTNAME || 'Unknown',
        clientVersion: '0.1.0',
      },
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || 'Failed to get device code');
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

/**
 * Poll for token using device code
 */
async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPoll?: () => void
): Promise<TokenResponse> {
  const webUrl = getWebUrl();
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    if (onPoll) onPoll();

    const response = await fetch(`${webUrl}/api/cli/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'transactional-cli/0.1.0',
      },
      body: JSON.stringify({ deviceCode }),
    });

    if (response.ok) {
      return response.json() as Promise<TokenResponse>;
    }

    const errorData = (await response.json()) as TokenErrorResponse;

    // Check error type
    switch (errorData.error) {
      case 'authorization_pending':
        // User hasn't authorized yet, keep polling
        break;
      case 'slow_down':
        // Polling too fast, increase interval
        interval = Math.min(interval + 5, 60);
        break;
      case 'expired_token':
        throw new Error('Login timed out. Please try again.');
      case 'access_denied':
        throw new Error('Authorization denied.');
      default:
        throw new Error(errorData.error_description || 'Login failed');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }

  throw new Error('Login timed out. Please try again.');
}

/**
 * Perform device authorization login flow
 */
export async function login(
  sessionType: 'CLI' | 'MCP' = 'CLI',
  callbacks?: {
    onDeviceCode?: (userCode: string, verificationUrl: string) => void;
    onBrowserOpen?: () => void;
    onPolling?: () => void;
  }
): Promise<
  CommandResult<{
    user: { id: string; email: string; name?: string };
    organizations: Array<{ id: number; role: string }>;
  }>
> {
  try {
    // Step 1: Request device code
    const deviceCodeResponse = await requestDeviceCode(sessionType);
    const { deviceCode, userCode, verificationUrl, expiresIn, interval } =
      deviceCodeResponse;

    // Notify about the user code
    if (callbacks?.onDeviceCode) {
      callbacks.onDeviceCode(userCode, verificationUrl);
    }

    // Step 2: Open browser
    if (callbacks?.onBrowserOpen) {
      callbacks.onBrowserOpen();
    }
    await open(verificationUrl);

    // Step 3: Poll for token
    const tokenResponse = await pollForToken(
      deviceCode,
      interval,
      expiresIn,
      callbacks?.onPolling
    );

    // Step 4: Store credentials
    storeToken(tokenResponse.token, tokenResponse.expiresIn);
    storeUserInfo({
      id: tokenResponse.user.id,
      email: tokenResponse.user.email,
      name: tokenResponse.user.name,
    });

    return {
      success: true,
      data: {
        user: tokenResponse.user,
        organizations: tokenResponse.organizations,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: err instanceof Error ? err.message : 'Login failed',
      },
    };
  }
}

/**
 * Logout - clear all credentials
 */
export function logout(): void {
  clearCredentials();
}

/**
 * Get current user and organization info (whoami)
 */
export async function whoami(orgSlug?: string): Promise<CommandResult<WhoamiResponse>> {
  const client = getApiClient(orgSlug);
  return client.get<WhoamiResponse>('/cli/whoami');
}

/**
 * List all organizations the user has access to
 */
export async function listOrganizations(): Promise<CommandResult<OrganizationInfo[]>> {
  const client = getApiClient();
  return client.get<OrganizationInfo[]>('/cli/organizations');
}

/**
 * Set the current organization for CLI commands
 */
export function useOrganization(orgSlug: string): void {
  setCurrentOrganization(orgSlug);
}

/**
 * Get the current organization slug
 */
export function getOrganization(): string | undefined {
  return getCurrentOrganization();
}
