# 🚀 Full-Stack Deployment Guide: Render & Vercel

Follow these exact steps in order to deploy the **Gmail AI Assistant** from scratch.

---

## 📋 Overview of Deployment Architecture

* **Backend**: Node.js / Express deployed on **Render** (Root: `backend`)
* **Frontend**: Static HTML/CSS/JS deployed on **Vercel** (Root: `frontend`)
* **OAuth**: Server-side Google OAuth 2.0 flow via Google Cloud Console
* **Sessions**: Persistent SQLite session store (`connect-sqlite3`) to survive Render restarts
* **AI**: Google Gemini API via `@google/generative-ai`

---

## ✅ STEP 1 — Session Store & CORS Setup (Completed)

> [!NOTE]
> This step has already been implemented in the codebase and pushed to GitHub.

* In-memory `express-session` was replaced with `connect-sqlite3` (`SQLiteStore`) in [`backend/server.js`](file:///backend/server.js).
* Session data is saved to a persistent SQLite database in `backend/data/sessions.sqlite`, ensuring OAuth states and user logins survive Render server restarts and redeployments.
* Cross-domain cookies (`sameSite: 'none'`, `secure: true` in production) and CORS origin restrictions are configured.

---

## 🌐 STEP 2 — Deploy Backend to Render

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
2. Connect your GitHub repository: `Ramcharan-40/gmail-ai-assistant`.
3. Configure the Web Service settings:
   - **Name**: `gmail-ai-assistant-backend` (or your chosen name)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Under **Environment Variables**, add the following keys:

| Environment Variable | Value / Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `GOOGLE_CLIENT_ID` | Your Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://<YOUR-RENDER-NAME>.onrender.com/auth/callback` |
| `GEMINI_API_KEY` | Your Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `SESSION_SECRET` | A secure random 32+ character string |
| `FRONTEND_URL` | *(Leave empty for now — you will set this in Step 4 once Vercel is deployed)* |

5. Click **Create Web Service**.
6. **Copy and save your live Render backend URL** (e.g. `https://gmail-ai-assistant-backend.onrender.com`).
   > ⚠️ **Important**: Do not delete or recreate this service later without updating all references in Google OAuth, `config.js`, and CORS.

---

## ⚡ STEP 3 — Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository `Ramcharan-40/gmail-ai-assistant`.
2. Configure Project:
   - **Framework Preset**: `Other` (Static HTML/JS, no build step needed)
   - **Root Directory**: Click *Edit* and select **`frontend`**
3. Click **Deploy**.
4. Once deployed, note down your assigned Vercel URL (e.g. `https://gmail-ai-assistant.vercel.app`).
5. Open [`frontend/config.js`](file:///frontend/config.js) locally and set `window.BACKEND_URL` to your exact Render URL from Step 2 (no trailing slash):
   ```javascript
   window.BACKEND_URL = "https://<YOUR-RENDER-NAME>.onrender.com";
   ```
6. Commit and push the updated config to GitHub:
   ```powershell
   git add frontend/config.js
   git commit -m "Set production Render backend URL in config.js"
   git push origin main
   ```
7. Vercel will automatically redeploy the updated frontend.

---

## 🔄 STEP 4 — Update Render Environment Variables

1. Go back to [Render Dashboard](https://dashboard.render.com/) ➔ your backend Web Service ➔ **Environment**.
2. Set `FRONTEND_URL` to your exact Vercel URL from Step 3 (no trailing slash):
   ```env
   FRONTEND_URL=https://<YOUR-VERCEL-APP>.vercel.app
   ```
3. Save changes. Render will trigger an automatic redeployment.

---

## 🔑 STEP 5 — Configure Google Cloud OAuth for Production

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Click to edit your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, add your production callback:
   - `http://localhost:3001/auth/callback` (for local development)
   - `https://<YOUR-RENDER-NAME>.onrender.com/auth/callback` (production)
4. > [!IMPORTANT]
   > **Do NOT add `.vercel.app` or `.onrender.com` to "Authorized JavaScript origins" or Google's "Authorized domains" list.**
   > Public suffix subdomains will be rejected with *"domains do not comply with Google's requirements."* Because our app uses a server-side OAuth redirect flow, only the Render redirect URI is required.
5. Under **OAuth consent screen** ➔ **Audience / Test users**:
   - Ensure the app Publishing Status is **Testing**.
   - Add test user email: `s3files01@gmail.com`
6. Click **Save**.

---

## 🔒 STEP 6 — Verify CORS & Security (Built-in)

[`backend/server.js`](file:///backend/server.js) dynamically validates incoming origins against `allowedOrigins` (`FRONTEND_URL`, `localhost:3001`):
* In production (`NODE_ENV=production`), unauthorized cross-origins are rejected.
* `credentials: true` enables secure HTTP-only cookies across domains.

---

## 🍪 STEP 7 — Verify Cross-Domain Session Cookie (Built-in)

The session cookie configuration in [`backend/server.js`](file:///backend/server.js) handles cross-domain authentication between Vercel and Render:
* `cookie.secure = true` (enforced via HTTPS on Render).
* `cookie.sameSite = 'none'` (required for cross-origin authentication from Vercel to Render).
* `app.set('trust proxy', 1)` enables reverse-proxy header recognition.

---

## 🧪 STEP 8 — End-to-End Verification Checklist

Test the complete live flow once all steps are complete:

- [ ] **Landing Page**: Visit `https://<YOUR-VERCEL-APP>.vercel.app` — verify landing page renders cleanly without 401 redirect loops.
- [ ] **Google Sign-In**: Click **Continue with Google** — verify redirect to Google consent screen.
- [ ] **Authentication**: Sign in using `s3files01@gmail.com` — verify redirect to `dashboard.html`.
- [ ] **Session Persistence**: Refresh `dashboard.html` — verify session remains active and user profile displays.
- [ ] **Email Features**: Fetch inbox, summarize an email with Gemini AI, and generate a smart reply.
- [ ] **Sign Out**: Click the user pill to log out — verify session is destroyed and redirected to landing page.

---

> ⚠️ **Important Reminder**: Do not delete or rename your Render Web Service or Vercel Project after deployment without updating Google Cloud credentials and `frontend/config.js`.
