import { expect, test } from 'claude-code/testing'

const userProps = (kind: string, extra: object = {}) => ({ text: 'hello', origin: { kind }, isExpanded: true, ...extra })

const REPLY = 'Here is what I found.\n\n**Your move:** pick one\n- option A\n- option B\n\nBack to the analysis.'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } }

// Stand-ins for the engine's own drawing and answers.
const engine = (on: any) => {
  on('ui.render', { component: 'UserMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{'> ' + e.props.text}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
}

const finishTurn = ($: any, answer: string, extra: object = {}) =>
  $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...extra })

test('terminal: your own messages get the bordered box; notifications do not', async ($, on) => {
  engine(on)
  const mine = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('composer') } as never)
  const box = await mine.find({ type: 'Box' })
  expect(box?.props.borderColor).toBe('#5b0a91')
  expect(box?.text).toContain('hello')

  const note = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('task-notification', { task: { id: 't1', status: 'completed' } }) } as never)
  expect(await note.find({ type: 'Box' })).toBeUndefined()
})

test('terminal: only the Your move section is outlined', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never)
  const outlined = (await ui.findAll({ type: 'Box' })).find(b => b.props.borderColor === '#ff2020')
  expect(outlined?.text).toContain('option B')
  expect(outlined?.text).not.toContain('Back to the analysis')

  const plain = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: 'Nothing for you here.', isFirstOfReply: true } } as never)
  expect((await plain.findAll({ type: 'Box' })).some(b => b.props.borderColor)).toBe(false)
})

test('terminal: plain and quoted leads both draw bold, quote markers dropped', async ($, on) => {
  engine(on)
  const plain = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: 'Done.\n\nYour move: approve the merge', isFirstOfReply: true } } as never)
  expect((await plain.find({ type: 'Markdown' }))?.text).toBe('**Your move:** approve the merge')

  const quoted = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: 'Found it.\n\n> **Your move:** pick one\n> - option A\nBack to work.', isFirstOfReply: true } } as never)
  expect((await quoted.find({ type: 'Markdown' }))?.text).toBe('**Your move:** pick one\n- option A')
  expect(await quoted.find({ type: 'Text', text: /Back to work/ })).toBeDefined()
})

test('desktop: marks go into the text, not a box', async ($, on) => {
  engine(on)
  for (const surface of ['desktop', 'vscode'] as const) {
    const mine = await $.ui.mount({ plugin: 'your-move', surface, component: 'UserMessage', props: userProps('composer') } as never)
    expect(await mine.find({ type: 'Box' })).toBeUndefined()
    expect((await mine.find({ type: 'Text' }))?.text).toBe('> 🟣 hello')

    const reply = await $.ui.mount({ plugin: 'your-move', surface, component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never)
    expect(await reply.find({ type: 'Box' })).toBeUndefined()
    expect((await reply.find({ type: 'Text' }))?.text).toBe(
      'Here is what I found.\n\n> 🟥 **Your move:** pick one\n> - option A\n> - option B\n\nBack to the analysis.',
    )
  }
})

test('the person\'s own colours are used', { options: { your_message_color: '#00aa88', your_move_color: '#ffaa00' } }, async ($, on) => {
  engine(on)
  const mine = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('composer') } as never)
  expect((await mine.find({ type: 'Box' }))?.props.borderColor).toBe('#00aa88')
  const reply = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never)
  expect((await reply.findAll({ type: 'Box' })).some(b => b.props.borderColor === '#ffaa00')).toBe(true)
})

test('a colour that is not hex falls back to the default', { options: { your_message_color: 'purple-ish' } }, async ($, on) => {
  engine(on)
  const mine = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('composer') } as never)
  expect((await mine.find({ type: 'Box' }))?.props.borderColor).toBe('#5b0a91')
})

test('the ask is pinned above the prompt on every surface until the person replies', async ($, on) => {
  engine(on)
  await finishTurn($, REPLY)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'your-move', surface, ...BAND } as never)
    expect((await band.find({ type: 'Text', text: /Waiting on you/ }))?.props.color).toBe('#ff2020')
    expect(await band.find({ type: 'Text', text: 'pick one (2 options)' })).toBeDefined()
    await band.unmount()
  }

  await $.prompt.submit({ text: 'option A', wait: false, origin: { kind: 'composer' } } as never)
  const cleared = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', ...BAND } as never)
  expect(await cleared.find({ type: 'Text', text: /Waiting on you/ })).toBeUndefined()
})

test('subagent turns and replies with no ask pin nothing', async ($, on) => {
  engine(on)
  await finishTurn($, REPLY, { agentId: 'sub-1' })
  await finishTurn($, 'All done, nothing needed.')
  const band = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', ...BAND } as never)
  expect(await band.find({ type: 'Text', text: /Waiting on you/ })).toBeUndefined()
})

test('the pin can be turned off', { options: { pin_waiting: false } }, async ($, on) => {
  engine(on)
  await finishTurn($, REPLY)
  const band = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', ...BAND } as never)
  expect(await band.find({ type: 'Text', text: /Waiting on you/ })).toBeUndefined()
})

test('the system prompt asks Claude for the marker, with or without a drawn transcript', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  const base = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', tools: [], outputStyle: null, traits: [] }
  for (const surfaces of [['terminal'], []]) {
    const composed = await $.prompt.compose({ ...base, surfaces } as never)
    expect(composed.sections.at(-1)?.text).toContain('**Your move:**')
  }
})
