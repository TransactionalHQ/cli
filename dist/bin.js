#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path2 from 'path';
import * as os2 from 'os';
import open from 'open';
import ora2 from 'ora';
import chalk4 from 'chalk';
import Table from 'cli-table3';
import yaml from 'yaml';
import inquirer from 'inquirer';

var CONFIG_DIR = path2.join(os2.homedir(), ".transactional");
var CONFIG_FILE = path2.join(CONFIG_DIR, "config.json");
var CREDENTIALS_FILE = path2.join(CONFIG_DIR, "credentials.json");
var DEFAULT_CONFIG = {
  apiUrl: "https://api.usetransactional.com",
  webUrl: "https://usetransactional.com",
  outputFormat: "table",
  color: true
};
var currentConfig = { ...DEFAULT_CONFIG };
var currentCredentials = null;
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 448 });
  }
}
function loadConfig() {
  ensureConfigDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      const loaded = JSON.parse(content);
      currentConfig = { ...DEFAULT_CONFIG, ...loaded };
    } catch {
      currentConfig = { ...DEFAULT_CONFIG };
    }
  } else {
    currentConfig = { ...DEFAULT_CONFIG };
  }
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
function saveConfig(config) {
  ensureConfigDir();
  currentConfig = { ...currentConfig, ...config };
  const { apiUrl, webUrl, outputFormat, color } = currentConfig;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiUrl, webUrl, outputFormat, color }, null, 2), {
    mode: 384
  });
}
function getConfig() {
  return currentConfig;
}
function getApiUrl() {
  return currentConfig.apiUrl;
}
function getWebUrl() {
  return currentConfig.webUrl;
}
function getOutputFormat() {
  return currentConfig.outputFormat;
}
function isColorEnabled() {
  return currentConfig.color;
}
function loadCredentials() {
  ensureConfigDir();
  if (currentCredentials) {
    return currentCredentials;
  }
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const content = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
      const loaded = JSON.parse(content);
      if (loaded.version === 1) {
        currentCredentials = {
          version: 2,
          user: loaded.user,
          currentOrganization: loaded.currentOrganization
        };
        saveCredentials(currentCredentials);
      } else {
        currentCredentials = loaded;
      }
    } catch {
      currentCredentials = {
        version: 2
      };
    }
  } else {
    currentCredentials = {
      version: 2
    };
  }
  return currentCredentials;
}
function saveCredentials(credentials) {
  ensureConfigDir();
  currentCredentials = credentials;
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    mode: 384
  });
}
function getCurrentOrganization() {
  const credentials = loadCredentials();
  return credentials.currentOrganization;
}
function setCurrentOrganization(orgSlug) {
  const credentials = loadCredentials();
  credentials.currentOrganization = orgSlug;
  saveCredentials(credentials);
}
function getToken() {
  const credentials = loadCredentials();
  if (!credentials.token) {
    return void 0;
  }
  if (credentials.expiresAt && new Date(credentials.expiresAt) < /* @__PURE__ */ new Date()) {
    return void 0;
  }
  return credentials.token;
}
function storeToken(token, expiresInSeconds) {
  const credentials = loadCredentials();
  credentials.token = token;
  credentials.expiresAt = new Date(Date.now() + expiresInSeconds * 1e3).toISOString();
  saveCredentials(credentials);
}
function isLoggedIn() {
  return !!getToken();
}
function clearCredentials() {
  ensureConfigDir();
  currentCredentials = {
    version: 2
  };
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}
function storeUserInfo(user) {
  const credentials = loadCredentials();
  credentials.user = user;
  saveCredentials(credentials);
}
function switchOrganization(orgSlug) {
  setCurrentOrganization(orgSlug);
}
function getConfigDir() {
  return CONFIG_DIR;
}
function getCredentialsFile() {
  return CREDENTIALS_FILE;
}
function initConfig() {
  return loadConfig();
}

