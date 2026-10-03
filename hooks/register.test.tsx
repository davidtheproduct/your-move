import { expect, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const

const userProps = (kind: string, extra: object = {}) => ({ text: 'hello', origin: { kind }, isExpanded: true, ...extra })

const REPLY = 'Here is what I found.\n\n**Your move:** pick one\n- option A\n- option B\n\nBack to the analysis.'

// Stand-ins for the engine's own drawing of each row.
const engineDraws = (on: any) => {
  on('ui.render', { component: 'UserMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{'> ' + e.props.text}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
}

test('your own messages get the default border; notifications do not', async ($, on) => {
  engineDraws(on)
  for (const surface of SURFACES) {
    const mine = await $.ui.mount({ plugin: 'your-move', surface, component: 'UserMessage', props: userProps('composer') } as never)
    const box = await mine.find({ type: 'Box' })
    expect(box?.props.borderColor).toBe('#5b0a91')
    expect(box?.text).toContain('hello')
    await mine.unmount()

    const note = await $.ui.mount({ plugin: 'your-move', surface, component: 'UserMessage', props: userProps('task-notification', { task: { id: 't1', status: 'completed' } }) } as never)
    expect(await note.find({ type: 'Box' })).toBeUndefined()
    await note.unmount()
  }
})

test('only the Your move section is outlined, in the default red', async ($, on) => {
  engineDraws(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'your-move', surface, component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never)
    const outlined = (await ui.findAll({ type: 'Box' })).find(b => b.props.borderColor === '#ff2020')
    expect(outlined?.text).toContain('option B')
    expect(outlined?.text).not.toContain('Back to the analysis')
    await ui.unmount()

    const plain = await $.ui.mount({ plugin: 'your-move', surface, component: 'AssistantMessage', props: { text: 'Nothing for you here.', isFirstOfReply: true } } as never)
    expect((await plain.findAll({ type: 'Box' })).some(b => b.props.borderColor)).toBe(false)
    await plain.unmount()
  }
})

test('a plain "Your move:" lead is drawn bold', async ($, on) => {
  engineDraws(on)
  const ui = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: 'Done.\n\nYour move: approve the merge', isFirstOfReply: true } } as never)
  expect((await ui.find({ type: 'Markdown' }))?.text).toBe('**Your move:** approve the merge')
})

test('the person\'s own colours are used', { options: { your_message_color: '#00aa88', your_move_color: '#ffaa00' } }, async ($, on) => {
  engineDraws(on)
  const mine = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('composer') } as never)
  expect((await mine.find({ type: 'Box' }))?.props.borderColor).toBe('#00aa88')
  const reply = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never)
  expect((await reply.findAll({ type: 'Box' })).some(b => b.props.borderColor === '#ffaa00')).toBe(true)
})

test('a colour that is not hex falls back to the default', { options: { your_message_color: 'purple-ish' } }, async ($, on) => {
  engineDraws(on)
  const mine = await $.ui.mount({ plugin: 'your-move', surface: 'terminal', component: 'UserMessage', props: userProps('composer') } as never)
  expect((await mine.find({ type: 'Box' }))?.props.borderColor).toBe('#5b0a91')
})

test('the system prompt asks Claude for the marker, only when a transcript is drawn', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  const base = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', tools: [], outputStyle: null, traits: [] }
  const drawn = await $.prompt.compose({ ...base, surfaces: ['terminal'] } as never)
  expect(drawn.sections.at(-1)?.text).toContain('**Your move:**')
  const headless = await $.prompt.compose({ ...base, surfaces: [] } as never)
  expect(headless.sections.some(s => s.id === 'your-move:marker')).toBe(false)
})

test('a quoted Your move block is outlined, with its quote markers dropped', async ($, on) => {
  engineDraws(on)
  const text = 'Here is what I found.\n\n> **Your move:** pick one\n> - option A\n> - option B\nBack to the analysis.'
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'your-move', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } } as never)
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe('**Your move:** pick one\n- option A\n- option B')
    expect((await ui.find({ type: 'Text', text: /Back to the analysis/ }))).toBeDefined()
    await ui.unmount()
  }
})
