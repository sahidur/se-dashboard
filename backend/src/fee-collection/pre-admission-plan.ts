export type PlanAction = 'CANCEL' | 'MOVE';

export interface PlanItem {
  receiptNumber: string;
  action: PlanAction;
  /** MOVE only: month (1-12) of the same student/year to apply the payment to. */
  targetMonth?: number;
  /** MOVE only: apply the whole payment to this fee head of the target month
   *  (when it was recorded against the wrong head). */
  reallocateHead?: string;
  line: number;
}

/**
 * Parses the approved plan: one payment per line,
 *   receipt_number,action[,target_month[,fee head name]]
 * action is CANCEL or MOVE (MOVE needs target_month). Blank lines, lines
 * starting with # and a header line are ignored. Throws on anything unclear,
 * so a typo can never turn into a wrong financial change.
 */
export function parsePlan(text: string): PlanItem[] {
  const items: PlanItem[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(',').map((c) => c.trim());
    const [receipt, actionRaw, monthRaw] = parts;
    // head names may contain commas and spaces: take the raw text after the 3rd comma
    let cut = -1;
    for (let k = 0; k < 3 && (k === 0 || cut >= 0); k++) cut = line.indexOf(',', cut + 1);
    const headRaw = cut >= 0 ? line.slice(cut + 1).trim() : '';
    if (index === 0 && /^receipt/i.test(receipt)) return; // header
    const action = (actionRaw ?? '').toUpperCase();
    if (!/^RCPT-\d{4}-\d{6}$/.test(receipt ?? '')) {
      throw new Error(`Line ${index + 1}: "${receipt}" is not a receipt number like RCPT-2026-000123`);
    }
    if (action !== 'CANCEL' && action !== 'MOVE') {
      throw new Error(`Line ${index + 1}: action must be CANCEL or MOVE, got "${actionRaw ?? ''}"`);
    }
    let targetMonth: number | undefined;
    if (action === 'MOVE') {
      targetMonth = Number(monthRaw);
      if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
        throw new Error(`Line ${index + 1}: MOVE needs a target month between 1 and 12`);
      }
    } else if (monthRaw) {
      throw new Error(`Line ${index + 1}: CANCEL must not have a target month`);
    }
    if (headRaw && action !== 'MOVE') throw new Error(`Line ${index + 1}: only MOVE can name a fee head`);
    if (seen.has(receipt)) throw new Error(`Line ${index + 1}: ${receipt} appears twice`);
    seen.add(receipt);
    items.push({
      receiptNumber: receipt,
      action: action as PlanAction,
      targetMonth,
      reallocateHead: headRaw || undefined,
      line: index + 1,
    });
  });
  if (items.length === 0) throw new Error('The plan file has no payments in it');
  return items;
}
