const dataStore = require('../services/dataStore');

async function getCustomerContext(req, res) {
  try {
    const { customerId } = req.params;

    const context = await dataStore.getSpareRouteContext(customerId);
    if (!context || !context.customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const { customer, orders, payments } = context;

    const [tickets, refunds, securityEvents, policies] = await Promise.all([
      dataStore.getTicketsByCustomerId(customerId),
      dataStore.getRefundsByCustomerId(customerId),
      dataStore.getSecurityEventsByCustomerId(customerId),
      dataStore.getAllPolicies(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        customer,
        orders: orders || [],
        payments: payments || [],
        tickets: tickets || [],
        refunds: refunds || [],
        securityEvents: securityEvents || [],
        policies: policies || [],
      },
    });
  } catch (err) {
    console.error('[context.controller] getCustomerContext failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getCustomerContext };
