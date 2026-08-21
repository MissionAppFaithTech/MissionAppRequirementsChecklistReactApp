import { beforeEach, describe, expect, it } from 'vitest';
import type { RequirementNode } from '@/data/requirements';
import {
  CHECKLIST_BACK_KEY,
  CHECKLIST_FULL_KEY,
  CHECKLIST_STORAGE_KEY,
  countDualProgress,
  countProgress,
  flattenRequirements,
  getLockedIds,
  loadChecklist,
  loadTimestampedChecklist,
  mergeTimestampedStates,
  saveChecklist,
  saveTimestampedChecklist,
  toggleChecklist,
  toggleTimestampedChecklist,
  toPlainState,
} from './checklist';

const requirements: RequirementNode[] = [
  {
    id: 'rf-1',
    code: 'RF 1',
    title: 'Cadastro',
    children: [
      { id: 'rf-1-1', code: 'RF 1.1', title: 'Nome completo' },
      { id: 'rf-1-2', code: 'RF 1.2', title: 'E-mail' },
    ],
  },
  { id: 'rf-2', code: 'RF 2', title: 'Projetos de impacto' },
  {
    id: 'rf-3',
    code: 'RF 3',
    title: 'Hierarquia profunda',
    children: [
      {
        id: 'rf-3-1',
        code: 'RF 3.1',
        title: 'Nível 2',
        children: [{ id: 'rf-3-1-1', code: 'RF 3.1.1', title: 'Nível 3' }],
      },
    ],
  },
];

describe('checklist state', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
  });

  it('flattens nested requirements and counts progress', () => {
    expect(flattenRequirements(requirements).map((node) => node.id)).toEqual([
      'rf-1',
      'rf-1-1',
      'rf-1-2',
      'rf-2',
      'rf-3',
      'rf-3-1',
      'rf-3-1-1',
    ]);
    expect(countProgress(requirements, { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true })).toEqual({
      completed: 3,
      total: 7,
      percent: 43,
    });
  });

  it('toggles an item without mutating the previous state', () => {
    const initial = { 'rf-2': false };
    const next = toggleChecklist(initial, 'rf-2', requirements);

    expect(next).toEqual({ 'rf-2': true });
    expect(initial).toEqual({ 'rf-2': false });
  });

  it('checks all sub-requirements within the box when a parent requirement is checked', () => {
    const next = toggleChecklist({}, 'rf-1', requirements);

    expect(next).toEqual({
      'rf-1': true,
      'rf-1-1': true,
      'rf-1-2': true,
    });
  });

  it('unchecks all sub-requirements when a parent requirement is unchecked', () => {
    const initial = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const next = toggleChecklist(initial, 'rf-1', requirements);

    expect(next).toEqual({
      'rf-1': false,
      'rf-1-1': false,
      'rf-1-2': false,
    });
  });

  it('unchecks the parent requirement when a sub-requirement is unchecked', () => {
    const initial = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const next = toggleChecklist(initial, 'rf-1-1', requirements);

    expect(next).toEqual({
      'rf-1': false,
      'rf-1-1': false,
      'rf-1-2': true,
    });
  });

  it('automatically checks the parent requirement when all sub-requirements are checked', () => {
    const initial = { 'rf-1': false, 'rf-1-1': true, 'rf-1-2': false };
    const next = toggleChecklist(initial, 'rf-1-2', requirements);

    expect(next).toEqual({
      'rf-1': true,
      'rf-1-1': true,
      'rf-1-2': true,
    });
  });

  it('handles deeply nested sub-requirements recursively', () => {
    const checkedParent = toggleChecklist({}, 'rf-3', requirements);
    expect(checkedParent).toEqual({
      'rf-3': true,
      'rf-3-1': true,
      'rf-3-1-1': true,
    });

    const uncheckedLeaf = toggleChecklist(checkedParent, 'rf-3-1-1', requirements);
    expect(uncheckedLeaf).toEqual({
      'rf-3': false,
      'rf-3-1': false,
      'rf-3-1-1': false,
    });
  });

  it('persists valid checklist entries and ignores unknown ids', () => {
    saveChecklist({ 'rf-2': true, unknown: true });
    expect(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)).toContain('"rf-2":true');

    expect(loadChecklist(CHECKLIST_STORAGE_KEY, requirements)).toEqual({ 'rf-2': true });
  });
});

