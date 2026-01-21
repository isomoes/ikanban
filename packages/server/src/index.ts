import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import type { ServerWebSocket } from 'bun';

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

const app = new Hono();

app.get('/', (c) => {
  return c.text('iKanban Server is running!');
});

app.get('/api/ws', upgradeWebSocket((c) => {
  return {
    onOpen(event, ws) {
      console.log('Connection opened');
    },
    onMessage(event, ws) {
      console.log(`Message from client: ${event.data}`);
      // TODO: Handle messages based on WsRequest type
      ws.send(JSON.stringify({ type: 'Event', payload: { event: 'Connected', payload: {} } }));
    },
    onClose(event, ws) {
      console.log('Connection closed');
    },
  };
}));

console.log('Server running on http://localhost:3000');

export default {
  port: 3000,
  fetch: app.fetch,
  websocket,
};
