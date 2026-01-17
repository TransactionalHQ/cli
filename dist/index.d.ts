import { Command } from 'commander';

/**
 * Self-contained types for the CLI
 *
 * This file contains all types needed by the CLI without any @transactional/* dependencies.
 * This allows the CLI to be published as a standalone package.
 */
/**
 * CLI session type
 */
declare enum CliSessionType {
    CLI = "CLI",
    MCP = "MCP"
}
/**
 * Output format for CLI commands
 */
type OutputFormat = 'table' | 'json' | 'yaml';
/**
 * Standard API error response
 */
interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
/**
 * Standard API success response
 */
interface ApiResponse<T> {
    data: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
    };
}
/**
 * Generic command result with success/error handling
 */
interface CommandResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
/**
 * User information stored in credentials
 */
interface UserInfo {
    id: string;
    email: string;
    name?: string;
}
/**
 * Organization info from API
 */
interface OrganizationInfo {
    id: number;
    name: string;
    slug: string;
    role: string;
}
/**
 * Stored credentials file structure
 * Version 2: User-scoped token (not per-org)
 */
interface StoredCredentials {
    version: number;
    token?: string;
    expiresAt?: string;
    user?: UserInfo;
    currentOrganization?: string;
}
/**
 * CLI configuration
 */
interface CliConfig {
    apiUrl: string;
    webUrl: string;
    outputFormat: OutputFormat;
    color: boolean;
}
/**
 * Email send options
 */
interface EmailSendOptions {
    from: string;
    to: string;
    subject?: string;
    htmlBody?: string;
    textBody?: string;
    templateId?: number;
    templateAlias?: string;
    templateModel?: Record<string, unknown>;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    tag?: string;
    streamId?: number;
}
/**
 * Email send result
 */
interface EmailSendResult {
    messageId: string;
    to: string;
    submittedAt: string;
    status?: string;
}
/**
 * Email template
 */
interface EmailTemplate {
    id: number;
    name: string;
    alias?: string;
    subject: string;
    htmlBody?: string;
    textBody?: string;
    status: string;
    serverId: number;
    createdAt: string;
    updatedAt: string;
}
/**
 * Email server
 */
interface EmailServer {
    id: number;
    name: string;
    organizationId: number;
    createdAt: string;
    updatedAt: string;
}
/**
 * Email stream
 */
interface EmailStream {
    id: number;
    name: string;
    type: string;
    serverId: number;
    createdAt: string;
    updatedAt: string;
}
/**
 * Email domain
 */
interface EmailDomain {
    id: number;
    name: string;
    status: string;
    dkimVerified: boolean;
    spfVerified: boolean;
    returnPathVerified: boolean;
    dmarcVerified: boolean;
    createdAt?: string;
    lastVerifiedAt?: string;
    verificationError?: string | null;
}
/**
 * DNS Record for domain verification
 */
interface DnsRecord {
    type: string;
    recordType: string;
    name: string;
    value: string;
    verified: boolean;
}
/**
 * Domain create response
 */
interface DomainCreateResponse extends EmailDomain {
    dkimSelector: string;
    dkimPublicKey: string;
    dkimRecordValue: string;
    dnsRecords: DnsRecord[];
}
/**
 * Email sender
 */
interface EmailSender {
    id: number;
    email: string;
    name?: string;
    status: string;
    verifiedAt?: string;
    createdAt: string;
}
/**
 * Email suppression
 */
interface EmailSuppression {
    id: number;
    email: string;
    reason: string;
    notes: string | null;
    serverId: number | null;
    streamId: number | null;
    createdAt: string;
}
/**
 * Email statistics
 */
interface EmailStats {
    period: string;
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    complaintRate: number;
}
/**
 * Organization member
 */
interface OrgMember {
    id: string;
    email: string;
    name?: string;
    role: string;
    joinedAt: string;
}
/**
 * API key info
 */
interface ApiKeyInfo {
    id: string;
    name: string;
    prefix: string;
    scopes?: string[];
    isLive: boolean;
    lastUsedAt?: string;
    expiresAt?: string;
    createdAt: string;
}
/**
 * Create API key result
 */
interface CreateApiKeyResult {
    id: string;
    name: string;
    key: string;
    prefix: string;
    scopes?: string[];
    isLive: boolean;
    createdAt: string;
}
/**
 * Billing usage info
 */
interface BillingUsage {
    period: {
        start: string;
        end: string;
    };
    email: {
        sent: number;
        limit: number;
        percentUsed: number;
    };
    sms?: {
        sent: number;
        limit: number;
        percentUsed: number;
    };
}
/**
 * Invoice info
 */
interface Invoice {
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    paidAt?: string;
    dueAt?: string;
    createdAt: string;
    pdfUrl?: string;
}
/**
 * Plan info
 */
