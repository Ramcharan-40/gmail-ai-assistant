/**
 * Frontend Configuration — Smart Auto-Detect
 *
 * - On localhost: Automatically connects to local backend (http://localhost:3001)
 * - On Vercel / Production: Automatically connects to live Render backend
 */
const isLocalhost = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1';

window.BACKEND_URL = isLocalhost 
  ? "" 
  : "https://gmail-ai-assistant-ezgp.onrender.com";
