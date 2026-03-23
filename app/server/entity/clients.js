// Registry of currently connected SSE clients
const connected = new Map(); // callerId -> res

function register(callerId, res) {
  connected.set(callerId, res);
}

function unregister(callerId) {
  connected.delete(callerId);
}

function getConnected() {
  return [...connected.keys()];
}

function push(callerId, data) {
  const res = connected.get(callerId);
  if (!res) return false;
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    connected.delete(callerId);
    return false;
  }
}

function pushAll(data) {
  for (const [callerId, res] of connected) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      connected.delete(callerId);
    }
  }
}

module.exports = { register, unregister, getConnected, push, pushAll };
