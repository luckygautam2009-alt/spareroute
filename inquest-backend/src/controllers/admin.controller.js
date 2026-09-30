const db = require('../db/connection');

function getOverview(req, res) {
  const data = {
    customers: db.prepare('SELECT * FROM customers').all(),
    orders: db.prepare('SELECT * FROM orders').all(),
    payments: db.prepare('SELECT * FROM payments').all(),
    tickets: db.prepare('SELECT * FROM tickets').all(),
    refunds: db.prepare('SELECT * FROM refunds').all(),
    securityEvents: db.prepare('SELECT * FROM security_events').all(),
    policies: db.prepare('SELECT * FROM policies').all(),
  };
  res.status(200).json({ success: true, data });
}

function getOrCreateProfile(req, res) {
  const { email, name } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const trimmedName = String(name || '').trim() || 'Authorized Staff';

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const existing = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);

  if (existing) {
    // If name changed, update it safely
    if (trimmedName && existing.name !== trimmedName) {
      db.prepare('UPDATE admin_profiles SET name = ?, updated_at = ? WHERE email = ?')
        .run(trimmedName, new Date().toISOString(), normalizedEmail);
      existing.name = trimmedName;
    }
    return res.status(200).json({ success: true, profile: existing });
  }

  // Generate a permanent, unique sequential employee code
  const totalProfiles = db.prepare('SELECT COUNT(*) as count FROM admin_profiles').get().count;
  let codeSeqNum = totalProfiles + 1;
  let employeeCode = `INQ-ADM-${String(codeSeqNum).padStart(3, '0')}`;
  while (db.prepare('SELECT 1 FROM admin_profiles WHERE employee_code = ?').get(employeeCode)) {
    codeSeqNum++;
    employeeCode = `INQ-ADM-${String(codeSeqNum).padStart(3, '0')}`;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO admin_profiles (email, name, employee_code, profile_photo, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?)
  `).run(normalizedEmail, trimmedName, employeeCode, now, now);

  const created = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);
  return res.status(200).json({ success: true, profile: created });
}

function updateProfilePhoto(req, res) {
  const { email, photo } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const existing = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Admin profile not found' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE admin_profiles SET profile_photo = ?, updated_at = ? WHERE email = ?')
    .run(photo || null, now, normalizedEmail);

  const updated = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);
  return res.status(200).json({ success: true, profile: updated });
}

function updateProfileName(req, res) {
  const { email, name } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const trimmedName = String(name || '').trim();

  if (!normalizedEmail || !trimmedName) {
    return res.status(400).json({ success: false, error: 'Email and name are required' });
  }

  const existing = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Admin profile not found' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE admin_profiles SET name = ?, updated_at = ? WHERE email = ?')
    .run(trimmedName, now, normalizedEmail);

  const updated = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(normalizedEmail);
  return res.status(200).json({ success: true, profile: updated });
}

module.exports = {
  getOverview,
  getOrCreateProfile,
  updateProfilePhoto,
  updateProfileName,
};
