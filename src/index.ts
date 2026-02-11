import { App } from '@slack/bolt'
import { spawn, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const execAsync = promisify(exec)

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
})

app.event('app_mention', async ({ event, say }) => {
  const user = event.user!
  // Remove the mention part (e.g. "<@U12345>") to get the actual message
  const text = event.text.replace(/<@[^>]+>/g, '').trim()
  const [command, ...rest] = text.split(/\s+/)
  const body = rest.join(' ')

  switch (command?.toLowerCase()) {
    case 'issue': {
      const request = body.trim()
      if (!request) {
        await say(`<@${user}> request body is required`)
        break
      }
      await say(`<@${user}> investigating: ${request}`)
      handleIssue(request, user, say as (text: string) => Promise<unknown>)
      break
    }
    case 'comment': {
      const workId = body.trim()
      if (!workId) {
        await say(`<@${user}> work directory ID is required`)
        break
      }
      await say(`<@${user}> resuming: ${workId}`)
      handleComment(workId, user, say as (text: string) => Promise<unknown>)
      break
    }
    case 'pr_comment': {
      const workId = body.trim()
      if (!workId) {
        await say(`<@${user}> work directory ID is required`)
        break
      }
      await say(`<@${user}> reviewing PR feedback: ${workId}`)
      handlePrComment(workId, user, say as (text: string) => Promise<unknown>)
      break
    }
    case 'pr': {
      const workId = body.trim()
      if (!workId) {
        await say(`<@${user}> work directory ID is required`)
        break
      }
      await say(`<@${user}> starting implementation: ${workId}`)
      handlePr(workId, user, say as (text: string) => Promise<unknown>)
      break
    }
    default:
      await say(`<@${user}> unknown command: ${command}`)
      break
  }
})

async function handleIssue(
  request: string,
  user: string,
  say: (text: string) => Promise<unknown>,
) {
  const repo = process.env.GITHUB_REPO!
  const baseDir = process.env.WORK_DIR!
  const workId = `work-${Date.now()}`
  const workDir = path.join(baseDir, workId)

  try {
    await mkdir(baseDir, { recursive: true })

    await execAsync(
      `git clone --depth 1 https://github.com/${repo}.git ${workDir}`,
    )

    const prompt = [
      `以下の要求についてコードベースを調査し、`,
      `実装プランをGitHub issueとして ${repo} リポジトリに作成してください。\n\n`,
      `【重要】issueを作成した後、設計や実装方針について少しでも疑問点・確認事項・曖昧な点がある場合は、`,
      `必ずそのissueにコメントとしてユーザーへの質問を投稿してください。`,
      `疑問点を残さず全て質問することを最優先としてください。\n\n`,
      `issueを作成したら、そのissue番号だけを ${path.join(workDir, '.issue-number')} にファイルとして書き出してください（番号のみ、例: 42）。\n\n`,
      `要求: ${request}`,
    ].join('')

    const child = spawn(
      process.env.CLAUDE_PATH!,
      ['-p', prompt, '--allowedTools', 'Bash(gh:*)', 'Read', 'Write', 'Glob', 'Grep'],
      {
        cwd: workDir,
        stdio: 'ignore',
      },
    )

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          const issueNumber = (
            await readFile(path.join(workDir, '.issue-number'), 'utf-8')
          ).trim()
          await say(
            `<@${user}> issue #${issueNumber} を作成しました (${workId})`,
          )
        } catch {
          await say(`<@${user}> 調査が完了しました (${workId})`)
        }
      } else {
        await say(
          `<@${user}> 処理中にエラーが発生しました (exit code: ${code})`,
        )
      }
    })

    child.on('error', async (error) => {
      await say(`<@${user}> 処理中にエラーが発生しました: ${error.message}`)
    })
  } catch (error) {
    await say(`<@${user}> 処理中にエラーが発生しました: ${error}`)
  }
}

async function handleComment(
  workId: string,
  user: string,
  say: (text: string) => Promise<unknown>,
) {
  const repo = process.env.GITHUB_REPO!
  const baseDir = process.env.WORK_DIR!
  const workDir = path.join(baseDir, workId)

  try {
    const issueNumber = (
      await readFile(path.join(workDir, '.issue-number'), 'utf-8')
    ).trim()

    const prompt = [
      `issue #${issueNumber} のコメントを gh issue view ${issueNumber} --repo ${repo} --comments で確認してください。`,
      `ユーザーが質問に対して回答しています。\n\n`,
      `回答内容を踏まえて実装プランを再検討し、issueのDescriptionを更新してください（上書きして構いません）。`,
      `まだ疑問点や確認事項があれば、issueにコメントとして質問を投稿してください。`,
    ].join('')

    const child = spawn(
      process.env.CLAUDE_PATH!,
      [
        '-p',
        prompt,
        '--continue',
        '--allowedTools',
        'Bash(gh:*)',
        'Read',
        'Write',
        'Glob',
        'Grep',
      ],
      {
        cwd: workDir,
        stdio: 'ignore',
      },
    )

    child.on('close', async (code) => {
      if (code === 0) {
        await say(
          `<@${user}> issue #${issueNumber} のプランを更新しました (${workId})`,
        )
      } else {
        await say(
          `<@${user}> 処理中にエラーが発生しました (exit code: ${code})`,
        )
      }
    })

    child.on('error', async (error) => {
      await say(`<@${user}> 処理中にエラーが発生しました: ${error.message}`)
    })
  } catch (error) {
    await say(`<@${user}> 処理中にエラーが発生しました: ${error}`)
  }
}

