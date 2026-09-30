const { z } = require('zod');

const initiate = z.object({
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

const confirm = z.object({
  referenceId: z.string().min(3),
  otp: z.string().regex(/^\d{4,6}$/, 'Enter a valid OTP'),
});

module.exports = { initiate, confirm };