interface PlanInfo {
    id: string;
    name: string;
    emailQuota: number;
    smsQuota?: number;
    price: number;
    currency: string;
    interval: string;
    features: string[];
}
/**
 * Whoami response from API
 */
interface WhoamiResponse {
    user: {
        id: string;
        email: string;
        name?: string;
    };
    organization: {
        id: number;
        name: string;
        slug: string;
        role: string;
    } | null;
    session: {
        id: number;
        type: string;
        createdAt: string;
        expiresAt?: string;
    };
}

/**
 * CLI Configuration
 *
 * Manages CLI configuration settings including API URLs and output preferences.
 */

/**
 * Load configuration from file
 */
declare function loadConfig(): CliConfig;
/**
 * Save configuration to file
 */
declare function saveConfig(config: Partial<CliConfig>): void;
/**
 * Get the current configuration
 */
declare function getConfig(): CliConfig;
/**
 * Get the API URL
 */
declare function getApiUrl(): string;
/**
 * Get the Web URL
 */
declare function getWebUrl(): string;
/**
 * Get the output format
 */
declare function getOutputFormat(): OutputFormat;
/**
 * Check if color output is enabled
 */
declare function isColorEnabled(): boolean;
/**
 * Load credentials from file
 */
declare function loadCredentials(): StoredCredentials;
/**
 * Save credentials to file
 */
declare function saveCredentials(credentials: StoredCredentials): void;
/**
 * Get the current organization slug
 */
declare function getCurrentOrganization(): string | undefined;
/**
 * Set the current organization
 */
declare function setCurrentOrganization(orgSlug: string): void;
/**
 * Get the stored user token
 */
declare function getToken(): string | undefined;
/**
 * Store the user token
 */
declare function storeToken(token: string, expiresInSeconds: number): void;
/**
 * Check if user is logged in
 */
declare function isLoggedIn(): boolean;
/**
 * Clear all credentials (logout)
 */
declare function clearCredentials(): void;
/**
 * Store user info
 */
declare function storeUserInfo(user: {
    id: string;
    email: string;
    name?: string;
}): void;
/**
 * Get stored user info
 */
declare function getUserInfo(): {
    id: string;
    email: string;
    name?: string;
} | undefined;
/**
 * Switch to a different organization (just updates local selection)
 */
declare function switchOrganization(orgSlug: string): void;
/**
 * Get config directory path
 */
declare function getConfigDir(): string;
/**
 * Get credentials file path
 */
declare function getCredentialsFile(): string;
/**
 * Initialize config (call on CLI start)
 */
declare function initConfig(): CliConfig;

/**
 * HTTP API Client
 *
 * Self-contained HTTP client for making API requests.
 * Uses native fetch and requires no external dependencies.
 */

/**
 * HTTP API client for making authenticated requests
 * All API requests go to the Hono API server (apiUrl)
 */
declare class ApiClient {
    private apiUrl;
    private token;
    private orgSlug;
    constructor(orgSlug?: string);
    /**
     * Get headers for API requests
     */
    private getHeaders;
    /**
     * Build URL with query parameters
     */
    private buildUrl;
    /**
     * Make an HTTP request
     */
    private request;
    /**
     * GET request
     */
    get<T>(path: string, params?: Record<string, unknown>): Promise<CommandResult<T>>;
    /**
     * POST request
     */
    post<T>(path: string, body?: unknown): Promise<CommandResult<T>>;
    /**
     * PUT request
     */
    put<T>(path: string, body?: unknown): Promise<CommandResult<T>>;
    /**
     * PATCH request
     */
    patch<T>(path: string, body?: unknown): Promise<CommandResult<T>>;
    /**
     * DELETE request
     */
    delete<T = void>(path: string): Promise<CommandResult<T>>;
}
/**
 * Get an API client for the current or specified organization
 */
declare function getApiClient(orgSlug?: string): ApiClient;
/**
 * Check if the user is authenticated for API calls
 */
declare function isAuthenticated(): boolean;

/**
 * Authentication
 *
 * Handles device authorization flow for CLI login.
 * No local server needed - CLI polls the API until user authorizes.
 */

/**
 * Perform device authorization login flow
 */
declare function login(sessionType?: 'CLI' | 'MCP', callbacks?: {
    onDeviceCode?: (userCode: string, verificationUrl: string) => void;
    onBrowserOpen?: () => void;
    onPolling?: () => void;
}): Promise<CommandResult<{
    user: {
        id: string;
        email: string;
        name?: string;
    };
    organizations: Array<{
        id: number;
        role: string;
    }>;
}>>;
/**
 * Logout - clear all credentials
 */
declare function logout(): void;
/**
 * Get current user and organization info (whoami)
 */
declare function whoami(orgSlug?: string): Promise<CommandResult<WhoamiResponse>>;
/**
 * List all organizations the user has access to
 */
declare function listOrganizations(): Promise<CommandResult<OrganizationInfo[]>>;

