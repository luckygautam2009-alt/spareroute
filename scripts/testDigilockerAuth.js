require('dotenv').config();

async function testAuth() {
  const res = await fetch(`${process.env.SANDBOX_BASE_URL}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SANDBOX_API_KEY,
      'x-api-secret': process.env.SANDBOX_API_SECRET,
    },
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testAuth().catch((err) => console.error('Error:', err.message));
