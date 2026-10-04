const assert = require('assert');
const { info, error, redact } = require('../src/utils/logger');

// Test logger redaction
const testMeta = {
  orderId: '00000000-0000-0000-0000-000000000000',
  otp: '654321',
  deliveryOtp: '654321',
  otp_ciphertext: '123:abc:def',
  safeField: 'safeValue',
};

// Check winston log capture
let loggedData = '';
const originalWrite = process.stdout.write;
process.stdout.write = function (chunk, ...args) {
  loggedData += chunk.toString();
  return originalWrite.apply(process.stdout, [chunk, ...args]);
};

try {
  info('Order delivery step completed', testMeta);
  error('Delivery failure occurred', testMeta);
} finally {
  process.stdout.write = originalWrite;
}

assert(!loggedData.includes('654321'), 'Raw OTP leaked into stdout!');
assert(!loggedData.includes('123:abc:def'), 'Ciphertext leaked into stdout!');
assert(loggedData.includes('[REDACTED]'), 'Redaction placeholder missing from logs!');

console.log('Secrets hygiene unit checks: ALL PASSED');
