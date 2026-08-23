/**
 * Auth Middleware — ensures a valid session before accessing protected routes
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated. Please sign in with Google.' });
  }
  next();
}

module.exports = { requireAuth };
