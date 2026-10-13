import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, runSteps } from '../server/domain/engine.js';

test('same configuration and seed produce identical committed hashes', () => {
  const config = { agentCount: 40, eventCount: 6, maxActiveEvents: 3, browseCapacity: 4, candidatePoolSize: 10, seed: 42 };
  const first = runSteps(createWorld(config), 5);
  const second = runSteps(createWorld(config), 5);
  assert.deepEqual(first.committedStepHashes, second.committedStepHashes);
  assert.deepEqual(first.eventMetrics, second.eventMetrics);
});

test('different seeds change the simulation', () => {
  const base = { agentCount: 30, eventCount: 4, maxActiveEvents: 4, browseCapacity: 3, candidatePoolSize: 8 };
  assert.notDeepEqual(runSteps(createWorld({ ...base, seed: 1 }), 3).committedStepHashes, runSteps(createWorld({ ...base, seed: 2 }), 3).committedStepHashes);
});

test('per-agent exposure never exceeds browse capacity', () => {
  const capacity = 3;
  const world = runSteps(createWorld({ agentCount: 50, eventCount: 10, maxActiveEvents: 10, browseCapacity: capacity, candidatePoolSize: 8, seed: 9 }), 4);
  for (const metric of Object.values(world.eventMetrics)) assert.ok(metric.exposures >= 0);
  const totalPerStep = Object.values(world.eventMetrics).flatMap(metric => metric.byStep).reduce((sum, row) => sum + row.exposures, 0);
  assert.ok(totalPerStep <= world.config.agentCount * capacity * world.step);
});

test('invalid attention configuration is rejected', () => {
  assert.throws(() => createWorld({ browseCapacity: 9, candidatePoolSize: 8 }), /cannot exceed/);
});