describe('timestamped checklist state and conflict resolution', () => {
  it('converts timestamped state to plain boolean state', () => {
    const tsState = {
      'rf-1': { value: true, timestamp: 100 },
      'rf-2': { value: false, timestamp: 200 },
    };
    expect(toPlainState(tsState)).toEqual({
      'rf-1': true,
      'rf-2': false,
    });
  });

  it('merges local and remote states based on "latest update wins" per item', () => {
    const localState = {
      'rf-1': { value: true, timestamp: 100 }, // older than remote
      'rf-2': { value: true, timestamp: 300 }, // newer than remote
      'rf-3': { value: false, timestamp: 200 }, // local only
    };

    const remoteState = {
      'rf-1': { value: false, timestamp: 200 }, // remote wins (200 > 100)
      'rf-2': { value: false, timestamp: 150 }, // local wins (300 > 150)
      'rf-4': { value: true, timestamp: 250 },  // remote only
    };

    const merged = mergeTimestampedStates(localState, remoteState);

    expect(merged['rf-1']).toEqual({ value: false, timestamp: 200 });
    expect(merged['rf-2']).toEqual({ value: true, timestamp: 300 });
    expect(merged['rf-3']).toEqual({ value: false, timestamp: 200 });
    expect(merged['rf-4']).toEqual({ value: true, timestamp: 250 });
  });

  it('toggles timestamped state and generates update payloads', () => {
    const initialTs = {
      'rf-2': { value: false, timestamp: 100 },
    };

    const { nextTsState, updates } = toggleTimestampedChecklist(initialTs, 'rf-2', 'back', 500, requirements);

    expect(nextTsState['rf-2']).toEqual({ value: true, timestamp: 500 });
    expect(updates).toContainEqual({ id: 'rf-2', type: 'back', value: true, timestamp: 500 });
  });

  it('loads timestamped checklist with migration from legacy boolean storage', () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    saveChecklist({ 'rf-2': true }, 'legacy-key');
    const loaded = loadTimestampedChecklist('legacy-key', requirements);

    expect(loaded['rf-2']).toEqual({ value: true, timestamp: 0 });
  });
});

describe('getLockedIds', () => {
  it('returns empty set when no items are checked', () => {
    const locked = getLockedIds({}, requirements);
    expect(locked.size).toBe(0);
  });

  it('locks a single checked leaf node', () => {
    const locked = getLockedIds({ 'rf-2': true }, requirements);
    expect(locked.has('rf-2')).toBe(true);
    expect(locked.has('rf-1')).toBe(false);
  });

  it('locks a parent and all its descendants when parent is checked', () => {
    const locked = getLockedIds({ 'rf-1': true }, requirements);
    expect(locked.has('rf-1')).toBe(true);
    expect(locked.has('rf-1-1')).toBe(true);
    expect(locked.has('rf-1-2')).toBe(true);
    expect(locked.has('rf-2')).toBe(false);
  });

  it('cascades through deeply nested hierarchies', () => {
    const locked = getLockedIds({ 'rf-3': true }, requirements);
    expect(locked.has('rf-3')).toBe(true);
    expect(locked.has('rf-3-1')).toBe(true);
    expect(locked.has('rf-3-1-1')).toBe(true);
  });

  it('locks children even when only a mid-level node is checked', () => {
    const locked = getLockedIds({ 'rf-3-1': true }, requirements);
    expect(locked.has('rf-3')).toBe(false);
    expect(locked.has('rf-3-1')).toBe(true);
    expect(locked.has('rf-3-1-1')).toBe(true);
  });
});

describe('countDualProgress', () => {
  it('returns independent progress for back and full checklists', () => {
    const backState = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const fullState = { 'rf-2': true };

    const progress = countDualProgress(requirements, backState, fullState);

    expect(progress.back.completed).toBe(3);
    expect(progress.back.total).toBe(7);
    expect(progress.full.completed).toBe(1);
    expect(progress.full.total).toBe(7);
  });

  it('returns zero progress for empty states', () => {
    const progress = countDualProgress(requirements, {}, {});
    expect(progress.back.completed).toBe(0);
    expect(progress.full.completed).toBe(0);
    expect(progress.back.percent).toBe(0);
    expect(progress.full.percent).toBe(0);
  });
});

describe('dual checklist storage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
  });

  it('persists and loads back checklist independently', () => {
    saveTimestampedChecklist({ 'rf-1': { value: true, timestamp: 100 } }, CHECKLIST_BACK_KEY);
    saveTimestampedChecklist({ 'rf-2': { value: true, timestamp: 100 } }, CHECKLIST_FULL_KEY);

    const backLoaded = loadTimestampedChecklist(CHECKLIST_BACK_KEY, requirements);
    const fullLoaded = loadTimestampedChecklist(CHECKLIST_FULL_KEY, requirements);

    expect(backLoaded['rf-1']).toEqual({ value: true, timestamp: 100 });
    expect(backLoaded['rf-2']).toBeUndefined();
    expect(fullLoaded['rf-2']).toEqual({ value: true, timestamp: 100 });
    expect(fullLoaded['rf-1']).toBeUndefined();
  });
});