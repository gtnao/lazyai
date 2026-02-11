# lazyai

A Slack bot built with [Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/) using Socket Mode.

## Prerequisites

- Node.js >= 22
- pnpm

## Slack App Setup

### 1. Create a Slack App

1. Go to [Slack API: Your Apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Select **From scratch**
4. Enter your app name and select the workspace, then click **Create App**

### 2. Enable Socket Mode

1. In the left sidebar, go to **Socket Mode**
2. Toggle **Enable Socket Mode** to on
3. You will be prompted to generate an App-Level Token
   - Name it (e.g., `socket-token`)
   - Add the `connections:write` scope
   - Click **Generate**
4. Copy the generated token (starts with `xapp-`) — this is your `SLACK_APP_TOKEN`

### 3. Configure Bot Token Scopes

1. In the left sidebar, go to **OAuth & Permissions**
2. Scroll down to **Scopes** > **Bot Token Scopes**
3. Add the following scopes:
   - `app_mentions:read`
   - `chat:write`

### 4. Subscribe to Events

1. In the left sidebar, go to **Event Subscriptions**
2. Toggle **Enable Events** to on
3. Expand **Subscribe to bot events**
4. Click **Add Bot User Event** and add `app_mention`
5. Click **Save Changes**

### 5. Install App to Workspace

1. In the left sidebar, go to **Install App**
2. Click **Install to Workspace**
3. Review the permissions and click **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`) — this is your `SLACK_BOT_TOKEN`

## Project Setup

```sh
cp .env.template .env
```

Edit `.env` and fill in the tokens obtained from the steps above:

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token
```

Install dependencies and start the app:

```sh
pnpm install
pnpm dev
```

## Usage

Mention the bot in any channel it has been invited to:

```
@lazyai hello
```

The bot will reply with a greeting.
