/**
 * Authentication
 *
 * Handles OAuth2 device authorization flow for CLI login.
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import open from 'open';
import {
  getWebUrl,
  getApiUrl,
  storeOrganizationToken,
  storeUserInfo,
  setCurrentOrganization,
  getOrganizationToken,
  clearCredentials,
} from './config';
import { getApiClient } from './client';
import type { CommandResult, WhoamiResponse, OrganizationInfo } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const CALLBACK_PORT_RANGE = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

// =============================================================================
// OAUTH FLOW
// =============================================================================

/**
 * Generate a cryptographically secure state parameter
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Start local HTTP server to receive OAuth callback
 */
function startCallbackServer(
  state: string,
  codeVerifier: string,
  sessionType: 'cli' | 'mcp' = 'cli'
): Promise<{ code: string; orgSlug: string; port: number }> {
  return new Promise((resolve, reject) => {
    let server: http.Server | null = null;
    let currentPort = 0;

    const tryPort = (portIndex: number) => {
      if (portIndex >= CALLBACK_PORT_RANGE.length) {
        reject(new Error('Could not find available port for callback server'));
        return;
      }

      const port = CALLBACK_PORT_RANGE[portIndex];
      currentPort = port;

      server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${port}`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const orgSlug = url.searchParams.get('org');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');

          // Set CORS headers for the response
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'text/html');

          if (error) {
            res.writeHead(400);
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Login Failed</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
                    h1 { color: #ef4444; }
                  </style>
                </head>
                <body>
                  <h1>Login Failed</h1>
                  <p>${errorDescription || error}</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            server?.close();
            reject(new Error(errorDescription || error));
            return;
          }

          if (!code || !returnedState || !orgSlug) {
            res.writeHead(400);
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Login Failed</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
                    h1 { color: #ef4444; }
                  </style>
                </head>
                <body>
                  <h1>Login Failed</h1>
                  <p>Missing required parameters in callback.</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            server?.close();
            reject(new Error('Missing required parameters in callback'));
            return;
          }

          if (returnedState !== state) {
            res.writeHead(400);
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Login Failed</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
                    h1 { color: #ef4444; }
                  </style>
                </head>
                <body>
                  <h1>Login Failed</h1>
                  <p>Invalid state parameter. This may indicate a security issue.</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            server?.close();
            reject(new Error('Invalid state parameter'));
            return;
          }

          // Success!
          res.writeHead(200);
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Login Successful</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
                  h1 { color: #22c55e; }
                </style>
              </head>
              <body>
                <h1>Login Successful!</h1>
                <p>You have been authenticated with <strong>${orgSlug}</strong>.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          server?.close();
          resolve({ code, orgSlug, port });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Port in use, try next one
          tryPort(portIndex + 1);
        } else {
          reject(err);
        }
      });

      server.listen(port, '127.0.0.1', () => {
        // Server started successfully
      });
    };

    tryPort(0);

    // Set timeout for callback server
    setTimeout(() => {
      if (server?.listening) {
        server.close();
        reject(new Error('Login timed out. Please try again.'));
      }
    }, 5 * 60 * 1000); // 5 minute timeout
  });
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  sessionType: 'cli' | 'mcp' = 'cli'
): Promise<{
  token: string;
  expiresAt?: string;
  user: { id: string; email: string; name?: string };
  organization: { id: number; name: string; slug: string; role: string };
}> {
  const apiUrl = getApiUrl();
  // The token endpoint is on the web app, not the API
  const webUrl = getWebUrl();

  const response = await fetch(`${webUrl}/api/cli/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'transactional-cli/0.1.0',
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri,
      sessionType: sessionType.toUpperCase(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error || `Token exchange failed: ${response.statusText}`
    );
  }

  const data = await response.json() as {
    token: string;
    expiresAt?: string;
    user: { id: string; email: string; name?: string };
    organization: { id: number; name: string; slug: string; role: string };
  };
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    user: data.user,
    organization: data.organization,
  };
}

/**
 * Perform OAuth login flow
 */
export async function login(
  sessionType: 'cli' | 'mcp' = 'cli',
  onBrowserOpen?: () => void
): Promise<CommandResult<{ user: { id: string; email: string; name?: string }; organization: OrganizationInfo }>> {
  try {
    // Generate OAuth parameters
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Start callback server first to get the port
    const callbackPromise = startCallbackServer(state, codeVerifier, sessionType);

    // We need to wait a bit for the server to start and get its port
    // This is a bit hacky, but we need the port before opening the browser
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find the port that was used
    let port = 3000;
    for (const p of CALLBACK_PORT_RANGE) {
      try {
        const server = http.createServer();
        await new Promise<void>((resolve, reject) => {
          server.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              port = p;
              resolve();
            } else {
              reject(err);
            }
          });
          server.listen(p, '127.0.0.1', () => {
            server.close();
            resolve();
          });
        });
        if (port === p) break;
      } catch {
        // Continue
      }
    }

    const redirectUri = `http://localhost:${port}/callback`;
    const webUrl = getWebUrl();

    // Build authorization URL
    const authUrl = new URL('/cli/authorize', webUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('session_type', sessionType.toUpperCase());

    // Notify that browser is opening
    if (onBrowserOpen) {
      onBrowserOpen();
    }

    // Open browser
    await open(authUrl.toString());

    // Wait for callback
    const { code, orgSlug } = await callbackPromise;

    // Exchange code for token
    const { token, expiresAt, user, organization } = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
      sessionType
    );

    // Store credentials
    storeOrganizationToken(orgSlug, token, expiresAt);
    storeUserInfo(user);
    setCurrentOrganization(orgSlug);

    return {
      success: true,
      data: {
        user,
        organization,
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
 * Logout from all organizations
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
