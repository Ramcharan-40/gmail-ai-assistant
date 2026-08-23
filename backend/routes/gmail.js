const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const gmailService = require('../services/gmailService');

const router = express.Router();

// All Gmail routes require auth
router.use(requireAuth);

/**
 * GET /api/emails
 * Query: pageToken, maxResults, label, q (search)
 */
router.get('/', async (req, res) => {
  try {
    const { pageToken, maxResults = 20, label = 'INBOX', q } = req.query;
    const labelIds = label === 'STARRED' ? ['STARRED']
      : label === 'SENT' ? ['SENT']
      : label === 'TRASH' ? ['TRASH']
      : label === 'ARCHIVE' ? []
      : ['INBOX'];

    const result = await gmailService.listEmails(req.session.tokens, {
      pageToken,
      maxResults: parseInt(maxResults),
      labelIds,
      q,
    });
    res.json(result);
  } catch (err) {
    console.error('List emails error:', err.message);
    res.status(500).json({ error: 'Failed to fetch emails.' });
  }
});

/**
 * GET /api/emails/search
 * Query: q
 */
router.get('/search', async (req, res) => {
  try {
    const { q, pageToken } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query required' });

    const result = await gmailService.listEmails(req.session.tokens, { q, pageToken });
    res.json(result);
  } catch (err) {
    console.error('Search emails error:', err.message);
    res.status(500).json({ error: 'Search failed.' });
  }
});

/**
 * GET /api/emails/:id
 * Get full email + thread
 */
router.get('/:id', async (req, res) => {
  try {
    const email = await gmailService.getEmail(req.session.tokens, req.params.id);

    // Auto mark as read when opened
    if (email.isUnread) {
      await gmailService.toggleRead(req.session.tokens, req.params.id, true);
      email.isUnread = false;
    }

    res.json(email);
  } catch (err) {
    console.error('Get email error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email.' });
  }
});

/**
 * PATCH /api/emails/:id/read
 * Body: { read: true|false }
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { read } = req.body;
    await gmailService.toggleRead(req.session.tokens, req.params.id, read);
    res.json({ success: true, read });
  } catch (err) {
    console.error('Toggle read error:', err.message);
    res.status(500).json({ error: 'Failed to update read status.' });
  }
});

/**
 * PATCH /api/emails/:id/star
 * Body: { starred: true|false }
 */
router.patch('/:id/star', async (req, res) => {
  try {
    const { starred } = req.body;
    await gmailService.toggleStar(req.session.tokens, req.params.id, starred);
    res.json({ success: true, starred });
  } catch (err) {
    console.error('Toggle star error:', err.message);
    res.status(500).json({ error: 'Failed to update star.' });
  }
});

/**
 * PATCH /api/emails/:id/archive
 */
router.patch('/:id/archive', async (req, res) => {
  try {
    await gmailService.archiveEmail(req.session.tokens, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Archive error:', err.message);
    res.status(500).json({ error: 'Failed to archive.' });
  }
});

/**
 * DELETE /api/emails/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await gmailService.trashEmail(req.session.tokens, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Trash error:', err.message);
    res.status(500).json({ error: 'Failed to delete email.' });
  }
});

/**
 * POST /api/emails/send
 * Body: { to, cc, subject, body }
 */
router.post('/send', async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required.' });
    }
    const result = await gmailService.sendEmail(req.session.tokens, { to, cc, subject, body });
    res.json({ success: true, messageId: result.id });
  } catch (err) {
    console.error('Send email error:', err.message);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

/**
 * POST /api/emails/:id/reply
 * Body: { body }
 */
router.post('/:id/reply', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'Reply body is required.' });

    const result = await gmailService.sendReply(req.session.tokens, req.params.id, { body });
    res.json({ success: true, messageId: result.id });
  } catch (err) {
    console.error('Reply error:', err.message);
    res.status(500).json({ error: 'Failed to send reply.' });
  }
});

module.exports = router;
