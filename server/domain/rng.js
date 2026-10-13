import { createHash } from 'node:crypto';

export function stableHash(...parts) {
  return createHash('sha256').update(parts.map(String).join('\u001f')).digest('hex');
}

export function deterministicUnit(...parts) {
  const value = BigInt(`0x${stableHash(...parts).slice(0, 13)}`);
  return Number(value) / Number(0xfffffffffffffn);
}

export function deterministicInt(min, max, ...parts) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError('deterministicInt requires an inclusive integer range');
  }
  return min + Math.floor(deterministicUnit(...parts) * (max - min + 1));
}

