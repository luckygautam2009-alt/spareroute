const { z } = require('zod');

const create = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
  deliveryAddress: z.string().min(5).max(500),
  deliveryLatitude: z.number().optional(),
  deliveryLongitude: z.number().optional(),
});

const updateStatus = z.object({
  status: z.enum(['accepted_by_seller', 'rejected_by_seller', 'cancelled']),
});

module.exports = { create, updateStatus };
