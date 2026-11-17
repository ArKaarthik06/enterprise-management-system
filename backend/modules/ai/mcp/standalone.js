// OPTIONAL demo: run the same tools as a stand-alone MCP server over stdio, so MCP clients
// such as Claude Desktop can connect to them.
//
//   AI_MCP_USER_EMAIL=customer@market.com node modules/ai/mcp/standalone.js
//
// The tools run as that user, with that user's role (RBAC still applies).
// Never expose this to the internet: stdio servers are for local use only.
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const User = require('../../auth/models/User');
const { createMcpServer } = require('./server');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: process.env.AI_MCP_USER_EMAIL });
  if (!user) {
    console.error('Set AI_MCP_USER_EMAIL to an existing user email.');
    process.exit(1);
  }
  const server = createMcpServer({ userId: String(user._id), role: user.role, name: user.name });
  await server.connect(new StdioServerTransport()); // stdout is reserved for the protocol, so log to stderr only
  console.error(`MCP server ready for ${user.email} (${user.role})`);
})();
