const config = require('../../config.json');

const LLM_URL = `http://${config.llm.serverHost}:${config.llm.port}/v1/chat/completions`;
const EMBED_URL = `http://${config.embedding.serverHost}:${config.embedding.port}/v1/embeddings`;

async function streamChat(messages, onToken, onDone, onError) {
  let response;

  try {
    response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        messages,
        stream: true,
        temperature: 0.8,
        max_tokens: 1024,
      }),
    });
  } catch (err) {
    onError(`Could not reach LLM server: ${err.message}`);
    return;
  }

  if (!response.ok) {
    onError(`LLM server error: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { onDone(); return; }
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {}
      }
    }
  } catch (err) {
    onError(`Stream error: ${err.message}`);
    return;
  }

  onDone();
}

// Non-streaming completion — for internal extractions (memory, state updates)
async function complete(messages, { temperature = 0.6, max_tokens = 512 } = {}) {
  const response = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'local', messages, stream: false, temperature, max_tokens }),
  });
  if (!response.ok) throw new Error(`LLM error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// Embedding — returns float array or null on failure
async function embed(text) {
  try {
    const response = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'local', input: text }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

module.exports = { streamChat, complete, embed };
