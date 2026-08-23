# 🚀 Deployment Guide: GitHub, Render & Vercel

Follow these steps to deploy **InboxAI** to GitHub, the backend to Render, and the frontend to Vercel.

---

## 1. Push to GitHub

The local repository is already initialized and all secret files (`.env`) are **strictly excluded**.

1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g. `gmail-ai-assistant`).
2. Run the following commands in your terminal (inside the `Gmail summerizer` folder):

```powershell
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/gmail-ai-assistant.git
git push -u origin main
```

---

## 2. Deploy Backend on Render

1. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service settings:
   - **Name**: `gmail-ai-assistant-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Scroll down to **Environment Variables** and add the following keys:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `GOOGLE_CLIENT_ID` | `your_google_client_id` |
| `GOOGLE_CLIENT_SECRET` | `your_google_client_secret` |
| `GOOGLE_REDIRECT_URI` | `https://YOUR_BACKEND_NAME.onrender.com/auth/callback` |
| `GEMINI_API_KEY` | `your_gemini_api_key` |
| `SESSION_SECRET` | `your_random_session_secret` |
| `FRONTEND_URL` | `https://YOUR_APP_NAME.vercel.app` |

5. Click **Create Web Service**.
6. Copy your live Render backend URL (e.g. `https://gmail-ai-backend.onrender.com`).

---

## 3. Deploy Frontend on Vercel

1. Open `frontend/config.js` and set your Render backend URL:
   ```javascript
   window.BACKEND_URL = "https://YOUR_BACKEND_NAME.onrender.com";
   ```
2. Commit and push this change:
   ```powershell
   git add frontend/config.js
   git commit -m "Configure production backend URL"
   git push origin main
   ```
3. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
4. In the Project Configuration:
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Framework Preset**: Other
5. Click **Deploy**.
6. Copy your live Vercel URL (e.g. `https://gmail-ai-assistant.vercel.app`).

---

## 4. Update Google Cloud OAuth Credentials

Now connect your live domains in Google Cloud:

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Click on your **OAuth 2.0 Client ID**.
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3001`
   - `https://YOUR_APP_NAME.vercel.app`
   - `https://YOUR_BACKEND_NAME.onrender.com`
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:3001/auth/callback`
   - `https://YOUR_BACKEND_NAME.onrender.com/auth/callback`
5. Click **Save**.

---

## 5. Update Backend `FRONTEND_URL` on Render

1. Go back to Render ➔ your Web Service ➔ **Environment**.
2. Ensure `FRONTEND_URL` is set to your exact Vercel URL (e.g. `https://gmail-ai-assistant.vercel.app`).
3. Render will automatically redeploy.

---

### 🎉 Your App is Live and Secure!
