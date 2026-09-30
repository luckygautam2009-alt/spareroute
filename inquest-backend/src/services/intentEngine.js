const { generateJSON } = require('./geminiService');

const VALID_TOP_LEVEL_INTENTS = [
  'payment/billing',
  'refund/return',
  'cancellation',
  'product_issue',
  'order_status/delay',
  'security/unauthorized_activity',
  'other/ambiguous',
];

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const HINGLISH_MARKERS = /\b(bhai|yaar|nahi|nahin|gya|gyi|gaya|gaye|baar|kat|dekh|lo|mera|meri|mere|kisi|abhi|tak|aaya|aayi|aaye|mila|karne|karo|paise|rupaye|khud|ho\s*gya|dikha\s*raha|bekaar|chahiye|wala)\b/i;

function convertDevanagariDigits(str) {
  if (!str) return str;
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(devanagariDigits[i], 'g'), String(i));
  }
  return res;
}

function detectLanguage(text) {
  if (!text) return 'en';
  const hasDevanagari = DEVANAGARI_REGEX.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasDevanagari && hasLatin) return 'mixed';
  if (hasDevanagari) return 'hi';
  if (HINGLISH_MARKERS.test(text)) return 'hinglish';
  return 'en';
}

function extractEntitiesFromText(text) {
  const normalized = convertDevanagariDigits(text);
  const orderMatch =
    normalized.match(/order\s*(?:id|no\.?|number|#)?\s*:?\s*([A-Za-z]*\d+[A-Za-z0-9]*)/i) ||
    normalized.match(/(?:mera|meri)\s*([A-Za-z]*\d+[A-Za-z0-9]*)\s*wala\s*order/i) ||
    normalized.match(/[ऑओ]र्ड[रर्]\s*(?:id|no\.?|#)?\s*:?\s*(\d+)/i) ||
    normalized.match(/#\s*([A-Za-z]*\d+[A-Za-z0-9]*)/i) ||
    normalized.match(/\b(ORDER\d+)\b/i) ||
    normalized.match(/\b(\d{3,})\b/);

  const amountMatch =
    normalized.match(/[₹$]\s*(\d+(?:,\d+)*(?:\.\d+)?)/) ||
    normalized.match(/\b(\d+)\s*(?:rs|rupees|inr|रुपये)\b/i);

  const paymentMatch = normalized.match(/\b(PAY\w+|\bUPI\w+|TXN\w+)\b/i);

  return {
    orderReference: orderMatch ? orderMatch[1].replace(/^ORDER/i, '') : null,
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    paymentReference: paymentMatch ? paymentMatch[1] : null,
  };
}

function fallbackSemanticUnderstanding(complaintText) {
  const normalized = convertDevanagariDigits(complaintText);
  const text = normalized.toLowerCase();
  const lang = detectLanguage(complaintText);
  const extracted = extractEntitiesFromText(complaintText);

  let intent = 'other/ambiguous';
  let subIntent = null;
  let sentiment = 'frustrated';
  let urgency = 'medium';
  let confidence = 50;
  const customerClaims = [complaintText.trim()];

  // 1. Security / unauthorized activity
  if (
    /\b(hack|hacked|hacking)\b|unauthorized|suspicious|log(?:ged|in|out)|password|account.*takeover|fraud|compromis|someone.*(?:using|accessing|logged).*account|koi aur login|kisi ne login|अनधिकृत|हैक|अकाउंट|सुरक्षा/i.test(text)
  ) {
    intent = 'security/unauthorized_activity';
    subIntent = 'unauthorized_login_or_access';
    sentiment = 'angry';
    urgency = 'high';
    confidence = 88;
  }
  // 2. Cancellation
  else if (/cancel|रद्द|कैंसिल|cancelling|cancellation|band kar|rok do/i.test(text)) {
    intent = 'cancellation';
    subIntent = 'order_cancellation';
    confidence = 85;
  }
  // 3. Order status / delay / in transit
  else if (
    /(?:kya\s*status|status\s*kya|where\s*is|kab\s*aayega|kab\s*tak|late|delay|in\s*transit|track|tracking)\b/i.test(text) &&
    !/(?:delivered|mila\s*nahi|not\s*received)/i.test(text)
  ) {
    intent = 'order_status/delay';
    subIntent = 'order_status_tracking';
    confidence = 85;
  }
  // 4. Delivered but not received / product issues
  else if (
    /(?:delivered|डिलीवर्ड|डिलीवर).*(?:nahi|not|never|mila|मिला|नहीं)|not received|never received|parcel.*not.*got|delivered dikha raha hai but mila nahi|पार्सल नहीं मिला|नहीं मिला/i.test(text)
  ) {
    intent = 'product_issue';
    subIntent = 'delivered_not_received';
    sentiment = 'angry';
    urgency = 'high';
    confidence = 85;
  } else if (/damage|broken|kharab|tuta|खराब|टूटा|defective|faulty|quality.*bekaar|bekaar/i.test(text)) {
    intent = 'product_issue';
    subIntent = 'damaged_product';
    confidence = 82;
  } else if (/wrong|galat|different item|गलत/i.test(text)) {
    intent = 'product_issue';
    subIntent = 'wrong_product';
    confidence = 82;
  }
  // 5. Refund / return
  else if (/refund|रिफंड|wapas.*paise|money back|return/i.test(text)) {
    intent = 'refund/return';
    subIntent = 'refund_status_delay';
    urgency = 'high';
    confidence = 85;
  }
  // 6. Duplicate payment / billing / deduction
  else if (
    /twice|duplicate|double|2\s*baar|do\s*baar|दो\s*बार/i.test(text) &&
    /pay|charged|debit|kat|कट गया|कट गयी|कट गए|पेमेंट|deduct/i.test(text)
  ) {
    intent = 'payment/billing';
    subIntent = 'duplicate_payment';
    sentiment = 'angry';
    urgency = 'high';
    confidence = 90;
  } else if (
    /kat\s*g|कट गया|कट गए|debit.*failed|money deducted|amount deducted|order nahi bana|order not placed|ऑर्डर कन्फर्म नहीं|deduct/i.test(text) &&
    /pay|कट|debit|paise|पैसे|खाते/i.test(text)
  ) {
    intent = 'payment/billing';
    subIntent = 'failed_payment';
    urgency = 'high';
    confidence = 85;
  } else if (/pay|payment|billing|पेमेंट|पैसे/i.test(text)) {
    intent = 'payment/billing';
    subIntent = 'general_payment_query';
    confidence = 65;
  }

  return validateAndFormatUnderstanding(
    {
      intent,
      subIntent,
      language: lang,
      sentiment,
      urgency,
      orderReference: extracted.orderReference,
      paymentReference: extracted.paymentReference,
      refundReference: null,
      amount: extracted.amount,
      dates: [],
      customerClaims,
      confidence,
    },
    complaintText,
    'fallback'
  );
}

function validateAndFormatUnderstanding(raw, complaintText, source = 'ai') {
  let intent = raw.intent;
  // Normalize intent synonyms
  if (intent === 'payment' || intent === 'billing') intent = 'payment/billing';
  if (intent === 'refund' || intent === 'return') intent = 'refund/return';
  if (intent === 'delivery' || intent === 'product_quality') intent = 'product_issue';
  if (intent === 'account') intent = 'security/unauthorized_activity';

  if (!VALID_TOP_LEVEL_INTENTS.includes(intent)) {
    intent = 'other/ambiguous';
  }

  const sentiment = ['calm', 'frustrated', 'angry'].includes(raw.sentiment) ? raw.sentiment : 'frustrated';
  const urgency = ['low', 'medium', 'high'].includes(raw.urgency) ? raw.urgency : 'medium';
  const confidence = typeof raw.confidence === 'number' && !isNaN(raw.confidence)
    ? Math.max(0, Math.min(100, Math.round(raw.confidence)))
    : (intent === 'other/ambiguous' ? 40 : 80);

  const lang = raw.language || detectLanguage(complaintText);
  const fallbackExtracted = extractEntitiesFromText(complaintText);

  const orderReference = raw.orderReference
    ? convertDevanagariDigits(String(raw.orderReference).trim().replace(/^ORDER\s*#?/i, ''))
    : fallbackExtracted.orderReference;

  const paymentReference = raw.paymentReference || fallbackExtracted.paymentReference || null;
  const amount = typeof raw.amount === 'number' ? raw.amount : fallbackExtracted.amount;
  const subIntent = raw.subIntent || null;
  const customerClaims = Array.isArray(raw.customerClaims) && raw.customerClaims.length > 0
    ? raw.customerClaims
    : [complaintText.trim()];

  return {
    intent,
    subIntent,
    language: lang,
    detectedLanguage: lang,
    sentiment,
    urgency,
    orderReference,
    paymentReference,
    refundReference: raw.refundReference || null,
    amount,
    dates: Array.isArray(raw.dates) ? raw.dates : [],
    customerClaims,
    confidence,
    intentSummary: `${intent}${subIntent ? ` - ${subIntent}` : ''}: ${customerClaims[0].slice(0, 80)}`,
    source,
    entities: {
      orderReferences: orderReference ? [orderReference] : [],
      paymentReferences: paymentReference ? [paymentReference] : [],
      amounts: amount ? [amount] : [],
      dates: Array.isArray(raw.dates) ? raw.dates : [],
    },
  };
}

async function analyzeComplaint(complaintText) {
  const prompt = `You are the Semantic Understanding Engine of an AI customer support investigation system.
The customer complaint may be in English, Hindi (Devanagari), Hinglish (Hindi written in Latin script), or mixed language. Text may contain typos, slang, missing punctuation, or colloquialisms.

Analyze the complaint and classify it into one of these strict top-level intents:
- "payment/billing": billing, duplicate charges, amount debited but order failed, unauthorized charges
- "refund/return": refund delayed, refund status, return refund pending, return request
- "cancellation": order cancellation query or cancellation status
- "product_issue": damaged product, poor quality, wrong product, delivered but not received
- "order_status/delay": tracking status, where is my order, shipping delay
- "security/unauthorized_activity": suspicious login, hacked account, unauthorized device/location access
- "other/ambiguous": unclear, unsupported, or out-of-scope text (e.g. sponsorship, greetings)

Return ONLY a valid JSON object with this exact structure:
{
  "intent": "payment/billing" | "refund/return" | "cancellation" | "product_issue" | "order_status/delay" | "security/unauthorized_activity" | "other/ambiguous",
  "subIntent": "short_snake_case_string_describing_specific_subtype",
  "language": "en" | "hi" | "hinglish" | "mixed",
  "sentiment": "calm" | "frustrated" | "angry",
  "urgency": "low" | "medium" | "high",
  "orderReference": "order id or number mentioned (e.g. '456', 'ORDER789') or null",
  "amount": numeric amount if mentioned or null,
  "dates": ["dates mentioned or empty array"],
  "customerClaims": ["concise bullet points of factual claims customer is making"],
  "confidence": <integer between 0 and 100 representing classification confidence>
}

Customer complaint:
"""${complaintText}"""
`;

  try {
    const raw = await generateJSON(prompt);
    return validateAndFormatUnderstanding(raw, complaintText, 'ai');
  } catch (err) {
    console.warn('[intentEngine] AI understanding failed or skipped, running semantic fallback:', err.message);
    return fallbackSemanticUnderstanding(complaintText);
  }
}

module.exports = {
  analyzeComplaint,
  detectLanguage,
  extractEntitiesFromText,
  fallbackSemanticUnderstanding,
  convertDevanagariDigits,
};
