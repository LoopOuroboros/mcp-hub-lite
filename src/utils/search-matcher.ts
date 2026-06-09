/**
 * Counts how many tokens from a whitespace-delimited query match against any of the given fields.
 * Returns a large value for empty or whitespace-only queries so they match all results.
 */
export function countMatchingTokens(query: string, fields: string[]): number {
  if (!query || typeof query !== 'string') {
    return 0;
  }

  const tokens = query
    .toLowerCase()
    .split(/[,\s;|]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const lowerFields = fields.map((f) => (f || '').toLowerCase());

  let matchCount = 0;
  for (const token of tokens) {
    if (lowerFields.some((field) => field.includes(token))) {
      matchCount++;
    }
  }

  return matchCount;
}
