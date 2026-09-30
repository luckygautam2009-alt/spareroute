const dataStore = require('../services/dataStore');

function listCustomers(req, res) {
  res.status(200).json({ success: true, data: dataStore.getAllCustomers() });
}

function createCustomer(req, res) {
  const result = dataStore.addCustomer(req.body);
  res.status(201).json({ success: true, data: result });
}

module.exports = { listCustomers, createCustomer };
