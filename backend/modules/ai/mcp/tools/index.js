// The tool registry: every tool the AI could ever use, in one list.
// To add a new tool: create a file in this folder and add it below.
const ALL_TOOLS = [
  require('./searchKnowledge'),
  ...require('./products'),
  ...require('./orders'),
  ...require('./insights'),
  ...require('./inventory'),
];

const getTool = (name) => ALL_TOOLS.find((t) => t.name === name);

module.exports = { ALL_TOOLS, getTool };
