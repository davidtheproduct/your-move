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
