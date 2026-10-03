const { z } = require('zod');

const approveSeller = z.object({ approve: z.boolean() });

const createRefund = z.object({
  orderId: z.string().uuid(),
  amountPaise: z.number().int().positive(),
  reason: z.string().min(3).max(500),
  returnRequestId: z.string().uuid().optional().nullable(),
});

const processRefund = z.object({
  status: z.enum(['processed', 'failed']),
  note: z.string().max(500).optional(),
});

module.exports = { approveSeller, createRefund, processRefund };
