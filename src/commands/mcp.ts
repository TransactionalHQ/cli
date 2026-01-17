/**
 * MCP Commands
 *
 * Commands for setting up MCP (Model Context Protocol) integration.
 * Supports Claude Desktop (paid and free tiers) and Claude Code.
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import { getApiUrl, getWebUrl, getCurrentOrganization, isColorEnabled } from '../lib';
import { printSuccess, printError, print } from '../output';

// =============================================================================
// TYPES
// =============================================================================

interface McpServerConfig {
  url: string;
}

interface McpServerConfigWithCommand {
  command: string;
  args: string[];
}

interface ClaudeDesktopConfig {
  mcpServers?: Record<string, McpServerConfig | McpServerConfigWithCommand>;
}

interface ClaudeCodeConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

type InstallTarget = 'claude-desktop' | 'claude-code' | 'both';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get Claude Desktop config path based on platform
 */
function getClaudeDesktopConfigPath(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux
    return path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
  }
}

/**
 * Get Claude Code config path
 */
function getClaudeCodeConfigPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.claude.json');
}

/**
 * Get the MCP server URL
 */
function getMcpServerUrl(): string {
  const apiUrl = getApiUrl();
  // MCP server is at the /mcp endpoint on the API, or separate domain in production
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    return apiUrl.replace(/\/$/, '') + '/mcp';
  }
  // In production, MCP has its own subdomain
  return process.env.MCP_SERVER_URL || 'https://mcp.usetransactional.com/mcp';
}

/**
 * Read and parse a JSON config file
 */
function readJsonConfig<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON config file
 */
