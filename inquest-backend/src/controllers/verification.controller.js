const { setReference, hasReference, verifyIdCard } = require('../services/verificationService');

function uploadReference(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'idCard image file is required' });
  }
  setReference(req.file.buffer.toString('base64'), req.file.mimetype);
  res.status(200).json({ success: true, message: 'Reference ID card saved' });
}

function referenceStatus(req, res) {
  res.status(200).json({ success: true, data: { configured: hasReference() } });
}

async function verify(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'idCard image file is required' });
  }
  const { employeeName, employeeEmail } = req.body;

  try {
    const result = await verifyIdCard(
      req.file.buffer.toString('base64'),
      req.file.mimetype,
      employeeName
    );

    res.status(200).json({
      success: true,
      data: {
        employeeName,
        employeeEmail,
        ...result,
      },
    });
  } catch (err) {
    console.error('[verification.controller] verify failed:', err.message);
    res.status(500).json({
      success: false,
      error: 'Verification service error',
      data: {
        employeeName,
        employeeEmail,
        verified: false,
        confidence: 0,
        reason: 'Verification service encountered an error — please try again.',
      },
    });
  }
}

module.exports = { uploadReference, referenceStatus, verify };
