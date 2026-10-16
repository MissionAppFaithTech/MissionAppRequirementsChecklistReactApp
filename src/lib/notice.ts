export type ChecklistType = 'back' | 'full';

export const CHECKLIST_LABELS: Record<ChecklistType, string> = {
  back: 'Back',
  full: 'Back e Front',
};

/**
 * Message shown (and announced) when checking an item moved it out of the other checklist.
 * `movedCount` is how many entries were cleared in the other list (a parent counts with its children).
 */
export const describeMove = (code: string, to: ChecklistType, movedCount: number): string => {
  const from: ChecklistType = to === 'back' ? 'full' : 'back';
  const extra = movedCount > 1 ? ` (${movedCount} itens)` : '';
  return `${code} movido de “${CHECKLIST_LABELS[from]}” para “${CHECKLIST_LABELS[to]}”${extra}.`;
};
