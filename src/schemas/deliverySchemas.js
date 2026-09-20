const { z } = require('zod');
const updateDeliveryStatus = z.object({
  status: z.enum(['out_for_delivery', 'delivered', 'returned']),
});
module.exports = { updateDeliveryStatus };
