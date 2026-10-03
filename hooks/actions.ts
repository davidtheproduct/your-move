// Splits an assistant reply into plain and action parts. An action part starts
// at a line opening with "Your move" (bold or not, quoted or not) or "needs
// input:" and runs to the first blank line followed by something other than a
// list item, a quoted line or an indented continuation, so a lead line plus
// its bullets stay together. The quote markers are dropped: the outline
// replaces the quote bar claude.ai would draw.
export type Part = { text: string; isAction: boolean }

const START = /^\s*(>\s*)?(\*\*)?(your move\b|needs input:)/i
const CONTINUES = /^(\s+\S|\s*>|\s*([-*+]|\d+[.)])\s)/
const QUOTE = /^\s*> ?/
const PLAIN_LEAD = /^(\s*)your move\s*:?/i

export const split = (text: string): Part[] => {
  const lines = text.split('\n')
  const parts: Part[] = []
  let buf: string[] = []
  let inAction = false
  let isQuoted = false

  const flush = () => {
    const joined = buf.join('\n').replace(/^\n+|\n+$/g, '')
    if (joined) parts.push({ text: joined, isAction: inAction })
    buf = []
  }

  lines.forEach((raw, i) => {
    let line = raw
    if (!inAction && START.test(line)) {
      flush()
      inAction = true
      isQuoted = QUOTE.test(line)
      // Always draw the lead in bold, even when Claude wrote it plain.
      line = line.replace(QUOTE, '').replace(PLAIN_LEAD, '$1**Your move:**')
    } else if (inAction && line.trim() === '') {
      const nextLine = lines.slice(i + 1).find(l => l.trim() !== '')
      if (nextLine === undefined || !CONTINUES.test(nextLine) || START.test(nextLine)) {
        flush()
        inAction = false
      }
    } else if (inAction && isQuoted && !QUOTE.test(line)) {
      // A quoted block ends at its first unquoted line.
      flush()
      inAction = false
    } else if (inAction) {
      line = line.replace(QUOTE, '')
    }
    buf.push(line)
  })
  flush()

  return parts
}

// The reply with each action part rewritten as a quote led by a red marker:
// what surfaces that draw their own message rows (the desktop app) get in
// place of the outline, since they show the text but not a wrapping box.
export const quoteActions = (text: string): string =>
  split(text)
    .map(p =>
      p.isAction
        ? p.text
            .replace('**Your move:**', '🟥 **Your move:**')
            .split('\n')
            .map(l => `> ${l}`)
            .join('\n')
        : p.text,
    )
    .join('\n\n')

// One line for the pinned strip: the first action part's lead, without its
// marker or markdown, plus how many options sit under it; null when the reply
// asks nothing of the person.
export const summarize = (text: string, max = 120): string | null => {
  const action = split(text).find(p => p.isAction)
  if (!action) return null

  const [lead = '', ...rest] = action.text.split('\n')
  const options = rest.filter(l => /^\s*([-*+]|\d+[.)])\s/.test(l)).length
  const plain = lead
    .replace(/^\s*(\*\*)?(your move|needs input)\s*:?\s*(\*\*)?\s*/i, '')
    .replace(/[*_`]/g, '')
    .trim()
  const suffix = options > 1 ? ` (${options} options)` : ''
  const room = max - suffix.length
  const body = plain.length > room ? `${plain.slice(0, room - 1).trimEnd()}…` : plain

  return (body || 'see the reply') + suffix
}
