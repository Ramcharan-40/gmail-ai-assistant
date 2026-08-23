const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const aiService = require('../services/aiService');

const router = express.Router();

// All AI routes require auth
router.use(requireAuth);

/**
 * POST /api/ai/summarize
 * Body: { subject, from, body }
 */
router.post('/summarize', async (req, res) => {
  try {
    const { subject, from, body } = req.body;
    if (!body) return res.status(400).json({ error: 'Email body is required' });

    const summary = await aiService.summarizeEmail({ subject, from, body });
    res.json({ summary });
  } catch (err) {
    console.error('AI summarize error:', err.message);
    res.status(500).json({ error: 'Failed to summarize email. Check your Gemini API key.' });
  }
});

/**
 * POST /api/ai/reply
 * Body: { subject, from, body, tone? }
 */
router.post('/reply', async (req, res) => {
  try {
    const { subject, from, body, tone = 'professional' } = req.body;
    if (!body) return res.status(400).json({ error: 'Email body is required' });

    const reply = await aiService.generateReply({ subject, from, body, tone });
    res.json({ reply });
  } catch (err) {
    console.error('AI reply error:', err.message);
    res.status(500).json({ error: 'Failed to generate reply.' });
  }
});

/**
 * POST /api/ai/classify
 * Body: { subject, from, body }
 */
router.post('/classify', async (req, res) => {
  try {
    const { subject, from, body } = req.body;
    if (!body) return res.status(400).json({ error: 'Email body is required' });

    const classification = await aiService.classifyEmail({ subject, from, body });
    res.json(classification);
  } catch (err) {
    console.error('AI classify error:', err.message);
    res.status(500).json({ error: 'Failed to classify email.' });
  }
});

/**
 * POST /api/ai/subject
 * Body: { body }
 */
router.post('/subject', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'Email body is required' });

    const subject = await aiService.generateSubject({ body });
    res.json({ subject });
  } catch (err) {
    console.error('AI subject error:', err.message);
    res.status(500).json({ error: 'Failed to generate subject.' });
  }
});

module.exports = router;
