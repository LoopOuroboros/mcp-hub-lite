/**
 * Normalizes a tool name to a standard format for comparison.
 *
 * This function converts various naming conventions (snake_case, kebab-case,
 * camelCase, space-separated, or uppercase) into a normalized lowercase
 * underscore format for consistent matching.
 *
 * @param toolName - The tool name to normalize
 * @returns Normalized tool name in lowercase underscore format
 * @example
 * normalizeToolName('list-servers') // returns 'list_servers'
 * normalizeToolName('LIST_SERVERS') // returns 'list_servers'
 * normalizeToolName('chatCompletions') // returns 'chat_completions'
 * normalizeToolName('chat_completions') // returns 'chat_completions'
 */
export function normalizeToolName(toolName: string): string {
  if (!toolName) return '';

  return (
    toolName
      // Insert underscore before uppercase letters (for camelCase handling)
      // e.g., 'chatCompletions' -> 'chat_Completions'
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Convert to lowercase
      .toLowerCase()
      // Replace hyphens, underscores, and spaces with single underscore
      .replace(/[-_\s]+/g, '_')
      // Remove leading and trailing underscores
      .replace(/^_+|_+$/g, '')
  );
}
