import test from 'node:test';
import assert from 'node:assert/strict';
import { ExperimentStore } from '../server/application/experiment-store.js';
import { Orchestrator } from '../server/application/orchestrator.js';
import { InMemoryBroker } from '../server/infrastructure/in-memory-broker.js';

test('pause is committed at a step boundary', async t => {
  const store = new ExperimentStore();
  const broker = new InMemoryBroker();
  const orchestrator = new Orchestrator({ store, broker, stepIntervalMs: 60_000 });
  t.after(() => orchestrator.close());
  const run = store.create({ agentCount: 10, eventCount: 2, maxActiveEvents: 2, browseCapacity: 2, candidatePoolSize: 4, seed: 7 });
  await orchestrator.queue(run.id);
  orchestrator.pause(run.id);
  await orchestrator.stepOnce(run.id);
  const paused = store.get(run.id);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.world.step, 1);
});

test('broker ignores a duplicate message id on the same topic', async () => {
  const broker = new InMemoryBroker();
  let deliveries = 0;
  broker.subscribe('topic', () => { deliveries += 1; });
  await broker.publish('topic', { messageId: 'same' });
  const duplicate = await broker.publish('topic', { messageId: 'same' });
  assert.equal(deliveries, 1);
  assert.equal(duplicate.duplicate, true);
});

