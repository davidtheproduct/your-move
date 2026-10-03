import type { Register } from 'claude-code'

import { split } from './actions'

const DEFAULTS = { yourMessage: '#5b0a91', yourMove: '#ff2020' }

// A colour the person set, if it is a hex colour; otherwise the default.
const colour = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback

// Rows that are the person typing (here, from the phone bridge, or an older
// stored prompt with no origin stamp). Task notifications and other agents'
// messages keep the normal look, so the border only ever means "I said this".
const MINE = new Set(['composer', 'bridge', 'unclassified'])

// Without this, Claude has no reason to write the marker the outline keys on.
const MARKER = {
  id: 'your-move:marker',
  scope: 'session',
  text: [
    '# Flagging what needs the user',
    'When part of a reply needs the user to act, decide, or answer something you are waiting on,',
    'put it in its own quote block whose first line starts with `> **Your move:**`, with any options',
    'as a list inside the same quote (every line prefixed with `>`). The user\'s interface outlines',
    'that block so it cannot be missed.',
    'Use at most one such section per reply, near the end, and only when something truly needs',
    'the user. Keep findings, reasoning and narration outside it.',
  ].join('\n'),
} as const

export const register: Register = (on, options) => {
  const yourMessage = colour(options.your_message_color, DEFAULTS.yourMessage)
  const yourMove = colour(options.your_move_color, DEFAULTS.yourMove)

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)

    // Headless runs draw no transcript, so the instruction would be wasted.
    if (e.surfaces.length === 0) {
      return result
    }

    return { ...result, sections: [...result.sections, MARKER] }
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    const isMine = MINE.has(e.props.origin.kind) && !e.props.task && !e.props.from

    if (!isMine) {
      return drawn
    }

    const { Box } = $.ui.resolve(e)

    return (
      <Box borderStyle="bold" borderColor={yourMessage} paddingX={1} marginTop={1} flexDirection="column">
        {drawn}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const parts = split(e.props.text)

    if (!parts.some(p => p.isAction)) {
      return next(e)
    }

    const { Box, Markdown } = $.ui.resolve(e)
    const drawn = await Promise.all(
      parts.map((p, i) =>
        p.isAction
          ? (
              <Box borderStyle="bold" borderColor={yourMove} paddingX={1} marginY={1} flexDirection="column">
                <Markdown text={p.text} />
              </Box>
            )
          : next({ ...e, props: { ...e.props, text: p.text, isFirstOfReply: e.props.isFirstOfReply && i === 0 } }),
      ),
    )

    return <Box flexDirection="column">{drawn}</Box>
  })
}
