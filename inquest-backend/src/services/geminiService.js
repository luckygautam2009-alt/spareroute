const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');

if (!config.geminiApiKey) {
  console.warn('[geminiService] Warning: GEMINI_API_KEY not set. AI calls will fail.');
}

const genAIPrimary = new GoogleGenerativeAI(config.geminiApiKey);
const genAIBackup = config.geminiApiKeyBackup
  ? new GoogleGenerativeAI(config.geminiApiKeyBackup)
  : null;

const MODEL_CHAIN = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'];
const VISION_MODEL_CHAIN = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'];

const CALL_TIMEOUT_MS = 12000;
const VISION_TIMEOUT_MS = 15000;

function isQuotaExhausted(err) {
  return /429|quota|resource_exhausted/i.test(err?.message || '');
}

function isTransientError(err) {
  return /503|overloaded|high demand/i.test(err?.message || '') || isQuotaExhausted(err);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
  ]);
}

async function tryModelChain(genAI, models, buildCall, timeoutMs) {
  let lastError;
  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      const result = await withTimeout(buildCall(model), timeoutMs);
      return result.response.text();
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError;
}

/**
 * Runs the model chain against the primary key. If every model on the
 * primary key fails due to quota exhaustion (free-tier daily limit) and a
 * backup key is configured, retries the full chain once on the backup key
 * before giving up.
 */
async function runWithKeyFallback(models, buildCall, timeoutMs) {
  try {
    return await tryModelChain(genAIPrimary, models, buildCall, timeoutMs);
  } catch (primaryErr) {
    if (isQuotaExhausted(primaryErr) && genAIBackup) {
      console.warn('[geminiService] Primary key quota exhausted — retrying with backup key');
      try {
        return await tryModelChain(genAIBackup, models, buildCall, timeoutMs);
      } catch (backupErr) {
        throw isQuotaExhausted(backupErr)
          ? new Error(`GEMINI_QUOTA_EXHAUSTED: ${backupErr.message}`)
          : backupErr;
      }
    }
    throw isQuotaExhausted(primaryErr)
      ? new Error(`GEMINI_QUOTA_EXHAUSTED: ${primaryErr.message}`)
      : primaryErr;
  }
}

async function generateContent(prompt) {
  return runWithKeyFallback(MODEL_CHAIN, (model) => model.generateContent(prompt), CALL_TIMEOUT_MS);
}

async function generateVisionContent(prompt, images) {
  const parts = [
    { text: prompt },
    ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
  ];
  return runWithKeyFallback(VISION_MODEL_CHAIN, (model) => model.generateContent(parts), VISION_TIMEOUT_MS);
}

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty response from AI model');
  }
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      let candidate = cleaned.substring(firstBrace, lastBrace + 1);
      candidate = candidate.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      try {
        return JSON.parse(candidate);
      } catch (innerErr) {
        throw initialErr;
      }
    }
    throw initialErr;
  }
}

async function generateJSON(prompt) {
  const raw = await generateContent(prompt);
  return extractJSON(raw);
}

async function generateVisionJSON(prompt, images) {
  const raw = await generateVisionContent(prompt, images);
  return extractJSON(raw);
}

module.exports = { generateContent, generateJSON, generateVisionContent, generateVisionJSON };
