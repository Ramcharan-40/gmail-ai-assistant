const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');

const router = express.Router();

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * GET /auth/google
 * Redirect user to Google OAuth consent screen with cryptographic CSRF state token
 */
router.get('/google', (req, res) => {
  const oAuth2Client = createOAuth2Client();

  // Generate cryptographically secure state token to prevent CSRF
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state,
    include_granted_scopes: true,
  });

  res.redirect(authUrl);
});

function getFrontendBase() {
  return (process.env.FRONTEND_URL || '').replace(/\/$/, '');
}

/**
 * GET /auth/callback
 * Handle OAuth callback with CSRF state verification & session fixation protection
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = getFrontendBase();

  if (error) {
    console.warn('OAuth authorization error returned from Google:', error);
    return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Authentication was cancelled or failed.'));
  }

  // 1. Verify CSRF state token
  if (!state || !req.session.oauthState || state !== req.session.oauthState) {
    console.error('CSRF state token mismatch in OAuth callback.');
    return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Security validation failed: invalid state token. Please try again.'));
  }

  // Clear state token once validated
  delete req.session.oauthState;

  if (!code) {
    return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('No authorization code provided.'));
  }

  try {
    const oAuth2Client = createOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Fetch user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const userInfo = await oauth2.userinfo.get();

    // 2. Protect against Session Fixation: Regenerate session ID upon successful auth
    const userPayload = {
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
    };

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Session initialization error.'));
      }

      req.session.tokens = tokens;
      req.session.user = userPayload;
      res.redirect(`${frontendBase}/dashboard.html`);
    });
  } catch (err) {
    console.error('OAuth token exchange error:', err.message);
    res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Failed to authenticate with Google. Please try again.'));
  }
});

/**
 * POST /auth/logout
 * Clear session securely
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

/**
 * GET /auth/me
 * Return current session user info (credentials & tokens never exposed to frontend)
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: req.session.user,
  });
});

module.exports = router;
