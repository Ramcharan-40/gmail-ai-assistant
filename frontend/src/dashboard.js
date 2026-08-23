/**
 * dashboard.js — Main email dashboard logic
 */

// ─── State ────────────────────────────────────────────────
const state = {
  currentLabel: 'INBOX',
  emails: [],
  selectedEmail: null,
  nextPageToken: null,
  loading: false,
  searchTimeout: null,
  currentTone: 'professional',
  aiOpen: true,
};

// ─── DOM Helpers ──────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (el) => el instanceof Element ? el.classList.remove('hidden') : $(el)?.classList.remove('hidden');
const hide = (el) => el instanceof Element ? el.classList.add('hidden') : $(el)?.classList.add('hidden');

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  } catch { return dateStr; }
}

function extractName(fromStr) {
  if (!fromStr) return '?';
  const match = fromStr.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : fromStr.split('@')[0];
}

function getInitial(fromStr) {
  const name = extractName(fromStr);
  return name.charAt(0).toUpperCase();
}

// ─── Init ─────────────────────────────────────────────────
async function init() {
  // Check auth
  try {
    const { authenticated, user } = await AuthAPI.me();
    if (!authenticated) {
      window.location.href = '/';
      return;
    }
    loadUser(user);
  } catch {
    window.location.href = '/';
    return;
  }

  // Load inbox
  await loadEmails();
  setupEventListeners();
}

function loadUser(user) {
  $('user-name').textContent = user.name || 'User';
  $('user-email').textContent = user.email || '';

  if (user.picture) {
    const img = $('user-avatar-img');
    img.src = user.picture;
    img.onerror = () => {
      hide(img);
      $('user-avatar-placeholder').textContent = (user.name || 'U').charAt(0).toUpperCase();
    };
    show(img);
    hide('user-avatar-placeholder');
  } else {
    $('user-avatar-placeholder').textContent = (user.name || 'U').charAt(0).toUpperCase();
  }
}

// ─── Load Emails ──────────────────────────────────────────
async function loadEmails(append = false, q = '') {
  if (state.loading) return;
  state.loading = true;

  if (!append) {
    state.emails = [];
    state.nextPageToken = null;
    renderEmailList([], true); // Show skeleton
  }

  try {
    const params = { label: state.currentLabel, maxResults: 20 };
    if (state.nextPageToken) params.pageToken = state.nextPageToken;
    if (q) params.q = q;

    const { emails, nextPageToken } = await EmailAPI.list(params);

    if (append) {
      state.emails = [...state.emails, ...emails];
    } else {
      state.emails = emails;
    }
    state.nextPageToken = nextPageToken;

    renderEmailList(state.emails, false);

    const unread = state.emails.filter(e => e.isUnread).length;
    if (unread > 0 && state.currentLabel === 'INBOX') {
      $('unread-badge').textContent = unread;
      show('unread-badge');
    } else {
      hide('unread-badge');
    }

    const titles = { INBOX: 'Inbox', STARRED: 'Starred', SENT: 'Sent', TRASH: 'Trash' };
    $('panel-subtitle').textContent = `${state.emails.length} emails`;

  } catch (err) {
    showToast('Failed to load emails: ' + err.message, 'error');
    renderEmailList([], false);
  } finally {
    state.loading = false;
  }
}

