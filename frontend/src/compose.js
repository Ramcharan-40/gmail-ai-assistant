/**
 * compose.js — Compose modal and reply logic
 */

// ─── Toast Notifications ──────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ─── Compose Modal State ──────────────────────────────────
let composeMode = 'new'; // 'new' | 'reply'
let replyToMessageId = null;
let replyPrefill = '';

function openCompose(mode = 'new', opts = {}) {
  composeMode = mode;
  replyToMessageId = opts.messageId || null;

  const modal = document.getElementById('compose-modal');
  const title = modal.querySelector('.compose-title');

  document.getElementById('compose-to').value = opts.to || '';
  document.getElementById('compose-cc').value = opts.cc || '';
  document.getElementById('compose-subject').value = opts.subject || '';
  document.getElementById('compose-body').value = opts.body || '';

  title.textContent = mode === 'reply' ? '💬 Reply' : '✏️ New Message';

  modal.classList.add('open');
  setTimeout(() => document.getElementById('compose-body').focus(), 200);
}

function closeCompose() {
  document.getElementById('compose-modal').classList.remove('open');
  composeMode = 'new';
  replyToMessageId = null;
  document.getElementById('compose-to').value = '';
  document.getElementById('compose-cc').value = '';
  document.getElementById('compose-subject').value = '';
  document.getElementById('compose-body').value = '';
}

// ─── Event Listeners ──────────────────────────────────────
document.getElementById('compose-btn').addEventListener('click', () => openCompose('new'));
document.getElementById('compose-close').addEventListener('click', closeCompose);

document.getElementById('compose-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCompose();
});

// Send email
document.getElementById('compose-send-btn').addEventListener('click', async () => {
  const btn = document.getElementById('compose-send-btn');
  const to = document.getElementById('compose-to').value.trim();
  const cc = document.getElementById('compose-cc').value.trim();
  const subject = document.getElementById('compose-subject').value.trim();
  const body = document.getElementById('compose-body').value.trim();

  if (!to) { showToast('Please enter a recipient.', 'error'); return; }
  if (!subject) { showToast('Please enter a subject.', 'error'); return; }
  if (!body) { showToast('Please write a message.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Sending...';

  try {
    if (composeMode === 'reply' && replyToMessageId) {
      await EmailAPI.reply(replyToMessageId, body);
    } else {
      await EmailAPI.send({ to, cc, subject, body });
    }
    showToast('✅ Email sent successfully!', 'success');
    closeCompose();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Send';
  }
});

// AI Subject generation
document.getElementById('btn-ai-subject').addEventListener('click', async () => {
  const body = document.getElementById('compose-body').value.trim();
  if (!body) { showToast('Write some content first.', 'info'); return; }

  const btn = document.getElementById('btn-ai-subject');
  btn.textContent = '⏳...';
  btn.disabled = true;

  try {
    const { subject } = await AIAPI.generateSubject({ body });
    document.getElementById('compose-subject').value = subject;
    showToast('✨ Subject generated!', 'success');
  } catch (err) {
    showToast('Failed to generate subject.', 'error');
  } finally {
    btn.textContent = '✨ AI Subject';
    btn.disabled = false;
  }
});

// Export for use in dashboard.js
window.ComposeModule = { openCompose, closeCompose, showToast };
