/**
 * Auth Commands
 *
 * Commands for authentication: login, logout, whoami, switch org.
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import {
  login,
  logout,
  whoami,
  listOrganizations,
  isLoggedIn,
  getCurrentOrganization,
  switchOrganization,
  isColorEnabled,
} from '../lib';
import { printSuccess, printError, printKeyValue, print } from '../output';
import { selectOrganization } from '../prompts';

/**
 * Create the login command
 */
export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with Transactional')
    .option('--mcp', 'Login for MCP server use')
    .action(async (options) => {
      if (isLoggedIn()) {
        const currentOrg = getCurrentOrganization();
        if (currentOrg) {
          printInfo(`Already logged in. Current organization: ${currentOrg}`);
        } else {
          printInfo('Already logged in. Use "transactional org use <slug>" to select an organization.');
        }
        printInfo('Use "transactional logout" to log out first.');
        return;
      }

      let spinner: ReturnType<typeof ora> | null = null;

      const result = await login(options.mcp ? 'MCP' : 'CLI', {
        onDeviceCode: (userCode, verificationUrl) => {
          console.log();
          console.log(chalk.bold('To complete authentication:'));
          console.log();
          console.log(`  1. Visit: ${chalk.cyan(verificationUrl)}`);
          console.log(`  2. Verify this code matches: ${chalk.bold.yellow(formatUserCode(userCode))}`);
          console.log(`  3. Click "Authorize" in your browser`);
          console.log();
        },
        onBrowserOpen: () => {
          spinner = ora('Opening browser...').start();
          spinner.succeed('Browser opened');
          spinner = ora('Waiting for authorization...').start();
        },
        onPolling: () => {
          // Could add a dot or similar to show activity
        },
      });

      if (spinner) {
        if (!result.success || !result.data) {
          spinner.fail('Login failed');
          printError(result.error?.message || 'Unknown error');
          process.exit(1);
        }
        spinner.succeed('Authorization received!');
      }

      console.log();
      printSuccess('Login successful!');
      console.log();
      printKeyValue('User', result.data!.user.email);

      // Prompt to select an organization
      if (result.data!.organizations.length > 0) {
        console.log();
        printInfo(`You have access to ${result.data!.organizations.length} organization(s).`);
        printInfo('Use "transactional org list" to see them, or "transactional org use <slug>" to select one.');
      }
    });
}

/**
 * Format user code for display (XXXX-XXXX)
 */
function formatUserCode(code: string): string {
  if (code.length === 8) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code;
}

/**
 * Create the logout command
 */
export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Log out from all organizations')
    .action(async () => {
      if (!isLoggedIn()) {
        printInfo('You are not logged in.');
        return;
      }

      logout();
      printSuccess('Logged out from all organizations.');
    });
}

/**
 * Create the whoami command
 */
export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Show current user and organization info')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      if (!isLoggedIn()) {
        printError('Not logged in. Use "transactional login" to authenticate.');
        process.exit(1);
      }

      const result = await whoami(options.org);

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to get user info');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const { user, organization, session } = result.data;
        console.log();
        printHeading('User');
        printKeyValue('ID', user.id);
        printKeyValue('Email', user.email);
        if (user.name) printKeyValue('Name', user.name);

        console.log();
        printHeading('Organization');
        printKeyValue('ID', organization.id);
        printKeyValue('Name', organization.name);
        printKeyValue('Slug', organization.slug);
        printKeyValue('Role', organization.role);

        console.log();
        printHeading('Session');
        printKeyValue('ID', session.id);
        printKeyValue('Type', session.type);
        printKeyValue('Created', session.createdAt);
        if (session.expiresAt) printKeyValue('Expires', session.expiresAt);
      }
    });
}

/**
 * Create the switch command (alias for org use)
 */