function writeJsonConfig(filePath: string, config: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Print info message
 */
function printInfo(message: string): void {
  if (isColorEnabled()) {
    console.log(chalk.blue('ℹ'), message);
  } else {
    console.log('[INFO]', message);
  }
}

/**
 * Print warning message
 */
function printWarning(message: string): void {
  if (isColorEnabled()) {
    console.log(chalk.yellow('⚠'), message);
  } else {
    console.log('[WARN]', message);
  }
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Create the mcp command
 */
export function createMcpCommand(): Command {
  const mcpCmd = new Command('mcp').description('MCP (Model Context Protocol) integration');

  // Setup command - shows instructions
  mcpCmd
    .command('setup')
    .description('Show MCP setup instructions')
    .action(() => {
      const mcpUrl = getMcpServerUrl();

      console.log('\n📡 Transactional MCP Server Setup\n');
      console.log('The MCP server allows Claude and other AI assistants to');
      console.log('interact with your Transactional account.\n');

      console.log(chalk.bold('MCP Server URL:'));
      console.log(`  ${chalk.cyan(mcpUrl)}\n`);

      console.log(chalk.bold('Setup Options:\n'));

      console.log(chalk.underline('1. Claude Desktop (Pro/Max/Team/Enterprise)'));
      console.log('   Go to Settings → Integrations → Add Custom Integration');
      console.log(`   Enter URL: ${chalk.cyan(mcpUrl.replace('/mcp', ''))}`);
      console.log('   Claude will handle OAuth authorization automatically.\n');

      console.log(chalk.underline('2. Claude Desktop (Free/JSON Config)'));
      console.log('   Run: transactional mcp install --target claude-desktop\n');

      console.log(chalk.underline('3. Claude Code'));
      console.log('   Run: transactional mcp install --target claude-code\n');

      console.log(chalk.bold('Available Commands:'));
      console.log('  transactional mcp install    Install MCP config');
      console.log('  transactional mcp uninstall  Remove MCP config');
      console.log('  transactional mcp status     Check MCP server status');
      console.log('  transactional mcp tools      List available MCP tools\n');
    });

  // Config command - outputs config JSON
  mcpCmd
    .command('config')
    .description('Show MCP server configuration')
    .option('--target <target>', 'Target: claude-desktop, claude-code', 'claude-desktop')
    .option('--json', 'Output as raw JSON')
    .action((options) => {
      const mcpUrl = getMcpServerUrl();
      const target = options.target as InstallTarget;

      let config: ClaudeDesktopConfig | ClaudeCodeConfig;

      if (target === 'claude-code') {
        // Claude Code uses URL-based config (OAuth handled by Claude)
        config = {
          mcpServers: {
            transactional: {
              url: mcpUrl,
            },
          },
        };
      } else {
        // Claude Desktop (JSON config) uses mcp-remote for OAuth support
        config = {
          mcpServers: {
            transactional: {
              command: 'npx',
              args: ['mcp-remote', mcpUrl.replace('/mcp', '')],
            },
          },
        };
      }

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log('\n📋 MCP Configuration\n');
        console.log(`Target: ${target}\n`);
        console.log('```json');
        console.log(JSON.stringify(config, null, 2));
        console.log('```\n');

        if (target === 'claude-desktop') {
          const configPath = getClaudeDesktopConfigPath();
          console.log(`Config file: ${configPath}\n`);
          console.log(chalk.yellow('Note: Uses mcp-remote for OAuth support.'));
          console.log('Install mcp-remote: npm install -g mcp-remote\n');
        } else {
          const configPath = getClaudeCodeConfigPath();
          console.log(`Config file: ${configPath}\n`);
        }

        console.log('Run "transactional mcp install" to auto-install.\n');
      }
    });

  // Install command - auto-install to Claude Desktop or Claude Code
  mcpCmd
    .command('install')
    .description('Install MCP config to Claude Desktop or Claude Code')
    .option('--target <target>', 'Target: claude-desktop, claude-code, both', 'both')
    .option('--force', 'Overwrite existing transactional config')
    .action(async (options) => {
      const target = options.target as InstallTarget;
      const mcpUrl = getMcpServerUrl();

      console.log('\n📡 Installing Transactional MCP configuration...\n');

      const targets = target === 'both' ? ['claude-desktop', 'claude-code'] : [target];
      let anyInstalled = false;
      let anySkipped = false;

      for (const t of targets) {
        try {
          if (t === 'claude-desktop') {
            const configPath = getClaudeDesktopConfigPath();
            const existingConfig = readJsonConfig<ClaudeDesktopConfig>(configPath) || { mcpServers: {} };

            // Check if transactional already exists
            if (existingConfig.mcpServers?.transactional && !options.force) {
              printWarning(`Claude Desktop: Already configured. Use --force to overwrite.`);
              console.log(`  Config: ${configPath}\n`);
              anySkipped = true;
              continue;
            }

            // Use mcp-remote for OAuth support
            existingConfig.mcpServers = {
              ...existingConfig.mcpServers,
              transactional: {
                command: 'npx',
                args: ['mcp-remote', mcpUrl.replace('/mcp', '')],
              },
            };

            writeJsonConfig(configPath, existingConfig);
            printSuccess(`Claude Desktop: Config installed`);
            console.log(`  Config: ${configPath}\n`);
            anyInstalled = true;

          } else if (t === 'claude-code') {
            const configPath = getClaudeCodeConfigPath();
            const existingConfig = readJsonConfig<ClaudeCodeConfig>(configPath) || {};

            // Check if transactional already exists
            if (existingConfig.mcpServers?.transactional && !options.force) {
              printWarning(`Claude Code: Already configured. Use --force to overwrite.`);
              console.log(`  Config: ${configPath}\n`);
              anySkipped = true;
              continue;
            }

            // Claude Code supports URL-based OAuth
            existingConfig.mcpServers = {
              ...existingConfig.mcpServers,
              transactional: {
                url: mcpUrl,
              },
            };

            writeJsonConfig(configPath, existingConfig);
            printSuccess(`Claude Code: Config installed`);
            console.log(`  Config: ${configPath}\n`);
            anyInstalled = true;
          }
        } catch (err) {
          printError(`Failed to install ${t} config: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (anyInstalled) {
        console.log(chalk.bold('Next steps:'));
        console.log('1. Restart Claude Desktop/Code to apply changes');
        console.log('2. When you use a Transactional tool, Claude will prompt you to authorize');
        console.log('');
      } else if (anySkipped) {
        console.log('To force reinstall, run: transactional mcp install --force\n');
      }
    });

  // Uninstall command
  mcpCmd
    .command('uninstall')
    .description('Remove MCP config from Claude Desktop and/or Claude Code')
    .option('--target <target>', 'Target: claude-desktop, claude-code, both', 'both')
    .action((options) => {
      const target = options.target as InstallTarget;
      const targets = target === 'both' ? ['claude-desktop', 'claude-code'] : [target];

      for (const t of targets) {
        const spinner = ora(`Removing MCP config from ${t}...`).start();

        try {
          const configPath = t === 'claude-desktop' ? getClaudeDesktopConfigPath() : getClaudeCodeConfigPath();

          if (!fs.existsSync(configPath)) {
            spinner.info(`No ${t} config found.`);
            continue;
          }

          const config = readJsonConfig<ClaudeDesktopConfig | ClaudeCodeConfig>(configPath);
          if (!config?.mcpServers?.transactional) {
            spinner.info(`Transactional not configured in ${t}.`);
            continue;
          }

          delete config.mcpServers.transactional;
          writeJsonConfig(configPath, config);
          spinner.succeed(`Removed from ${t}`);
        } catch (err) {
          spinner.fail(`Failed to remove ${t} config`);
          printError(err instanceof Error ? err.message : 'Unknown error');
        }
      }

      console.log('');
      printWarning('Please restart Claude Desktop/Code to apply changes.\n');
    });

  // Status command
  mcpCmd
    .command('status')
    .description('Check MCP server status')
    .action(async () => {
      const spinner = ora('Checking MCP server...').start();

      const mcpUrl = getMcpServerUrl().replace('/mcp', '');

      try {
        const response = await fetch(`${mcpUrl}/health`);

        if (response.ok) {
          const data = await response.json();
          spinner.succeed('MCP server is running');
          console.log('\nServer info:');
          print(data);

          // Also check OAuth metadata
          console.log('\nOAuth endpoints:');
          console.log(`  Authorization: ${mcpUrl}/mcp/authorize`);
          console.log(`  Token: ${mcpUrl}/mcp/token`);
          console.log(`  Protected Resource Metadata: ${mcpUrl}/.well-known/oauth-protected-resource`);
        } else {
          spinner.fail(`MCP server returned ${response.status}`);
        }
      } catch (err) {
        spinner.fail('Could not connect to MCP server');
        printError(err instanceof Error ? err.message : 'Unknown error');
      }
    });

  // Tools command - list available tools
  mcpCmd
    .command('tools')
    .description('List available MCP tools')
    .action(() => {
      console.log('\n🔧 Available MCP Tools\n');

      const tools = [
        { category: 'Email', tools: [
          { name: 'transactional_email_send', desc: 'Send a single email' },
          { name: 'transactional_email_batch', desc: 'Send multiple emails' },
          { name: 'transactional_email_stats', desc: 'Get email statistics' },
          { name: 'transactional_templates_list', desc: 'List templates' },
          { name: 'transactional_templates_get', desc: 'Get template details' },
          { name: 'transactional_templates_create', desc: 'Create template' },
          { name: 'transactional_domains_list', desc: 'List domains' },
          { name: 'transactional_domains_add', desc: 'Add domain' },
          { name: 'transactional_senders_list', desc: 'List senders' },
          { name: 'transactional_suppressions_list', desc: 'List suppressions' },
        ]},
        { category: 'Organization', tools: [
          { name: 'transactional_whoami', desc: 'Current user info' },
          { name: 'transactional_orgs_list', desc: 'List organizations' },
          { name: 'transactional_orgs_switch', desc: 'Switch organization' },
          { name: 'transactional_api_keys_list', desc: 'List API keys' },
          { name: 'transactional_api_keys_create', desc: 'Create API key' },
          { name: 'transactional_members_list', desc: 'List members' },
        ]},
        { category: 'Billing', tools: [
          { name: 'transactional_billing_usage', desc: 'Get usage' },
          { name: 'transactional_billing_invoices', desc: 'List invoices' },
          { name: 'transactional_billing_plan', desc: 'Get plan details' },
        ]},
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
