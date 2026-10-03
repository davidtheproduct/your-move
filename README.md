# Your Move

**Find your messages. Never miss what Claude is waiting on you for.**

A Claude Code plugin for long sessions. When you scroll back, everything Claude says looks the same, and the one line where it asked you to decide something is easy to miss. Your Move fixes two things:

- **Your messages get a border**, so you can find what you said at a glance.
- **Anything Claude needs from you gets an outline.** The plugin asks Claude to open any decision, question or action for you with a **Your move:** line, and draws an outline around that section so it stands out from the reasoning around it.

Nothing else in the transcript changes. Background-task notices and messages from other agents keep their normal look, so the border only ever means "you said this", and the outline only ever means "this is on you".

## Install

From your shell:

```bash
claude plugin marketplace add davidtheproduct/your-move
claude plugin install your-move@davidtheproduct
```

Or from inside a Claude Code session:

```
/plugin install your-move --marketplace davidtheproduct/your-move
```

New sessions pick it up. It needs a recent Claude Code, since it is built with Claude Code's mods API (function hooks), which is in early access.

## Choose your colours

Open `/config` and look for the two Your Move rows:

| Setting | What it colours | Default |
| --- | --- | --- |
| Your messages: border colour | The border around messages you type | `#5b0a91` (deep violet) |
| Your move: outline colour | The outline around what needs you | `#ff2020` (red) |

Use a hex colour such as `#00aa88`. Anything else falls back to the default.

## How it works

- **The border** wraps the transcript row Claude Code draws for each message you send, from the terminal or the Remote Control bridge.
- **The outline** starts at a line beginning `Your move` (bold or not) and covers that paragraph plus any list directly under it. A blank line followed by ordinary text ends it. The lead is always drawn in bold.
- **The instruction**: the plugin adds a short paragraph to Claude's system prompt asking it to use the **Your move:** marker, at most once per reply and only when something really needs you. It isn't added in headless runs (`claude -p`), which draw no transcript.

Only the drawing changes. Your stored conversation, and what Claude reads back from it, are untouched.

## Develop

```bash
claude --plugin-dir .          # run Claude Code with your working copy
claude plugin test .           # run the tests
claude plugin validate --strict .claude-plugin/plugin.json
```

## Licence

MIT, by [davidtheproduct](https://github.com/davidtheproduct).
