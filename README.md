# transactional-cli

Official command-line interface for [Transactional](https://usetransactional.com) - manage email, SMS, forms, and more from your terminal.

[![npm version](https://badge.fury.io/js/transactional-cli.svg)](https://www.npmjs.com/package/transactional-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install -g transactional-cli
```

Or using npx without installation:

```bash
npx transactional-cli login
```

## Quick Start

1. **Authenticate**
   ```bash
   transactional login
   ```
   This opens your browser to authenticate and link the CLI to your Transactional organization.

2. **Send an email**
   ```bash
   transactional email send \
     --from "sender@example.com" \
     --to "recipient@example.com" \
     --subject "Hello from CLI" \
     --text "This is a test email"
   ```

3. **Check your user info**
   ```bash
   transactional whoami
   ```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `transactional login` | Authenticate with Transactional |
| `transactional logout` | Log out from all organizations |
| `transactional whoami` | Show current user and organization |
| `transactional switch [org]` | Switch to a different organization |
| `transactional orgs list` | List all authenticated organizations |

### Email

| Command | Description |
|---------|-------------|
| `transactional email send` | Send a single email |
| `transactional email batch <file>` | Send batch emails from JSON file |
| `transactional email stats` | Get email statistics |
| `transactional email templates list` | List email templates |
| `transactional email templates get <id>` | Get template details |
| `transactional email templates create` | Create a new template |
| `transactional email domains list` | List email domains |
| `transactional email domains add <domain>` | Add a domain |
| `transactional email senders list` | List email senders |
| `transactional email suppressions list` | List suppressions |

### Configuration

| Command | Description |
|---------|-------------|
| `transactional config show` | Show current configuration |
| `transactional config set <key> <value>` | Set a configuration value |
| `transactional config get <key>` | Get a configuration value |
| `transactional config reset` | Reset to default configuration |
| `transactional config path` | Show configuration file paths |

## Global Options

| Option | Description |
|--------|-------------|
| `-o, --org <slug>` | Override the current organization |
| `--json` | Output results as JSON |
| `--help` | Show help for a command |
| `--version` | Show CLI version |

## Configuration

Configuration is stored in `~/.transactional/config.json`:

| Key | Description | Default |
|-----|-------------|---------|
| `apiUrl` | API base URL | `https://api.usetransactional.com` |
| `webUrl` | Web app URL | `https://app.usetransactional.com` |
| `outputFormat` | Output format (table, json, yaml) | `table` |
| `color` | Enable color output | `true` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TRANSACTIONAL_API_URL` | Override API URL |
| `TRANSACTIONAL_WEB_URL` | Override web URL |
| `NO_COLOR` | Disable color output |
| `TRANSACTIONAL_NO_COLOR` | Disable color output |

## Credentials

Credentials are stored securely in `~/.transactional/credentials.json` with file permissions set to `0600` (read/write for owner only).

## Examples

### Send email with template

```bash
transactional email send \
  --from "noreply@example.com" \
  --to "user@example.com" \
  --template-alias "welcome" \
  --model '{"name": "John", "company": "Acme"}'
```

### Send batch emails

Create a file `emails.json`:
```json
[
  {
    "from": "noreply@example.com",
    "to": "user1@example.com",
    "subject": "Hello User 1",
    "text": "Hello from batch!"
  },
  {
    "from": "noreply@example.com",
    "to": "user2@example.com",
    "subject": "Hello User 2",
    "text": "Hello from batch!"
  }
]
```

Then send:
```bash
transactional email batch emails.json
```

### Get stats as JSON

```bash
transactional email stats --period month --json
```

## Documentation

Full documentation is available at [usetransactional.com/docs/cli](https://usetransactional.com/docs/cli)

## License

MIT - see [LICENSE](LICENSE) for details.
