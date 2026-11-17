// The MCP server (Model Context Protocol).
// MCP is a standard way to offer "tools" to an AI. We create ONE server per request,
// bound to the logged-in user (ctx), so every tool call knows exactly who is asking.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { ALL_TOOLS } = require('./tools');
const { ToolError } = require('./tools/toolError');
const { proposeAction } = require('./pendingActions');
const { canUseTool } = require('../guardrails/rbacPolicy');
const { wrapUntrusted } = require('../guardrails/untrustedData');

// ctx = { userId, role, name }  - comes from the verified JWT, never from the AI.
function createMcpServer(ctx) {
  const server = new McpServer({ name: 'enterprise-marketplace', version: '1.0.0' });

  for (const tool of ALL_TOOLS) {
    // RBAC check #1: tools the role may not use are not even registered,
    // so the model cannot see or call them.
    if (!canUseTool(ctx.role, tool)) continue;

    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input }, async (args) => {
      try {
        // RBAC check #2: checked again at call time (defence in depth).
        if (!canUseTool(ctx.role, tool)) throw new ToolError('Your role is not allowed to use this tool.');

        // Write tools only create a pending action. Read tools run directly.
        const data = tool.kind === 'write' ? await proposeAction(tool, args, ctx) : await tool.run(args, ctx);

        return {
          // Tool output is wrapped as untrusted data (defence against indirect prompt injection).
          content: [{ type: 'text', text: wrapUntrusted(`tool:${tool.name}`, data) }],
          _meta: {
            sources: tool.extractSources ? tool.extractSources(data) : [],
            pendingAction: data && data.status === 'awaiting_user_confirmation'
              ? { actionId: data.actionId, summary: data.summary, tool: tool.name } : undefined,
          },
        };
      } catch (err) {
        if (!(err instanceof ToolError)) console.error(`[AI] tool ${tool.name} failed:`, err);
        const message = err instanceof ToolError ? err.message : 'The tool failed. Tell the user something went wrong.';
        return { isError: true, content: [{ type: 'text', text: message }] };
      }
    });
  }
  return server;
}

module.exports = { createMcpServer };
