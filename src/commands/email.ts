/**
 * Email Commands
 *
 * Commands for email operations: send, batch, templates, domains, senders, suppressions, stats.
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import ora from 'ora';
import { getApiClient, isLoggedIn } from '../lib';
import { printSuccess, printError, print, printKeyValue } from '../output';
import { confirm } from '../prompts';
import type {
  EmailSendOptions,
  EmailSendResult,
  EmailTemplate,
  EmailDomain,
  EmailSender,
  EmailSuppression,
  EmailStats,
} from '../lib/types';

/**
 * Create the email command
 */
export function createEmailCommand(): Command {
  const emailCmd = new Command('email').description('Email management commands');

  // Send command
  emailCmd
    .command('send')
    .description('Send a single email')
    .requiredOption('-f, --from <email>', 'Sender email address')
    .requiredOption('-t, --to <email>', 'Recipient email address')
    .option('-s, --subject <text>', 'Email subject')
    .option('--html <content>', 'HTML body')
    .option('--text <content>', 'Plain text body')
    .option('--template <id>', 'Template ID')
    .option('--template-alias <alias>', 'Template alias')
    .option('--model <json>', 'Template model (JSON)')
    .option('--cc <emails>', 'CC recipients (comma-separated)')
    .option('--bcc <emails>', 'BCC recipients (comma-separated)')
    .option('--reply-to <email>', 'Reply-to address')
    .option('--tag <tag>', 'Message tag')
    .option('--stream <id>', 'Stream ID')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const spinner = ora('Sending email...').start();

      try {
        const sendOptions: EmailSendOptions = {
          from: options.from,
          to: options.to,
          subject: options.subject,
          htmlBody: options.html,
          textBody: options.text,
          templateId: options.template ? parseInt(options.template, 10) : undefined,
          templateAlias: options.templateAlias,
          templateModel: options.model ? JSON.parse(options.model) : undefined,
          cc: options.cc ? options.cc.split(',').map((e: string) => e.trim()) : undefined,
          bcc: options.bcc ? options.bcc.split(',').map((e: string) => e.trim()) : undefined,
          replyTo: options.replyTo,
          tag: options.tag,
          streamId: options.stream ? parseInt(options.stream, 10) : undefined,
        };

        const client = getApiClient(options.org);
        const result = await client.post<EmailSendResult>('/email', sendOptions);

        if (!result.success || !result.data) {
          spinner.fail('Failed to send email');
          printError(result.error?.message || 'Unknown error');
          process.exit(1);
        }

        spinner.succeed('Email sent successfully!');

        if (options.json) {
          print(result.data, 'json');
        } else {
          printKeyValue('Message ID', result.data.messageId);
          printKeyValue('To', result.data.to);
          printKeyValue('Submitted At', result.data.submittedAt);
        }
      } catch (err) {
        spinner.fail('Failed to send email');
        printError(err instanceof Error ? err.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Batch command
  emailCmd
    .command('batch <file>')
    .description('Send batch emails from a JSON file')
    .option('--dry-run', 'Validate without sending')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (file: string, options) => {
      requireLogin();

      // Read file
      if (!fs.existsSync(file)) {
        printError(`File not found: ${file}`);
        process.exit(1);
      }

      let emails;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        emails = JSON.parse(content);
      } catch (err) {
        printError(`Failed to parse JSON file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        process.exit(1);
      }

      if (!Array.isArray(emails)) {
        printError('File must contain an array of email objects');
        process.exit(1);
      }

      if (options.dryRun) {
        printSuccess(`Validated ${emails.length} emails (dry run)`);
        return;
      }

      const spinner = ora(`Sending ${emails.length} emails...`).start();

      try {
        const client = getApiClient(options.org);
        const result = await client.post<EmailSendResult[]>('/email/batch', { messages: emails });

        if (!result.success || !result.data) {
          spinner.fail('Failed to send batch emails');
          printError(result.error?.message || 'Unknown error');
          process.exit(1);
        }

        spinner.succeed(`Sent ${result.data.length} emails successfully!`);

        if (options.json) {
          print(result.data, 'json');
        }
      } catch (err) {
        spinner.fail('Failed to send batch emails');
        printError(err instanceof Error ? err.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Templates subcommand
  const templates = emailCmd.command('templates').description('Manage email templates');

  templates
    .command('list')
    .description('List email templates')
    .option('--server <id>', 'Filter by server ID')
    .option('--status <status>', 'Filter by status (DRAFT, ACTIVE, ARCHIVED)')
    .option('--limit <n>', 'Max results', '50')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailTemplate[]>('/email/templates', {
        serverId: options.server ? parseInt(options.server, 10) : undefined,
        status: options.status,
        limit: parseInt(options.limit, 10),
      });

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to list templates');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const data = result.data.map((t) => ({
          id: t.id,
          name: t.name,
          alias: t.alias || '-',
          status: t.status,
          updated: t.updatedAt,
        }));
        print(data);
      }
    });

  templates
    .command('get <id>')
    .description('Get template details')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailTemplate>(`/email/templates/${id}`);

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to get template');
        process.exit(1);
      }

      print(result.data, options.json ? 'json' : undefined);
    });

  templates
    .command('create')
    .description('Create a new template')
    .requiredOption('--name <name>', 'Template name')
    .requiredOption('--subject <subject>', 'Email subject')
    .requiredOption('--server <id>', 'Server ID')
    .option('--alias <alias>', 'Template alias')
    .option('--html <content>', 'HTML body')
    .option('--text <content>', 'Plain text body')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const spinner = ora('Creating template...').start();

      const client = getApiClient(options.org);
      const result = await client.post<EmailTemplate>('/email/templates', {
        name: options.name,
        subject: options.subject,
        serverId: parseInt(options.server, 10),
        alias: options.alias,
        htmlBody: options.html,
        textBody: options.text,
      });

      if (!result.success || !result.data) {
        spinner.fail('Failed to create template');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Template created!');

      if (options.json) {
        print(result.data, 'json');
      } else {
        printKeyValue('ID', result.data.id);
        printKeyValue('Name', result.data.name);
      }
    });

  templates
    .command('update <id>')
    .description('Update a template')
    .option('--name <name>', 'Template name')
    .option('--subject <subject>', 'Email subject')
    .option('--alias <alias>', 'Template alias')
    .option('--html <content>', 'HTML body')
    .option('--text <content>', 'Plain text body')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      requireLogin();

      const spinner = ora('Updating template...').start();

      const client = getApiClient(options.org);
      const result = await client.patch<EmailTemplate>(`/email/templates/${id}`, {
        name: options.name,
        subject: options.subject,
        alias: options.alias,
        htmlBody: options.html,
        textBody: options.text,
      });

      if (!result.success || !result.data) {
        spinner.fail('Failed to update template');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Template updated!');

      if (options.json) {
        print(result.data, 'json');
      }
    });

  templates
    .command('delete <id>')
    .description('Delete a template')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (id: string, options) => {
      requireLogin();

      const shouldDelete = await confirm(`Are you sure you want to delete template ${id}?`, false);
      if (!shouldDelete) {
        return;
      }

      const spinner = ora('Deleting template...').start();

      const client = getApiClient(options.org);
      const result = await client.delete(`/email/templates/${id}`);

      if (!result.success) {
        spinner.fail('Failed to delete template');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Template deleted!');
    });

  // Domains subcommand
  const domains = emailCmd.command('domains').description('Manage email domains');

  domains
    .command('list')
    .description('List email domains')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailDomain[]>('/email/domains');

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to list domains');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const data = result.data.map((d) => ({
          id: d.id,
          domain: d.domain,
          status: d.status,
          verified: d.verifiedAt || '-',
        }));
        print(data);
      }
    });

  domains
    .command('add <domain>')
    .description('Add a domain')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (domain: string, options) => {
      requireLogin();

      const spinner = ora('Adding domain...').start();

      const client = getApiClient(options.org);
      const result = await client.post<EmailDomain>('/email/domains', { domain });

      if (!result.success || !result.data) {
        spinner.fail('Failed to add domain');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Domain added!');

      console.log('\nDNS Records to configure:');
      for (const record of result.data.dnsRecords) {
        console.log(`\n${record.type}:`);
        console.log(`  Name: ${record.name}`);
        console.log(`  Value: ${record.value}`);
      }

      if (options.json) {
        print(result.data, 'json');
      }
    });

  domains
    .command('verify <id>')
    .description('Verify a domain')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      requireLogin();

      const spinner = ora('Verifying domain...').start();

      const client = getApiClient(options.org);
      const result = await client.post<EmailDomain>(`/email/domains/${id}/verify`);

      if (!result.success || !result.data) {
        spinner.fail('Domain verification failed');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      if (result.data.status === 'VERIFIED') {
        spinner.succeed('Domain verified!');
      } else {
        spinner.info('Verification in progress');
        console.log('\nDNS Record Status:');
        for (const record of result.data.dnsRecords) {
          const status = record.verified ? '\u2713' : '\u2717';
          console.log(`  ${status} ${record.type}: ${record.name}`);
        }
      }

      if (options.json) {
        print(result.data, 'json');
      }
    });

  domains
    .command('delete <id>')
    .description('Delete a domain')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (id: string, options) => {
      requireLogin();

      const shouldDelete = await confirm(`Are you sure you want to delete domain ${id}?`, false);
      if (!shouldDelete) {
        return;
      }

      const spinner = ora('Deleting domain...').start();

      const client = getApiClient(options.org);
      const result = await client.delete(`/email/domains/${id}`);

      if (!result.success) {
        spinner.fail('Failed to delete domain');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Domain deleted!');
    });

  // Senders subcommand
  const senders = emailCmd.command('senders').description('Manage email senders');

  senders
    .command('list')
    .description('List email senders')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailSender[]>('/email/senders');

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to list senders');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const data = result.data.map((s) => ({
          id: s.id,
          email: s.email,
          name: s.name || '-',
          status: s.status,
          verified: s.verifiedAt || '-',
        }));
        print(data);
      }
    });

  senders
    .command('add <email>')
    .description('Add an email sender')
    .option('--name <name>', 'Sender name')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (emailAddr: string, options) => {
      requireLogin();

      const spinner = ora('Adding sender...').start();

      const client = getApiClient(options.org);
      const result = await client.post<EmailSender>('/email/senders', {
        email: emailAddr,
        name: options.name,
      });

      if (!result.success || !result.data) {
        spinner.fail('Failed to add sender');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Sender added! Check your email for verification link.');
    });

  senders
    .command('delete <id>')
    .description('Delete an email sender')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (id: string, options) => {
      requireLogin();

      const shouldDelete = await confirm(`Are you sure you want to delete sender ${id}?`, false);
      if (!shouldDelete) {
        return;
      }

      const spinner = ora('Deleting sender...').start();

      const client = getApiClient(options.org);
      const result = await client.delete(`/email/senders/${id}`);

      if (!result.success) {
        spinner.fail('Failed to delete sender');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Sender deleted!');
    });

  // Suppressions subcommand
  const suppressions = emailCmd.command('suppressions').description('Manage email suppressions');

  suppressions
    .command('list')
    .description('List email suppressions')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailSuppression[]>('/email/suppressions');

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to list suppressions');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const data = result.data.map((s) => ({
          email: s.email,
          reason: s.reason,
          created: s.createdAt,
        }));
        print(data);
      }
    });

  suppressions
    .command('add <email>')
    .description('Add email to suppression list')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (emailAddr: string, options) => {
      requireLogin();

      const spinner = ora('Adding to suppression list...').start();

      const client = getApiClient(options.org);
      const result = await client.post<EmailSuppression>('/email/suppressions', { email: emailAddr });

      if (!result.success) {
        spinner.fail('Failed to add suppression');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Email added to suppression list!');
    });

  suppressions
    .command('remove <email>')
    .description('Remove email from suppression list')
    .option('-o, --org <slug>', 'Organization slug')
    .action(async (emailAddr: string, options) => {
      requireLogin();

      const shouldRemove = await confirm(
        `Are you sure you want to remove ${emailAddr} from the suppression list?`,
        false
      );
      if (!shouldRemove) {
        return;
      }

      const spinner = ora('Removing from suppression list...').start();

      const client = getApiClient(options.org);
      const result = await client.delete(`/email/suppressions/${encodeURIComponent(emailAddr)}`);

      if (!result.success) {
        spinner.fail('Failed to remove suppression');
        printError(result.error?.message || 'Unknown error');
        process.exit(1);
      }

      spinner.succeed('Email removed from suppression list!');
    });

  // Stats command
  emailCmd
    .command('stats')
    .description('Get email statistics')
    .option('--period <period>', 'Period (day, week, month)', 'week')
    .option('--server <id>', 'Filter by server ID')
    .option('--stream <id>', 'Filter by stream ID')
    .option('-o, --org <slug>', 'Organization slug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      requireLogin();

      const client = getApiClient(options.org);
      const result = await client.get<EmailStats>('/email/stats', {
        period: options.period,
        serverId: options.server ? parseInt(options.server, 10) : undefined,
        streamId: options.stream ? parseInt(options.stream, 10) : undefined,
      });

      if (!result.success || !result.data) {
        printError(result.error?.message || 'Failed to get stats');
        process.exit(1);
      }

      if (options.json) {
        print(result.data, 'json');
      } else {
        const data = result.data;
        console.log(`\nEmail Statistics (${data.period})\n`);
        printKeyValue('Sent', data.sent);
        printKeyValue('Delivered', data.delivered);
        printKeyValue('Bounced', data.bounced);
        printKeyValue('Complaints', data.complained);
        printKeyValue('Opened', data.opened);
        printKeyValue('Clicked', data.clicked);
        console.log('\nRates:');
        printKeyValue('Delivery Rate', `${(data.deliveryRate * 100).toFixed(2)}%`);
        printKeyValue('Open Rate', `${(data.openRate * 100).toFixed(2)}%`);
        printKeyValue('Click Rate', `${(data.clickRate * 100).toFixed(2)}%`);
        printKeyValue('Bounce Rate', `${(data.bounceRate * 100).toFixed(2)}%`);
        printKeyValue('Complaint Rate', `${(data.complaintRate * 100).toFixed(4)}%`);
      }
    });

  return emailCmd;
}

/**
 * Require user to be logged in
 */
function requireLogin(): void {
  if (!isLoggedIn()) {
    printError('Not logged in. Use "transactional login" to authenticate.');
    process.exit(1);
  }
}
