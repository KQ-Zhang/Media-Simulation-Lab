import { deterministicUnit, stableHash } from './rng.js';

const DEFAULTS = Object.freeze({
  agentCount: 100,
  browseCapacity: 8,
  candidatePoolSize: 50,
  eventCount: 20,
  maxActiveEvents: 20,
  seed: 20261012,
});

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function normalizeConfig(input = {}) {
  const config = { ...DEFAULTS, ...input };
  for (const key of ['agentCount', 'browseCapacity', 'candidatePoolSize', 'eventCount', 'maxActiveEvents']) {
    if (!Number.isInteger(config[key]) || config[key] <= 0) throw new TypeError(`${key} must be a positive integer`);
  }
  if (config.browseCapacity > config.candidatePoolSize) {
    throw new RangeError('browseCapacity cannot exceed candidatePoolSize');
  }
  return config;
}

export function createWorld(input = {}) {
  const config = normalizeConfig(input);
  const topics = ['society', 'technology', 'sports', 'culture', 'life'];
  const events = Array.from({ length: config.eventCount }, (_, index) => ({
    id: `event-${String(index + 1).padStart(4, '0')}`,
    topic: topics[index % topics.length],
    injectedStep: Math.floor(index / config.maxActiveEvents),
    baseHeat: 0.15 + deterministicUnit(config.seed, 'event-heat', index) * 0.55,
  }));
  const agents = Array.from({ length: config.agentCount }, (_, index) => {
    const interests = Object.fromEntries(topics.map(topic => [topic, deterministicUnit(config.seed, 'interest', index, topic)]));
    return {
      id: `agent-${String(index + 1).padStart(6, '0')}`,
      interests,
      activity: 0.55 + deterministicUnit(config.seed, 'activity', index) * 0.45,
      repostBias: -1.5 + deterministicUnit(config.seed, 'repost', index) * 1.25,
      fatigue: {},
      memory: {},
    };
  });
  return {
    schemaVersion: 1,
    config,
    step: 0,
    agents,
    events,
    posts: [],
    eventMetrics: {},
    committedStepHashes: [],
  };
}

function activeEvents(world, step) {
  return world.events.filter(event => event.injectedStep <= step).slice(-world.config.maxActiveEvents);
}

function makeSeedPost(world, event, step) {
  const id = `post-${stableHash(world.config.seed, 'seed-post', event.id).slice(0, 16)}`;
  return {
    id,
    eventId: event.id,
    authorId: 'system',
    parentPostId: null,
    createdStep: step,
    heat: event.baseHeat,
    generationMode: 'original_seed',
  };
}

function candidateScore(world, agent, post, event, step) {
  const interest = agent.interests[event.topic] ?? 0;
  const freshness = 1 / (1 + Math.max(0, step - post.createdStep));
  const fatigue = agent.fatigue[event.id] ?? 0;
  const exploration = deterministicUnit(world.config.seed, step, agent.id, post.id, 'explore') * 0.12;
  return 0.42 * interest + 0.32 * post.heat + 0.18 * freshness + exploration - 0.2 * fatigue;
}

function decide(world, agent, post, event, step, score) {
  const probability = sigmoid(-2.2 + score * 2.4 + agent.repostBias + post.heat * 0.7);
  const sampledValue = deterministicUnit(world.config.seed, step, agent.id, post.id, 'repost');
  return { action: sampledValue < probability ? 'repost' : 'ignore', probability, sampledValue };
}

export function computeStep(world) {
  const step = world.step;
  const injected = activeEvents(world, step)
    .filter(event => event.injectedStep === step)
    .map(event => makeSeedPost(world, event, step));
  const visiblePosts = [...world.posts, ...injected];
  const eventById = new Map(world.events.map(event => [event.id, event]));
  const exposures = [];
  const decisions = [];
  const createdPosts = [];
  const agentDeltas = [];

  for (const agent of world.agents) {
    const online = deterministicUnit(world.config.seed, step, agent.id, 'online') < agent.activity;
    if (!online || visiblePosts.length === 0) continue;
    const ranked = visiblePosts
      .map(post => ({ post, score: candidateScore(world, agent, post, eventById.get(post.eventId), step) }))
      .sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id))
      .slice(0, world.config.candidatePoolSize)
      .slice(0, world.config.browseCapacity);
    const fatigueDelta = {};
    const memoryDelta = {};
    ranked.forEach(({ post, score }, rank) => {
      const event = eventById.get(post.eventId);
      exposures.push({ agentId: agent.id, postId: post.id, eventId: post.eventId, rank: rank + 1, score });
      const result = decide(world, agent, post, event, step, score);
      decisions.push({ agentId: agent.id, postId: post.id, eventId: post.eventId, ...result });
      fatigueDelta[event.id] = clamp((agent.fatigue[event.id] ?? 0) + 0.04);
      memoryDelta[event.id] = (agent.memory[event.id] ?? 0) + 1;
      if (result.action === 'repost') {
        const id = `post-${stableHash(world.config.seed, step, agent.id, post.id, 'repost-post').slice(0, 16)}`;
        createdPosts.push({
          id, eventId: event.id, authorId: agent.id, parentPostId: post.id,
          createdStep: step, heat: clamp(post.heat * 0.94 + 0.03), generationMode: 'unchanged_repost',
        });
      }
    });
    agentDeltas.push({ agentId: agent.id, fatigueDelta, memoryDelta });
  }

  return { step, injected, exposures, decisions, createdPosts, agentDeltas };
}

export function commitStep(world, result) {
  if (result.step !== world.step) throw new Error(`Cannot commit step ${result.step}; world is at ${world.step}`);
  const agentsById = new Map(world.agents.map(agent => [agent.id, { ...agent, fatigue: { ...agent.fatigue }, memory: { ...agent.memory } }]));
  for (const delta of result.agentDeltas) {
    const agent = agentsById.get(delta.agentId);
    Object.assign(agent.fatigue, delta.fatigueDelta);
    Object.assign(agent.memory, delta.memoryDelta);
  }
  const eventMetrics = structuredClone(world.eventMetrics);
  for (const event of world.events) {
    const eventExposures = result.exposures.filter(item => item.eventId === event.id);
    const eventReposts = result.decisions.filter(item => item.eventId === event.id && item.action === 'repost');
    if (!eventExposures.length && !eventReposts.length) continue;
    const metric = eventMetrics[event.id] ?? { exposures: 0, propagations: 0, posts: 0, byStep: [] };
    metric.exposures += eventExposures.length;
    metric.propagations += eventReposts.length;
    metric.posts += result.injected.filter(post => post.eventId === event.id).length + result.createdPosts.filter(post => post.eventId === event.id).length;
    metric.byStep.push({ step: world.step, exposures: eventExposures.length, propagations: eventReposts.length });
    eventMetrics[event.id] = metric;
  }
  const stepHash = stableHash(JSON.stringify({ step: result.step, exposures: result.exposures, decisions: result.decisions, posts: result.createdPosts }));
  return {
    ...world,
    step: world.step + 1,
    agents: [...agentsById.values()],
    posts: [...world.posts, ...result.injected, ...result.createdPosts],
    eventMetrics,
    committedStepHashes: [...world.committedStepHashes, stepHash],
  };
}

export function runSteps(world, count) {
  let current = world;
  for (let index = 0; index < count; index += 1) current = commitStep(current, computeStep(current));
  return current;
}

