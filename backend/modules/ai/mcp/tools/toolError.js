// An error whose message is SAFE to show to the AI model (and therefore to the user).
// Any other error is hidden behind a generic message so internals never leak.
class ToolError extends Error {}

module.exports = { ToolError };
