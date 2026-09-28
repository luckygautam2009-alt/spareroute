const { z } = require('zod');

const create = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  serviceFeePaise: z.number().int().nonnegative(),
});

const update = z.object({
  name: z.string().min(2).max(100).optional(),
  serviceFeePaise: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

module.exports = { create, update };
