// The MCP client: how our agent talks to the MCP server.
// Both live in the same Node process, so we connect them with an in-memory pipe.
// (The same server could also be run as a separate process - see standalone.js.)
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { createMcpServer } = require('./server');

async function openMcpSession(ctx) {
  const server = createMcpServer(ctx);
  const client = new Client({ name: 'enterprise-agent', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    // Tools in the format the OpenAI-compatible API expects. Sorted by name so the list is always
    // identical for the same role - a requirement for prompt caching.
    async listTools() {
      const { tools } = await client.listTools();
      return tools
        .map((t) => {
          const { $schema, ...parameters } = t.inputSchema; // the API does not need the $schema key
          return { type: 'function', function: { name: t.name, description: t.description, parameters } };
        })
        .sort((a, b) => a.function.name.localeCompare(b.function.name));
    },
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      return {
        text: (result.content || []).map((c) => c.text || '').join('\n'),
        isError: Boolean(result.isError),
        sources: (result._meta && result._meta.sources) || [],
        pendingAction: result._meta && result._meta.pendingAction,
      };
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}

module.exports = { openMcpSession };