/**
 * Auth Commands
 *
 * Commands for authentication: login, logout, whoami, switch org.
 */

/**
 * Create the login command
 */
declare function createLoginCommand(): Command;
/**
 * Create the logout command
 */
declare function createLogoutCommand(): Command;
/**
 * Create the whoami command
 */
declare function createWhoamiCommand(): Command;
/**
 * Create the switch command (alias for org use)
 */
declare function createSwitchCommand(): Command;
/**
 * Create the org command with subcommands
 */
declare function createOrgsCommand(): Command;

/**
 * Email Commands
 *
 * Commands for email operations: send, batch, templates, domains, senders, suppressions, stats.
 */

/**
 * Create the email command
 */
declare function createEmailCommand(): Command;

/**
 * Config Commands
 *
 * Commands for managing CLI configuration.
 */

/**
 * Create the config command
 */
declare function createConfigCommand(): Command;

/**
 * MCP Commands
 *
 * Commands for setting up MCP (Model Context Protocol) integration.
 * Supports Claude Desktop (paid and free tiers) and Claude Code.
 */

/**
 * Create the mcp command
 */
declare function createMcpCommand(): Command;

/**
 * CLI Output Formatting
 *
 * Functions for formatting and displaying CLI output.
 */

/**
 * Format data based on the output format setting
 */
declare function formatOutput(data: unknown, format?: OutputFormat): string;
/**
 * Print success message
 */
declare function printSuccess(message: string): void;
/**
 * Print error message
 */
declare function printError(message: string, details?: string): void;
/**
 * Print warning message
 */
declare function printWarning(message: string): void;
/**
 * Print info message
 */
declare function printInfo(message: string): void;
/**
 * Print a heading
 */
declare function printHeading(title: string): void;
/**
 * Print a key-value pair
 */
declare function printKeyValue(key: string, value: unknown): void;
/**
 * Print data with automatic format detection
 */
declare function print(data: unknown, format?: OutputFormat): void;

/**
 * CLI Prompts
 *
 * Interactive prompts for CLI user input.
 */

/**
 * Prompt user to select an organization
 */
declare function selectOrganization(organizations: OrganizationInfo[]): Promise<string>;
/**
 * Prompt for confirmation
 */
declare function confirm(message: string, defaultValue?: boolean): Promise<boolean>;
/**
 * Prompt for text input
 */
declare function input(message: string, options?: {
    default?: string;
    required?: boolean;
    validate?: (value: string) => boolean | string;
}): Promise<string>;
/**
 * Prompt for password/secret input
 */
declare function password(message: string, options?: {
    required?: boolean;
    validate?: (value: string) => boolean | string;
}): Promise<string>;
/**
 * Prompt for selection from a list
 */
declare function select<T extends string>(message: string, choices: {
    name: string;
    value: T;
}[]): Promise<T>;
/**
 * Prompt for multiple selection from a list
 */
declare function multiSelect<T extends string>(message: string, choices: {
    name: string;
    value: T;
    checked?: boolean;
}[]): Promise<T[]>;
/**
 * Prompt for email input
 */
declare function emailInput(message: string, options?: {
    default?: string;
    required?: boolean;
}): Promise<string>;
/**
 * Prompt for editor input (opens editor for multiline content)
 */
declare function editor(message: string, options?: {
    default?: string;
}): Promise<string>;

/**
 * Transactional CLI
 *
 * Main CLI entry point with Commander.js setup.
 */

/**
 * Create the CLI program
 */
declare function createProgram(): Command;

export { ApiClient, type ApiErrorResponse, type ApiKeyInfo, type ApiResponse, type BillingUsage, type CliConfig, CliSessionType, type CommandResult, type CreateApiKeyResult, type DnsRecord, type DomainCreateResponse, type EmailDomain, type EmailSendOptions, type EmailSendResult, type EmailSender, type EmailServer, type EmailStats, type EmailStream, type EmailSuppression, type EmailTemplate, type Invoice, type OrgMember, type OrganizationInfo, type OutputFormat, type PlanInfo, type StoredCredentials, type UserInfo, type WhoamiResponse, clearCredentials, confirm, createConfigCommand, createEmailCommand, createLoginCommand, createLogoutCommand, createMcpCommand, createOrgsCommand, createProgram, createSwitchCommand, createWhoamiCommand, editor, emailInput, formatOutput, getApiClient, getApiUrl, getConfig, getConfigDir, getCredentialsFile, getCurrentOrganization, getOutputFormat, getToken, getUserInfo, getWebUrl, initConfig, input, isAuthenticated, isColorEnabled, isLoggedIn, listOrganizations, loadConfig, loadCredentials, login, logout, multiSelect, password, print, printError, printHeading, printInfo, printKeyValue, printSuccess, printWarning, saveConfig, saveCredentials, select, selectOrganization, setCurrentOrganization, storeToken, storeUserInfo, switchOrganization, whoami };
