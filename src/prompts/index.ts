/**
 * CLI Prompts
 *
 * Interactive prompts for CLI user input.
 */

import inquirer from 'inquirer';
import type { OrganizationInfo } from '../lib/types';

/**
 * Prompt user to select an organization
 */
export async function selectOrganization(organizations: OrganizationInfo[]): Promise<string> {
  const { orgSlug } = await inquirer.prompt<{ orgSlug: string }>([
    {
      type: 'list',
      name: 'orgSlug',
      message: 'Select an organization:',
      choices: organizations.map((org) => ({
        name: `${org.name} (${org.slug}) - ${org.role}`,
        value: org.slug,
      })),
    },
  ]);

  return orgSlug;
}

/**
 * Prompt for confirmation
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);

  return confirmed;
}

/**
 * Prompt for text input
 */
export async function input(
  message: string,
  options?: {
    default?: string;
    required?: boolean;
    validate?: (value: string) => boolean | string;
  }
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      default: options?.default,
      validate: (inp: string) => {
        if (options?.required && !inp.trim()) {
          return 'This field is required';
        }
        if (options?.validate) {
          return options.validate(inp);
        }
        return true;
      },
    },
  ]);

  return value;
}

/**
 * Prompt for password/secret input
 */
export async function password(
  message: string,
  options?: {
    required?: boolean;
    validate?: (value: string) => boolean | string;
  }
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'password',
      name: 'value',
      message,
      mask: '*',
      validate: (inp: string) => {
        if (options?.required && !inp.trim()) {
          return 'This field is required';
        }
        if (options?.validate) {
          return options.validate(inp);
        }
        return true;
      },
    },
  ]);

  return value;
}

/**
 * Prompt for selection from a list
 */
export async function select<T extends string>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const { value } = await inquirer.prompt<{ value: T }>([
    {
      type: 'list',
      name: 'value',
      message,
      choices,
    },
  ]);

  return value;
}

/**
 * Prompt for multiple selection from a list
 */
export async function multiSelect<T extends string>(
  message: string,
  choices: { name: string; value: T; checked?: boolean }[]
): Promise<T[]> {
  const { values } = await inquirer.prompt<{ values: T[] }>([
    {
      type: 'checkbox',
      name: 'values',
      message,
      choices,
    },
  ]);

  return values;
}

/**
 * Prompt for email input
 */
export async function emailInput(
  message: string,
  options?: { default?: string; required?: boolean }
): Promise<string> {
  return input(message, {
    ...options,
    validate: (value) => {
      if (!value && !options?.required) {
        return true;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
      return true;
    },
  });
}

/**
 * Prompt for editor input (opens editor for multiline content)
 */
export async function editor(
  message: string,
  options?: { default?: string }
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'editor',
      name: 'value',
      message,
      default: options?.default,
    },
  ]);

  return value;
}
