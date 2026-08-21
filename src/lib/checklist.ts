import { allRequirements, type RequirementNode } from '@/data/requirements';

export const CHECKLIST_STORAGE_KEY = 'mission-app-requirements:checklist:v1';
export const CHECKLIST_BACK_KEY = 'mission-app-requirements:checklist-back:v1';
export const CHECKLIST_FULL_KEY = 'mission-app-requirements:checklist-full:v1';

export type ChecklistState = Record<string, boolean>;

export type TimestampedItem = {
  value: boolean;
  timestamp: number;
};

export type TimestampedChecklistState = Record<string, TimestampedItem>;

export type CloudChecklistState = {
  back: TimestampedChecklistState;
  full: TimestampedChecklistState;
};

export type UpdatePayloadItem = {
  id: string;
  type: 'back' | 'full';
  value: boolean;
  timestamp: number;
};

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

/**
 * Converts a TimestampedChecklistState to a plain boolean ChecklistState.
 */
export const toPlainState = (tsState: TimestampedChecklistState): ChecklistState => {
  const plain: ChecklistState = {};
  for (const [id, item] of Object.entries(tsState)) {
    plain[id] = item.value;
  }
  return plain;
};

/**
 * Merges local and remote timestamped states using the per-item "latest timestamp wins" rule.
 */
export const mergeTimestampedStates = (
  localState: TimestampedChecklistState,
  remoteState: TimestampedChecklistState,
): TimestampedChecklistState => {
  const merged: TimestampedChecklistState = { ...localState };

  for (const [id, remoteItem] of Object.entries(remoteState)) {
    const localItem = localState[id];
    if (!localItem || remoteItem.timestamp > localItem.timestamp) {
      merged[id] = remoteItem;
    }
  }

  return merged;
};

/**
 * Loads timestamped checklist state from localStorage with fallback for legacy boolean states.
 */
export const loadTimestampedChecklist = (
  storageKey: string = CHECKLIST_STORAGE_KEY,
  nodes: RequirementNode[] = allRequirements,
): TimestampedChecklistState => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};

    const validIds = new Set(flattenRequirements(nodes).map((node) => node.id));
    const result: TimestampedChecklistState = {};

    for (const [id, value] of Object.entries(saved)) {
      if (!validIds.has(id)) continue;

      if (typeof value === 'boolean') {
        // Migration from legacy boolean storage
        result[id] = { value, timestamp: 0 };
      } else if (
        typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        'timestamp' in value &&
        typeof (value as TimestampedItem).value === 'boolean' &&
        typeof (value as TimestampedItem).timestamp === 'number'
      ) {
        result[id] = value as TimestampedItem;
      }
    }

    return result;
  } catch {
    return {};
  }
};

/**
 * Saves timestamped checklist state to localStorage.
 */
export const saveTimestampedChecklist = (
  state: TimestampedChecklistState,
  storageKey: string = CHECKLIST_STORAGE_KEY,
) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }
};

export const loadChecklist = (
  storageKey: string = CHECKLIST_STORAGE_KEY,
  nodes: RequirementNode[] = allRequirements,
): ChecklistState => {
  const tsState = loadTimestampedChecklist(storageKey, nodes);
  const plain = toPlainState(tsState);
  return syncParentStates(nodes, plain);
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

/**
 * Toggles an item in timestamped state, updating timestamps for all modified nodes.
 * Returns the new timestamped state and the list of update payloads for cloud sync.
 */
export const toggleTimestampedChecklist = (
  tsState: TimestampedChecklistState,
  id: string,
  type: 'back' | 'full',
  timestamp: number = Date.now(),
  nodes: RequirementNode[] = allRequirements,
): { nextTsState: TimestampedChecklistState; updates: UpdatePayloadItem[] } => {
  const currentPlain = toPlainState(tsState);
  const nextPlain = toggleChecklist(currentPlain, id, nodes);

  const nextTsState: TimestampedChecklistState = { ...tsState };
  const updates: UpdatePayloadItem[] = [];

  const allNodeIds = flattenRequirements(nodes).map((n) => n.id);

  for (const nodeId of allNodeIds) {
    const prevVal = Boolean(currentPlain[nodeId]);
    const newVal = Boolean(nextPlain[nodeId]);

    if (prevVal !== newVal || !tsState[nodeId]) {
      const item: TimestampedItem = { value: newVal, timestamp };
      nextTsState[nodeId] = item;
      updates.push({ id: nodeId, type, value: newVal, timestamp });
    }
  }

  return { nextTsState, updates };
};

/* --- Cloud Storage API Helpers --- */

export const fetchCloudState = async (): Promise<CloudChecklistState | null> => {
  try {
    const res = await fetch('/api/checklist', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CloudChecklistState;
    if (data && typeof data === 'object' && ('back' in data || 'full' in data)) {
      return {
        back: data.back ?? {},
        full: data.full ?? {},
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch cloud state from Vercel KV:', err);
    return null;
  }
};

export const syncCloudItems = async (updates: UpdatePayloadItem[]): Promise<CloudChecklistState | null> => {
  if (!updates.length) return null;
  try {
    const res = await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CloudChecklistState;
  } catch (err) {
    console.warn('Could not sync items with Vercel KV:', err);
    return null;
  }
};

export const resetCloudState = async (): Promise<CloudChecklistState | null> => {
  try {
    const res = await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CloudChecklistState;
  } catch (err) {
    console.warn('Could not reset cloud state in Vercel KV:', err);
    return null;
  }
};