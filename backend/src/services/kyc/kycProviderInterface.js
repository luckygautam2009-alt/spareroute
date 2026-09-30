/**
 * Every real KYC provider (Digio, Karza, Signzy, IDfy, Setu, etc.)
 * must implement this shape. Swapping providers later = write a new
 * file that implements this same interface, change one line in
 * kycProviderFactory.js. Nothing else in the app changes.
 *
 * IMPORTANT: no implementation of this interface should ever return
 * or persist the raw Aadhaar number. Only:
 *   - a provider-issued reference/transaction ID
 *   - a status (pending / verified / failed)
 *   - the verified name (for display/reconciliation)
 */
class KycProviderInterface {
  /**
   * Starts an Aadhaar verification flow (e.g. sends OTP to the
   * Aadhaar-linked mobile via the provider).
   * @param {{aadhaarNumber: string, sellerId: string}} input
   * @returns {Promise<{referenceId: string, status: 'pending'}>}
   */
  async initiateVerification(input) {
    throw new Error('Not implemented');
  }

  /**
   * Confirms verification (e.g. submits OTP) and returns the result.
   * @param {{referenceId: string, otp: string}} input
   * @returns {Promise<{status: 'verified'|'failed', verifiedName?: string}>}
   */
  async confirmVerification(input) {
    throw new Error('Not implemented');
  }
}

module.exports = KycProviderInterface;
