const { z } = require('zod');

const create = z.object({
  name: z.string().min(2).max(200),
  oemPartNumber: z.string().max(100).optional(),
  compatiblePartNumbers: z.array(z.string().max(100)).optional(),
  brand: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  pricePaise: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
});

const updateStock = z.object({
  stockQuantity: z.number().int().nonnegative(),
});

const search = z.object({
  query: z.string().max(200).optional(),
  oemPartNumber: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
});

module.exports = { create, updateStock, search };
