const config = require('../config/env');

function requireAdminPassword(req, res, next) {
  const provided = req.body?.adminPassword;
  if (!config.adminPassword) {
    return res.status(500).json({ success: false, error: 'Admin password not configured on server' });
  }
  if (!provided || provided !== config.adminPassword) {
    return res.status(401).json({ success: false, error: 'Invalid or missing admin password' });
  }
  next();
}

module.exports = { requireAdminPassword };
