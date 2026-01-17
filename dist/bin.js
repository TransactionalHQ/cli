#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as crypto from 'crypto';
import open from 'open';
import ora2 from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import yaml from 'yaml';
import inquirer from 'inquirer';

var CONFIG_DIR = path.join(os.homedir(), ".transactional");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
var CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");
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
      currentCredentials = JSON.parse(content);
    } catch {
      currentCredentials = {
        version: 1,
        organizations: {}
      };
    }
  } else {
    currentCredentials = {
      version: 1,
      organizations: {}
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
function getOrganizationToken(orgSlug) {
  const credentials = loadCredentials();
  const slug = orgSlug || credentials.currentOrganization;
  if (!slug) return void 0;
  const orgCreds = credentials.organizations[slug];
  if (!orgCreds) return void 0;
  if (orgCreds.expiresAt && new Date(orgCreds.expiresAt) < /* @__PURE__ */ new Date()) {
    return void 0;
  }
  return orgCreds.token;
}
function storeOrganizationToken(orgSlug, token, expiresAt) {
  const credentials = loadCredentials();
  credentials.organizations[orgSlug] = { token, expiresAt };
  saveCredentials(credentials);
}
function getAuthenticatedOrganizations() {
  const credentials = loadCredentials();
  return Object.keys(credentials.organizations);
}
function isLoggedIn() {
  const credentials = loadCredentials();
  return Object.keys(credentials.organizations).length > 0;
}
function clearCredentials() {
  ensureConfigDir();
  currentCredentials = {
    version: 1,
    organizations: {}
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
  const credentials = loadCredentials();
  if (credentials.organizations[orgSlug]) {
    credentials.currentOrganization = orgSlug;
    saveCredentials(credentials);
    return true;
  }
  return false;
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
  baseUrl;
  token;
  constructor(orgSlug) {
    this.baseUrl = getApiUrl();
    this.token = getOrganizationToken(orgSlug);
  }
  /**
   * Get headers for API requests
   */
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "transactional-cli/0.1.0"
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }
  /**
   * Build URL with query parameters
   */
  buildUrl(path2, params) {
    const url = new URL(path2, this.baseUrl);
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
  async request(method, path2, options) {
    try {
      const url = this.buildUrl(path2, options?.params);
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
              message: `Cannot connect to API server at ${this.baseUrl}. Check your network connection.`
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
  async get(path2, params) {
    return this.request("GET", path2, { params });
  }
  /**
   * POST request
   */
  async post(path2, body) {
    return this.request("POST", path2, { body });
  }
  /**
   * PUT request
   */
  async put(path2, body) {
    return this.request("PUT", path2, { body });
  }
  /**
   * PATCH request
   */
  async patch(path2, body) {
    return this.request("PATCH", path2, { body });
  }
  /**
   * DELETE request
   */
  async delete(path2) {
    return this.request("DELETE", path2);
  }
};
function getApiClient(orgSlug) {
  return new ApiClient(orgSlug);
}
var CALLBACK_PORT_RANGE = [3e3, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
function generateState() {
  return crypto.randomBytes(32).toString("base64url");
}
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}
function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
function startCallbackServer(state, codeVerifier, sessionType = "cli") {
  return new Promise((resolve, reject) => {
    let server = null;
    const tryPort = (portIndex) => {
      if (portIndex >= CALLBACK_PORT_RANGE.length) {
        reject(new Error("Could not find available port for callback server"));
        return;
      }
      const port = CALLBACK_PORT_RANGE[portIndex];
      server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");
          const orgSlug = url.searchParams.get("org");
          const error = url.searchParams.get("error");
          const errorDescription = url.searchParams.get("error_description");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "text/html");
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
            reject(new Error("Missing required parameters in callback"));
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
            reject(new Error("Invalid state parameter"));
            return;
          }
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
          res.end("Not found");
        }
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          tryPort(portIndex + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, "127.0.0.1", () => {
      });
    };
    tryPort(0);
    setTimeout(() => {
      if (server?.listening) {
        server.close();
        reject(new Error("Login timed out. Please try again."));
      }
    }, 5 * 60 * 1e3);
  });
}
async function exchangeCodeForToken(code, codeVerifier, redirectUri, sessionType = "cli") {
  getApiUrl();
  const webUrl = getWebUrl();
  const response = await fetch(`${webUrl}/api/cli/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "transactional-cli/0.1.0"
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri,
      sessionType: sessionType.toUpperCase()
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Token exchange failed: ${response.statusText}`
    );
  }
  const data = await response.json();
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    user: data.user,
    organization: data.organization
  };
}
async function login(sessionType = "cli", onBrowserOpen) {
  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const callbackPromise = startCallbackServer(state, codeVerifier, sessionType);
    await new Promise((resolve) => setTimeout(resolve, 100));
    let port = 3e3;
    for (const p of CALLBACK_PORT_RANGE) {
      try {
        const server = http.createServer();
        await new Promise((resolve, reject) => {
          server.once("error", (err) => {
            if (err.code === "EADDRINUSE") {
              port = p;
              resolve();
            } else {
              reject(err);
            }
          });
          server.listen(p, "127.0.0.1", () => {
            server.close();
            resolve();
          });
        });
        if (port === p) break;
      } catch {
      }
    }
    const redirectUri = `http://localhost:${port}/callback`;
    const webUrl = getWebUrl();
    const authUrl = new URL("/cli/authorize", webUrl);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("session_type", sessionType.toUpperCase());
    if (onBrowserOpen) {
      onBrowserOpen();
    }
    await open(authUrl.toString());
    const { code, orgSlug } = await callbackPromise;
    const { token, expiresAt, user, organization } = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
      sessionType
    );
    storeOrganizationToken(orgSlug, token, expiresAt);
    storeUserInfo(user);
    setCurrentOrganization(orgSlug);
    return {
      success: true,
      data: {
        user,
        organization
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
      head: columns.map((c) => isColorEnabled() ? chalk.bold(c) : c),
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
      const formattedKey = isColorEnabled() ? chalk.bold(key) : key;
      table.push({ [formattedKey]: formatValue(value) });
    }
    return table.toString();
  }
  return String(data);
}
function formatValue(value) {
  if (value === null || value === void 0) {
    return isColorEnabled() ? chalk.gray("-") : "-";
  }
  if (typeof value === "boolean") {
    if (isColorEnabled()) {
      return value ? chalk.green("Yes") : chalk.red("No");
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
    console.log(chalk.green("\u2713"), message);
  } else {
    console.log("[OK]", message);
  }
}
function printError(message, details) {
  if (isColorEnabled()) {
    console.error(chalk.red("\u2717"), message);
  } else {
    console.error("[ERROR]", message);
  }
}
function printKeyValue(key, value) {
  const formattedValue = formatValue(value);
  if (isColorEnabled()) {
    console.log(`${chalk.gray(key + ":")} ${formattedValue}`);
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
  return new Command("login").description("Authenticate with Transactional").option("--mcp", "Login for MCP server use").action(async (options) => {
    if (isLoggedIn()) {
      const currentOrg = getCurrentOrganization();
      printInfo(`Already logged in to organization: ${currentOrg}`);
      printInfo('Use "transactional logout" to log out first, or "transactional switch" to change organization.');
      return;
    }
    const spinner = ora2("Opening browser for authentication...").start();
    const result = await login(options.mcp ? "mcp" : "cli", () => {
      spinner.text = "Waiting for browser authentication...";
    });
    if (!result.success || !result.data) {
      spinner.fail("Login failed");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Login successful!");
    console.log();
    printKeyValue("User", result.data.user.email);
    printKeyValue("Organization", `${result.data.organization.name} (${result.data.organization.slug})`);
    printKeyValue("Role", result.data.organization.role);
  });
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
      printKeyValue("ID", organization.id);
      printKeyValue("Name", organization.name);
      printKeyValue("Slug", organization.slug);
      printKeyValue("Role", organization.role);
      console.log();
      printHeading("Session");
      printKeyValue("ID", session.id);
      printKeyValue("Type", session.type);
      printKeyValue("Created", session.createdAt);
      if (session.expiresAt) printKeyValue("Expires", session.expiresAt);
    }
  });
}
function createSwitchCommand() {
  return new Command("switch").description("Switch to a different organization").argument("[slug]", "Organization slug to switch to").action(async (slug) => {
    if (!isLoggedIn()) {
      printError('Not logged in. Use "transactional login" to authenticate.');
      process.exit(1);
    }
    const orgs = getAuthenticatedOrganizations();
    if (orgs.length === 0) {
      printError("No authenticated organizations found.");
      process.exit(1);
    }
    if (orgs.length === 1) {
      printInfo(`Only one organization available: ${orgs[0]}`);
      switchOrganization(orgs[0]);
      return;
    }
    let targetSlug = slug;
    if (!targetSlug) {
      const orgInfos = [];
      for (const orgSlug of orgs) {
        const result = await whoami(orgSlug);
        if (result.success && result.data) {
          orgInfos.push({
            id: result.data.organization.id,
            name: result.data.organization.name,
            slug: result.data.organization.slug,
            role: result.data.organization.role
          });
        } else {
          orgInfos.push({
            id: 0,
            name: orgSlug,
            slug: orgSlug,
            role: "unknown"
          });
        }
      }
      targetSlug = await selectOrganization(orgInfos);
    }
    if (!orgs.includes(targetSlug)) {
      printError(`Organization "${targetSlug}" is not authenticated.`);
      printInfo("Available organizations: " + orgs.join(", "));
      process.exit(1);
    }
    const success = switchOrganization(targetSlug);
    if (success) {
      printSuccess(`Switched to organization: ${targetSlug}`);
    } else {
      printError(`Failed to switch to organization: ${targetSlug}`);
      process.exit(1);
    }
  });
}
function createOrgsCommand() {
  const orgsCmd = new Command("orgs").description("List organizations");
  orgsCmd.command("list").description("List all authenticated organizations").option("--json", "Output as JSON").action(async (options) => {
    const orgs = getAuthenticatedOrganizations();
    if (orgs.length === 0) {
      printInfo('No authenticated organizations. Use "transactional login" to authenticate.');
      return;
    }
    const orgInfos = [];
    const currentOrg = getCurrentOrganization();
    for (const orgSlug of orgs) {
      const result = await whoami(orgSlug);
      if (result.success && result.data) {
        orgInfos.push({
          slug: result.data.organization.slug,
          name: result.data.organization.name,
          role: result.data.organization.role,
          current: orgSlug === currentOrg ? "Yes" : "No"
        });
      } else {
        orgInfos.push({
          slug: orgSlug,
          name: "-",
          role: "-",
          current: orgSlug === currentOrg ? "Yes" : "No"
        });
      }
    }
    if (options.json) {
      print(orgInfos, "json");
    } else {
      print(orgInfos);
    }
  });
  return orgsCmd;
}
function printInfo(message) {
  if (isColorEnabled()) {
    console.log(chalk.blue("\u2139"), message);
  } else {
    console.log("[INFO]", message);
  }
}
function printHeading(title) {
  if (isColorEnabled()) {
    console.log(chalk.bold.underline(title));
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
    const result = await client.get("/email/templates", {
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
    const result = await client.get(`/email/templates/${id}`);
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
    const result = await client.post("/email/templates", {
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
    const result = await client.patch(`/email/templates/${id}`, {
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
    const result = await client.delete(`/email/templates/${id}`);
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
    const result = await client.get("/email/domains");
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list domains");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const data = result.data.map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        verified: d.verifiedAt || "-"
      }));
      print(data);
    }
  });
  domains.command("add <domain>").description("Add a domain").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (domain, options) => {
    requireLogin();
    const spinner = ora2("Adding domain...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/email/domains", { domain });
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
    const result = await client.post(`/email/domains/${id}/verify`);
    if (!result.success || !result.data) {
      spinner.fail("Domain verification failed");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    if (result.data.status === "VERIFIED") {
      spinner.succeed("Domain verified!");
    } else {
      spinner.info("Verification in progress");
      console.log("\nDNS Record Status:");
      for (const record of result.data.dnsRecords) {
        const status = record.verified ? "\u2713" : "\u2717";
        console.log(`  ${status} ${record.type}: ${record.name}`);
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
    const result = await client.delete(`/email/domains/${id}`);
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
    const result = await client.get("/email/senders");
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list senders");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const data = result.data.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name || "-",
        status: s.status,
        verified: s.verifiedAt || "-"
      }));
      print(data);
    }
  });
  senders.command("add <email>").description("Add an email sender").option("--name <name>", "Sender name").option("-o, --org <slug>", "Organization slug").action(async (emailAddr, options) => {
    requireLogin();
    const spinner = ora2("Adding sender...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/email/senders", {
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
    const result = await client.delete(`/email/senders/${id}`);
    if (!result.success) {
      spinner.fail("Failed to delete sender");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Sender deleted!");
  });
  const suppressions = emailCmd.command("suppressions").description("Manage email suppressions");
  suppressions.command("list").description("List email suppressions").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/email/suppressions");
    if (!result.success || !result.data) {
      printError(result.error?.message || "Failed to list suppressions");
      process.exit(1);
    }
    if (options.json) {
      print(result.data, "json");
    } else {
      const data = result.data.map((s) => ({
        email: s.email,
        reason: s.reason,
        created: s.createdAt
      }));
      print(data);
    }
  });
  suppressions.command("add <email>").description("Add email to suppression list").option("-o, --org <slug>", "Organization slug").action(async (emailAddr, options) => {
    requireLogin();
    const spinner = ora2("Adding to suppression list...").start();
    const client = getApiClient(options.org);
    const result = await client.post("/email/suppressions", { email: emailAddr });
    if (!result.success) {
      spinner.fail("Failed to add suppression");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Email added to suppression list!");
  });
  suppressions.command("remove <email>").description("Remove email from suppression list").option("-o, --org <slug>", "Organization slug").action(async (emailAddr, options) => {
    requireLogin();
    const shouldRemove = await confirm(
      `Are you sure you want to remove ${emailAddr} from the suppression list?`,
      false
    );
    if (!shouldRemove) {
      return;
    }
    const spinner = ora2("Removing from suppression list...").start();
    const client = getApiClient(options.org);
    const result = await client.delete(`/email/suppressions/${encodeURIComponent(emailAddr)}`);
    if (!result.success) {
      spinner.fail("Failed to remove suppression");
      printError(result.error?.message || "Unknown error");
      process.exit(1);
    }
    spinner.succeed("Email removed from suppression list!");
  });
  emailCmd.command("stats").description("Get email statistics").option("--period <period>", "Period (day, week, month)", "week").option("--server <id>", "Filter by server ID").option("--stream <id>", "Filter by stream ID").option("-o, --org <slug>", "Organization slug").option("--json", "Output as JSON").action(async (options) => {
    requireLogin();
    const client = getApiClient(options.org);
    const result = await client.get("/email/stats", {
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
    console.log(chalk.bold.underline(title));
  } else {
    console.log(`=== ${title} ===`);
  }
}

// src/index.ts
initConfig();
function createProgram() {
  const program2 = new Command();
  program2.name("transactional").description("CLI for Transactional - manage email, SMS, forms, and more").version("0.1.0");
  program2.addCommand(createLoginCommand());
  program2.addCommand(createLogoutCommand());
  program2.addCommand(createWhoamiCommand());
  program2.addCommand(createSwitchCommand());
  program2.addCommand(createOrgsCommand());
  program2.addCommand(createEmailCommand());
  program2.addCommand(createConfigCommand());
  return program2;
}

// src/bin.ts
var program = createProgram();
program.parse(process.argv);
//# sourceMappingURL=bin.js.map
//# sourceMappingURL=bin.js.map