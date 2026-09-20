const crypto = require('crypto');
const KycProviderInterface = require('./kycProviderInterface');

/**
 * DEVELOPMENT ONLY. Does not call any real Aadhaar/UIDAI system.
 * Simulates the flow so you can build and test the rest of the app
 * (seller onboarding UI, admin approval, order gating on kyc_status)
 * before you sign up with a real licensed KYC provider.
 *
 * DO NOT use this in production — it will "verify" anything.
 */
class StubKycProvider extends KycProviderInterface {
  async initiateVerification({ aadhaarNumber }) {
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      throw new Error('Aadhaar number must be exactly 12 digits');
    }
    // We deliberately do not store or return the aadhaarNumber itself.
    const referenceId = `stub_${crypto.randomUUID()}`;
    return { referenceId, status: 'pending' };
  }

  async confirmVerification({ referenceId, otp }) {
    // Stub rule: OTP "000000" simulates a failure, anything else "succeeds".
    // This lets you test both success and failure paths in the app.
    if (otp === '000000') {
      return { status: 'failed' };
    }
    return { status: 'verified', verifiedName: 'Test Seller (stub)' };
  }
}

module.exports = StubKycProvider;
