import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { ExperimentStore } from './application/experiment-store.js';
import { Orchestrator } from './application/orchestrator.js';
import { InMemoryBroker } from './infrastructure/in-memory-broker.js';

function send(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

export function createSimulationServer({ stepIntervalMs = 300 } = {}) {
  const store = new ExperimentStore();
  const broker = new InMemoryBroker();
  const orchestrator = new Orchestrator({ store, broker, stepIntervalMs });
  const clients = new Set();
  broker.subscribe('step.committed.v1', message => {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of clients) client.write(data);
  });

  const server = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,idempotency-key' });
      return response.end();
    }
    const url = new URL(request.url, 'http://localhost');
    const match = url.pathname.match(/^\/api\/runs\/([^/:]+)(?::(start|pause|resume|cancel))?$/);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { status: 'ok', broker: 'memory' });
      if (request.method === 'GET' && url.pathname === '/api/runs') return send(response, 200, store.list());
      if (request.method === 'POST' && url.pathname === '/api/runs') return send(response, 201, store.create(await body(request)));
      if (request.method === 'GET' && match && !match[2]) {
        const run = store.get(match[1]);
        return run ? send(response, 200, run) : send(response, 404, { error: 'RUN_NOT_FOUND' });
      }
      if (request.method === 'POST' && match?.[2]) {
        const [, id, action] = match;
        if (action === 'start' || action === 'resume') return send(response, 202, await orchestrator.queue(id));
        if (action === 'pause') return send(response, 202, orchestrator.pause(id));
        if (action === 'cancel') return send(response, 202, orchestrator.cancel(id));
      }
      if (request.method === 'GET' && url.pathname === '/api/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
        clients.add(response);
        request.on('close', () => clients.delete(response));
        return response.write(': connected\n\n');
      }
      return send(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const status = error.message === 'RUN_NOT_FOUND' ? 404 : error.message.startsWith('INVALID_TRANSITION') ? 409 : 400;
      return send(response, status, { error: error.message });
    }
  });
  return { server, store, broker, orchestrator };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.SIM_PORT ?? 8787);
  const { server } = createSimulationServer();
  server.listen(port, '127.0.0.1', () => console.log(`Simulation API listening on http://127.0.0.1:${port}`));
}

