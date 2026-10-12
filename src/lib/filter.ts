import { normalizeText, type RequirementNode } from '@/data/requirements';
import type { ChecklistState } from '@/lib/checklist';

export type FilterMode = 'all' | 'open' | 'done';

export function nodeMatches(node: RequirementNode, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeText(`${node.code} ${node.title} ${node.description ?? ''}`);
  return haystack.includes(normalizeText(query)) || Boolean(node.children?.some((child) => nodeMatches(child, query)));
}

export function filterNode(node: RequirementNode, query: string, mode: FilterMode, backState: ChecklistState, fullState: ChecklistState): RequirementNode | null {
  const children = node.children?.map((child) => filterNode(child, query, mode, backState, fullState)).filter(Boolean) as RequirementNode[] | undefined;
  const ownMatch = nodeMatches(node, query);
  const descendantMatch = Boolean(children?.length);
  const isDone = Boolean(backState[node.id]) || Boolean(fullState[node.id]);
  const statusMatch = mode === 'all' || (mode === 'done' ? isDone || descendantMatch : !isDone || descendantMatch);
  if ((!ownMatch && !children?.length) || !statusMatch) return null;
  return { ...node, children };
}
