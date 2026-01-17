/**
 * Self-contained types for the CLI
 *
 * This file contains all types needed by the CLI without any @transactional/* dependencies.
 * This allows the CLI to be published as a standalone package.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * CLI session type
 */
export enum CliSessionType {
  CLI = 'CLI',
  MCP = 'MCP',
}

/**
 * Output format for CLI commands
 */
export type OutputFormat = 'table' | 'json' | 'yaml';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standard API success response
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// =============================================================================
// COMMAND RESULT TYPES
// =============================================================================

/**
 * Generic command result with success/error handling
 */
export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// =============================================================================
// CREDENTIAL TYPES
// =============================================================================

/**
 * User information stored in credentials
 */
export interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

/**
 * Organization info from API
 */
export interface OrganizationInfo {
  id: number;
  name: string;
  slug: string;
  role: string;
}

/**
 * Stored credentials file structure
 * Version 2: User-scoped token (not per-org)
 */
export interface StoredCredentials {
  version: number;
  token?: string;
  expiresAt?: string;
  user?: UserInfo;
  currentOrganization?: string; // Selected org slug for CLI commands
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

/**
 * CLI configuration
 */
export interface CliConfig {
  apiUrl: string;
  webUrl: string;
  outputFormat: OutputFormat;
  color: boolean;
}

// =============================================================================
// EMAIL TYPES
// =============================================================================

/**
 * Email send options
 */
export interface EmailSendOptions {
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
export interface EmailSendResult {
  messageId: string;
  to: string;
  submittedAt: string;
  status?: string;
}

/**
 * Email template
 */
export interface EmailTemplate {
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
export interface EmailServer {
  id: number;
  name: string;
  organizationId: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Email stream
 */
export interface EmailStream {
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
export interface EmailDomain {
  id: number;
  domain: string;
  status: string;
  verifiedAt?: string;
  dnsRecords: Array<{
    type: string;
    name: string;
    value: string;
    verified?: boolean;
  }>;
  createdAt: string;
}

/**
 * Email sender
 */
export interface EmailSender {
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
export interface EmailSuppression {
  email: string;
  reason: string;
  createdAt: string;
}

/**
 * Email statistics
 */
export interface EmailStats {
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

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

/**
 * Organization member
 */
export interface OrgMember {
  id: string;
  email: string;
  name?: string;
  role: string;
  joinedAt: string;
}

/**
 * API key info
 */
export interface ApiKeyInfo {
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
export interface CreateApiKeyResult {
  id: string;
  name: string;
  key: string; // Full key (only shown once)
  prefix: string;
  scopes?: string[];
  isLive: boolean;
  createdAt: string;
}

// =============================================================================
// BILLING TYPES
// =============================================================================

/**
 * Billing usage info
 */
export interface BillingUsage {
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
export interface Invoice {
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
export interface PlanInfo {
  id: string;
  name: string;
  emailQuota: number;
  smsQuota?: number;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

// =============================================================================
// WHOAMI TYPES
// =============================================================================

/**
 * Whoami response from API
 */
export interface WhoamiResponse {
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
  };
  session: {
    id: number;
    type: string;
    createdAt: string;
    expiresAt?: string;
  };
}
