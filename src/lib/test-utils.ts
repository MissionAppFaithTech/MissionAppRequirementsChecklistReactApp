import type { RequirementNode } from '@/data/requirements';
import type { TimestampedChecklistState } from './checklist';

/**
 * Small hand-made tree covering every shape the engine must handle:
 * leaf roots, 1/2/3-level branches, mixed leaf+branch siblings and an empty `children` array.
 */
export const fixture: RequirementNode[] = [
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
  {
    id: 'rf-4',
    code: 'RF 4',
    title: 'Misto',
    children: [
      { id: 'rf-4-1', code: 'RF 4.1', title: 'Folha irmã' },
      {
        id: 'rf-4-2',
        code: 'RF 4.2',
        title: 'Ramo',
        children: [
          { id: 'rf-4-2-1', code: 'RF 4.2.1', title: 'Neto A' },
          { id: 'rf-4-2-2', code: 'RF 4.2.2', title: 'Neto B' },
        ],
      },
    ],
  },
  { id: 'rf-5', code: 'RF 5', title: 'Sem filhos de verdade', children: [] },
];

export const FIXTURE_IDS = [
  'rf-1', 'rf-1-1', 'rf-1-2',
  'rf-2',
  'rf-3', 'rf-3-1', 'rf-3-1-1',
  'rf-4', 'rf-4-1', 'rf-4-2', 'rf-4-2-1', 'rf-4-2-2',
  'rf-5',
];

/** Builds a timestamped state from a plain `{id: boolean}` map. */
export const ts = (state: Record<string, boolean>, timestamp = 1): TimestampedChecklistState =>
  Object.fromEntries(Object.entries(state).map(([id, value]) => [id, { value, timestamp }]));

/** Ids that are `true` in a plain state, sorted — easier to read in failures than a full map. */
export const checkedIds = (state: Record<string, boolean>): string[] =>
  Object.entries(state).filter(([, value]) => value).map(([id]) => id).sort();

/** Installs a hand-rolled `window.localStorage` (the suite runs in plain node, no jsdom). */
export const installLocalStorage = (options: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      localStorage: {
        getItem: (key: string) => {
          if (options.throwOnGet) throw new Error('storage unavailable');
          return storage.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (options.throwOnSet) throw new Error('quota exceeded');
          storage.set(key, value);
        },
      },
    },
  });
  return storage;
};

export const removeWindow = () => {
  Reflect.deleteProperty(globalThis, 'window');
};

/** Deterministic PRNG (mulberry32) so the random-walk tests are reproducible. */
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