async function handlePr(
  workId: string,
  user: string,
  say: (text: string) => Promise<unknown>,
) {
  const repo = process.env.GITHUB_REPO!
  const baseDir = process.env.WORK_DIR!
  const workDir = path.join(baseDir, workId)

  try {
    const issueNumber = (
      await readFile(path.join(workDir, '.issue-number'), 'utf-8')
    ).trim()

    const setupCommand = process.env.SETUP_COMMAND
    if (setupCommand) {
      await execAsync(setupCommand, { cwd: workDir })
    }

    const promptParts = [
      `gh issue view ${issueNumber} --repo ${repo} の内容を確認してください。\n\n`,
      `issueの実装プランに従って実装を進めてください。\n`,
      `まずブランチを作成してから作業を開始し、完了したらPRを作成してください。\n`,
      `PRのbodyにはissueへの参照（closes #${issueNumber}）を含めてください。\n\n`,
      `PRを作成したら、そのPR番号だけを ${path.join(workDir, '.pr-number')} にファイルとして書き出してください（番号のみ、例: 123）。`,
    ]

    if (setupCommand) {
      promptParts.unshift(
        `セットアップコマンド "${setupCommand}" は実行済みです。\n\n`,
      )
    }

    const allowedTools = [
      'Bash(git:*)',
      'Bash(gh:*)',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
    ]

    const extraTools = process.env.CLAUDE_EXTRA_TOOLS
    if (extraTools) {
      allowedTools.push(...extraTools.split(',').map((t) => t.trim()))
    }

    const child = spawn(
      process.env.CLAUDE_PATH!,
      ['-p', promptParts.join(''), '--allowedTools', ...allowedTools],
      {
        cwd: workDir,
        stdio: 'ignore',
      },
    )

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          const prNumber = (
            await readFile(path.join(workDir, '.pr-number'), 'utf-8')
          ).trim()
          await say(
            `<@${user}> PR #${prNumber} を作成しました (${workId})`,
          )
        } catch {
          await say(`<@${user}> 実装が完了しました (${workId})`)
        }
      } else {
        await say(
          `<@${user}> 処理中にエラーが発生しました (exit code: ${code})`,
        )
      }
    })

    child.on('error', async (error) => {
      await say(`<@${user}> 処理中にエラーが発生しました: ${error.message}`)
    })
  } catch (error) {
    await say(`<@${user}> 処理中にエラーが発生しました: ${error}`)
  }
}

async function handlePrComment(
  workId: string,
  user: string,
  say: (text: string) => Promise<unknown>,
) {
  const repo = process.env.GITHUB_REPO!
  const baseDir = process.env.WORK_DIR!
  const workDir = path.join(baseDir, workId)

  try {
    const prNumber = (
      await readFile(path.join(workDir, '.pr-number'), 'utf-8')
    ).trim()

    const prompt = [
      `PR #${prNumber} のレビューコメントを確認してください。\n`,
      `gh pr view ${prNumber} --repo ${repo} --comments でコメントを、`,
      `gh api repos/${repo}/pulls/${prNumber}/reviews でレビューを確認できます。\n\n`,
      `フィードバックの内容に従ってコードを修正し、コミット・プッシュしてください。`,
    ].join('')

    const allowedTools = [
      'Bash(git:*)',
      'Bash(gh:*)',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
    ]

    const extraTools = process.env.CLAUDE_EXTRA_TOOLS
    if (extraTools) {
      allowedTools.push(...extraTools.split(',').map((t) => t.trim()))
    }

    const child = spawn(
      process.env.CLAUDE_PATH!,
      [
        '-p',
        prompt,
        '--continue',
        '--allowedTools',
        ...allowedTools,
      ],
      {
        cwd: workDir,
        stdio: 'ignore',
      },
    )

    child.on('close', async (code) => {
      if (code === 0) {
        await say(
          `<@${user}> PR #${prNumber} の修正が完了しました (${workId})`,
        )
      } else {
        await say(
          `<@${user}> 処理中にエラーが発生しました (exit code: ${code})`,
        )
      }
    })

    child.on('error', async (error) => {
      await say(`<@${user}> 処理中にエラーが発生しました: ${error.message}`)
    })
  } catch (error) {
    await say(`<@${user}> 処理中にエラーが発生しました: ${error}`)
  }
}

await app.start()
console.log('lazyai is running')
