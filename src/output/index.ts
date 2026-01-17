/**
 * CLI Output Formatting
 *
 * Functions for formatting and displaying CLI output.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import yaml from 'yaml';
import { getOutputFormat, isColorEnabled } from '../lib/config';
import type { OutputFormat } from '../lib/types';

/**
 * Format data based on the output format setting
 */
export function formatOutput(data: unknown, format?: OutputFormat): string {
  const outputFormat = format || getOutputFormat();

  switch (outputFormat) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.stringify(data);
    case 'table':
    default:
      return formatAsTable(data);
  }
}

/**
 * Format data as a table
 */
function formatAsTable(data: unknown): string {
  if (!data) {
    return 'No data';
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return 'No results';
    }

    // Get columns from first item
    const columns = Object.keys(data[0]);
    const table = new Table({
      head: columns.map((c) => (isColorEnabled() ? chalk.bold(c) : c)),
      style: {
        head: isColorEnabled() ? ['cyan'] : [],
        border: isColorEnabled() ? ['gray'] : [],
      },
    });

    for (const row of data) {
      table.push(columns.map((col) => formatValue((row as Record<string, unknown>)[col])));
    }

    return table.toString();
  }

  if (typeof data === 'object') {
    const table = new Table({
      style: {
        border: isColorEnabled() ? ['gray'] : [],
      },
    });

    for (const [key, value] of Object.entries(data)) {
      const formattedKey = isColorEnabled() ? chalk.bold(key) : key;
      table.push({ [formattedKey]: formatValue(value) });
    }

    return table.toString();
  }

  return String(data);
}

/**
 * Format a single value for table display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return isColorEnabled() ? chalk.gray('-') : '-';
  }

  if (typeof value === 'boolean') {
    if (isColorEnabled()) {
      return value ? chalk.green('Yes') : chalk.red('No');
    }
    return value ? 'Yes' : 'No';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  if (isColorEnabled()) {
    console.log(chalk.green('✓'), message);
  } else {
    console.log('[OK]', message);
  }
}

/**
 * Print error message
 */
export function printError(message: string, details?: string): void {
  if (isColorEnabled()) {
    console.error(chalk.red('✗'), message);
    if (details) {
      console.error(chalk.gray(details));
    }
  } else {
    console.error('[ERROR]', message);
    if (details) {
      console.error(details);
    }
  }
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  if (isColorEnabled()) {
    console.warn(chalk.yellow('⚠'), message);
  } else {
    console.warn('[WARN]', message);
  }
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  if (isColorEnabled()) {
    console.log(chalk.blue('ℹ'), message);
  } else {
    console.log('[INFO]', message);
  }
}

/**
 * Print a heading
 */
export function printHeading(title: string): void {
  if (isColorEnabled()) {
    console.log();
    console.log(chalk.bold.underline(title));
    console.log();
  } else {
    console.log();
    console.log(`=== ${title} ===`);
    console.log();
  }
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: unknown): void {
  const formattedValue = formatValue(value);
  if (isColorEnabled()) {
    console.log(`${chalk.gray(key + ':')} ${formattedValue}`);
  } else {
    console.log(`${key}: ${formattedValue}`);
  }
}

/**
 * Print data with automatic format detection
 */
export function print(data: unknown, format?: OutputFormat): void {
  console.log(formatOutput(data, format));
}
