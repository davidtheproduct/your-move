/** Claude's latest open ask, as one line for the pinned strip; null when nothing waits. */
export type Waiting = string | null

declare module 'claude-code' {
  interface PluginState {
    'your-move': { waiting: Waiting }
  }
}
