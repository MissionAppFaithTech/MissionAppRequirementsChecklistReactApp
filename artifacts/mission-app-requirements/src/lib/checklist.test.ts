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
    title: 'Cadastro',
    children: [
      { id: 'rf-1-1', title: 'Nome completo' },
      { id: 'rf-1-2', title: 'E-mail' },
    ],
  },
  { id: 'rf-2', title: 'Projetos de impacto' },
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
    ]);
    expect(countProgress(requirements, { 'rf-1': true, 'rf-1-1': true })).toEqual({
      completed: 2,
      total: 4,
      percent: 50,
    });
  });

  it('toggles an item without mutating the previous state', () => {
    const initial = { 'rf-1-1': false };
    const next = toggleChecklist(initial, 'rf-1-1');

    expect(next).toEqual({ 'rf-1-1': true });
    expect(initial).toEqual({ 'rf-1-1': false });
  });

  it('persists valid checklist entries and ignores unknown ids', () => {
    saveChecklist({ 'rf-1': true, unknown: true });
    expect(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)).toContain('"rf-1":true');

    expect(loadChecklist(requirements)).toEqual({ 'rf-1': true });
  });
});