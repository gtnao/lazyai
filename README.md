# lazyai

A Slack bot that automates the development workflow — from issue planning to PR creation — by orchestrating [Claude Code](https://docs.anthropic.com/en/docs/claude-code) via Slack commands.

Built with [Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/) using Socket Mode.

## Workflow

```mermaid
sequenceDiagram
    actor User
    participant Slack
    participant lazyai
    participant FS as Work Directory
    participant Claude as Claude Code
    participant GitHub

    Note over User,GitHub: Phase 1: Issue Planning

    User->>Slack: @lazyai issue <request>
    Slack->>lazyai: app_mention event
    lazyai->>FS: Create work-{timestamp}
    lazyai->>FS: git clone --depth 1
    lazyai->>Claude: spawn (new session)<br/>allowedTools: Bash(gh:*), Read, Write, Glob, Grep
    Claude->>GitHub: Create issue with plan
    Claude->>GitHub: Comment questions (if any)
    Claude->>FS: Write .issue-number
    lazyai->>FS: Read .issue-number
    lazyai->>Slack: issue #N created (work-xxx)

    Note over User,GitHub: Phase 2: Plan Refinement (repeat as needed)

    loop Until plan is finalized
        User->>GitHub: Answer questions on issue
        User->>Slack: @lazyai comment <work-id>
        Slack->>lazyai: app_mention event
        lazyai->>Claude: spawn (--continue, same session)<br/>allowedTools: Bash(gh:*), Read, Write, Glob, Grep
        Claude->>GitHub: Update issue description
        Claude->>GitHub: Comment follow-up questions (if any)
        lazyai->>Slack: issue #N updated (work-xxx)
    end

    Note over User,GitHub: Phase 3: Implementation

    User->>Slack: @lazyai pr <work-id>
    Slack->>lazyai: app_mention event
    lazyai->>FS: Run SETUP_COMMAND in work dir
    lazyai->>Claude: spawn (new session)<br/>allowedTools: Bash(git:*,gh:*), Read, Write, Edit, Glob, Grep<br/>+ CLAUDE_EXTRA_TOOLS (e.g. Bash(pnpm:*))
    Claude->>GitHub: Create branch, implement, push & open PR
    Claude->>FS: Write .pr-number
    lazyai->>FS: Read .pr-number
    lazyai->>Slack: PR #N created (work-xxx)

    Note over User,GitHub: Phase 4: Review & Fix (repeat as needed)

    loop Until PR is approved
        User->>GitHub: Review PR & leave comments
        User->>Slack: @lazyai pr_comment <work-id>
        Slack->>lazyai: app_mention event
        lazyai->>Claude: spawn (--continue, same session)<br/>allowedTools: Bash(git:*,gh:*), Read, Write, Edit, Glob, Grep<br/>+ CLAUDE_EXTRA_TOOLS
        Claude->>GitHub: Fix code, commit & push
        lazyai->>Slack: PR #N updated (work-xxx)
    end
```

## Commands

| Command | Body | Description |
|---------|------|-------------|
| `issue` | Request text | Clone repo, investigate codebase, create a GitHub issue with implementation plan |
| `comment` | Work ID | Read issue comments (user answers), update the plan. Uses `--continue` |
| `pr` | Work ID | Implement the plan, create a branch and open a PR |
| `pr_comment` | Work ID | Read PR review comments, fix code and push. Uses `--continue` |

## Prerequisites

- Node.js >= 22
- pnpm
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub CLI](https://cli.github.com/) (`gh`)

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

Edit `.env` and fill in your configuration:

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token
GITHUB_REPO=owner/repo
WORK_DIR=/tmp/lazyai
CLAUDE_PATH=/usr/local/bin/claude
CLAUDE_EXTRA_TOOLS=
SETUP_COMMAND=
```

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-`) |
| `SLACK_APP_TOKEN` | App-Level Token (`xapp-`) |
| `GITHUB_REPO` | Target repository (`owner/repo`) |
| `WORK_DIR` | Base directory for cloned workspaces |
| `CLAUDE_PATH` | Absolute path to the `claude` binary |
| `CLAUDE_EXTRA_TOOLS` | Comma-separated additional `--allowedTools` for Claude (e.g., `Bash(pnpm:*)`) |
| `SETUP_COMMAND` | Command to run before implementation (e.g., `pnpm install && docker compose up -d`). Leave empty to skip |

Install dependencies and start the app:

```sh
pnpm install
pnpm dev
```

## Usage

Invite the bot to a channel, then mention it with a command:

```
@lazyai issue Add user authentication with OAuth
```