// ─── Render Email List ────────────────────────────────────
function renderEmailList(emails, skeleton) {
  const list = $('email-list');

  if (skeleton) {
    list.innerHTML = `
      <div id="email-skeleton">
        ${Array(6).fill(`
          <div class="skeleton-email">
            <div class="sk-line skeleton sk-wide"></div>
            <div class="sk-line skeleton sk-medium"></div>
            <div class="sk-line skeleton sk-narrow"></div>
          </div>`).join('')}
      </div>`;
    return;
  }

  if (emails.length === 0) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:0.875rem;">No emails found</div>`;
    return;
  }

  const emailsHtml = emails.map(email => `
    <div class="email-item ${email.isUnread ? 'unread' : ''} ${state.selectedEmail?.id === email.id ? 'active' : ''}"
         data-id="${email.id}"
         role="button"
         tabindex="0">
      <div class="unread-dot"></div>
      <div class="email-item-content">
        <div class="email-item-top">
          <span class="sender-name">${escHtml(extractName(email.from))}</span>
          <span class="email-date">${formatDate(email.date)}</span>
        </div>
        <div class="email-subject">${escHtml(email.subject)}</div>
        <div class="email-snippet">${escHtml(email.snippet)}</div>
      </div>
      <div class="email-actions-quick">
        <button class="quick-btn ${email.isStarred ? 'starred' : ''}" data-action="star" data-id="${email.id}" data-starred="${email.isStarred}" title="Star">
          ${email.isStarred ? '⭐' : '☆'}
        </button>
        <button class="quick-btn" data-action="archive" data-id="${email.id}" title="Archive">📦</button>
      </div>
    </div>
  `).join('');

  const loadMoreHtml = state.nextPageToken ? `
    <div class="load-more-btn" id="load-more-btn">Load more →</div>
  ` : '';

  list.innerHTML = emailsHtml + loadMoreHtml;

  // Bind email item clicks
  list.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.email-actions-quick')) return;
      selectEmail(item.dataset.id);
    });
  });

  // Quick action buttons
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id, starred } = btn.dataset;
      if (action === 'star') handleQuickStar(id, starred === 'true', btn);
      if (action === 'archive') handleQuickArchive(id);
    });
  });

  // Load more
  $('load-more-btn')?.addEventListener('click', () => loadEmails(true));
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Select & Load Email ──────────────────────────────────
async function selectEmail(id) {
  // Highlight in list
  document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.email-item[data-id="${id}"]`)?.classList.add('active');

  // Mark as read in list state
  const emailMeta = state.emails.find(e => e.id === id);
  if (emailMeta) emailMeta.isUnread = false;

  // Show detail panel
  hide('empty-state');
  show('email-detail');

  // Reset AI panel
  resetAIPanel();

  // Show loading state
  $('detail-subject').textContent = emailMeta?.subject || 'Loading...';
  $('detail-from-name').textContent = extractName(emailMeta?.from);
  $('detail-from-email').textContent = '';
  $('detail-avatar').textContent = getInitial(emailMeta?.from);
  $('email-body-html').innerHTML = '';
  $('email-body-text').textContent = '';
  show('body-loading');

  try {
    const email = await EmailAPI.get(id);
    state.selectedEmail = email;
    renderEmailDetail(email);
  } catch (err) {
    showToast('Failed to load email: ' + err.message, 'error');
    hide('body-loading');
  }
}

function renderEmailDetail(email) {
  hide('body-loading');

  $('detail-subject').textContent = email.subject;
  $('detail-avatar').textContent = getInitial(email.from);
  $('detail-date').textContent = formatDate(email.date);
  $('detail-to').textContent = email.to ? `To: ${email.to}` : '';

  const fromName = extractName(email.from);
  const fromEmail = email.from.replace(/.*<(.+)>/, '$1').replace(fromName, '').trim();
  $('detail-from-name').textContent = fromName;
  $('detail-from-email').textContent = fromEmail || email.from;

  // Star button
  $('btn-star').textContent = email.isStarred ? '★ Unstar' : '⭐ Star';

  // Body
  if (email.body) {
    $('email-body-html').innerHTML = email.body;
    hide('email-body-text');
    show('email-body-html');
  } else if (email.bodyText) {
    $('email-body-text').textContent = email.bodyText;
    hide('email-body-html');
    show('email-body-text');
  } else {
    $('email-body-html').innerHTML = `<p style="color:var(--text-muted)">No content to display.</p>`;
  }

  // Thread
  if (email.thread && email.thread.length > 1) {
    const otherMessages = email.thread.filter(m => m.id !== email.id);
    $('thread-list').innerHTML = otherMessages.map(m => `
      <div class="thread-item">
        <span class="sender">${escHtml(extractName(m.from))}</span>
        <span style="flex:1;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 8px">
          ${escHtml(m.snippet)}
        </span>
        <span class="date">${formatDate(m.date)}</span>
      </div>
    `).join('');
    show('thread-section');
  } else {
    hide('thread-section');
  }
}

// ─── Email Actions ────────────────────────────────────────
$('btn-star').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  const { id, isStarred } = state.selectedEmail;
  try {
    await EmailAPI.toggleStar(id, !isStarred);
    state.selectedEmail.isStarred = !isStarred;
    $('btn-star').textContent = state.selectedEmail.isStarred ? '★ Unstar' : '⭐ Star';
    showToast(state.selectedEmail.isStarred ? '⭐ Starred' : 'Unstarred', 'success');
    // Update list
    const listItem = state.emails.find(e => e.id === id);
    if (listItem) listItem.isStarred = state.selectedEmail.isStarred;
  } catch (err) { showToast(err.message, 'error'); }
});

$('btn-archive').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  try {
    await EmailAPI.archive(state.selectedEmail.id);
    showToast('📦 Archived', 'success');
    removeEmailFromList(state.selectedEmail.id);
  } catch (err) { showToast(err.message, 'error'); }
});

$('btn-delete').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  if (!confirm('Move this email to trash?')) return;
  try {
    await EmailAPI.delete(state.selectedEmail.id);
    showToast('🗑️ Moved to trash', 'success');
    removeEmailFromList(state.selectedEmail.id);
  } catch (err) { showToast(err.message, 'error'); }
});

$('btn-mark-unread').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  try {
    await EmailAPI.markRead(state.selectedEmail.id, false);
    showToast('Marked as unread', 'info');
    const listItem = state.emails.find(e => e.id === state.selectedEmail.id);
    if (listItem) listItem.isUnread = true;
    renderEmailList(state.emails, false);
    hide('email-detail');
    show('empty-state');
    state.selectedEmail = null;
  } catch (err) { showToast(err.message, 'error'); }
});

$('btn-reply').addEventListener('click', () => {
  if (!state.selectedEmail) return;
  // Switch to AI reply tab
  switchAiTab('reply');
  $('ai-panel-body').classList.add('open');
  $('btn-gen-reply').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

function removeEmailFromList(id) {
  state.emails = state.emails.filter(e => e.id !== id);
  state.selectedEmail = null;
  renderEmailList(state.emails, false);
  hide('email-detail');
  show('empty-state');
}

async function handleQuickStar(id, isStarred, btn) {
  try {
    await EmailAPI.toggleStar(id, !isStarred);
    btn.dataset.starred = String(!isStarred);
    btn.textContent = !isStarred ? '⭐' : '☆';
    btn.classList.toggle('starred', !isStarred);
    const item = state.emails.find(e => e.id === id);
    if (item) item.isStarred = !isStarred;
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleQuickArchive(id) {
  try {
    await EmailAPI.archive(id);
    showToast('📦 Archived', 'success');
    if (state.selectedEmail?.id === id) {
      hide('email-detail');
      show('empty-state');
      state.selectedEmail = null;
    }
    state.emails = state.emails.filter(e => e.id !== id);
    renderEmailList(state.emails, false);
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── AI Features ──────────────────────────────────────────
function resetAIPanel() {
  hide('summary-result');
  hide('summarize-loading');
  hide('classify-loading');
  hide('reply-loading');
  hide('reply-textarea');
  hide('reply-actions');
  $('classify-result').innerHTML = '';
  hide('classify-result');
  $('reply-textarea').value = '';
}

// AI tab switching
$('ai-panel-toggle').addEventListener('click', () => {
  const body = $('ai-panel-body');
  body.classList.toggle('open');
  $('ai-chevron').textContent = body.classList.contains('open') ? '▲' : '▼';
});

document.querySelectorAll('.ai-tab').forEach(tab => {
  tab.addEventListener('click', () => switchAiTab(tab.dataset.tab));
});

function switchAiTab(tab) {
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  const panels = { summarize: 'panel-summarize', reply: 'panel-reply', classify: 'panel-classify' };
  Object.entries(panels).forEach(([key, id]) => {
    key === tab ? show(id) : hide(id);
  });
}

// Summarize
$('btn-summarize').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  const { subject, from, body, bodyText } = state.selectedEmail;
  const content = body || bodyText || '';
  if (!content) { showToast('No content to summarize.', 'info'); return; }

  show('summarize-loading');
  hide('summary-result');

  try {
    // Strip HTML for cleaner summary
    const tmp = document.createElement('div');
    tmp.innerHTML = content;
    const plainText = tmp.textContent || tmp.innerText || content;

    const { summary } = await AIAPI.summarize({ subject, from, body: plainText });
    $('summary-text').textContent = summary;
    show('summary-result');
    showToast('✨ Summary ready!', 'success');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    hide('summarize-loading');
  }
});

// Generate Reply
$('btn-gen-reply').addEventListener('click', generateAIReply);
$('btn-regen-reply').addEventListener('click', generateAIReply);

async function generateAIReply() {
  if (!state.selectedEmail) return;
  const { subject, from, body, bodyText } = state.selectedEmail;
  const content = body || bodyText || '';

  show('reply-loading');
  hide('reply-textarea');
  hide('reply-actions');

  try {
    const tmp = document.createElement('div');
    tmp.innerHTML = content;
    const plainText = tmp.textContent || tmp.innerText || content;

    const { reply } = await AIAPI.generateReply({ subject, from, body: plainText, tone: state.currentTone });
    const replyTextarea = $('reply-textarea');
    replyTextarea.value = reply;
    show('reply-textarea');
    show('reply-actions');

    // Auto-adjust height to display full reply
    replyTextarea.style.height = 'auto';
    replyTextarea.style.height = (replyTextarea.scrollHeight + 16) + 'px';
    
    // Smoothly scroll reply into view so the user can see everything
    setTimeout(() => {
      replyTextarea.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    hide('reply-loading');
  }
}

// Auto-expand textarea when typing
$('reply-textarea').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight + 16) + 'px';
});

// Tone selector
document.querySelectorAll('.tone-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentTone = btn.dataset.tone;
  });
});

// Send AI reply
$('btn-send-reply').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  const body = $('reply-textarea').value.trim();
  if (!body) { showToast('Reply is empty.', 'error'); return; }

  $('btn-send-reply').disabled = true;
  $('btn-send-reply').textContent = '⏳ Sending...';

  try {
    await EmailAPI.reply(state.selectedEmail.id, body);
    showToast('✅ Reply sent!', 'success');
    hide('reply-textarea');
    hide('reply-actions');
    $('reply-textarea').value = '';
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'error');
  } finally {
    $('btn-send-reply').disabled = false;
    $('btn-send-reply').textContent = '📤 Send Reply';
  }
});

// Open in compose (pre-fill reply)
$('btn-open-compose-reply').addEventListener('click', () => {
  if (!state.selectedEmail) return;
  const fromAddr = state.selectedEmail.from.match(/<(.+)>/) ?
    state.selectedEmail.from.match(/<(.+)>/)[1] : state.selectedEmail.from;
  window.ComposeModule.openCompose('reply', {
    messageId: state.selectedEmail.id,
    to: fromAddr,
    subject: state.selectedEmail.subject.startsWith('Re:')
      ? state.selectedEmail.subject
      : `Re: ${state.selectedEmail.subject}`,
    body: $('reply-textarea').value,
  });
});

// Classify
$('btn-classify').addEventListener('click', async () => {
  if (!state.selectedEmail) return;
  const { subject, from, body, bodyText } = state.selectedEmail;
  const content = body || bodyText || '';

  show('classify-loading');
  hide('classify-result');

  try {
    const tmp = document.createElement('div');
    tmp.innerHTML = content;
    const plainText = tmp.textContent || tmp.innerText || content;

    const result = await AIAPI.classify({ subject, from, body: plainText });

    const badges = [
      { label: `🎯 ${result.priority?.toUpperCase()} priority`, cls: `priority-${result.priority || 'medium'}` },
      { label: `📂 ${result.category}`, cls: 'category' },
      result.isSpam ? { label: '⚠️ Possible Spam', cls: 'spam' } : null,
      result.isImportant ? { label: '⭐ Important', cls: 'important' } : null,
      result.actionRequired ? { label: '✅ Action Required', cls: 'action' } : null,
    ].filter(Boolean);

    $('classify-result').innerHTML = `
      ${badges.map(b => `<span class="classify-badge ${b.cls}">${b.label}</span>`).join('')}
      ${result.summary ? `<div style="width:100%;font-size:0.8rem;color:var(--text-secondary);margin-top:8px">${escHtml(result.summary)}</div>` : ''}
    `;
    show('classify-result');
  } catch (err) {
    showToast('Classification failed: ' + err.message, 'error');
  } finally {
    hide('classify-loading');
  }
});

// ─── Navigation ───────────────────────────────────────────
document.querySelectorAll('.nav-item[data-label]').forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.label === state.currentLabel && !state.loading) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    state.currentLabel = item.dataset.label;
    const titles = { INBOX: 'Inbox', STARRED: 'Starred', SENT: 'Sent', TRASH: 'Trash' };
    $('panel-title').textContent = titles[state.currentLabel] || state.currentLabel;

    hide('email-detail');
    show('empty-state');
    state.selectedEmail = null;

    loadEmails();
  });
});

// ─── Search ───────────────────────────────────────────────
$('search-input').addEventListener('input', (e) => {
  clearTimeout(state.searchTimeout);
  const q = e.target.value.trim();

  state.searchTimeout = setTimeout(() => {
    if (q.length > 1) {
      $('panel-title').textContent = `Search: "${q}"`;
      loadEmails(false, q);
    } else if (q === '') {
      const titles = { INBOX: 'Inbox', STARRED: 'Starred', SENT: 'Sent', TRASH: 'Trash' };
      $('panel-title').textContent = titles[state.currentLabel] || state.currentLabel;
      loadEmails();
    }
  }, 400);
});

// ─── Refresh ──────────────────────────────────────────────
$('refresh-btn').addEventListener('click', () => {
  $('search-input').value = '';
  loadEmails();
});

// ─── Logout ───────────────────────────────────────────────
$('user-pill').addEventListener('click', async () => {
  if (!confirm('Sign out of InboxAI?')) return;
  try {
    await AuthAPI.logout();
    window.location.href = '/';
  } catch {
    window.location.href = '/';
  }
});

// ─── History Nav (placeholder) ────────────────────────────
$('nav-history').addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('nav-history').classList.add('active');
  $('panel-title').textContent = 'Activity';
  $('panel-subtitle').textContent = 'Recent email actions';
  $('email-list').innerHTML = `
    <div style="padding:32px;text-align:center;color:var(--text-muted);font-size:0.875rem;">
      ✅ Activity tracking coming soon
    </div>`;
  hide('email-detail');
  show('empty-state');
});

// ─── Setup all event listeners ────────────────────────────
function setupEventListeners() {
  // Already attached above via inline addEventListener calls
}

// ─── Start ────────────────────────────────────────────────
init();
