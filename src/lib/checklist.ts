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
  // Start from the state the user sees (parents derived from children), so a stale stored
  // parent value can never turn a click into a no-op.
  const currentPlain = syncParentStates(nodes, toPlainState(tsState));
  const nextPlain = toggleChecklist(currentPlain, id, nodes);

  const nextTsState: TimestampedChecklistState = { ...tsState };
  const updates: UpdatePayloadItem[] = [];

  for (const { id: nodeId } of flattenRequirements(nodes)) {
    const newVal = Boolean(nextPlain[nodeId]);
    if (Boolean(currentPlain[nodeId]) === newVal) continue;

    nextTsState[nodeId] = { value: newVal, timestamp };
    updates.push({ id: nodeId, type, value: newVal, timestamp });
  }

  return { nextTsState, updates };
};

/**
 * Clears a node and its whole branch in the OPPOSITE checklist, so an item is never
 * checked in `back` and `full` at the same time. Parents are re-derived afterwards, so
 * an ancestor that is no longer fully checked is cleared too.
 * Only genuinely changed nodes are written and returned as cloud updates.
 */
export const clearTimestampedBranch = (
  tsState: TimestampedChecklistState,
  id: string,
  type: 'back' | 'full',
  timestamp: number = Date.now(),
  nodes: RequirementNode[] = allRequirements,
): { nextTsState: TimestampedChecklistState; updates: UpdatePayloadItem[] } => {
  const currentPlain = syncParentStates(nodes, toPlainState(tsState));
  const targetNode = findRequirementNode(nodes, id);
  const branchIds = targetNode ? getDescendantIds(targetNode) : [id];

  const cleared: ChecklistState = { ...currentPlain };
  for (const branchId of branchIds) {
    cleared[branchId] = false;
  }
  const nextPlain = syncParentStates(nodes, cleared);

  const nextTsState: TimestampedChecklistState = { ...tsState };
  const updates: UpdatePayloadItem[] = [];

  for (const node of flattenRequirements(nodes)) {
    const newVal = Boolean(nextPlain[node.id]);
    if (Boolean(currentPlain[node.id]) === newVal) continue;
    nextTsState[node.id] = { value: newVal, timestamp };
    updates.push({ id: node.id, type, value: newVal, timestamp });
  }

  return { nextTsState, updates };
};

/**
 * Toggles an item in a cumulative dual-checklist system:
 * - `back`: backend complete.
 * - `full`: full implementation complete (backend + frontend).
 *
 * Invariants:
 * 1. `full` implies `back`: an item can only be `full` if its `back` is also complete.
 * 2. When checking `full`, `back` is automatically marked completed as well for the node and its descendants.
 *    Marking `full` NEVER clears or decrements `back`.
 * 3. When unchecking `full`, `back` remains checked (backend is still done).
 * 4. When unchecking `back`, `full` is also unchecked (since full requires back).
 * 5. When checking `back`, `full` remains unchanged.
 */
