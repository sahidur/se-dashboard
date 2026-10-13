import { toMoney } from '../fee-management/fee-calculation';
import { Payment } from './entities/payment.entity';
import { StudentFee } from './entities/student-fee.entity';

type Breakdown = StudentFee['breakdown'];

/**
 * Paid amount per fee head for one month, from the month's completed
 * payments. Payments that carry explicit head allocations are summed per
 * head; legacy month-level payments (no allocations) fill heads in
 * breakdown order, skipping heads already covered by other payments —
 * so the same money is never attributed to a head twice. Any legacy
 * surplus beyond all heads' payable (over-collection in old data) is
 * spread by payable share so the head sum still equals the payment amount.
 * The two payment kinds can coexist on one fee — each payment is
 * attributed independently.
 */
export function computeHeadWisePaid(
  breakdown: Breakdown,
  payments: Payment[],
): Map<string, number> {
  const paid = new Map<string, number>();

  for (const p of payments ?? []) {
    const allocations = p.allocations ?? [];
    if (allocations.length > 0) {
      for (const a of allocations) {
        paid.set(a.feeHeadId, toMoney((paid.get(a.feeHeadId) ?? 0) + (a.amount ?? 0)));
      }
      continue;
    }

    let left = toMoney(parseFloat(p.amount));
    for (const b of breakdown) {
      if (left <= 0.009) break;
      const remaining = toMoney(b.payable - (paid.get(b.feeHeadId) ?? 0));
      if (remaining <= 0) continue;
      const pay = Math.min(remaining, left);
      paid.set(b.feeHeadId, toMoney((paid.get(b.feeHeadId) ?? 0) + pay));
      left = toMoney(left - pay);
    }
    if (left > 0.009 && breakdown.length > 0) {
      const payableTotal = breakdown.reduce((s, b) => s + b.payable, 0);
      if (payableTotal > 0) {
        for (const b of breakdown) {
          const extra = (left * b.payable) / payableTotal;
          paid.set(b.feeHeadId, toMoney((paid.get(b.feeHeadId) ?? 0) + extra));
        }
      }
    }
  }

  return paid;
}
