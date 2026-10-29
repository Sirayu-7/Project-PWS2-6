const clients = new Map();

function addClient(userId, res) {
  const key = Number(userId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
  res.on('close', () => removeClient(key, res));
}

function removeClient(userId, res) {
  const set = clients.get(Number(userId));
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(Number(userId));
}

function send(res, event, payload) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch (_) {
    // The response close handler performs cleanup.
  }
}

function emitToUser(userId, event, payload = {}) {
  const set = clients.get(Number(userId));
  if (!set) return;
  for (const res of set) send(res, event, { ...payload, userId: Number(userId) });
}

function emitToAll(event, payload = {}) {
  for (const [userId, set] of clients) {
    for (const res of set) send(res, event, { ...payload, userId: Number(userId) });
  }
}

function heartbeat() {
  for (const [userId, set] of clients) {
    for (const res of set) {
      try { res.write(': heartbeat\n\n'); } catch (_) { removeClient(userId, res); }
    }
  }
}

const heartbeatTimer = setInterval(heartbeat, 25000);
if (heartbeatTimer.unref) heartbeatTimer.unref();

module.exports = { addClient, removeClient, emitToUser, emitToAll };
