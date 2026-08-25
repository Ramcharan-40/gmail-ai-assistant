# 🚀 Full-Stack Deployment Guide: Render & Vercel

Follow these exact steps to complete the deployment of the **Gmail AI Assistant**.

---

## 📋 Live Architecture & Configuration

* **Backend Service**: Deployed on **Render**
  - **Live URL**: `https://gmail-ai-assistant-d1b6.onrender.com`
  - **Root Directory**: `backend`
  - **Start Command**: `npm start`
  - **Health Check**: `https://gmail-ai-assistant-d1b6.onrender.com/api/health`
* **Frontend**: Deploying to **Vercel**
  - **Root Directory**: `frontend`
  - **Framework Preset**: `Other` (Static HTML/JS)
  - **Backend Config**: Configured in [`frontend/config.js`](file:///frontend/config.js)
* **Google OAuth**: Project `gmail-ai-assistant-v2-506417`
  - **Redirect URI**: `https://gmail-ai-assistant-d1b6.onrender.com/auth/callback`
  - **Test User**: `s3files01@gmail.com`

---

## ✅ STEP 1 — Session Store & CORS Setup (Completed)

* Persistent session management with `connect-sqlite3` configured in [`backend/server.js`](file:///backend/server.js).
* Session data is saved to `backend/data/sessions.sqlite`, surviving Render redeployments and restarts.
* Cross-origin cookies (`sameSite: 'none'`, `secure: true`) configured for Vercel ➔ Render communication.

---

## ✅ STEP 2 — Backend Deployed on Render (Completed)

Your backend is live at:
```
https://gmail-ai-assistant-d1b6.onrender.com
```

Ensure your Render **Environment Variables** are set as follows:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `GOOGLE_CLIENT_ID` | `487566808012-gu0g2o262qmj8dpe56vh6mlvnavnk717.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | *Your Google Client Secret* |
| `GOOGLE_REDIRECT_URI` | `https://gmail-ai-assistant-d1b6.onrender.com/auth/callback` |
| `GEMINI_API_KEY` | *Your Gemini API Key* |
| `SESSION_SECRET` | *Your Session Secret string* |
| `FRONTEND_URL` | *Your Vercel URL (set after Step 3)* |

---

## ⚡ STEP 3 — Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new) and import `Ramcharan-40/gmail-ai-assistant`.
2. Configure Project:
   - **Framework Preset**: `Other` (Static HTML/CSS/JS, no build command)
   - **Root Directory**: Click *Edit* and select **`frontend`**
3. Click **Deploy**.
4. Once deployed, note down your assigned Vercel URL (e.g. `https://gmail-ai-assistant.vercel.app` or `https://gmail-ai-assistant-ramcharan.vercel.app`).
5. Verify [`frontend/config.js`](file:///frontend/config.js) has your live Render backend URL:
   ```javascript
   window.BACKEND_URL = "https://gmail-ai-assistant-d1b6.onrender.com";
   ```
   *(Already updated and committed to main!)*

---

## 🔄 STEP 4 — Set `FRONTEND_URL` on Render

1. Go to [Render Dashboard](https://dashboard.render.com/) ➔ your backend Web Service ➔ **Environment**.
2. Update `FRONTEND_URL` with your exact Vercel URL from Step 3 (no trailing slash):
   ```env
   FRONTEND_URL=https://<your-app-name>.vercel.app
   ```
3. Click **Save Changes** (Render will automatically redeploy with the new CORS origin).

---

## 🔑 STEP 5 — Complete Google Cloud OAuth Setup

1. **Fix Branding (OAuth Consent Screen)**:
   - Go to [Google Cloud Console Branding Page](https://console.cloud.google.com/auth/branding?project=gmail-ai-assistant-v2-506417).
   - Fill in:
     - **App name**: `Gmail AI Assistant`
     - **User support email**: `s3files01@gmail.com`
     - **Developer contact information**: `s3files01@gmail.com`
     - **App Home page**: `https://<your-app-name>.vercel.app` (or leave blank if still in test mode)
     - **Application privacy policy link**: `https://<your-app-name>.vercel.app/privacy.html`
     - **Application terms of service link**: `https://<your-app-name>.vercel.app/terms.html`
   - Click **Save**.

2. **Verify Audience / Test Users**:
   - Go to **Audience** tab.
   - Verify Publishing status is **Testing**.
   - Verify `s3files01@gmail.com` is in the **Test users** list.

3. **Verify Authorized Redirect URI**:
   - Go to **Clients** ➔ Click your Web Client ID.
   - In **Authorized redirect URIs**, ensure you have:
     ```
     https://gmail-ai-assistant-d1b6.onrender.com/auth/callback
     http://localhost:3001/auth/callback
     ```
   - Click **Save**.

---

## 🧪 STEP 6 — End-to-End Verification Checklist

Open your live Vercel URL in your browser:

- [ ] **1. Landing Page**: Page loads cleanly without redirect loops.
- [ ] **2. Google Sign-In**: Click **Continue with Google** ➔ Redirects to Google consent screen.
- [ ] **3. Consent**: Sign in with `s3files01@gmail.com` ➔ Redirects to `/dashboard.html`.
- [ ] **4. Dashboard**: Inbox emails load with snippets, dates, and unread badges.
- [ ] **5. AI Summarize**: Select an email ➔ Click **⚡ Summarize Email** ➔ Gemini summary generates.
- [ ] **6. AI Reply**: Select Tone ➔ Click **✍️ Generate Reply** ➔ Gemini reply drafts.
- [ ] **7. Session Persistence**: Refresh the dashboard page (`F5`) ➔ Session remains logged in.
- [ ] **8. Sign Out**: Click user pill ➔ Confirms and logs out cleanly back to landing page.

---

> ⚠️ **Important Reminder**: Do not delete or rename your Render Web Service or Vercel Project after deployment to prevent dangling subdomain and OAuth breakage.
