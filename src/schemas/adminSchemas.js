const { z } = require('zod');
const approveSeller = z.object({ approve: z.boolean() });
module.exports = { approveSeller };
