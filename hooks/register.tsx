import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { quoteActions, split, summarize } from './actions'

const DEFAULTS = { yourMessage: '#5b0a91', yourMove: '#ff2020' }

// Claude's latest open ask, pinned above the prompt until the person replies.
const waiting = atom({ plugin: 'your-move', key: 'waiting' } as const, null)

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
  const isPinning = options.pin_waiting !== false

  // Added whether or not a surface draws here: a cloud session viewed from the
  // desktop app reports none, yet the person still reads the reply.
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    return { ...result, sections: [...result.sections, MARKER] }
  })

  // The main loop's answer decides what is pinned: its ask, or nothing.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (!e.agentId && !e.isAborted) {
      const ask = summarize(e.answer)
      await update($, waiting, () => ask)
    }

    return result
  })

  // The person answering clears the pin.
  on('prompt.submit', async ($, e, next) => {
    if (MINE.has(e.origin.kind)) {
      await update($, waiting, () => null)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const ask = isPinning && !e.props.hasSurvey ? await read($, waiting) : null

    if (!ask) {
      return below
    }

    const { Box, Text } = $.ui.resolve(e)
    const line = (
      <Box flexDirection="row">
        <Text color={yourMove} bold>
          {'● Waiting on you: '}
        </Text>
        <Text>{ask}</Text>
      </Box>
    )

    return below ? (
      <Box flexDirection="column">
        {line}
        {below}
      </Box>
    ) : (
      line
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isMine = MINE.has(e.props.origin.kind) && !e.props.task && !e.props.from

    if (!isMine) {
      return next(e)
    }

    // The desktop app draws message rows itself and keeps their text, not a
    // box around them, so off the terminal the mark goes into the text.
    if (e.surface !== 'terminal') {
      return next({ ...e, props: { ...e.props, text: `🟣 ${e.props.text}` } })
    }

    const drawn = await next(e)
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

    if (e.surface !== 'terminal') {
      return next({ ...e, props: { ...e.props, text: quoteActions(e.props.text) } })
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
