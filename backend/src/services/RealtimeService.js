class RealtimeService {
  constructor() {
    this.clients = new Set();
    this.events = [];
  }

  addEvent(event) {
    const normalized = {
      id: event.id || `${Date.now()}-${Math.random()}`,
      time: event.time || new Date().toISOString(),
      type: event.type || 'info',
      ...event
    };
    this.events = [normalized, ...this.events].slice(0, 50);
    this.broadcast('event', normalized);
    return normalized;
  }

  connect(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
    this.clients.add(res);

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
    });
  }

  broadcast(type, data) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) client.write(message);
  }

  recentEvents() {
    return this.events;
  }
}

export const realtimeService = new RealtimeService();
