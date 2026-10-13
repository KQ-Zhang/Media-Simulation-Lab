import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationServer } from '../server/http.js';

test('HTTP API creates, starts and pauses a deterministic run', async t => {
  const app = createSimulationServer({ stepIntervalMs: 10 });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    app.orchestrator.close();
    app.server.close();
  });
  const { port } = app.server.address();
  const base = `http://127.0.0.1:${port}`;
  const createdResponse = await fetch(`${base}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentCount: 12, eventCount: 3, maxActiveEvents: 3, browseCapacity: 2, candidatePoolSize: 5, seed: 11 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.status, 'draft');

  const startedResponse = await fetch(`${base}/api/runs/${created.id}:start`, { method: 'POST' });
  assert.equal(startedResponse.status, 202);
  const pauseResponse = await fetch(`${base}/api/runs/${created.id}:pause`, { method: 'POST' });
  assert.equal(pauseResponse.status, 202);
  await new Promise(resolve => setTimeout(resolve, 30));

  const current = await fetch(`${base}/api/runs/${created.id}`).then(response => response.json());
  assert.equal(current.status, 'paused');
  assert.equal(current.world.step, 1);
  assert.equal(current.world.committedStepHashes.length, 1);
});

