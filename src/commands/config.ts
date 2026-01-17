/**
 * Config Commands
 *
 * Commands for managing CLI configuration.
 */

import { Command } from 'commander';
import { getConfig, saveConfig, getConfigDir, getCredentialsFile, isColorEnabled } from '../lib';
import { printSuccess, printKeyValue, print } from '../output';
import chalk from 'chalk';
import type { OutputFormat } from '../lib/types';

/**
 * Create the config command
 */
export function createConfigCommand(): Command {
  const configCmd = new Command('config').description('Manage CLI configuration');

  configCmd
    .command('show')
    .description('Show current configuration')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = getConfig();

      if (options.json) {
        print(config, 'json');
      } else {
        console.log();
        printHeading('Current Configuration');
        printKeyValue('API URL', config.apiUrl);
        printKeyValue('Web URL', config.webUrl);
        printKeyValue('Output Format', config.outputFormat);
        printKeyValue('Color', config.color ? 'enabled' : 'disabled');
        console.log();
        printHeading('File Locations');
        printKeyValue('Config Directory', getConfigDir());
        printKeyValue('Credentials File', getCredentialsFile());
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      const validKeys = ['apiUrl', 'webUrl', 'outputFormat', 'color'];

      if (!validKeys.includes(key)) {
        console.error(`Invalid key: ${key}`);
        console.error(`Valid keys: ${validKeys.join(', ')}`);
        process.exit(1);
      }

      // Validate values
      if (key === 'outputFormat') {
        const validFormats: OutputFormat[] = ['table', 'json', 'yaml'];
        if (!validFormats.includes(value as OutputFormat)) {
          console.error(`Invalid output format: ${value}`);
          console.error(`Valid formats: ${validFormats.join(', ')}`);
          process.exit(1);
        }
      }

      if (key === 'color') {
        const validColors = ['true', 'false', 'yes', 'no', '1', '0'];
        if (!validColors.includes(value.toLowerCase())) {
          console.error(`Invalid color value: ${value}`);
          console.error(`Valid values: true, false`);
          process.exit(1);
        }
      }

      // Convert value types
      let typedValue: string | boolean = value;
      if (key === 'color') {
        typedValue = ['true', 'yes', '1'].includes(value.toLowerCase());
      }

      saveConfig({ [key]: typedValue });
      printSuccess(`Set ${key} = ${typedValue}`);
    });

  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const config = getConfig();
      const value = config[key as keyof typeof config];

      if (value === undefined) {
        console.error(`Unknown key: ${key}`);
        process.exit(1);
      }

      console.log(value);
    });

  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      saveConfig({
        apiUrl: 'https://api.usetransactional.com',
        webUrl: 'https://usetransactional.com',
        outputFormat: 'table',
        color: true,
      });
      printSuccess('Configuration reset to defaults');
    });

  configCmd
    .command('path')
    .description('Show configuration file paths')
    .action(() => {
      console.log('Config Directory:', getConfigDir());
      console.log('Credentials File:', getCredentialsFile());
    });

  return configCmd;
}

// Helper function
function printHeading(title: string): void {
  if (isColorEnabled()) {
    console.log(chalk.bold.underline(title));
  } else {
    console.log(`=== ${title} ===`);
  }
}
