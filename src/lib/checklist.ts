import { allRequirements, type RequirementNode } from '@/data/requirements';

export const CHECKLIST_STORAGE_KEY = 'mission-app-requirements:checklist:v1';
export const CHECKLIST_BACK_KEY = 'mission-app-requirements:checklist-back:v1';
export const CHECKLIST_FULL_KEY = 'mission-app-requirements:checklist-full:v1';
export type ChecklistState = Record<string, boolean>;

export const flattenRequirements = (nodes: RequirementNode[]): RequirementNode[] =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenRequirements(node.children) : [])]);

export const countProgress = (nodes: RequirementNode[], state: ChecklistState) => {
  const all = flattenRequirements(nodes);
  const completed = all.filter((node) => state[node.id]).length;
  return { completed, total: all.length, percent: all.length ? Math.round((completed / all.length) * 100) : 0 };
};

export type ProgressInfo = ReturnType<typeof countProgress>;

export const countDualProgress = (
  nodes: RequirementNode[],
  backState: ChecklistState,
  fullState: ChecklistState,
) => ({
  back: countProgress(nodes, backState),
  full: countProgress(nodes, fullState),
});

/**
 * Returns a Set of node IDs that should be LOCKED (disabled) in the opposite checklist.
 * A node is locked if it, or any ancestor, is checked in the given state.
 */
export const getLockedIds = (state: ChecklistState, nodes: RequirementNode[]): Set<string> => {
  const locked = new Set<string>();

  const walk = (node: RequirementNode, ancestorLocked: boolean) => {
    const selfLocked = ancestorLocked || Boolean(state[node.id]);
    if (selfLocked) locked.add(node.id);
    if (node.children) {
      for (const child of node.children) {
        walk(child, selfLocked);
      }
    }
  };

  for (const node of nodes) {
    walk(node, false);
  }

  return locked;
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

export const loadChecklist = (storageKey: string = CHECKLIST_STORAGE_KEY, nodes: RequirementNode[] = allRequirements): ChecklistState => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as unknown;
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

export const saveChecklist = (state: ChecklistState, storageKey: string = CHECKLIST_STORAGE_KEY) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(state));
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