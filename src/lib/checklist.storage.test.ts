import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHECKLIST_BACK_KEY,
  CHECKLIST_FULL_KEY,
  CHECKLIST_STORAGE_KEY,
  loadChecklist,
  loadTimestampedChecklist,
  saveChecklist,
  saveTimestampedChecklist,
} from './checklist';
import { fixture, installLocalStorage, removeWindow, ts } from './test-utils';

let storage: Map<string, string>;

beforeEach(() => {
  storage = installLocalStorage();
});

afterEach(() => {
  removeWindow();
});

describe('storage keys', () => {
  it('are three distinct, versioned keys', () => {
    const keys = [CHECKLIST_STORAGE_KEY, CHECKLIST_BACK_KEY, CHECKLIST_FULL_KEY];
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((key) => key.endsWith(':v1'))).toBe(true);
  });
});

describe('loadTimestampedChecklist', () => {
  it('returns {} when nothing is stored', () => {
    expect(loadTimestampedChecklist('k', fixture)).toEqual({});
  });

  it('returns {} without a window (SSR / node)', () => {
    removeWindow();
    expect(loadTimestampedChecklist('k', fixture)).toEqual({});
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['empty string', ''],
    ['JSON null', 'null'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON string', '"hello"'],
    ['a JSON number', '42'],
    ['a JSON boolean', 'true'],
  ])('returns {} for %s', (_name, raw) => {
    storage.set('k', raw);
    expect(loadTimestampedChecklist('k', fixture)).toEqual({});
  });

  it('returns {} (does not throw) when reading storage throws', () => {
    installLocalStorage({ throwOnGet: true });
    expect(loadTimestampedChecklist('k', fixture)).toEqual({});
  });

  it('drops ids that are not in the tree', () => {
    storage.set('k', JSON.stringify({ ghost: { value: true, timestamp: 1 }, 'rf-2': { value: true, timestamp: 1 } }));
    expect(Object.keys(loadTimestampedChecklist('k', fixture))).toEqual(['rf-2']);
  });

  it.each([
    ['missing timestamp', { value: true }],
    ['missing value', { timestamp: 5 }],
    ['non-boolean value', { value: 'true', timestamp: 5 }],
    ['non-number timestamp', { value: true, timestamp: '5' }],
    ['null entry', null],
    ['string entry', 'yes'],
    ['numeric entry', 1],
    ['array entry', [true, 5]],
  ])('drops a malformed entry: %s', (_name, entry) => {
    storage.set('k', JSON.stringify({ 'rf-2': entry, 'rf-1-1': { value: false, timestamp: 9 } }));
    expect(loadTimestampedChecklist('k', fixture)).toEqual({ 'rf-1-1': { value: false, timestamp: 9 } });
  });

  it('migrates bare legacy booleans (true and false) to timestamp 0', () => {
    storage.set('k', JSON.stringify({ 'rf-2': true, 'rf-1-1': false }));
    expect(loadTimestampedChecklist('k', fixture)).toEqual({
      'rf-2': { value: true, timestamp: 0 },
      'rf-1-1': { value: false, timestamp: 0 },
    });
  });

  it('handles a mix of legacy and current entries', () => {
    storage.set('k', JSON.stringify({ 'rf-2': true, 'rf-1-1': { value: true, timestamp: 50 } }));
    const loaded = loadTimestampedChecklist('k', fixture);
    expect(loaded['rf-2'].timestamp).toBe(0);
    expect(loaded['rf-1-1'].timestamp).toBe(50);
  });

  it('keeps a timestamp of 0 and a negative timestamp as valid numbers', () => {
    storage.set('k', JSON.stringify({ 'rf-2': { value: true, timestamp: 0 }, 'rf-1-1': { value: true, timestamp: -1 } }));
    expect(Object.keys(loadTimestampedChecklist('k', fixture)).sort()).toEqual(['rf-1-1', 'rf-2']);
  });

  it('defaults to the real requirement tree and the legacy key', () => {
    storage.set(CHECKLIST_STORAGE_KEY, JSON.stringify({ 'rf-1': { value: true, timestamp: 3 }, 'rf-1-1': { value: true, timestamp: 3 } }));
    const loaded = loadTimestampedChecklist();
    expect(loaded['rf-1']).toEqual({ value: true, timestamp: 3 });
  });
});

describe('saveTimestampedChecklist', () => {
  it('writes JSON under the given key', () => {
    saveTimestampedChecklist(ts({ 'rf-2': true }, 4), 'k');
    expect(JSON.parse(storage.get('k')!)).toEqual({ 'rf-2': { value: true, timestamp: 4 } });
  });

  it('round-trips through load', () => {
    const state = ts({ 'rf-2': true, 'rf-1-1': false }, 11);
    saveTimestampedChecklist(state, 'k');
    expect(loadTimestampedChecklist('k', fixture)).toEqual(state);
  });

  it('overwrites the previous value (it is a snapshot, not an append)', () => {
    saveTimestampedChecklist(ts({ 'rf-2': true }), 'k');
    saveTimestampedChecklist(ts({ 'rf-1-1': true }), 'k');
    expect(Object.keys(JSON.parse(storage.get('k')!))).toEqual(['rf-1-1']);
  });

  it('does nothing (and does not throw) without a window', () => {
    removeWindow();
    expect(() => saveTimestampedChecklist(ts({ 'rf-2': true }), 'k')).not.toThrow();
  });

  it('keeps the back and full keys independent', () => {
    saveTimestampedChecklist(ts({ 'rf-1-1': true }), CHECKLIST_BACK_KEY);
    saveTimestampedChecklist(ts({ 'rf-2': true }), CHECKLIST_FULL_KEY);
    expect(Object.keys(loadTimestampedChecklist(CHECKLIST_BACK_KEY, fixture))).toEqual(['rf-1-1']);
    expect(Object.keys(loadTimestampedChecklist(CHECKLIST_FULL_KEY, fixture))).toEqual(['rf-2']);
  });
});

describe('plain (legacy/test-only) helpers', () => {
  it('loadChecklist derives parents from the stored children', () => {
    storage.set('k', JSON.stringify({ 'rf-1-1': true, 'rf-1-2': true }));
    expect(loadChecklist('k', fixture)).toEqual({ 'rf-1-1': true, 'rf-1-2': true, 'rf-1': true });
  });

  it('loadChecklist unchecks a stored parent whose children are not all checked', () => {
    storage.set('k', JSON.stringify({ 'rf-1': true, 'rf-1-1': true }));
    expect(loadChecklist('k', fixture)['rf-1']).toBe(false);
  });

  it('loadChecklist returns {} for corrupt storage', () => {
    storage.set('k', '{oops');
    expect(loadChecklist('k', fixture)).toEqual({});
  });

  it('saveChecklist writes the plain map and is a no-op without a window', () => {
    saveChecklist({ 'rf-2': true }, 'k');
    expect(JSON.parse(storage.get('k')!)).toEqual({ 'rf-2': true });
    removeWindow();
    expect(() => saveChecklist({ 'rf-2': true }, 'k')).not.toThrow();
  });
});
