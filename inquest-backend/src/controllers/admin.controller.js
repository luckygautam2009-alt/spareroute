const db = require("../db/connection");

async function getOverview(req, res) {
  try {
    const [ticketsRes, refundsRes, securityRes, policiesRes] = await Promise.all([
      db.query("SELECT * FROM tickets ORDER BY date DESC"),
      db.query("SELECT * FROM refunds ORDER BY initiated_at DESC"),
      db.query("SELECT * FROM security_events ORDER BY timestamp DESC"),
      db.query("SELECT * FROM policies ORDER BY id ASC"),
    ]);

    const data = {
      tickets: ticketsRes.rows,
      refunds: refundsRes.rows,
      securityEvents: securityRes.rows,
      policies: policiesRes.rows,
    };

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[admin.controller] getOverview failed:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

async function getOrCreateProfile(req, res) {
  try {
    const callerId = req.user?.id;
    if (!callerId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { email, name } = req.body;
    const trimmedName = String(name || "").trim();

    // Look up by caller user_id
    const existingRes = await db.query(
      "SELECT * FROM admin_profiles WHERE user_id = $1",
      [callerId]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (trimmedName && existing.name !== trimmedName) {
        const updateRes = await db.query(
          "UPDATE admin_profiles SET name = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *",
          [trimmedName, callerId]
        );
        return res.status(200).json({ success: true, profile: updateRes.rows[0] });
      }
      return res.status(200).json({ success: true, profile: existing });
    }

    // Not found: create it with user_id = caller, email and name from body
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const finalName = trimmedName || "Authorized Staff";

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    // Check if email already belongs to another user_id or to a legacy row with user_id NULL
    const emailCheck = await db.query(
      "SELECT user_id FROM admin_profiles WHERE email = $1",
      [normalizedEmail]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: "Profile email already in use" });
    }

    // Generate sequential employee code
    const countRes = await db.query("SELECT COUNT(*)::int AS count FROM admin_profiles");
    let codeSeqNum = (countRes.rows[0]?.count || 0) + 1;
    let employeeCode = "INQ-ADM-" + String(codeSeqNum).padStart(3, "0");
    while (true) {
      const checkRes = await db.query(
        "SELECT 1 FROM admin_profiles WHERE employee_code = $1",
        [employeeCode]
      );
      if (checkRes.rows.length === 0) {
        break;
      }
      codeSeqNum++;
      employeeCode = "INQ-ADM-" + String(codeSeqNum).padStart(3, "0");
    }

    const insertRes = await db.query(
      `INSERT INTO admin_profiles (user_id, email, name, employee_code, profile_photo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
       RETURNING *`,
      [callerId, normalizedEmail, finalName, employeeCode]
    );

    return res.status(200).json({ success: true, profile: insertRes.rows[0] });
  } catch (err) {
    console.error("[admin.controller] getOrCreateProfile failed:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

async function updateProfilePhoto(req, res) {
  try {
    const callerId = req.user?.id;
    if (!callerId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { photo } = req.body;

    const result = await db.query(
      `UPDATE admin_profiles
       SET profile_photo = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [photo || null, callerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Admin profile not found" });
    }

    return res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (err) {
    console.error("[admin.controller] updateProfilePhoto failed:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

async function updateProfileName(req, res) {
  try {
    const callerId = req.user?.id;
    if (!callerId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { name } = req.body;
    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const result = await db.query(
      `UPDATE admin_profiles
       SET name = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [trimmedName, callerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Admin profile not found" });
    }

    return res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (err) {
    console.error("[admin.controller] updateProfileName failed:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

module.exports = {
  getOverview,
  getOrCreateProfile,
  updateProfilePhoto,
  updateProfileName,
};
