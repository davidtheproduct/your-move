---
name: your-move
description: Use in any reply that asks the user to decide, choose, approve, confirm, provide something, or take an action, or that leaves you waiting on the user. Formats that part as a "Your move" quote block so the user can't miss it when scrolling back.
---

# Your move

When part of a reply needs the user to act, decide, or answer something you are waiting on, put it in its own quote block whose first line starts with `**Your move:**`, with any options as a list inside the same quote:

```markdown
> **Your move:** pick one of these names, or tell me which direction to push.
> - **Tally:** plain and familiar.
> - **Keepup:** built around momentum.
```

Rules:

- One such block per reply, near the end, and only when something truly needs the user. If nothing does, write none, so the block always means "this is on you".
- Keep findings, reasoning and narration outside it. The block holds the ask and its options, nothing else.
- Keep every line of the block prefixed with `>`, so it stays one block.

In claude.ai the quote block draws with a bar down its left edge. In Claude Code with the Your Move plugin, it draws inside a coloured outline instead.
