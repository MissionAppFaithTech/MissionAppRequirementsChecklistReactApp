import { beforeEach, describe, expect, it } from 'vitest';
import type { RequirementNode } from '@/data/requirements';
import {
  CHECKLIST_STORAGE_KEY,
  countProgress,
  flattenRequirements,
  loadChecklist,
  saveChecklist,
  toggleChecklist,
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

    expect(loadChecklist(requirements)).toEqual({ 'rf-2': true });
  });
});