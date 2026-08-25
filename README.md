# 📧 InboxMate — AI-Powered Gmail Assistant

An intelligent email management application that connects to Gmail via OAuth and uses Google Gemini AI to summarize emails, generate smart replies, and classify your inbox.

## ✨ Features

- **Gmail OAuth** — Secure login with Google (no passwords stored)
- **Email Dashboard** — View, read, and manage your inbox
- **Email Threads** — See full conversation context
- **Email Search** — Search across your Gmail
- **Email Management** — Star, archive, mark read/unread, delete
- **AI Summarization** — Get 2-3 sentence summaries of any email
- **AI Reply Generation** — Generate professional replies with tone selection
- **AI Classification** — Detect priority, category, spam, and action items
- **AI Subject Line** — Generate subject lines for new emails
- **Email Composition** — Compose and send new emails
- **Reply Sending** — Send AI-generated or custom replies

---

## 🚀 Setup Instructions

### 1. Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- A Google account
- A Google Cloud project

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - APIs & Services → Library → Search "Gmail API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3001/auth/callback`
   - Save your **Client ID** and **Client Secret**
5. Configure OAuth consent screen:
   - Add your email as a test user
   - Add scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

### 3. Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create an API key
3. Copy it

### 4. Configure Environment Variables

```bash
cd backend
copy .env.example .env
```

Edit `.env` and fill in your values:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/callback
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=any_long_random_string_here
PORT=3001
```

### 5. Install Dependencies

```bash
cd backend
npm install
```

### 6. Run the App

```bash
npm run dev
```

Open your browser at **http://localhost:3001**

---

## 📁 Project Structure

```
Gmail summerizer/
├── backend/
│   ├── server.js              # Express entry point
│   ├── package.json
│   ├── .env.example           # Template (copy to .env)
│   ├── routes/
│   │   ├── auth.js            # OAuth routes
│   │   ├── gmail.js           # Gmail API routes
│   │   └── ai.js              # Gemini AI routes
│   ├── middleware/
│   │   └── authMiddleware.js  # Session protection
│   └── services/
│       ├── gmailService.js    # Gmail API wrapper
│       └── aiService.js       # Gemini AI wrapper
├── frontend/
│   ├── index.html             # Landing / Login page
│   ├── dashboard.html         # Email dashboard
│   ├── style.css              # Full design system
│   └── src/
│       ├── api.js             # Frontend API client
│       ├── dashboard.js       # Dashboard logic
│       └── compose.js         # Compose modal
├── .gitignore
└── README.md
```

---

## 🔐 Security

- OAuth tokens are stored **server-side only** (session) — never exposed to the browser
- All Gmail API calls are proxied through the backend
- `.env` file is excluded from git via `.gitignore`
- Helmet.js provides security headers
- Sessions use httpOnly cookies

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Auth | Google OAuth 2.0 |
| Email | Gmail API (googleapis) |
| AI | Google Gemini 1.5 Flash |
| Session | express-session |
| Frontend | Vanilla HTML/CSS/JS |
| Design | Dark Glassmorphism |
