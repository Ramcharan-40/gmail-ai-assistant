const { google } = require('googleapis');

/**
 * Create an authenticated Gmail API client from session tokens
 */
function createGmailClient(tokens) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

/**
 * Parse email headers into a convenient object
 */
function parseHeaders(headers = []) {
  const map = {};
  headers.forEach(h => { map[h.name.toLowerCase()] = h.value; });
  return map;
}

/**
 * Recursively extract body from payload (handles multipart)
 */
function extractBody(payload) {
  if (!payload) return { html: '', text: '' };

  // Simple message
  if (payload.body && payload.body.data) {
    const content = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    if (payload.mimeType === 'text/html') return { html: content, text: '' };
    return { html: '', text: content };
  }

  // Multipart
  if (payload.parts) {
    let html = '';
    let text = '';

    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        text = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType && part.mimeType.startsWith('multipart/')) {
        const nested = extractBody(part);
        if (!html && nested.html) html = nested.html;
        if (!text && nested.text) text = nested.text;
      }
    }
    return { html, text };
  }

  return { html: '', text: '' };
}

/**
 * Format a raw Gmail message into a clean object
 */
function formatMessage(msg, includeFull = false) {
  const headers = parseHeaders(msg.payload?.headers);
  const { html, text } = includeFull ? extractBody(msg.payload) : { html: '', text: '' };

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headers['from'] || '',
    to: headers['to'] || '',
    cc: headers['cc'] || '',
    subject: headers['subject'] || '(no subject)',
    date: headers['date'] || '',
    snippet: msg.snippet || '',
    body: html || text,
    bodyText: text,
    messageId: headers['message-id'] || '',
    references: headers['references'] || '',
    inReplyTo: headers['in-reply-to'] || '',
    isUnread: (msg.labelIds || []).includes('UNREAD'),
    isStarred: (msg.labelIds || []).includes('STARRED'),
    isImportant: (msg.labelIds || []).includes('IMPORTANT'),
    labelIds: msg.labelIds || [],
  };
}

/**
 * List emails from inbox (or any label)
 */
async function listEmails(tokens, { pageToken, maxResults = 20, labelIds = ['INBOX'], q = '' } = {}) {
  const gmail = createGmailClient(tokens);

  const params = { userId: 'me', maxResults, labelIds };
  if (pageToken) params.pageToken = pageToken;
  if (q) { params.q = q; delete params.labelIds; }

  const listRes = await gmail.users.messages.list(params);
  const messages = listRes.data.messages || [];

  if (messages.length === 0) {
    return { emails: [], nextPageToken: null };
  }

  // Batch fetch message metadata safely
  const emailResults = await Promise.all(
    messages.map(({ id }) =>
      gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      }).then(r => formatMessage(r.data))
        .catch(err => {
          console.warn(`Failed to fetch message metadata for ${id}:`, err.message);
          return null;
        })
    )
  );

  const emails = emailResults.filter(Boolean);

  return { emails, nextPageToken: listRes.data.nextPageToken || null };
}

/**
 * Get a full email with body and thread context
 */
async function getEmail(tokens, messageId) {
  const gmail = createGmailClient(tokens);

  const msgRes = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const email = formatMessage(msgRes.data, true);

  // Fetch thread messages (limited to 10)
  const threadRes = await gmail.users.threads.get({
    userId: 'me',
    id: msgRes.data.threadId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  });

  email.thread = (threadRes.data.messages || []).map(m => formatMessage(m));

  return email;
}

/**
 * Toggle read/unread state
 */
async function toggleRead(tokens, messageId, markAsRead) {
  const gmail = createGmailClient(tokens);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: markAsRead ? [] : ['UNREAD'],
      removeLabelIds: markAsRead ? ['UNREAD'] : [],
    },
  });
}

/**
 * Toggle star
 */
async function toggleStar(tokens, messageId, star) {
  const gmail = createGmailClient(tokens);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: star ? ['STARRED'] : [],
      removeLabelIds: star ? [] : ['STARRED'],
    },
  });
}

/**
 * Archive an email (remove INBOX label)
 */
async function archiveEmail(tokens, messageId) {
  const gmail = createGmailClient(tokens);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['INBOX'] },
  });
}

/**
 * Move email to trash
 */
async function trashEmail(tokens, messageId) {
  const gmail = createGmailClient(tokens);
  await gmail.users.messages.trash({ userId: 'me', id: messageId });
}

/**
 * Build a base64url-encoded RFC 2822 email
 */
function buildRawEmail({ to, cc, subject, body, inReplyTo, references, fromName, fromEmail }) {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    '',
    body,
  ].filter(l => l !== null);

  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

/**
 * Send a new email
 */
async function sendEmail(tokens, { to, cc, subject, body }) {
  const gmail = createGmailClient(tokens);
  const raw = buildRawEmail({ to, cc, subject, body });
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return res.data;
}

/**
 * Send a reply to an existing email thread
 */
async function sendReply(tokens, messageId, { body }) {
  const gmail = createGmailClient(tokens);

  // Fetch original for headers
  const original = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Message-ID', 'References'],
  });

  const headers = parseHeaders(original.data.payload?.headers || []);
  const replySubject = headers['subject']?.startsWith('Re:')
    ? headers['subject']
    : `Re: ${headers['subject']}`;

  const raw = buildRawEmail({
    to: headers['from'],
    subject: replySubject,
    body,
    inReplyTo: headers['message-id'],
    references: `${headers['references'] || ''} ${headers['message-id']}`.trim(),
  });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: original.data.threadId },
  });
  return res.data;
}

/**
 * Get user profile
 */
async function getUserProfile(tokens) {
  const gmail = createGmailClient(tokens);
  const res = await gmail.users.getProfile({ userId: 'me' });
  return res.data;
}

module.exports = {
  listEmails,
  getEmail,
  toggleRead,
  toggleStar,
  archiveEmail,
  trashEmail,
  sendEmail,
  sendReply,
  getUserProfile,
};
