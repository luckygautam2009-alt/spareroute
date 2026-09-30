const env = require('../../config/env');
const StubKycProvider = require('./stubKycProvider');
// const DigioKycProvider = require('./digioKycProvider'); // implement when you have real API access

function getKycProvider() {
  switch (env.kyc.providerName) {
    case 'digio':
      // return new DigioKycProvider(env.kyc.apiKey, env.kyc.apiSecret, env.kyc.baseUrl);
      throw new Error(
        'Digio provider not implemented yet — implement DigioKycProvider ' +
        'against kycProviderInterface.js once you have API credentials.'
      );
    case 'stub':
    default:
      return new StubKycProvider();
  }
}

module.exports = getKycProvider;
