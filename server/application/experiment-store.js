import { randomUUID } from 'node:crypto';
import { createWorld } from '../domain/engine.js';

const TRANSITIONS = {
  draft: new Set(['queued']),
  queued: new Set(['preparing', 'cancelled']),
  preparing: new Set(['running', 'failed', 'cancelled']),
  running: new Set(['pausing', 'cancelling', 'completed', 'failed']),
  pausing: new Set(['paused', 'failed']),
  paused: new Set(['queued', 'cancelled']),
  cancelling: new Set(['cancelled', 'failed']),
  failed: new Set(['queued']),
  completed: new Set(),
  cancelled: new Set(),
};

export class ExperimentStore {
  #runs = new Map();

  create(config) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const run = { id, status: 'draft', version: 1, config, world: createWorld(config), createdAt: now, updatedAt: now, logs: [] };
    this.#runs.set(id, run);
    return structuredClone(run);
  }

  list() {
    return [...this.#runs.values()].map(run => structuredClone(run));
  }

  get(id) {
    const run = this.#runs.get(id);
    return run ? structuredClone(run) : null;
  }

  transition(id, nextStatus, message = '') {
    const run = this.#runs.get(id);
    if (!run) throw new Error('RUN_NOT_FOUND');
    if (!TRANSITIONS[run.status]?.has(nextStatus)) throw new Error(`INVALID_TRANSITION:${run.status}:${nextStatus}`);
    run.status = nextStatus;
    run.version += 1;
    run.updatedAt = new Date().toISOString();
    if (message) run.logs.push({ at: run.updatedAt, message });
    return structuredClone(run);
  }

  commitWorld(id, expectedStep, world, message) {
    const run = this.#runs.get(id);
    if (!run) throw new Error('RUN_NOT_FOUND');
    if (run.world.step !== expectedStep) return { duplicate: true, run: structuredClone(run) };
    run.world = structuredClone(world);
    run.version += 1;
    run.updatedAt = new Date().toISOString();
    run.logs.push({ at: run.updatedAt, message });
    return { duplicate: false, run: structuredClone(run) };
  }
}

