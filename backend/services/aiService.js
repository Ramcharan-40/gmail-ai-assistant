const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || !apiKey.startsWith('AIza')) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY appears invalid or missing.');
  console.warn('   Get a valid key at https://aistudio.google.com/apikey');
  console.warn('   Valid keys start with "AIza..."');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Candidate models in preference order with fallback
const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-flash-latest'
];

/**
 * Robust generation with candidate fallbacks and retry on transient 503/429 errors
 */
async function generateWithFallback(prompt) {
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1beta' });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelName} failed (${err.message}). Trying fallback model...`);
      // If 503 or 429, wait 500ms before next candidate
      await new Promise(r => setTimeout(r, 500));
    }
  }

  throw lastError || new Error('All AI models failed to generate content.');
}

/**
 * Summarize an email body into 2-3 concise sentences
 */
async function summarizeEmail({ subject, from, body }) {
  const prompt = `You are an AI email assistant. Summarize the following email concisely in 2-3 sentences. 
Highlight any key action items, deadlines, or important information.

From: ${from}
Subject: ${subject}

Email Content:
${body.substring(0, 8000)}

Provide a clear, concise summary:`;

  return await generateWithFallback(prompt);
}

/**
 * Generate a smart reply to an email
 */
async function generateReply({ subject, from, body, tone = 'professional' }) {
  const toneGuide = {
    professional: 'Write in a professional and formal tone.',
    friendly: 'Write in a warm, friendly, and approachable tone.',
    concise: 'Write a very brief and to-the-point reply.',
    formal: 'Write in a highly formal and structured tone.',
  };

  const prompt = `You are an AI email assistant. Generate a helpful reply to the following email.
${toneGuide[tone] || toneGuide.professional}
Keep the reply focused and relevant. Do not include a subject line. Start directly with the greeting.

Original email from: ${from}
Subject: ${subject}

Email Content:
${body.substring(0, 6000)}

Generate a reply:`;

  return await generateWithFallback(prompt);
}

/**
 * Classify an email: priority level + category + spam detection
 */
async function classifyEmail({ subject, from, body }) {
  const prompt = `Analyze this email and respond ONLY with a JSON object (no markdown, no code blocks).

From: ${from}
Subject: ${subject}
Body: ${body.substring(0, 3000)}

Respond with exactly this JSON format:
{
  "priority": "high" | "medium" | "low",
  "category": "Work" | "Personal" | "Finance" | "Newsletter" | "Promotional" | "Social" | "Support" | "Other",
  "isSpam": true | false,
  "isImportant": true | false,
  "actionRequired": true | false,
  "summary": "one sentence description"
}`;

  try {
    const text = await generateWithFallback(prompt);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      priority: 'medium',
      category: 'Other',
      isSpam: false,
      isImportant: false,
      actionRequired: false,
      summary: 'Could not classify this email.',
    };
  }
}

/**
 * Generate a subject line for a new email body
 */
async function generateSubject({ body }) {
  const prompt = `Generate a concise, professional email subject line for the following email body. 
Return ONLY the subject line text, nothing else.

Email body:
${body.substring(0, 2000)}

Subject line:`;

  return await generateWithFallback(prompt);
}

module.exports = { summarizeEmail, generateReply, classifyEmail, generateSubject };
