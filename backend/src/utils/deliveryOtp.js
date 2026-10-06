const crypto = require('crypto');

function getDeliveryOtpKey() {
  const secret = process.env.DELIVERY_OTP_SECRET;
  if (secret) {
    if (Buffer.byteLength(secret, 'utf8') === 32) {
      return Buffer.from(secret, 'utf8');
    }
    return crypto.createHash('sha256').update(secret).digest();
  }
  // In NON-production, if unset, derive a key from JWT_ACCESS_SECRET via HMAC-SHA256(JWT_ACCESS_SECRET, 'delivery-otp-v1')
  const fallback = process.env.JWT_ACCESS_SECRET || 'dev-fallback-secret-access-token-minimum-32-chars';
  return crypto.createHmac('sha256', fallback).update('delivery-otp-v1').digest();
}

function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function encryptOtp(otp) {
  const key = getDeliveryOtpKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(otp, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

function decryptOtp(storedCiphertext) {
  if (!storedCiphertext) return null;
  const key = getDeliveryOtpKey();
  const [ivHex, tagHex, cipherHex] = storedCiphertext.split(':');
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Malformed OTP ciphertext');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  getDeliveryOtpKey,
  generateOtp,
  encryptOtp,
  decryptOtp,
};
