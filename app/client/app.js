const ENTITY_NAME = 'Aion';
const CALLER_ID = 'user';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const resetBtn = document.getElementById('reset');
const hardResetBtn = document.getElementById('hard-reset');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmOk = document.getElementById('confirm-ok');
const statusEl = document.getElementById('status');

let responding = false;

// --- State panel ---

function updateStatePanel(emotional) {
  const axes = ['arousal', 'valence', 'loneliness', 'coherence', 'curiosity'];
  for (const axis of axes) {
    const bar = document.getElementById(`bar-${axis}`);
    if (bar && emotional[axis] !== undefined) {
      bar.style.width = `${Math.round(emotional[axis] * 100)}%`;
    }
  }
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const data = await res.json();
    updateStatePanel(data.emotional);
  } catch {}
}

fetchState();

// --- SSE stream ---

function connectStream() {
  const es = new EventSource(`/api/stream/${CALLER_ID}`);

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'ping') return;
      if (data.type === 'state' && data.emotional) {
        updateStatePanel(data.emotional);
      }
      if (data.type === 'message' && data.content) {
        appendMessage('entity', data.content, true);
      }
    } catch {}
  };

  es.onerror = () => {
    es.close();
    setTimeout(connectStream, 5000);
  };
}

connectStream();

// --- Chat ---

function setStatus(text) {
  statusEl.textContent = text;
}

function appendMessage(role, content = '', initiated = false) {
  const el = document.createElement('div');
  el.classList.add('message', role === 'user' ? 'user' : 'entity');
  if (initiated) el.classList.add('initiated');

  const label = document.createElement('div');
  label.classList.add('label');
  label.textContent = role === 'user' ? 'you' : ENTITY_NAME.toLowerCase();

  const contentEl = document.createElement('div');
  contentEl.classList.add('content');
  contentEl.textContent = content;

  el.appendChild(label);
  el.appendChild(contentEl);
  messagesEl.appendChild(el);
  scrollToBottom();
  return contentEl;
}

function appendCursor(contentEl) {
  const cursor = document.createElement('span');
  cursor.classList.add('cursor');
  contentEl.appendChild(cursor);
  return cursor;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || responding) return;

  responding = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  appendMessage('user', text);

  const contentEl = appendMessage('entity');
  const cursor = appendCursor(contentEl);
  setStatus('thinking');

  let fullResponse = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerId: CALLER_ID,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    setStatus('—');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try {
          const parsed = JSON.parse(d);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.token) {
            fullResponse += parsed.token;
            contentEl.textContent = fullResponse;
            contentEl.appendChild(cursor);
            scrollToBottom();
          }
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') throw e;
        }
      }
    }
  } catch (err) {
    contentEl.textContent = `[error: ${err.message}]`;
    setStatus('error');
  } finally {
    cursor.remove();
    responding = false;
    sendBtn.disabled = false;
    setStatus('—');
    inputEl.focus();
    fetchState();
  }
}

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

sendBtn.addEventListener('click', send);

resetBtn.addEventListener('click', async () => {
  await fetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerId: CALLER_ID }),
  });
  messagesEl.innerHTML = '';
  inputEl.focus();
});

hardResetBtn.addEventListener('click', () => {
  confirmOverlay.classList.remove('hidden');
});

confirmCancel.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});

confirmOk.addEventListener('click', async () => {
  confirmOverlay.classList.add('hidden');
  setStatus('resetting...');
  await fetch('/api/reset/hard', { method: 'POST' });
  messagesEl.innerHTML = '';
  fetchState();
  setStatus('—');
  inputEl.focus();
});

confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) confirmOverlay.classList.add('hidden');
});

inputEl.focus();
