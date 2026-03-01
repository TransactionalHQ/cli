/**
 * Transactional CLI
 *
 * Main CLI entry point with Commander.js setup.
 */

import { Command } from 'commander';
import { initConfig } from './lib';
import {
  createLoginCommand,
  createLogoutCommand,
  createWhoamiCommand,
  createSwitchCommand,
  createOrgsCommand,
  createEmailCommand,
  createConfigCommand,
  createMcpCommand,
} from './commands';

// Initialize configuration on import
initConfig();

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('transactional')
    .description('CLI for Transactional - manage email, SMS, forms, and more')
    .version('0.1.2');

  // Auth commands
  program.addCommand(createLoginCommand());
  program.addCommand(createLogoutCommand());
  program.addCommand(createWhoamiCommand());
  program.addCommand(createSwitchCommand());
  program.addCommand(createOrgsCommand());

  // Email commands
  program.addCommand(createEmailCommand());

  // Config commands
  program.addCommand(createConfigCommand());

  // MCP commands
  program.addCommand(createMcpCommand());

  return program;
}

// Export library functions for programmatic use
export * from './lib';
export * from './commands';
export * from './output';
export * from './prompts';
