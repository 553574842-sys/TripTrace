export const HIDDEN_ADDON_IDS = new Set(['journey', 'atlas', 'vacay', 'mcp'])

export const isHiddenAddon = (id: string): boolean => HIDDEN_ADDON_IDS.has(id)
