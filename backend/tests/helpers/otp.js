const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

async function getDeliveryOtp(orderId, buyerToken, baseUrl = BASE_URL) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/orders/${orderId}/delivery-otp`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${buyerToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to get delivery OTP: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.otp || data.data?.otp;
}

async function deliverWithOtp(orderId, buyerToken, riderToken, baseUrl = BASE_URL) {
  const otp = await getDeliveryOtp(orderId, buyerToken, baseUrl);
  const url = `${baseUrl.replace(/\/$/, '')}/api/delivery/${orderId}/status`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${riderToken}`,
    },
    body: JSON.stringify({ status: 'delivered', otp }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to deliver order with OTP: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = {
  getDeliveryOtp,
  deliverWithOtp,
};
