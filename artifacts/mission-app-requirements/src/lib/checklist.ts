import type { RequirementNode } from '@/data/requirements';

export const CHECKLIST_STORAGE_KEY = 'mission-app-requirements:checklist:v1';
export type ChecklistState = Record<string, boolean>;

export const flattenRequirements = (nodes: RequirementNode[]): RequirementNode[] =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenRequirements(node.children) : [])]);

export const countProgress = (nodes: RequirementNode[], state: ChecklistState) => {
  const all = flattenRequirements(nodes);
  const completed = all.filter((node) => state[node.id]).length;
  return { completed, total: all.length, percent: all.length ? Math.round((completed / all.length) * 100) : 0 };
};

export const loadChecklist = (nodes: RequirementNode[]): ChecklistState => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const validIds = new Set(flattenRequirements(nodes).map((node) => node.id));
    return Object.fromEntries(
      Object.entries(saved).filter(([id, value]) => validIds.has(id) && typeof value === 'boolean'),
    );
  } catch {
    return {};
  }
};

export const saveChecklist = (state: ChecklistState) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
};

export const toggleChecklist = (state: ChecklistState, id: string): ChecklistState => ({
  ...state,
  [id]: !state[id],
});