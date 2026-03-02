/**
 * HTTP API Client
 *
 * Self-contained HTTP client for making API requests.
 * Uses native fetch and requires no external dependencies.
 */

import { getApiUrl, getToken, getCurrentOrganization } from './config';
import type { CommandResult, ApiErrorResponse } from './types';

// =============================================================================
// API CLIENT CLASS
// =============================================================================

/**
 * HTTP API client for making authenticated requests
 * All API requests go to the Hono API server (apiUrl)
 */
export class ApiClient {
  private apiUrl: string;
  private token: string | undefined;
  private orgSlug: string | undefined;

  constructor(orgSlug?: string) {
    this.apiUrl = getApiUrl();
    this.token = getToken();
    this.orgSlug = orgSlug || getCurrentOrganization();
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': '@usetransactional/cli/0.1.0',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Include organization context in headers
    if (this.orgSlug) {
      headers['X-Organization-Slug'] = this.orgSlug;
    }

    return headers;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(path, this.apiUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, unknown>;
    }
  ): Promise<CommandResult<T>> {
    try {
      const url = this.buildUrl(path, options?.params);
      const init: RequestInit = {
        method,
        headers: this.getHeaders(),
      };

      if (options?.body) {
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, init);

      // Handle no content responses
      if (response.status === 204) {
        return { success: true };
      }

      // Parse response body
      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle error responses
      if (!response.ok) {
        const errorResponse = data as ApiErrorResponse;
        return {
          success: false,
          error: {
            code: errorResponse.error?.code || `HTTP_${response.status}`,
            message: errorResponse.error?.message || response.statusText,
            details: errorResponse.error?.details,
          },
        };
      }

      // Handle successful responses
      // API returns { data: T } or just T depending on endpoint
      if (data && typeof data === 'object' && 'data' in data) {
        return { success: true, data: (data as { data: T }).data };
      }

      return { success: true, data: data as T };
    } catch (err) {
      // Handle network errors
      if (err instanceof Error) {
        if (err.message.includes('ECONNREFUSED')) {
          return {
            success: false,
            error: {
              code: 'CONNECTION_REFUSED',
              message: `Cannot connect to API server. Check your network connection.`,
            },
          };
        }

        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: err.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, params?: Record<string, unknown>): Promise<CommandResult<T>> {
    return this.request<T>('GET', path, { params });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown): Promise<CommandResult<T>> {
    return this.request<T>('POST', path, { body });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown): Promise<CommandResult<T>> {
    return this.request<T>('PUT', path, { body });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown): Promise<CommandResult<T>> {
    return this.request<T>('PATCH', path, { body });
  }

  /**
   * DELETE request
   */
  async delete<T = void>(path: string): Promise<CommandResult<T>> {
    return this.request<T>('DELETE', path);
  }
}

/**
 * Get an API client for the current or specified organization
 */
export function getApiClient(orgSlug?: string): ApiClient {
  return new ApiClient(orgSlug);
}

/**
 * Check if the user is authenticated for API calls
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}
