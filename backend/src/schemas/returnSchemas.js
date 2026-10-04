const { z } = require('zod');

const reviewReturn = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});

const idParam = z.object({
  id: z.string().uuid(),
});

module.exports = { reviewReturn, idParam };
