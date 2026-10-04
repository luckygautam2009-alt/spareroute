const { z } = require('zod');

const approveSeller = z.object({ approve: z.boolean() });

const createRefund = z.object({
  orderId: z.string().uuid(),
  amountPaise: z.number().int().positive().max(1000000000),
  reason: z.string().min(3).max(500),
  returnRequestId: z.string().uuid().optional().nullable(),
});

const processRefund = z.object({
  status: z.enum(['processed', 'failed']),
  note: z.string().max(500).optional(),
});

const idParam = z.object({
  id: z.string().uuid(),
});

const sellerIdParam = z.object({
  sellerId: z.string().uuid(),
});

const listRefunds = z.object({
  status: z.enum(['pending', 'processed', 'failed']).optional(),
  orderId: z.string().uuid().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const orderIdParam = z.object({
  orderId: z.string().uuid(),
});

const forceDeliver = z.object({
  reason: z.string().min(10).max(300),
  cashCollected: z.literal(true),
});

module.exports = { approveSeller, createRefund, processRefund, idParam, sellerIdParam, orderIdParam, forceDeliver, listRefunds };

