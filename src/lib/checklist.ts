import { allRequirements, type RequirementNode } from '@/data/requirements';

export const CHECKLIST_STORAGE_KEY = 'mission-app-requirements:checklist:v1';
export type ChecklistState = Record<string, boolean>;

export const flattenRequirements = (nodes: RequirementNode[]): RequirementNode[] =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenRequirements(node.children) : [])]);

export const countProgress = (nodes: RequirementNode[], state: ChecklistState) => {
  const all = flattenRequirements(nodes);
  const completed = all.filter((node) => state[node.id]).length;
  return { completed, total: all.length, percent: all.length ? Math.round((completed / all.length) * 100) : 0 };
};

export const findRequirementNode = (nodes: RequirementNode[], id: string): RequirementNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findRequirementNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const getDescendantIds = (node: RequirementNode): string[] => {
  const ids: string[] = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...getDescendantIds(child));
    }
  }
  return ids;
};

export const syncParentStates = (nodes: RequirementNode[], state: ChecklistState): ChecklistState => {
  let updatedState = { ...state };

  const updateNode = (node: RequirementNode): boolean => {
    if (!node.children || node.children.length === 0) {
      return Boolean(updatedState[node.id]);
    }

    const childrenChecked = node.children.map((child) => updateNode(child));
    const allChecked = childrenChecked.every(Boolean);

    if (allChecked) {
      updatedState[node.id] = true;
    } else if (updatedState[node.id]) {
      updatedState[node.id] = false;
    }

    return allChecked;
  };

  for (const node of nodes) {
    updateNode(node);
  }

  return updatedState;
};

export const loadChecklist = (nodes: RequirementNode[] = allRequirements): ChecklistState => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const validIds = new Set(flattenRequirements(nodes).map((node) => node.id));
    const rawState = Object.fromEntries(
      Object.entries(saved).filter(([id, value]) => validIds.has(id) && typeof value === 'boolean'),
    );
    return syncParentStates(nodes, rawState);
  } catch {
    return {};
  }
};

export const saveChecklist = (state: ChecklistState) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
};

export const toggleChecklist = (
  state: ChecklistState,
  id: string,
  nodes: RequirementNode[] = allRequirements,
): ChecklistState => {
  const targetNode = findRequirementNode(nodes, id);
  const nextVal = !state[id];

  let nextState = { ...state };

  if (targetNode) {
    const descendantIds = getDescendantIds(targetNode);
    for (const descId of descendantIds) {
      nextState[descId] = nextVal;
    }
  } else {
    nextState[id] = nextVal;
  }

  return syncParentStates(nodes, nextState);
};