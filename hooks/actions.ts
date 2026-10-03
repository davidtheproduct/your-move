// Splits an assistant reply into plain and action parts. An action part starts
// at a line opening with "Your move" (bold or not) or "needs input:" and runs
// to the first blank line followed by something other than a list item or an
// indented continuation, so a lead line plus its bullets stay together.
export type Part = { text: string; isAction: boolean }

const START = /^\s*(\*\*)?(your move\b|needs input:)/i
const CONTINUES = /^(\s+\S|\s*([-*+]|\d+[.)])\s)/
const PLAIN_LEAD = /^(\s*)your move\s*:?/i

export const split = (text: string): Part[] => {
  const lines = text.split('\n')
  const parts: Part[] = []
  let buf: string[] = []
  let inAction = false

  const flush = () => {
    const joined = buf.join('\n').replace(/^\n+|\n+$/g, '')
    if (joined) parts.push({ text: joined, isAction: inAction })
    buf = []
  }

  lines.forEach((line, i) => {
    if (!inAction && START.test(line)) {
      flush()
      inAction = true
      // Always draw the lead in bold, even when Claude wrote it plain.
      line = line.replace(PLAIN_LEAD, '$1**Your move:**')
    } else if (inAction && line.trim() === '') {
      const nextLine = lines.slice(i + 1).find(l => l.trim() !== '')
      if (nextLine === undefined || !CONTINUES.test(nextLine) || START.test(nextLine)) {
        flush()
        inAction = false
      }
    }
    buf.push(line)
  })
  flush()

  return parts
}
