async function listCustomers(req, res) {
  try {
    return res.status(501).json({
      success: false,
      error: 'Not implemented: customer data is managed by SpareRoute',
    });
  } catch (err) {
    console.error('[customer.controller] listCustomers failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function createCustomer(req, res) {
  try {
    return res.status(501).json({
      success: false,
      error: 'Not implemented: customer data is managed by SpareRoute',
    });
  } catch (err) {
    console.error('[customer.controller] createCustomer failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { listCustomers, createCustomer };
