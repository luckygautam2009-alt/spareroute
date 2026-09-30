const fs = require('fs');
const path = require('path');
const { verifyIdCard, hasReference, clearReference, setReference } = require('../src/services/verificationService');

async function runAllTests() {
  console.log('====================================================');
  console.log('STARTING NIET ID VERIFICATION PIPELINE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testNum, testName, condition, details = '') {
    if (condition) {
      console.log(`✅ TEST ${testNum} PASSED: ${testName} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ TEST ${testNum} FAILED: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Load original reference card
  const refPath = path.join(__dirname, '../reference_card.json');
  const originalRef = fs.readFileSync(refPath, 'utf8');

  // TEST 1: Valid NIET ID card
  const nietBuf = fs.readFileSync(path.join(__dirname, '../test_card.jpg'));
  const res1 = await verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Yash Gautam');
  assert(
    1,
    'Upload valid NIET ID card',
    res1.verified === true && res1.confidence >= 90 && res1.details?.institutionDetected === 'NIET',
    `verified=${res1.verified}, conf=${res1.confidence}, reason="${res1.reason}"`
  );

  // TEST 1B: Valid NIET card where AKTU / AICTE subtext is missed due to glare/cropping
  const nietNoAktuBuf = fs.readFileSync(path.join(__dirname, '../test_niet_no_aktu.jpg'));
  const res1b = await verifyIdCard(nietNoAktuBuf.toString('base64'), 'image/jpeg', 'Yash Gautam');
  assert(
    '1B',
    'Upload valid NIET ID without AKTU/AICTE (glare/crop tolerance)',
    res1b.verified === true && res1b.confidence >= 90 && res1b.details?.institutionDetected === 'NIET',
    `verified=${res1b.verified}, conf=${res1b.confidence}, reason="${res1b.reason}"`
  );

  // TEST 2: Aadhaar Card
  const aadhaarBuf = fs.readFileSync(path.join(__dirname, '../test_aadhaar.jpg'));
  const res2 = await verifyIdCard(aadhaarBuf.toString('base64'), 'image/jpeg', 'Ramesh Kumar');
  assert(
    2,
    'Upload Aadhaar',
    res2.verified === false && /aadhaar/i.test(res2.reason),
    `verified=${res2.verified}, reason="${res2.reason}"`
  );

  // TEST 3: PAN Card
  const panBuf = fs.readFileSync(path.join(__dirname, '../test_pan.jpg'));
  const res3 = await verifyIdCard(panBuf.toString('base64'), 'image/jpeg', 'Suresh Verma');
  assert(
    3,
    'Upload PAN card',
    res3.verified === false && /pan/i.test(res3.reason),
    `verified=${res3.verified}, reason="${res3.reason}"`
  );

  // TEST 4: Driving Licence
  const dlBuf = fs.readFileSync(path.join(__dirname, '../test_dl.jpg'));
  const res4 = await verifyIdCard(dlBuf.toString('base64'), 'image/jpeg', 'Amit Sharma');
  assert(
    4,
    'Upload Driving Licence',
    res4.verified === false && /driving licence/i.test(res4.reason),
    `verified=${res4.verified}, reason="${res4.reason}"`
  );

  // TEST 5: Another College / University ID
  const amityBuf = fs.readFileSync(path.join(__dirname, '../test_amity.jpg'));
  const res5 = await verifyIdCard(amityBuf.toString('base64'), 'image/jpeg', 'Rohan Gupta');
  assert(
    5,
    'Upload another college/university ID',
    res5.verified === false && /another institution|amity/i.test(res5.reason),
    `verified=${res5.verified}, reason="${res5.reason}"`
  );

  // TEST 6: Random person photo / selfie
  const selfieBuf = fs.readFileSync(path.join(__dirname, '../test_selfie.jpg'));
  const res6 = await verifyIdCard(selfieBuf.toString('base64'), 'image/jpeg', 'Unknown Person');
  assert(
    6,
    'Upload a random person photo / selfie',
    res6.verified === false && /not appear to be a valid NIET|blank|unreadable/i.test(res6.reason),
    `verified=${res6.verified}, reason="${res6.reason}"`
  );

  // TEST 7: Random document containing name + ID number
  const randomDocBuf = fs.readFileSync(path.join(__dirname, '../test_random_doc.jpg'));
  const res7 = await verifyIdCard(randomDocBuf.toString('base64'), 'image/jpeg', 'John Smith');
  assert(
    7,
    'Upload random document with name + ID number',
    res7.verified === false && /not appear to be a valid NIET|does not contain valid NIET/i.test(res7.reason),
    `verified=${res7.verified}, reason="${res7.reason}"`
  );

  // TEST 8: Blank / invalid image
  const blankBuf = fs.readFileSync(path.join(__dirname, '../test_blank.jpg'));
  const res8 = await verifyIdCard(blankBuf.toString('base64'), 'image/jpeg');
  assert(
    8,
    'Upload blank / invalid image',
    res8.verified === false && /blank|unreadable/i.test(res8.reason),
    `verified=${res8.verified}, reason="${res8.reason}"`
  );

  // TEST 9: Remove / make unavailable the NIET reference card
  clearReference();
  const res9 = await verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Yash Gautam');
  assert(
    9,
    'Remove/make unavailable NIET reference card',
    res9.verified === false && /reference card is not configured/i.test(res9.reason),
    `verified=${res9.verified}, reason="${res9.reason}"`
  );

  // Restore reference card
  const parsedRef = JSON.parse(originalRef);
  setReference(parsedRef.data, parsedRef.mimeType);

  // TEST 10: Submit Verify multiple times rapidly
  console.log('\n--- Running TEST 10: Rapid duplicate submissions ---');
  const rapidPromises = [
    verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Yash Gautam'),
    verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Yash Gautam'),
    verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Yash Gautam'),
  ];
  const rapidResults = await Promise.all(rapidPromises);
  const allSucceeded = rapidResults.every((r) => r.verified === true);
  assert(
    10,
    'Rapid duplicate submissions execute cleanly without corruption',
    allSucceeded,
    `Results count: ${rapidResults.length}`
  );

  // TEST 11: Fail-closed verification (card with wrong claimed name)
  const res11 = await verifyIdCard(nietBuf.toString('base64'), 'image/jpeg', 'Vikramaditya Rao');
  assert(
    11,
    'Fail-closed when cardholder name does not match claimed name',
    res11.verified === false && /does not match claimed name/i.test(res11.reason),
    `verified=${res11.verified}, reason="${res11.reason}"`
  );

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
