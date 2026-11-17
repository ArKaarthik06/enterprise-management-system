// ============================================================
// RBAC for the AI layer (Role Based Access Control)
// One place that decides: what may this role see and do?
// The role ALWAYS comes from the verified JWT login - never from the AI model.
// ============================================================

// Which knowledge-base documents each role may read.
const DOCUMENT_ACCESS = {
  customer: ['public'],
  product_owner: ['public', 'seller'],
  root_admin: ['public', 'seller', 'admin'],
};

function allowedDocumentLevels(role) {
  return DOCUMENT_ACCESS[role] || ['public']; // unknown role => least privilege
}

// A tool lists the roles that may use it. This is the check.
function canUseTool(role, tool) {
  return Array.isArray(tool.roles) && tool.roles.includes(role);
}

module.exports = { allowedDocumentLevels, canUseTool, DOCUMENT_ACCESS };
