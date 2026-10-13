import { randomUUID } from 'node:crypto';
import { commitStep, computeStep } from '../domain/engine.js';

export class Orchestrator {
  #timers = new Map();
  #pauseRequested = new Set();

  constructor({ store, broker, stepIntervalMs = 150 }) {
    this.store = store;
    this.broker = broker;
    this.stepIntervalMs = stepIntervalMs;
  }

  async queue(id) {
    const current = this.store.get(id);
    if (!current) throw new Error('RUN_NOT_FOUND');
    if (current.status === 'paused' || current.status === 'failed') this.store.transition(id, 'queued', '运行已重新排队');
    else this.store.transition(id, 'queued', '运行已进入队列');
    this.store.transition(id, 'preparing', '正在准备世界快照');
    this.store.transition(id, 'running', '运行开始');
    await this.broker.publish('experiment.command.v1', { messageId: randomUUID(), runId: id, type: 'START' });
    this.#schedule(id);
    return this.store.get(id);
  }

  pause(id) {
    const run = this.store.get(id);
    if (!run) throw new Error('RUN_NOT_FOUND');
    if (run.status !== 'running') throw new Error(`INVALID_TRANSITION:${run.status}:pausing`);
    this.store.transition(id, 'pausing', '将在当前时间步提交后暂停');
    this.#pauseRequested.add(id);
    return this.store.get(id);
  }

  cancel(id) {
    const run = this.store.get(id);
    if (!run) throw new Error('RUN_NOT_FOUND');
    if (run.status === 'queued' || run.status === 'paused') this.store.transition(id, 'cancelled', '运行已取消');
    else {
      this.store.transition(id, 'cancelling', '正在取消运行');
      this.store.transition(id, 'cancelled', '运行已取消，已提交步骤保留');
    }
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    return this.store.get(id);
  }

  close() {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#pauseRequested.clear();
  }

  async stepOnce(id) {
    const run = this.store.get(id);
    if (!run || !['running', 'pausing'].includes(run.status)) return run;
    const expectedStep = run.world.step;
    const result = computeStep(run.world);
    const world = commitStep(run.world, result);
    const committed = this.store.commitWorld(id, expectedStep, world, `第 ${world.step} 步已提交`);
    if (!committed.duplicate) {
      await this.broker.publish('step.committed.v1', {
        messageId: `${id}:${expectedStep}`, runId: id, step: expectedStep,
        metrics: world.eventMetrics, stepHash: world.committedStepHashes.at(-1),
      });
    }
    if (this.#pauseRequested.has(id)) {
      this.#pauseRequested.delete(id);
      clearTimeout(this.#timers.get(id));
      this.#timers.delete(id);
      this.store.transition(id, 'paused', `已在第 ${world.step} 步边界暂停`);
    }
    return this.store.get(id);
  }

  #schedule(id) {
    clearTimeout(this.#timers.get(id));
    const tick = async () => {
      const run = this.store.get(id);
      if (!run || !['running', 'pausing'].includes(run.status)) return;
      await this.stepOnce(id);
      if (this.store.get(id)?.status === 'running') this.#timers.set(id, setTimeout(tick, this.stepIntervalMs));
    };
    this.#timers.set(id, setTimeout(tick, this.stepIntervalMs));
  }
}

