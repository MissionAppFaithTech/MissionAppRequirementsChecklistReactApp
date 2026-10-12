import { describe, expect, it } from 'vitest';
import type { RequirementNode } from '@/data/requirements';
import { filterNode, nodeMatches } from './filter';
import { fixture } from './test-utils';

const tree: RequirementNode[] = [
  {
    id: 'a',
    code: 'RF 1',
    title: 'Autenticação',
    description: 'Login com e-mail',
    children: [
      { id: 'a1', code: 'RF 1.1', title: 'Recuperar senha' },
      { id: 'a2', code: 'RF 1.2', title: 'Sessão', description: 'Expira em 30 dias' },
    ],
  },
  { id: 'b', code: 'RF 2', title: 'Perfil missionário' },
];

const ids = (nodes: Array<RequirementNode | null>): string[] =>
  nodes.flatMap((n) => (n ? [n.id, ...ids(n.children ?? [])] : []));

const visible = (mode: 'all' | 'open' | 'done', query: string, back: Record<string, boolean>, full: Record<string, boolean>) =>
  ids(tree.map((node) => filterNode(node, query, mode, back, full)));

describe('nodeMatches', () => {
  it('matches everything for an empty query', () => {
    expect(nodeMatches(tree[1], '')).toBe(true);
  });

  it('matches everything for a whitespace-only query', () => {
    expect(nodeMatches(tree[1], '   ')).toBe(true);
  });

  it('matches by title, code and description', () => {
    expect(nodeMatches(tree[1], 'perfil')).toBe(true);
    expect(nodeMatches(tree[1], 'rf 2')).toBe(true);
    expect(nodeMatches(tree[0], 'login')).toBe(true);
  });

  it('ignores case and accents in both directions', () => {
    expect(nodeMatches(tree[0], 'AUTENTICACAO')).toBe(true);
    expect(nodeMatches(tree[0], 'autenticação')).toBe(true);
    expect(nodeMatches(tree[1], 'missionario')).toBe(true);
    expect(nodeMatches(tree[1], 'MISSIONÁRIO')).toBe(true);
  });

  it('trims the query', () => {
    expect(nodeMatches(tree[1], '  perfil  ')).toBe(true);
  });

  it('matches when only a descendant matches', () => {
    expect(nodeMatches(tree[0], 'recuperar')).toBe(true);
    expect(nodeMatches(tree[0], '30 dias')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(nodeMatches(tree[1], 'pagamento')).toBe(false);
  });

  it('treats regex metacharacters literally', () => {
    expect(nodeMatches(tree[1], '.*')).toBe(false);
    expect(nodeMatches(tree[1], '(')).toBe(false);
    expect(nodeMatches(tree[1], '[')).toBe(false);
  });

  it('copes with a node without description or children', () => {
    expect(nodeMatches({ id: 'x', code: 'X', title: 'Só título' }, 'titulo')).toBe(true);
  });
});

describe('filterNode — status filter, no query', () => {
  it('"all" keeps the whole tree', () => {
    expect(visible('all', '', {}, {})).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('"all" returns a structurally equal copy and does not mutate the original', () => {
    const before = JSON.stringify(tree);
    const copy = filterNode(tree[0], '', 'all', {}, {});
    expect(copy).toEqual(tree[0]);
    expect(copy).not.toBe(tree[0]);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('"open" with nothing checked keeps everything', () => {
    expect(visible('open', '', {}, {})).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('"done" with nothing checked keeps nothing', () => {
    expect(visible('done', '', {}, {})).toEqual([]);
  });

  it('counts an item as done when it is done in the back list', () => {
    expect(visible('done', '', { b: true }, {})).toEqual(['b']);
  });

  it('counts an item as done when it is done in the full list', () => {
    expect(visible('done', '', {}, { b: true })).toEqual(['b']);
  });

  it('"open" hides finished leaves (either list)', () => {
    expect(visible('open', '', { b: true }, {})).toEqual(['a', 'a1', 'a2']);
    expect(visible('open', '', {}, { b: true })).toEqual(['a', 'a1', 'a2']);
  });

  it('"open" hides a fully finished branch entirely', () => {
    const done = { a: true, a1: true, a2: true };
    expect(visible('open', '', done, {})).toEqual(['b']);
  });

  it('"open" keeps a partly finished parent but only with its open children', () => {
    expect(visible('open', '', { a1: true }, {})).toEqual(['a', 'a2', 'b']);
  });

  it('"done" shows a partly finished parent with only its finished children', () => {
    expect(visible('done', '', { a1: true }, {})).toEqual(['a', 'a1']);
  });

  it('"done" shows a fully finished branch in full', () => {
    expect(visible('done', '', { a: true, a1: true, a2: true }, {})).toEqual(['a', 'a1', 'a2']);
  });

  it('a branch whose children are split between back and full counts as done in "done" mode', () => {
    expect(visible('done', '', { a1: true }, { a2: true })).toEqual(['a', 'a1', 'a2']);
  });
});

describe('filterNode — query', () => {
  it('prunes non-matching siblings but keeps the matching ancestor chain', () => {
    expect(visible('all', 'recuperar', {}, {})).toEqual(['a', 'a1']);
  });

  it('keeps a parent that matches by itself but prunes every child that does not match (UX: the card shows no sub-items)', () => {
    expect(visible('all', 'autenticacao', {}, {})).toEqual(['a']);
  });

  it('returns nothing when nothing matches', () => {
    expect(visible('all', 'zzz', {}, {})).toEqual([]);
  });

  it('combines query and status: query matches a done item but mode is "open"', () => {
    expect(visible('open', 'perfil', { b: true }, {})).toEqual([]);
  });

  it('combines query and status: query matches a done item and mode is "done"', () => {
    expect(visible('done', 'perfil', { b: true }, {})).toEqual(['b']);
  });

  it('a leaf has `children` undefined, a pruned parent has an empty array', () => {
    expect(filterNode(tree[1], '', 'all', {}, {})?.children).toBeUndefined();
    expect(filterNode(tree[0], 'autenticacao', 'all', {}, {})?.children).toEqual([]);
  });
});

describe('filterNode — fixture edge cases', () => {
  it('handles nodes with an empty children array', () => {
    const node = fixture[4];
    expect(filterNode(node, '', 'all', {}, {})?.id).toBe('rf-5');
    expect(filterNode(node, '', 'done', {}, {})).toBeNull();
    expect(filterNode(node, '', 'done', { 'rf-5': true }, {})?.id).toBe('rf-5');
  });

  it('prunes deep trees level by level', () => {
    const node = filterNode(fixture[3], 'neto b', 'all', {}, {});
    expect(ids([node])).toEqual(['rf-4', 'rf-4-2', 'rf-4-2-2']);
  });
});
