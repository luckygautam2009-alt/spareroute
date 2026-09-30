const dataStore = require('../services/dataStore');

function getCustomerContext(req, res) {
  const { customerId } = req.params;

  const customer = dataStore.getCustomerById(customerId);
  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  const orders = dataStore.getOrdersByCustomerId(customerId);
  const payments = dataStore.getPaymentsByCustomerId(customerId);
  const tickets = dataStore.getTicketsByCustomerId(customerId);
  const refunds = dataStore.getRefundsByCustomerId(customerId);
  const securityEvents = dataStore.getSecurityEventsByCustomerId(customerId);
  const policies = dataStore.getAllPolicies();

  res.status(200).json({
    success: true,
    data: { customer, orders, payments, tickets, refunds, securityEvents, policies },
  });
}

module.exports = { getCustomerContext };