export function createSwitchCommand(): Command {
  return new Command('switch')
    .description('Switch to a different organization (alias for "org use")')
    .argument('[slug]', 'Organization slug to switch to')
    .action(async (slug?: string) => {
      if (!isLoggedIn()) {
        printError('Not logged in. Use "transactional login" to authenticate.');
        process.exit(1);
      }

      // Fetch organizations from API
      const spinner = ora('Fetching organizations...').start();
      const orgsResult = await listOrganizations();

      if (!orgsResult.success || !orgsResult.data) {
        spinner.fail('Failed to fetch organizations');
        printError(orgsResult.error?.message || 'Unknown error');
        process.exit(1);
      }

      const orgs = orgsResult.data;
      spinner.stop();

      if (orgs.length === 0) {
        printError('No organizations found.');
        process.exit(1);
      }

      let targetSlug = slug;

      if (!targetSlug) {
        // Show organization picker
        if (orgs.length === 1) {
          targetSlug = orgs[0].slug;
          printInfo(`Only one organization available: ${targetSlug}`);
        } else {
          targetSlug = await selectOrganization(orgs);
        }
      }

      // Verify the slug is valid
      const validOrg = orgs.find((o) => o.slug === targetSlug);
      if (!validOrg) {
        printError(`Organization "${targetSlug}" not found.`);
        printInfo('Available organizations: ' + orgs.map((o) => o.slug).join(', '));
        process.exit(1);
      }

      switchOrganization(targetSlug);
      printSuccess(`Switched to organization: ${validOrg.name} (${targetSlug})`);
    });
}

/**
 * Create the org command with subcommands
 */
export function createOrgsCommand(): Command {
  const orgCmd = new Command('org')
    .description('Manage organizations');

  // org list
  orgCmd
    .command('list')
    .description('List all organizations you have access to')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      if (!isLoggedIn()) {
        printError('Not logged in. Use "transactional login" to authenticate.');
        process.exit(1);
      }

      const spinner = ora('Fetching organizations...').start();
      const result = await listOrganizations();

      if (!result.success || !result.data) {
        spinner.fail('Failed to fetch organizations');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.stop();
      const orgs = result.data;
      const currentOrg = getCurrentOrganization();

      if (orgs.length === 0) {
        printInfo('No organizations found.');
        return;
      }

      const orgInfos = orgs.map((org) => ({
        slug: org.slug,
        name: org.name,
        role: org.role,
        current: org.slug === currentOrg ? '*' : '',
      }));

      if (options.json) {
        print(orgInfos, 'json');
      } else {
        print(orgInfos);
        console.log();
        printInfo(`Current organization: ${currentOrg || '(none selected)'}`);
      }
    });

  // org use <slug>
  orgCmd
    .command('use')
    .description('Set the current organization for CLI commands')
    .argument('<slug>', 'Organization slug to use')
    .action(async (slug: string) => {
      if (!isLoggedIn()) {
        printError('Not logged in. Use "transactional login" to authenticate.');
        process.exit(1);
      }

      // Verify the org exists
      const spinner = ora('Verifying organization...').start();
      const result = await listOrganizations();

      if (!result.success || !result.data) {
        spinner.fail('Failed to verify organization');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      const org = result.data.find((o) => o.slug === slug);
      if (!org) {
        spinner.fail('Organization not found');
        printError(`Organization "${slug}" not found.`);
        printInfo('Use "transactional org list" to see available organizations.');
        process.exit(1);
      }

      spinner.stop();
      switchOrganization(slug);
      printSuccess(`Now using organization: ${org.name} (${slug})`);
    });

  // org current
  orgCmd
    .command('current')
    .description('Show the current organization')
    .action(() => {
      const currentOrg = getCurrentOrganization();
      if (currentOrg) {
        printKeyValue('Current organization', currentOrg);
      } else {
        printInfo('No organization selected. Use "transactional org use <slug>" to select one.');
      }
    });

  return orgCmd;
}

// Helper functions

function printInfo(message: string): void {
  if (isColorEnabled()) {
    console.log(chalk.blue('ℹ'), message);
  } else {
    console.log('[INFO]', message);
  }
}

function printHeading(title: string): void {
  if (isColorEnabled()) {
    console.log(chalk.bold.underline(title));
  } else {
    console.log(`=== ${title} ===`);
  }
}
