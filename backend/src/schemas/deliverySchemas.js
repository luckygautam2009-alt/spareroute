const { z } = require('zod');

const updateDeliveryStatus = z
  .object({
    status: z.enum(['out_for_delivery', 'delivered', 'returned']),
    otp: z.string().regex(/^\d{6}$/, 'Delivery OTP must be exactly 6 digits').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'delivered') {
      if (!data.otp || !/^\d{6}$/.test(data.otp)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Delivery OTP is required and must be exactly 6 digits',
          path: ['otp'],
        });
      }
    }
  });

module.exports = { updateDeliveryStatus };