export const toggleCumulative = (
  backTsState: TimestampedChecklistState,
  fullTsState: TimestampedChecklistState,
  id: string,
  type: 'back' | 'full',
  timestamp: number = Date.now(),
  nodes: RequirementNode[] = allRequirements,
): {
  nextBackTsState: TimestampedChecklistState;
  nextFullTsState: TimestampedChecklistState;
  updates: UpdatePayloadItem[];
} => {
  if (type === 'full') {
    const toggledFull = toggleTimestampedChecklist(fullTsState, id, 'full', timestamp, nodes);
    let nextFullTsState = toggledFull.nextTsState;
    let nextBackTsState = backTsState;
    const updates: UpdatePayloadItem[] = [...toggledFull.updates];

    const currentFullPlain = syncParentStates(nodes, toPlainState(nextFullTsState));
    const isNowCheckedInFull = Boolean(currentFullPlain[id]);

    if (isNowCheckedInFull) {
      // Checking full ensures the node and all its descendants are also checked in back.
      const targetNode = findRequirementNode(nodes, id);
      const branchIds = targetNode ? getDescendantIds(targetNode) : [id];
      const currentBackPlain = syncParentStates(nodes, toPlainState(backTsState));
      const nextBackPlain = { ...currentBackPlain };
      let anyBackChanged = false;

      for (const branchId of branchIds) {
        if (!nextBackPlain[branchId]) {
          nextBackPlain[branchId] = true;
          anyBackChanged = true;
        }
      }

      if (anyBackChanged) {
        const syncedBackPlain = syncParentStates(nodes, nextBackPlain);
        nextBackTsState = { ...backTsState };
        for (const node of flattenRequirements(nodes)) {
          const newVal = Boolean(syncedBackPlain[node.id]);
          if (Boolean(currentBackPlain[node.id]) !== newVal) {
            nextBackTsState[node.id] = { value: newVal, timestamp };
            updates.push({ id: node.id, type: 'back', value: newVal, timestamp });
          }
        }
      }
    }

    return { nextBackTsState, nextFullTsState, updates };
  } else {
    // type === 'back'
    const toggledBack = toggleTimestampedChecklist(backTsState, id, 'back', timestamp, nodes);
    let nextBackTsState = toggledBack.nextTsState;
    let nextFullTsState = fullTsState;
    const updates: UpdatePayloadItem[] = [...toggledBack.updates];

    const currentBackPlain = syncParentStates(nodes, toPlainState(nextBackTsState));
    const isNowCheckedInBack = Boolean(currentBackPlain[id]);

    if (!isNowCheckedInBack) {
      // Unchecking back means full cannot remain checked for this node and its descendants.
      const targetNode = findRequirementNode(nodes, id);
      const branchIds = targetNode ? getDescendantIds(targetNode) : [id];
      const currentFullPlain = syncParentStates(nodes, toPlainState(fullTsState));
      const nextFullPlain = { ...currentFullPlain };
      let anyFullChanged = false;

      for (const branchId of branchIds) {
        if (nextFullPlain[branchId]) {
          nextFullPlain[branchId] = false;
          anyFullChanged = true;
        }
      }

      if (anyFullChanged) {
        const syncedFullPlain = syncParentStates(nodes, nextFullPlain);
        nextFullTsState = { ...fullTsState };
        for (const node of flattenRequirements(nodes)) {
          const newVal = Boolean(syncedFullPlain[node.id]);
          if (Boolean(currentFullPlain[node.id]) !== newVal) {
            nextFullTsState[node.id] = { value: newVal, timestamp };
            updates.push({ id: node.id, type: 'full', value: newVal, timestamp });
          }
        }
      }
    }

    return { nextBackTsState, nextFullTsState, updates };
  }
};

/**
 * Compatibility wrapper for toggleExclusive, delegating to cumulative semantics.
 */
export const toggleExclusive = (
  tsState: TimestampedChecklistState,
  oppositeTsState: TimestampedChecklistState,
  id: string,
  type: 'back' | 'full',
  timestamp: number = Date.now(),
  nodes: RequirementNode[] = allRequirements,
): {
  nextTsState: TimestampedChecklistState;
  nextOppositeTsState: TimestampedChecklistState;
  updates: UpdatePayloadItem[];
} => {
  const isBack = type === 'back';
  const back = isBack ? tsState : oppositeTsState;
  const full = isBack ? oppositeTsState : tsState;

  const result = toggleCumulative(back, full, id, type, timestamp, nodes);

  return {
    nextTsState: isBack ? result.nextBackTsState : result.nextFullTsState,
    nextOppositeTsState: isBack ? result.nextFullTsState : result.nextBackTsState,
    updates: result.updates,
  };
};

/**
 * True when a parent is NOT checked in this list but some of its descendants are
 * (the "indeterminate" checkbox state). Leaves are never partial.
 */
export const isPartiallyChecked = (node: RequirementNode, state: ChecklistState): boolean =>
  Boolean(node.children?.length) &&
  !state[node.id] &&
  getDescendantIds(node).slice(1).some((id) => Boolean(state[id]));

/**
 * Brings `current` back to the (derived) values of `previous`, stamping every changed id with
 * `timestamp` so the revert also wins the "latest timestamp" conflict rule in the cloud.
 * Used by "undo": only genuinely different ids are written and returned as updates.
 */
export const restoreTimestampedState = (
  current: TimestampedChecklistState,
  previous: TimestampedChecklistState,
  type: 'back' | 'full',
  timestamp: number = Date.now(),
  nodes: RequirementNode[] = allRequirements,
): { nextTsState: TimestampedChecklistState; updates: UpdatePayloadItem[] } => {
  const currentPlain = syncParentStates(nodes, toPlainState(current));
  const previousPlain = syncParentStates(nodes, toPlainState(previous));

  const nextTsState: TimestampedChecklistState = { ...current };
  const updates: UpdatePayloadItem[] = [];

  for (const { id } of flattenRequirements(nodes)) {
    const target = Boolean(previousPlain[id]);
    if (Boolean(currentPlain[id]) === target) continue;

    nextTsState[id] = { value: target, timestamp };
    updates.push({ id, type, value: target, timestamp });
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