// src/lib/client.ts
var ApiClient = class {
  apiUrl;
  token;
  orgSlug;
  constructor(orgSlug) {
    this.apiUrl = getApiUrl();
    this.token = getToken();
    this.orgSlug = orgSlug || getCurrentOrganization();
  }
  /**
   * Get headers for API requests
   */
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "@usetransactional/cli/0.1.0"
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (this.orgSlug) {
      headers["X-Organization-Slug"] = this.orgSlug;
    }
    return headers;
  }
  /**
   * Build URL with query parameters
   */
  buildUrl(path3, params) {
    const url = new URL(path3, this.apiUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== void 0 && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
  /**
   * Make an HTTP request
   */
  async request(method, path3, options) {
    try {
      const url = this.buildUrl(path3, options?.params);
      const init = {
        method,
        headers: this.getHeaders()
      };
      if (options?.body) {
        init.body = JSON.stringify(options.body);
      }
      const response = await fetch(url, init);
      if (response.status === 204) {
        return { success: true };
      }
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      if (!response.ok) {
        const errorResponse = data;
        return {
          success: false,
          error: {
            code: errorResponse.error?.code || `HTTP_${response.status}`,
            message: errorResponse.error?.message || response.statusText,
            details: errorResponse.error?.details
          }
        };
      }
      if (data && typeof data === "object" && "data" in data) {
        return { success: true, data: data.data };
      }
      return { success: true, data };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("ECONNREFUSED")) {
          return {
            success: false,
            error: {
              code: "CONNECTION_REFUSED",
              message: `Cannot connect to API server. Check your network connection.`
            }
          };
        }
        return {
          success: false,
          error: {
            code: "NETWORK_ERROR",
            message: err.message
          }
        };
      }
      return {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: "An unknown error occurred"
        }
      };
    }
  }
  /**
   * GET request
   */
  async get(path3, params) {
    return this.request("GET", path3, { params });
  }
  /**
   * POST request
   */
  async post(path3, body) {
    return this.request("POST", path3, { body });
  }
  /**
   * PUT request
   */
  async put(path3, body) {
    return this.request("PUT", path3, { body });
  }
  /**
   * PATCH request
   */
  async patch(path3, body) {
    return this.request("PATCH", path3, { body });
  }
  /**
   * DELETE request
   */
  async delete(path3) {
    return this.request("DELETE", path3);
  }
};
function getApiClient(orgSlug) {
  return new ApiClient(orgSlug);
}
async function requestDeviceCode(sessionType = "CLI") {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/cli/device-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "@usetransactional/cli/0.1.0"
    },
    body: JSON.stringify({
      sessionType,
      clientInfo: {
        deviceName: process.env.HOSTNAME || "Unknown",
        osName: process.platform,
        osVersion: process.version,
        hostname: process.env.HOSTNAME || "Unknown",
        clientVersion: "0.1.0"
      }
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = typeof errorData.error === "string" ? errorData.error : errorData.error?.message || "Failed to get device code";
    throw new Error(errorMsg);
  }
  return response.json();
}
async function pollForToken(deviceCode, interval, expiresIn, onPoll) {
  const apiUrl = getApiUrl();
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1e3;
  while (Date.now() < expiresAt) {
    if (onPoll) onPoll();
    const response = await fetch(`${apiUrl}/cli/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "@usetransactional/cli/0.1.0"
      },
      body: JSON.stringify({ deviceCode })
    });
    if (response.ok) {
      return response.json();
    }
    const errorData = await response.json();
    switch (errorData.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        interval = Math.min(interval + 5, 60);
        break;
      case "expired_token":
        throw new Error("Login timed out. Please try again.");
      case "access_denied":
        throw new Error("Authorization denied.");
      default:
        throw new Error(errorData.error_description || "Login failed");
    }
    await new Promise((resolve) => setTimeout(resolve, interval * 1e3));
  }
  throw new Error("Login timed out. Please try again.");
}
async function login(sessionType = "CLI", callbacks) {
  try {
    const deviceCodeResponse = await requestDeviceCode(sessionType);
    const { deviceCode, userCode, expiresIn, interval } = deviceCodeResponse;
    const webUrl = getWebUrl();
    const verificationUrl = `${webUrl}/cli/authorize?user_code=${userCode}`;
    if (callbacks?.onDeviceCode) {
      callbacks.onDeviceCode(userCode, verificationUrl);
    }
    if (callbacks?.onBrowserOpen) {
      callbacks.onBrowserOpen();
    }
    await open(verificationUrl);
    const tokenResponse = await pollForToken(
      deviceCode,
      interval,
      expiresIn,
      callbacks?.onPolling
    );
    storeToken(tokenResponse.token, tokenResponse.expiresIn);
    storeUserInfo({
      id: tokenResponse.user.id,
      email: tokenResponse.user.email,
      name: tokenResponse.user.name
    });
    return {
      success: true,
      data: {
        user: tokenResponse.user,
        organizations: tokenResponse.organizations
      }
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: err instanceof Error ? err.message : "Login failed"
      }
    };
  }
}
function logout() {
  clearCredentials();
}
async function whoami(orgSlug) {
  const client = getApiClient(orgSlug);
  return client.get("/cli/whoami");
}
async function listOrganizations() {
  const client = getApiClient();
  return client.get("/cli/organizations");
}
function formatOutput(data, format) {
  const outputFormat = format || getOutputFormat();
  switch (outputFormat) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yaml.stringify(data);
    case "table":
    default:
      return formatAsTable(data);
  }
}
function formatAsTable(data) {
  if (!data) {
    return "No data";
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return "No results";
    }
    const columns = Object.keys(data[0]);
    const table = new Table({
      head: columns.map((c) => isColorEnabled() ? chalk4.bold(c) : c),
      style: {
        head: isColorEnabled() ? ["cyan"] : [],
        border: isColorEnabled() ? ["gray"] : []
      }
    });
    for (const row of data) {
      table.push(columns.map((col) => formatValue(row[col])));
    }
    return table.toString();
  }
  if (typeof data === "object") {
    const table = new Table({
      style: {
        border: isColorEnabled() ? ["gray"] : []
      }
    });
    for (const [key, value] of Object.entries(data)) {
      const formattedKey = isColorEnabled() ? chalk4.bold(key) : key;
      table.push({ [formattedKey]: formatValue(value) });
    }
    return table.toString();
  }
  return String(data);
}
function formatValue(value) {
  if (value === null || value === void 0) {
    return isColorEnabled() ? chalk4.gray("-") : "-";
  }
  if (typeof value === "boolean") {
    if (isColorEnabled()) {
      return value ? chalk4.green("Yes") : chalk4.red("No");
    }
    return value ? "Yes" : "No";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
function printSuccess(message) {
  if (isColorEnabled()) {
    console.log(chalk4.green("\u2713"), message);
  } else {
    console.log("[OK]", message);
  }
}
function printError(message, details) {
  if (isColorEnabled()) {
    console.error(chalk4.red("\u2717"), message);
  } else {
    console.error("[ERROR]", message);
  }
}
function printKeyValue(key, value) {
  const formattedValue = formatValue(value);
  if (isColorEnabled()) {
    console.log(`${chalk4.gray(key + ":")} ${formattedValue}`);
  } else {
    console.log(`${key}: ${formattedValue}`);
  }
}
function print(data, format) {
  console.log(formatOutput(data, format));
}
async function selectOrganization(organizations) {
  const { orgSlug } = await inquirer.prompt([
    {
      type: "list",
      name: "orgSlug",
      message: "Select an organization:",
      choices: organizations.map((org) => ({
        name: `${org.name} (${org.slug}) - ${org.role}`,
        value: org.slug
      }))
    }
  ]);
  return orgSlug;
}
async function confirm(message, defaultValue = false) {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message,
      default: defaultValue
    }
  ]);
  return confirmed;
}

// src/commands/auth.ts
function createLoginCommand() {
  return new Command("login").description("Authenticate with Transactional").option("--mcp", "Login for MCP server use").option("-f, --force", "Force new login even if already logged in").action(async (options) => {
    if (isLoggedIn() && !options.force) {
      const currentOrg = getCurrentOrganization();
      if (currentOrg) {
        printInfo(`Already logged in. Current organization: ${currentOrg}`);
      } else {
        printInfo('Already logged in. Use "transactional org use <slug>" to select an organization.');
      }
      printInfo('Use "transactional login --force" to get a new token.');
      return;
    }
    const spinner = ora2();
    const result = await login(options.mcp ? "MCP" : "CLI", {
      onDeviceCode: (userCode, verificationUrl) => {
        console.log();
        console.log(chalk4.bold("To complete authentication:"));
        console.log();
        console.log(`  1. Visit: ${chalk4.cyan(verificationUrl)}`);
        console.log(`  2. Verify this code matches: ${chalk4.bold.yellow(formatUserCode(userCode))}`);
        console.log(`  3. Click "Authorize" in your browser`);
        console.log();
      },
      onBrowserOpen: () => {
        spinner.start("Opening browser...");
        spinner.succeed("Browser opened");
        spinner.start("Waiting for authorization...");
      },
      onPolling: () => {
      }
    });
    if (!result.success || !result.data) {
      spinner.fail("Login failed");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Authorization received!");
    console.log();
    printSuccess("Login successful!");
    console.log();
    printKeyValue("User", result.data.user.email);
    if (result.data.organizations.length > 0) {
      console.log();
      printInfo(`You have access to ${result.data.organizations.length} organization(s).`);
      printInfo('Use "transactional org list" to see them, or "transactional org use <slug>" to select one.');
    }
  });
}
function formatUserCode(code) {
  if (code.length === 8) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code;
}
function createLogoutCommand() {
  return new Command("logout").description("Log out from all organizations").action(async () => {
    if (!isLoggedIn()) {
      printInfo("You are not logged in.");
      return;
    }
    logout();
    printSuccess("Logged out from all organizations.");
  });
}
function createWhoamiCommand() {
  return new Command("whoami").description("Show current user and organization info").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    if (!isLoggedIn()) {
      printError('Not logged in. Use "transactional login" to authenticate.');
      process.exit(1);
    }
    const result = await whoami(options.org);
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to get user info");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const { user, organization, session } = result.data;
      console.log();
      printHeading("User");
      printKeyValue("ID", user.id);
      printKeyValue("Email", user.email);
      if (user.name) printKeyValue("Name", user.name);
      console.log();
      printHeading("Organization");
      if (organization) {
        printKeyValue("ID", String(organization.id));
        printKeyValue("Name", organization.name);
        printKeyValue("Slug", organization.slug);
        printKeyValue("Role", organization.role);
      } else {
        printInfo('No organization selected. Use "transactional org use <slug>" to select one.');
      }
      console.log();
      printHeading("Session");
      printKeyValue("ID", String(session.id));
      printKeyValue("Type", session.type);
      printKeyValue("Created", session.createdAt);
      if (session.expiresAt) printKeyValue("Expires", session.expiresAt);
    }
  });
}
function createSwitchCommand() {
  return new Command("switch").description('Switch to a different organization (alias for "org use")').argument("[slug]", "Organization slug to switch to").action(async (slug) => {
    if (!isLoggedIn()) {
      printError('Not logged in. Use "transactional login" to authenticate.');
      process.exit(1);
    }
    const spinner = ora2("Fetching organizations...").start();
    const orgsResult = await listOrganizations();
    if (!orgsResult.success || !orgsResult.data) {
      spinner.fail("Failed to fetch organizations");
      printError(orgsResult.error?.message || "Unknown error");
      process.exit(1);
    }
    const orgs = orgsResult.data;
    spinner.stop();
    if (orgs.length === 0) {
      printError("No organizations found.");
      process.exit(1);
    }
    let targetSlug = slug;
    if (!targetSlug) {
      if (orgs.length === 1) {
        targetSlug = orgs[0].slug;
        printInfo(`Only one organization available: ${targetSlug}`);
      } else {
        targetSlug = await selectOrganization(orgs);
      }
    }
    const validOrg = orgs.find((o) => o.slug === targetSlug);
    if (!validOrg) {
      printError(`Organization "${targetSlug}" not found.`);
      printInfo("Available organizations: " + orgs.map((o) => o.slug).join(", "));
      process.exit(1);
    }
    switchOrganization(targetSlug);
    printSuccess(`Switched to organization: ${validOrg.name} (${targetSlug})`);
  });
}
function createOrgsCommand() {
  const orgCmd = new Command("org").description("Manage organizations");
  orgCmd.command("list").description("List all organizations you have access to").option("--json", "Output as JSON").action(async (options) => {
    if (!isLoggedIn()) {
      printError('Not logged in. Use "transactional login" to authenticate.');
      process.exit(1);
    }
    const spinner = ora2("Fetching organizations...").start();
    const result = await listOrganizations();
    if (!result.success || !result.data) {
      spinner.fail("Failed to fetch organizations");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.stop();
    const orgs = result.data;
    const currentOrg = getCurrentOrganization();
    if (orgs.length === 0) {
      printInfo("No organizations found.");
      return;
    }
    const orgInfos = orgs.map((org) => ({
      slug: org.slug,
      name: org.name,
      role: org.role,
      current: org.slug === currentOrg ? "*" : ""
    }));
    if (options.json) {
      print(orgInfos, "json");
    } else {
      print(orgInfos);
      console.log();
      printInfo(`Current organization: ${currentOrg || "(none selected)"}`);
    }
  });
  orgCmd.command("use").description("Set the current organization for CLI commands").argument("<slug>", "Organization slug to use").action(async (slug) => {
    if (!isLoggedIn()) {
      printError('Not logged in. Use "transactional login" to authenticate.');
      process.exit(1);
    }
    const spinner = ora2("Verifying organization...").start();
    const result = await listOrganizations();
    if (!result.success || !result.data) {
      spinner.fail("Failed to verify organization");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    const org = result.data.find((o) => o.slug === slug);
    if (!org) {
      spinner.fail("Organization not found");
      printError(`Organization "${slug}" not found.`);
      printInfo('Use "transactional org list" to see available organizations.');
      process.exit(1);
    }
    spinner.stop();
    switchOrganization(slug);
    printSuccess(`Now using organization: ${org.name} (${slug})`);
  });
  orgCmd.command("current").description("Show the current organization").action(() => {
    const currentOrg = getCurrentOrganization();
    if (currentOrg) {
      printKeyValue("Current organization", currentOrg);
    } else {
      printInfo('No organization selected. Use "transactional org use <slug>" to select one.');
    }
  });
  return orgCmd;
}
function printInfo(message) {
  if (isColorEnabled()) {
    console.log(chalk4.blue("\u2139"), message);
  } else {
    console.log("[INFO]", message);
  }
}
function printHeading(title) {
  if (isColorEnabled()) {
    console.log(chalk4.bold.underline(title));
  } else {
    console.log(`=== ${title} ===`);
  }
}
function createEmailCommand() {
  const emailCmd = new Command("email").description("Email management commands");
  emailCmd.command("send").description("Send a single email").requiredOption("-f, --from <email>", "Sender email address").requiredOption("-t, --to <email>", "Recipient email address").option("-s, --subject <text>", "Email subject").option("--html <content>", "HTML body").option("--text <content>", "Plain text body").option("--template <id>", "Template ID").option("--template-alias <alias>", "Template alias").option("--model <json>", "Template model (JSON)").option("--cc <emails>", "CC recipients (comma-separated)").option("--bcc <emails>", "BCC recipients (comma-separated)").option("--reply-to <email>", "Reply-to address").option("--tag <tag>", "Message tag").option("--stream <id>", "Stream ID").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const spinner = ora2("Sending email...").start();
    try {
      const sendOptions = {
        from: options.from,
        to: options.to,
        subject: options.subject,
        htmlBody: options.html,
        textBody: options.text,
        templateId: options.template ? parseInt(options.template, 10) : void 0,
        templateAlias: options.templateAlias,
        templateModel: options.model ? JSON.parse(options.model) : void 0,
        cc: options.cc ? options.cc.split(",").map((e) => e.trim()) : void 0,
        bcc: options.bcc ? options.bcc.split(",").map((e) => e.trim()) : void 0,
        replyTo: options.replyTo,
        tag: options.tag,
        streamId: options.stream ? parseInt(options.stream, 10) : void 0
      };
      const client = getApiClient(options.org);
      const result = await client.post("/email", sendOptions);
      if (!result.success || !result.data) {
        spinner.fail("Failed to send email");
        printError(result.error?.message || "Unknown error");
        process.exit(1);
      }
      spinner.succeed("Email sent successfully!");
      if (options.json) {
        print(result.data, "json");
      } else {
        printKeyValue("Message ID", result.data.messageId);
        printKeyValue("To", result.data.to);
        printKeyValue("Submitted At", result.data.submittedAt);
      }
    } catch (err) {
      spinner.fail("Failed to send email");
      printError(err instanceof Error ? err.message : "Unknown error");
      process.exit(1);
    }
  });
  emailCmd.command("batch <file>").description("Send batch emails from a JSON file").option("--dry-run", "Validate without sending").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (file, options) => {
    requireLogin();
    if (!fs.existsSync(file)) {
      printError(`File not found: ${file}`);
      process.exit(1);
    }
    let emails;
    try {
      const content = fs.readFileSync(file, "utf-8");
      emails = JSON.parse(content);
    } catch (err) {
      printError(`Failed to parse JSON file: ${err instanceof Error ? err.message : "Unknown error"}`);
      process.exit(1);
    }
    if (!Array.isArray(emails)) {
      printError("File must contain an array of email objects");
      process.exit(1);
    }
    if (options.dryRun) {
      printSuccess(`Validated ${emails.length} emails (dry run)`);
      return;
    }
    const spinner = ora2(`Sending ${emails.length} emails...`).start();
    try {
      const client = getApiClient(options.org);
      const result = await client.post("/email/batch", { messages: emails });
      if (!result.success || !result.data) {
        spinner.fail("Failed to send batch emails");
        printError(result.error?.message || "Unknown error");
        process.exit(1);
      }
      spinner.succeed(`Sent ${result.data.length} emails successfully!`);
      if (options.json) {
        print(result.data, "json");
      }
    } catch (err) {
      spinner.fail("Failed to send batch emails");
      printError(err instanceof Error ? err.message : "Unknown error");
      process.exit(1);
    }
  });
  const templates = emailCmd.command("templates").description("Manage email templates");
  templates.command("list").description("List email templates").option("--server <id>", "Filter by server ID").option("--status <status>", "Filter by status (DRAFT, ACTIVE, ARCHIVED)").option("--limit <n>", "Max results", "50").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/templates", {
      serverId: options.server ? parseInt(options.server, 10) : void 0,
      status: options.status,
      limit: parseInt(options.limit, 10)
    });
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list templates");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const data = result.data.map((t) => ({
        id: t.id,
        name: t.name,
        alias: t.alias || "-",
        status: t.status,
        updated: t.updatedAt
      }));
      print(data);
    }
  });
  templates.command("get <id>").description("Get template details").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (id, options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get(`/templates/${id}`);
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to get template");
      process.exit(1);
    }
    print(result.data, options.json ? "json" : void 0);
  });
  templates.command("create").description("Create a new template").requiredOption("--name <name>", "Template name").requiredOption("--subject <subject>", "Email subject").requiredOption("--server <id>", "Server ID").option("--alias <alias>", "Template alias").option("--html <content>", "HTML body").option("--text <content>", "Plain text body").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const spinner = ora2("Creating template...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/templates", {
      name: options.name,
      subject: options.subject,
      serverId: parseInt(options.server, 10),
      alias: options.alias,
      htmlBody: options.html,
      textBody: options.text
    });
    if (!result.success || !result.data) {
      spinner.fail("Failed to create template");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Template created!");
    if (options.json) {
      print(result.data, "json");
    } else {
      printKeyValue("ID", result.data.id);
      printKeyValue("Name", result.data.name);
    }
  });
  templates.command("update <id>").description("Update a template").option("--name <name>", "Template name").option("--subject <subject>", "Email subject").option("--alias <alias>", "Template alias").option("--html <content>", "HTML body").option("--text <content>", "Plain text body").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (id, options) => {
    requireLogin();
    const spinner = ora2("Updating template...").start();
    const client = getApiClient(options.org);
    const result = await client.patch(`/templates/${id}`, {
      name: options.name,
      subject: options.subject,
      alias: options.alias,
      htmlBody: options.html,
      textBody: options.text
    });
    if (!result.success || !result.data) {
      spinner.fail("Failed to update template");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Template updated!");
    if (options.json) {
      print(result.data, "json");
    }
  });
  templates.command("delete <id>").description("Delete a template").option("-o, --org <slug>", "Organization slug").action(async (id, options) => {
    requireLogin();
    const shouldDelete = await confirm(`Are you sure you want to delete template ${id}?`, false);
    if (!shouldDelete) {
      return;
    }
    const spinner = ora2("Deleting template...").start();
    const client = getApiClient(options.org);
    const result = await client.delete(`/templates/${id}`);
    if (!result.success) {
      spinner.fail("Failed to delete template");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Template deleted!");
  });
  const domains = emailCmd.command("domains").description("Manage email domains");
  domains.command("list").description("List email domains").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/domains");
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list domains");
      process.exit(1);
    }
    if (options.json) {
      print(result.data.domains, "json");
    } else {
      const data = result.data.domains.map((d) => ({
        id: d.id,
        domain: d.name,
        status: d.status,
        dkimVerified: d.dkimVerified ? "Yes" : "No",
        spfVerified: d.spfVerified ? "Yes" : "No"
      }));
      print(data);
    }
  });
  domains.command("add <domain>").description("Add a domain").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (domain, options) => {
    requireLogin();
    const spinner = ora2("Adding domain...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/domains", { domain });
    if (!result.success || !result.data) {
      spinner.fail("Failed to add domain");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Domain added!");
    console.log("\nDNS Records to configure:");
    for (const record of result.data.dnsRecords) {
      console.log(`
${record.type}:`);
      console.log(`  Name: ${record.name}`);
      console.log(`  Value: ${record.value}`);
    }
    if (options.json) {
      print(result.data, "json");
    }
  });
  domains.command("verify <id>").description("Verify a domain").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (id, options) => {
    requireLogin();
    const spinner = ora2("Verifying domain...").start();
    const client = getApiClient(options.org);
    const result = await client.post(`/domains/${id}/verify`);
    if (!result.success || !result.data) {
      spinner.fail("Domain verification failed");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    if (result.data.status === "VERIFIED") {
      spinner.succeed("Domain verified!");
    } else {
      spinner.info("Verification in progress");
      console.log("\nVerification Status:");
      const checkmark = (verified) => verified ? "\u2713" : "\u2717";
      console.log(`  ${checkmark(result.data.dkimVerified)} DKIM`);
      console.log(`  ${checkmark(result.data.spfVerified)} SPF`);
      console.log(`  ${checkmark(result.data.returnPathVerified)} Return-Path`);
      console.log(`  ${checkmark(result.data.dmarcVerified)} DMARC`);
      if (result.data.verificationError) {
        console.log(`
Error: ${result.data.verificationError}`);
      }
    }
    if (options.json) {
      print(result.data, "json");
    }
  });
  domains.command("delete <id>").description("Delete a domain").option("-o, --org <slug>", "Organization slug").action(async (id, options) => {
    requireLogin();
    const shouldDelete = await confirm(`Are you sure you want to delete domain ${id}?`, false);
    if (!shouldDelete) {
      return;
    }
    const spinner = ora2("Deleting domain...").start();
    const client = getApiClient(options.org);
    const result = await client.delete(`/domains/${id}`);
    if (!result.success) {
      spinner.fail("Failed to delete domain");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Domain deleted!");
  });
  const senders = emailCmd.command("senders").description("Manage email senders");
  senders.command("list").description("List email senders").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/senders");
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list senders");
      process.exit(1);
    }
    if (options.json) {
      print(result.data.senders, "json");
    } else {
      const data = result.data.senders.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name || "-",
        status: s.status
      }));
      print(data);
    }
  });
  senders.command("add <email>").description("Add an email sender").option("--name <name>", "Sender name").option("-o, --org <slug>", "Organization slug").action(async (emailAddr, options) => {
    requireLogin();
    const spinner = ora2("Adding sender...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/senders", {
      email: emailAddr,
      name: options.name
    });
    if (!result.success || !result.data) {
      spinner.fail("Failed to add sender");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Sender added! Check your email for verification link.");
  });
  senders.command("delete <id>").description("Delete an email sender").option("-o, --org <slug>", "Organization slug").action(async (id, options) => {
    requireLogin();
    const shouldDelete = await confirm(`Are you sure you want to delete sender ${id}?`, false);
    if (!shouldDelete) {
      return;
    }
    const spinner = ora2("Deleting sender...").start();
    const client = getApiClient(options.org);
    const result = await client.delete(`/senders/${id}`);
    if (!result.success) {
      spinner.fail("Failed to delete sender");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Sender deleted!");
  });
  const suppressions = emailCmd.command("suppressions").description("Manage email suppressions");
  suppressions.command("list").description("List email suppressions").option("-o, --org <slug>", "Organization slug").option("--server <id>", "Filter by server ID").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const params = new URLSearchParams();
    if (options.server) {
      params.set("serverId", options.server);
    }
    const queryString = params.toString();
    const url = queryString ? `/suppressions?${queryString}` : "/suppressions";
    const result = await client.get(url);
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list suppressions");
      process.exit(1);
    }
    if (options.json) {
      print(result.data.data, "json");
    } else {
      const data = result.data.data.map((s) => ({
        id: s.id,
        email: s.email,
        reason: s.reason,
        created: s.createdAt
      }));
      print(data);
    }
  });
  suppressions.command("add <email>").description("Add email to suppression list").option("-o, --org <slug>", "Organization slug").requiredOption("--server <id>", "Server ID to add suppression to").option("--reason <reason>", "Suppression reason (HARD_BOUNCE, SPAM_COMPLAINT, MANUAL, UNSUBSCRIBE)", "MANUAL").option("--notes <notes>", "Optional notes").action(async (emailAddr, options) => {
    requireLogin();
    const spinner = ora2("Adding to suppression list...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/suppressions", {
      email: emailAddr,
      serverId: parseInt(options.server, 10),
      reason: options.reason,
      notes: options.notes
    });
    if (!result.success) {
      spinner.fail("Failed to add suppression");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Email added to suppression list!");
  });
  suppressions.command("remove <id>").description("Remove suppression by ID").option("-o, --org <slug>", "Organization slug").action(async (id, options) => {
    requireLogin();
    const shouldRemove = await confirm(
      `Are you sure you want to remove suppression #${id}?`,
      false
    );
    if (!shouldRemove) {
      return;
    }
    const spinner = ora2("Removing from suppression list...").start();
    const client = getApiClient(options.org);
    const result = await client.delete(`/suppressions/${id}`);
    if (!result.success) {
      spinner.fail("Failed to remove suppression");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Suppression removed!");
  });
  emailCmd.command("stats").description("Get email statistics").option("--period <period>", "Period (day, week, month)", "week").option("--server <id>", "Filter by server ID").option("--stream <id>", "Filter by stream ID").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/stats/outbound", {
      period: options.period,
      serverId: options.server ? parseInt(options.server, 10) : void 0,
      streamId: options.stream ? parseInt(options.stream, 10) : void 0
    });
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to get stats");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const data = result.data;
      console.log(`
Email Statistics (${data.period})
`);
      printKeyValue("Sent", data.sent);
      printKeyValue("Delivered", data.delivered);
      printKeyValue("Bounced", data.bounced);
      printKeyValue("Complaints", data.complained);
      printKeyValue("Opened", data.opened);
      printKeyValue("Clicked", data.clicked);
      console.log("\nRates:");
      printKeyValue("Delivery Rate", `${(data.deliveryRate * 100).toFixed(2)}%`);
      printKeyValue("Open Rate", `${(data.openRate * 100).toFixed(2)}%`);
      printKeyValue("Click Rate", `${(data.clickRate * 100).toFixed(2)}%`);
      printKeyValue("Bounce Rate", `${(data.bounceRate * 100).toFixed(2)}%`);
      printKeyValue("Complaint Rate", `${(data.complaintRate * 100).toFixed(4)}%`);
    }
  });
  return emailCmd;
}
function requireLogin() {
  if (!isLoggedIn()) {
    printError('Not logged in. Use "transactional login" to authenticate.');
    process.exit(1);
  }
}
function createConfigCommand() {
  const configCmd = new Command("config").description("Manage CLI configuration");
  configCmd.command("show").description("Show current configuration").option("--json", "Output as JSON").action((options) => {
    const config = getConfig();
    if (options.json) {
      print(config, "json");
    } else {
      console.log();
      printHeading2("Current Configuration");
      printKeyValue("API URL", config.apiUrl);
      printKeyValue("Web URL", config.webUrl);
      printKeyValue("Output Format", config.outputFormat);
      printKeyValue("Color", config.color ? "enabled" : "disabled");
      console.log();
      printHeading2("File Locations");
      printKeyValue("Config Directory", getConfigDir());
      printKeyValue("Credentials File", getCredentialsFile());
    }
  });
  configCmd.command("set <key> <value>").description("Set a configuration value").action((key, value) => {
    const validKeys = ["apiUrl", "webUrl", "outputFormat", "color"];
    if (!validKeys.includes(key)) {
      console.error(`Invalid key: ${key}`);
      console.error(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(1);
    }
    if (key === "outputFormat") {
      const validFormats = ["table", "json", "yaml"];
      if (!validFormats.includes(value)) {
        console.error(`Invalid output format: ${value}`);
        console.error(`Valid formats: ${validFormats.join(", ")}`);
        process.exit(1);
      }
    }
    if (key === "color") {
      const validColors = ["true", "false", "yes", "no", "1", "0"];
      if (!validColors.includes(value.toLowerCase())) {
        console.error(`Invalid color value: ${value}`);
        console.error(`Valid values: true, false`);
        process.exit(1);
      }
    }
    let typedValue = value;
    if (key === "color") {
      typedValue = ["true", "yes", "1"].includes(value.toLowerCase());
    }
    saveConfig({ [key]: typedValue });
    printSuccess(`Set ${key} = ${typedValue}`);
  });
  configCmd.command("get <key>").description("Get a configuration value").action((key) => {
    const config = getConfig();
    const value = config[key];
    if (value === void 0) {
      console.error(`Unknown key: ${key}`);
      process.exit(1);
    }
    console.log(value);
  });
  configCmd.command("reset").description("Reset configuration to defaults").action(() => {
    saveConfig({
      apiUrl: "https://api.usetransactional.com",
      webUrl: "https://usetransactional.com",
      outputFormat: "table",
      color: true
    });
    printSuccess("Configuration reset to defaults");
  });
  configCmd.command("path").description("Show configuration file paths").action(() => {
    console.log("Config Directory:", getConfigDir());
    console.log("Credentials File:", getCredentialsFile());
  });
  return configCmd;
}
function printHeading2(title) {
  if (isColorEnabled()) {
    console.log(chalk4.bold.underline(title));
  } else {
    console.log(`=== ${title} ===`);
  }
}
function getClaudeDesktopConfigPath() {
  const platform2 = os2.platform();
  const homeDir = os2.homedir();
  if (platform2 === "darwin") {
    return path2.join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform2 === "win32") {
    return path2.join(homeDir, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  } else {
    return path2.join(homeDir, ".config", "claude", "claude_desktop_config.json");
  }
}
function getClaudeCodeConfigPath() {
  const homeDir = os2.homedir();
  return path2.join(homeDir, ".claude.json");
}
function getMcpServerUrl() {
  const apiUrl = getApiUrl();
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return apiUrl.replace(/\/$/, "") + "/mcp";
  }
  return process.env.MCP_SERVER_URL || "https://mcp.usetransactional.com/mcp";
}
function readJsonConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeJsonConfig(filePath, config) {
  const dir = path2.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
}
function printWarning(message) {
  if (isColorEnabled()) {
    console.log(chalk4.yellow("\u26A0"), message);
  } else {
    console.log("[WARN]", message);
  }
}
function createMcpCommand() {
  const mcpCmd = new Command("mcp").description("MCP (Model Context Protocol) integration");
  mcpCmd.command("setup").description("Show MCP setup instructions").action(() => {
    const mcpUrl = getMcpServerUrl();
    console.log("\n\u{1F4E1} Transactional MCP Server Setup\n");
    console.log("The MCP server allows Claude and other AI assistants to");
    console.log("interact with your Transactional account.\n");
    console.log(chalk4.bold("MCP Server URL:"));
    console.log(`  ${chalk4.cyan(mcpUrl)}
`);
    console.log(chalk4.bold("Setup Options:\n"));
    console.log(chalk4.underline("1. Claude Desktop (Pro/Max/Team/Enterprise)"));
    console.log("   Go to Settings \u2192 Integrations \u2192 Add Custom Integration");
    console.log(`   Enter URL: ${chalk4.cyan(mcpUrl.replace("/mcp", ""))}`);
    console.log("   Claude will handle OAuth authorization automatically.\n");
    console.log(chalk4.underline("2. Claude Desktop (Free/JSON Config)"));
    console.log("   Run: transactional mcp install --target claude-desktop\n");
    console.log(chalk4.underline("3. Claude Code"));
    console.log("   Run: transactional mcp install --target claude-code\n");
    console.log(chalk4.bold("Available Commands:"));
    console.log("  transactional mcp install    Install MCP config");
    console.log("  transactional mcp uninstall  Remove MCP config");
    console.log("  transactional mcp status     Check MCP server status");
    console.log("  transactional mcp tools      List available MCP tools\n");
  });
  mcpCmd.command("config").description("Show MCP server configuration").option("--target <target>", "Target: claude-desktop, claude-code", "claude-desktop").option("--json", "Output as raw JSON").action((options) => {
    const mcpUrl = getMcpServerUrl();
    const target = options.target;
    let config;
    if (target === "claude-code") {
      config = {
        mcpServers: {
          transactional: {
            type: "http",
            url: mcpUrl
          }
        }
      };
    } else {
      config = {
        mcpServers: {
          transactional: {
            command: "npx",
            args: ["mcp-remote", mcpUrl.replace("/mcp", "")]
          }
        }
      };
    }
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log("\n\u{1F4CB} MCP Configuration\n");
      console.log(`Target: ${target}
`);
      console.log("```json");
      console.log(JSON.stringify(config, null, 2));
      console.log("```\n");
      if (target === "claude-desktop") {
        const configPath = getClaudeDesktopConfigPath();
        console.log(`Config file: ${configPath}
`);
        console.log(chalk4.yellow("Note: Uses mcp-remote for OAuth support."));
        console.log("Install mcp-remote: npm install -g mcp-remote\n");
      } else {
        const configPath = getClaudeCodeConfigPath();
        console.log(`Config file: ${configPath}
`);
      }
      console.log('Run "transactional mcp install" to auto-install.\n');
    }
  });
  mcpCmd.command("install").description("Install MCP config to Claude Desktop or Claude Code").option("--target <target>", "Target: claude-desktop, claude-code, both", "both").option("--force", "Overwrite existing transactional config").action(async (options) => {
    const target = options.target;
    const mcpUrl = getMcpServerUrl();
    console.log("\n\u{1F4E1} Installing Transactional MCP configuration...\n");
    const targets = target === "both" ? ["claude-desktop", "claude-code"] : [target];
    let anyInstalled = false;
    let anySkipped = false;
    for (const t of targets) {
      try {
        if (t === "claude-desktop") {
          const configPath = getClaudeDesktopConfigPath();
          const existingConfig = readJsonConfig(configPath) || { mcpServers: {} };
          if (existingConfig.mcpServers?.transactional && !options.force) {
            printWarning(`Claude Desktop: Already configured. Use --force to overwrite.`);
            console.log(`  Config: ${configPath}
`);
            anySkipped = true;
            continue;
          }
          existingConfig.mcpServers = {
            ...existingConfig.mcpServers,
            transactional: {
              command: "npx",
              args: ["mcp-remote", mcpUrl.replace("/mcp", "")]
            }
          };
          writeJsonConfig(configPath, existingConfig);
          printSuccess(`Claude Desktop: Config installed`);
          console.log(`  Config: ${configPath}
`);
          anyInstalled = true;
        } else if (t === "claude-code") {
          const configPath = getClaudeCodeConfigPath();
          const existingConfig = readJsonConfig(configPath) || {};
          if (existingConfig.mcpServers?.transactional && !options.force) {
            printWarning(`Claude Code: Already configured. Use --force to overwrite.`);
            console.log(`  Config: ${configPath}
`);
            anySkipped = true;
            continue;
          }
          existingConfig.mcpServers = {
            ...existingConfig.mcpServers,
            transactional: {
              type: "http",
              url: mcpUrl
            }
          };
          writeJsonConfig(configPath, existingConfig);
          printSuccess(`Claude Code: Config installed`);
          console.log(`  Config: ${configPath}
`);
          anyInstalled = true;
        }
      } catch (err) {
        printError(`Failed to install ${t} config: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
    if (anyInstalled) {
      console.log(chalk4.bold("Next steps:"));
      console.log("1. Restart Claude Desktop/Code to apply changes");
      console.log("2. When you use a Transactional tool, Claude will prompt you to authorize");
      console.log("");
    } else if (anySkipped) {
      console.log("To force reinstall, run: transactional mcp install --force\n");
    }
  });
  mcpCmd.command("uninstall").description("Remove MCP config from Claude Desktop and/or Claude Code").option("--target <target>", "Target: claude-desktop, claude-code, both", "both").action((options) => {
    const target = options.target;
    const targets = target === "both" ? ["claude-desktop", "claude-code"] : [target];
    for (const t of targets) {
      const spinner = ora2(`Removing MCP config from ${t}...`).start();
      try {
        const configPath = t === "claude-desktop" ? getClaudeDesktopConfigPath() : getClaudeCodeConfigPath();
        if (!fs.existsSync(configPath)) {
          spinner.info(`No ${t} config found.`);
          continue;
        }
        const config = readJsonConfig(configPath);
        if (!config?.mcpServers?.transactional) {
          spinner.info(`Transactional not configured in ${t}.`);
          continue;
        }
        delete config.mcpServers.transactional;
        writeJsonConfig(configPath, config);
        spinner.succeed(`Removed from ${t}`);
      } catch (err) {
        spinner.fail(`Failed to remove ${t} config`);
        printError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    console.log("");
    printWarning("Please restart Claude Desktop/Code to apply changes.\n");
  });
  mcpCmd.command("status").description("Check MCP server status").action(async () => {
    const spinner = ora2("Checking MCP server...").start();
    const mcpUrl = getMcpServerUrl().replace("/mcp", "");
    try {
      const response = await fetch(`${mcpUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        spinner.succeed("MCP server is running");
        console.log("\nServer info:");
        print(data);
        console.log("\nOAuth endpoints:");
        console.log(`  Authorization: ${mcpUrl}/mcp/authorize`);
        console.log(`  Token: ${mcpUrl}/mcp/token`);
        console.log(`  Protected Resource Metadata: ${mcpUrl}/.well-known/oauth-protected-resource`);
      } else {
        spinner.fail(`MCP server returned ${response.status}`);
      }
    } catch (err) {
      spinner.fail("Could not connect to MCP server");
      printError(err instanceof Error ? err.message : "Unknown error");
    }
  });
  mcpCmd.command("tools").description("List available MCP tools").action(() => {
    console.log("\n\u{1F527} Available MCP Tools\n");
    const tools = [
      { category: "Email", tools: [
        { name: "transactional_email_send", desc: "Send a single email" },
        { name: "transactional_email_batch", desc: "Send multiple emails" },
        { name: "transactional_email_stats", desc: "Get email statistics" },
        { name: "transactional_templates_list", desc: "List templates" },
        { name: "transactional_templates_get", desc: "Get template details" },
        { name: "transactional_templates_create", desc: "Create template" },
        { name: "transactional_domains_list", desc: "List domains" },
        { name: "transactional_domains_add", desc: "Add domain" },
        { name: "transactional_senders_list", desc: "List senders" },
        { name: "transactional_suppressions_list", desc: "List suppressions" }
      ] },
      { category: "Organization", tools: [
        { name: "transactional_whoami", desc: "Current user info" },
        { name: "transactional_orgs_list", desc: "List organizations" },
        { name: "transactional_orgs_switch", desc: "Switch organization" },
        { name: "transactional_api_keys_list", desc: "List API keys" },
        { name: "transactional_api_keys_create", desc: "Create API key" },
        { name: "transactional_members_list", desc: "List members" }
      ] },
      { category: "Billing", tools: [
        { name: "transactional_billing_usage", desc: "Get usage" },
        { name: "transactional_billing_invoices", desc: "List invoices" },
        { name: "transactional_billing_plan", desc: "Get plan details" }
      ] }
    ];
    for (const category of tools) {
      console.log(`${category.category}:`);
      for (const tool of category.tools) {
        console.log(`  ${tool.name.padEnd(35)} ${tool.desc}`);
      }
      console.log();
    }
  });
  return mcpCmd;
}

// src/index.ts
initConfig();
function createProgram() {
  const program2 = new Command();
  program2.name("transactional").description("CLI for Transactional - manage email, SMS, forms, and more").version("0.1.3");
  program2.addCommand(createLoginCommand());
  program2.addCommand(createLogoutCommand());
  program2.addCommand(createWhoamiCommand());
  program2.addCommand(createSwitchCommand());
  program2.addCommand(createOrgsCommand());
  program2.addCommand(createEmailCommand());
  program2.addCommand(createConfigCommand());
  program2.addCommand(createMcpCommand());
  return program2;
}

// src/bin.ts
var program = createProgram();
program.parse(process.argv);
//# sourceMappingURL=bin.js.map
//# sourceMappingURL=bin.js.map