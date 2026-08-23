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

function getFrontendBase() {
  return (process.env.FRONTEND_URL || '').replace(/\/$/, '');
}

/**
 * GET /auth/google
 * Redirect user to Google OAuth consent screen
 */
router.get('/google', (req, res) => {
  const oAuth2Client = createOAuth2Client();

  // Generate state token for CSRF defense
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  // Crucial: Save session before redirecting so session cookie is committed
  req.session.save((err) => {
    if (err) {
      console.error('Session save error on /auth/google:', err);
    }
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: state,
      include_granted_scopes: true,
    });
    res.redirect(authUrl);
  });
});

/**
 * GET /auth/callback
 * Handle OAuth callback, exchange code for tokens, save session
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = getFrontendBase();

  if (error) {
    console.warn('OAuth authorization error returned from Google:', error);
    return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Authentication was cancelled or failed.'));
  }

  if (!code) {
    return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('No authorization code provided.'));
  }

  // Verify CSRF state if session has it (soft warning if session restarted)
  if (state && req.session.oauthState && state !== req.session.oauthState) {
    console.warn('Warning: State parameter mismatch during OAuth callback.');
  }
  delete req.session.oauthState;

  try {
    const oAuth2Client = createOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Fetch user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const userInfo = await oauth2.userinfo.get();

    const userPayload = {
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
    };

    req.session.tokens = tokens;
    req.session.user = userPayload;

    // Crucial: Save session before redirecting to dashboard
    req.session.save((err) => {
      if (err) {
        console.error('Session save error on /auth/callback:', err);
        return res.redirect(`${frontendBase}/?error=` + encodeURIComponent('Session initialization error.'));
      }
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
 * Return current session user info
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
