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
  getAuthenticatedOrganizations,
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
        printInfo(`Already logged in to organization: ${currentOrg}`);
        printInfo('Use "transactional logout" to log out first, or "transactional switch" to change organization.');
        return;
      }

      const spinner = ora('Opening browser for authentication...').start();

      const result = await login(options.mcp ? 'mcp' : 'cli', () => {
        spinner.text = 'Waiting for browser authentication...';
      });

      if (!result.success || !result.data) {
        spinner.fail('Login failed');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Login successful!');
      console.log();
      printKeyValue('User', result.data.user.email);
      printKeyValue('Organization', `${result.data.organization.name} (${result.data.organization.slug})`);
      printKeyValue('Role', result.data.organization.role);
    });
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
 * Create the switch command
 */
export function createSwitchCommand(): Command {
  return new Command('switch')
    .description('Switch to a different organization')
    .argument('[slug]', 'Organization slug to switch to')
    .action(async (slug?: string) => {
      if (!isLoggedIn()) {
        printError('Not logged in. Use "transactional login" to authenticate.');
        process.exit(1);
      }

      const orgs = getAuthenticatedOrganizations();

      if (orgs.length === 0) {
        printError('No authenticated organizations found.');
        process.exit(1);
      }

      if (orgs.length === 1) {
        printInfo(`Only one organization available: ${orgs[0]}`);
        switchOrganization(orgs[0]);
        return;
      }

      let targetSlug = slug;

      if (!targetSlug) {
        // Show organization picker
        // First, try to get org info for each authenticated org
        const orgInfos = [];
        for (const orgSlug of orgs) {
          const result = await whoami(orgSlug);
          if (result.success && result.data) {
            orgInfos.push({
              id: result.data.organization.id,
              name: result.data.organization.name,
              slug: result.data.organization.slug,
              role: result.data.organization.role,
            });
          } else {
            orgInfos.push({
              id: 0,
              name: orgSlug,
              slug: orgSlug,
              role: 'unknown',
            });
          }
        }

        targetSlug = await selectOrganization(orgInfos);
      }

      if (!orgs.includes(targetSlug)) {
        printError(`Organization "${targetSlug}" is not authenticated.`);
        printInfo('Available organizations: ' + orgs.join(', '));
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

/**
 * Create the orgs list command
 */
export function createOrgsCommand(): Command {
  const orgsCmd = new Command('orgs')
    .description('List organizations');

  orgsCmd
    .command('list')
    .description('List all authenticated organizations')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const orgs = getAuthenticatedOrganizations();

      if (orgs.length === 0) {
        printInfo('No authenticated organizations. Use "transactional login" to authenticate.');
        return;
      }

      // Get detailed info for each org
      const orgInfos = [];
      const currentOrg = getCurrentOrganization();

      for (const orgSlug of orgs) {
        const result = await whoami(orgSlug);
        if (result.success && result.data) {
          orgInfos.push({
            slug: result.data.organization.slug,
            name: result.data.organization.name,
            role: result.data.organization.role,
            current: orgSlug === currentOrg ? 'Yes' : 'No',
          });
        } else {
          orgInfos.push({
            slug: orgSlug,
            name: '-',
            role: '-',
            current: orgSlug === currentOrg ? 'Yes' : 'No',
          });
        }
      }

      if (options.json) {
        print(orgInfos, 'json');
      } else {
        print(orgInfos);
      }
    });

  return orgsCmd;
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
