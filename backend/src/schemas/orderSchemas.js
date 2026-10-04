const { z } = require('zod');

const create = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
  deliveryAddress: z.string().min(5).max(500),
  deliveryLatitude: z.number().optional(),
  deliveryLongitude: z.number().optional(),
  mechanicId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cod', 'online']).optional(),
  payment_method: z.enum(['cod', 'online']).optional(),
});

const rateMechanic = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

const updateStatus = z.object({
  status: z.enum(['accepted_by_seller', 'rejected_by_seller', 'cancelled']),
});

const cancel = z.object({
  reason: z.string().max(300).optional(),
  cancelReason: z.string().max(300).optional(),
}).optional().default({});

const createReturn = z.object({
  reason: z.string().min(3).max(500),
});

module.exports = { create, updateStatus, rateMechanic, cancel, createReturn };
