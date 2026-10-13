export class InMemoryBroker {
  #handlers = new Map();
  #seen = new Set();

  subscribe(topic, handler) {
    const handlers = this.#handlers.get(topic) ?? [];
    handlers.push(handler);
    this.#handlers.set(topic, handlers);
    return () => this.#handlers.set(topic, handlers.filter(item => item !== handler));
  }

  async publish(topic, message) {
    if (!message?.messageId) throw new TypeError('messageId is required');
    const dedupeKey = `${topic}:${message.messageId}`;
    if (this.#seen.has(dedupeKey)) return { duplicate: true };
    this.#seen.add(dedupeKey);
    for (const handler of this.#handlers.get(topic) ?? []) await handler(structuredClone(message));
    return { duplicate: false };
  }
}

