const rolesPermissions = {
  root_admin: [
    'owner:approve',
    'analytics:view:global',
    'inventory:view:global',
    'messaging:send',
    'messaging:view',
  ],
  product_owner: [
    'product:create',
    'product:update:own',
    'product:delete:own',
    'inventory:update:own',
    'analytics:view:own',
    'messaging:send',
    'messaging:view',
  ],
  customer: [
    'order:create',
    'order:view:own',
    'review:create',
  ]
};

// RBAC Middleware
exports.authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userRole = req.user.role;
    const permissions = rolesPermissions[userRole] || [];

    if (!permissions.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

// Resource Ownership Check Middleware
// Requires req.resource (set by a previous middleware that fetches the document)
exports.isOwner = (resourceOwnerIdField = 'ownerId') => {
  return (req, res, next) => {
    // root_admin bypasses owner checks typically, but prompt says "product_owner with right role must still only mutate products where ownerId == user.id"
    if (req.user.role === 'root_admin') {
      return next();
    }

    if (!req.resource) {
      return res.status(500).json({ message: 'Server Error: Resource not found in request for ownership check' });
    }

    const ownerId = req.resource[resourceOwnerIdField].toString();
    if (ownerId !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You do not own this resource' });
    }

    next();
  };
};
