const { z } = require('zod');

// Password policy: min 10 chars, at least one upper, one lower, one
// digit. Adjust as needed but don't go below this for a live platform.
const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const register = z.object({
  fullName: z.string().min(2).max(100),
  phone: phoneSchema,
  email: z.string().email().optional(),
  password: passwordSchema,
  role: z.enum(['buyer', 'seller', 'delivery_partner']), // never allow 'admin' from public signup
});

const login = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
});

const refresh = z.object({
  refreshToken: z.string().min(10),
});

module.exports = { register, login, refresh };
