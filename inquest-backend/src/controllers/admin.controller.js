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

    try {
      const insertRes = await db.query(
        `INSERT INTO admin_profiles (user_id, email, name, employee_code, profile_photo, created_at, updated_at)
         VALUES ($1, $2, $3, 'INQ-ADM-' || lpad(nextval('admin_employee_seq')::text, 3, '0'), NULL, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [callerId, normalizedEmail, finalName]
      );

      if (insertRes.rows.length > 0) {
        return res.status(200).json({ success: true, profile: insertRes.rows[0] });
      }

      // If no row was returned due to ON CONFLICT (user_id), fetch the existing row
      const fallbackRes = await db.query(
        "SELECT * FROM admin_profiles WHERE user_id = $1",
        [callerId]
      );
      return res.status(200).json({ success: true, profile: fallbackRes.rows[0] });
    } catch (insertErr) {
      if (insertErr.code === "23505") {
        return res.status(409).json({ success: false, error: "Profile email already in use" });
      }
      throw insertErr;
    }
  } catch (err) {
    console.error("[admin.controller] getOrCreateProfile failed:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

function validateProfilePhoto(photo) {
  if (photo === null || photo === undefined || (typeof photo === "string" && photo.trim() === "")) {
    return { valid: true, value: null };
  }

  if (typeof photo !== "string") {
    return { valid: false };
  }

  const match = photo.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    return { valid: false };
  }

  const base64Data = match[2];
  if (base64Data.length % 4 !== 0) {
    return { valid: false };
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0 || buffer.length > 512 * 1024) {
    return { valid: false };
  }

  return { valid: true, value: photo };
}

async function updateProfilePhoto(req, res) {
  try {
    const callerId = req.user?.id;
    if (!callerId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { photo } = req.body;
    const photoValidation = validateProfilePhoto(photo);
    if (!photoValidation.valid) {
      return res.status(400).json({ success: false, error: "Invalid photo" });
    }

    const result = await db.query(
      `UPDATE admin_profiles
       SET profile_photo = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [photoValidation.value, callerId]
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
