import { describe, expect, it } from 'vitest';
import { flattenRequirements } from '@/lib/checklist';
import { allRequirements, functionalRequirements, nonFunctionalRequirements, normalizeText } from './requirements';

const flat = flattenRequirements(allRequirements);

describe('requirement corpus integrity (ids are persistence keys)', () => {
  it('has no duplicate ids', () => {
    const ids = flat.map((n) => n.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('has no duplicate codes', () => {
    const codes = flat.map((n) => n.code);
    expect(codes.filter((code, i) => codes.indexOf(code) !== i)).toEqual([]);
  });

  it('uses url-safe lowercase ids', () => {
    expect(flat.filter((n) => !/^[a-z0-9-]+$/.test(n.id)).map((n) => n.id)).toEqual([]);
  });

  it('prefixes every child id with its parent id', () => {
    const wrong: string[] = [];
    const walk = (node: (typeof flat)[number]) =>
      node.children?.forEach((child) => {
        if (!child.id.startsWith(`${node.id}-`)) wrong.push(`${node.id} > ${child.id}`);
        walk(child);
      });
    allRequirements.forEach(walk);
    expect(wrong).toEqual([]);
  });

  it('has trimmed, non-empty titles and codes', () => {
    expect(flat.filter((n) => !n.title.trim() || !n.code.trim()).map((n) => n.id)).toEqual([]);
    expect(flat.filter((n) => n.title !== n.title.trim() || n.code !== n.code.trim()).map((n) => n.id)).toEqual([]);
  });

  it('has no empty `children` arrays (a parent must have children)', () => {
    expect(flat.filter((n) => n.children && n.children.length === 0).map((n) => n.id)).toEqual([]);
  });

  it('allRequirements is functional followed by non-functional', () => {
    expect(allRequirements).toEqual([...functionalRequirements, ...nonFunctionalRequirements]);
  });
});

describe('hardcoded UI copy stays in sync with the data', () => {
  it('has the 20 functional requirements announced as "RF 01 — RF 20"', () => {
    expect(functionalRequirements.map((n) => n.code)).toEqual(Array.from({ length: 20 }, (_, i) => `RF ${i + 1}`));
  });

  it('has the 6 non-functional requirements announced as "NF 01 — NF 06"', () => {
    expect(nonFunctionalRequirements.map((n) => n.code)).toEqual(Array.from({ length: 6 }, (_, i) => `NF.${i + 1}`));
  });

  it('keeps the sidebar numbering (code with the RF/NF prefix stripped) numeric', () => {
    const numbers = allRequirements.map((n) => n.code.replace('RF ', '').replace('NF.', ''));
    expect(numbers.every((value) => /^\d+$/.test(value))).toBe(true);
  });

  it('has at least one sub-requirement under every top-level group', () => {
    expect(allRequirements.filter((n) => !n.children?.length).map((n) => n.id)).toEqual([]);
  });
});

describe('normalizeText', () => {
  it.each([
    ['Ação', 'acao'],
    ['AÇÃO', 'acao'],
    ['Não funcional', 'nao funcional'],
    ['  espaços  ', 'espacos'],
    ['É-mail', 'e-mail'],
    ['', ''],
    ['   ', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = normalizeText('Atenção ÀS Regras');
    expect(normalizeText(once)).toBe(once);
  });

  it('works on a decomposed (NFD) input as well as precomposed', () => {
    expect(normalizeText('á')).toBe(normalizeText('á'));
  });

  it('keeps digits and punctuation', () => {
    expect(normalizeText('RF 1.2.3')).toBe('rf 1.2.3');
  });
});
