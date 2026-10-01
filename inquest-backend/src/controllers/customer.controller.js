async function listCustomers(req, res) {
  try {
    // Customers are stored in SpareRoute's database, not in Inquest PostgreSQL.
    // Inquest does not maintain a local customers table.
    return res.status(200).json({ success: true, data: [] });
  } catch (err) {
    console.error('[customer.controller] listCustomers failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function createCustomer(req, res) {
  try {
    // Customer records are managed by SpareRoute. Inquest does not store customer accounts.
    return res.status(400).json({
      success: false,
      error: 'Customer management has moved to SpareRoute. Inquest does not maintain a customer database.',
    });
  } catch (err) {
    console.error('[customer.controller] createCustomer failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { listCustomers, createCustomer };
