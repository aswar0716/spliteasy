import {
  WoolworthsSession,
  RestaurantSession,
  UniversalSession,
  PersonSplit,
  SplitResult,
} from '../types';

const ME = 'me';

// ─── Woolworths ───────────────────────────────────────────────────────────────

export function calculateWoolworthsSplit(
  session: WoolworthsSession,
  friendMap: Record<string, string>,
): SplitResult {
  const subtotals: Record<string, number> = {};
  const savings: Record<string, number> = {};

  const allPeople = new Set<string>([ME]);
  session.items.forEach(item => {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    people.forEach(p => allPeople.add(p));
  });

  allPeople.forEach(p => { subtotals[p] = 0; savings[p] = 0; });

  for (const item of session.items) {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    const afterProductDiscount = item.originalPrice * (1 - item.productDiscount / 100);
    const storeDiscountAmt = afterProductDiscount * (session.storeDiscount / 100);
    const finalItemPrice = afterProductDiscount - storeDiscountAmt;
    const totalSaving = item.originalPrice - finalItemPrice;
    const pricePerPerson = finalItemPrice / people.length;
    const savingPerPerson = totalSaving / people.length;
    people.forEach(p => {
      subtotals[p] = (subtotals[p] ?? 0) + pricePerPerson;
      savings[p] = (savings[p] ?? 0) + savingPerPerson;
    });
  }

  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);

  const splits: PersonSplit[] = Array.from(allPeople).map(id => {
    const sub = subtotals[id] ?? 0;
    const voucherSaving = totalSubtotal > 0 ? (sub / totalSubtotal) * session.voucher : 0;
    const total = Math.max(0, sub - voucherSaving);
    return {
      friendId: id,
      name: id === ME ? 'Me' : (friendMap[id] ?? id),
      subtotal: round(sub),
      discount: round(savings[id] ?? 0),
      feeShare: 0,
      voucherSaving: round(voucherSaving),
      total: round(total),
    };
  });

  return {
    session,
    type: 'woolworths',
    splits,
    grandTotal: round(splits.reduce((s, p) => s + p.total, 0)),
  };
}

// ─── Restaurant / DoorDash ────────────────────────────────────────────────────

export function calculateRestaurantSplit(
  session: RestaurantSession,
  friendMap: Record<string, string>,
): SplitResult {
  const subtotals: Record<string, number> = {};
  const allPeople = new Set<string>([ME]);

  session.items.forEach(item => {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    people.forEach(p => allPeople.add(p));
  });

  allPeople.forEach(p => (subtotals[p] = 0));

  for (const item of session.items) {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    const pricePerPerson = item.price / people.length;
    people.forEach(p => {
      subtotals[p] = (subtotals[p] ?? 0) + pricePerPerson;
    });
  }

  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);

  const splits: PersonSplit[] = Array.from(allPeople).map(id => {
    const sub = subtotals[id] ?? 0;
    const feeShare = totalSubtotal > 0 ? (sub / totalSubtotal) * session.extraFees : 0;
    return {
      friendId: id,
      name: id === ME ? 'Me' : (friendMap[id] ?? id),
      subtotal: round(sub),
      discount: 0,
      feeShare: round(feeShare),
      voucherSaving: 0,
      total: round(sub + feeShare),
    };
  });

  return {
    session,
    type: 'restaurant',
    splits,
    grandTotal: round(splits.reduce((s, p) => s + p.total, 0)),
  };
}

// ─── Universal (Smart Split) ──────────────────────────────────────────────────
/**
 * Handles any bill type:
 *   1. Per item: apply productDiscount % → then storeDiscount % → final price
 *   2. Split final price equally among assignees
 *   3. Apply voucher proportionally (deduction)
 *   4. Apply extraFees proportionally (addition)
 */
export function calculateUniversalSplit(
  session: UniversalSession,
  friendMap: Record<string, string>,
): SplitResult {
  const subtotals: Record<string, number> = {};
  const savings: Record<string, number> = {};
  const allPeople = new Set<string>([ME]);

  session.items.forEach(item => {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    people.forEach(p => allPeople.add(p));
  });

  allPeople.forEach(p => { subtotals[p] = 0; savings[p] = 0; });

  for (const item of session.items) {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    const afterProduct = item.originalPrice * (1 - item.productDiscount / 100);
    const afterStore = afterProduct * (1 - session.storeDiscount / 100);
    const saved = item.originalPrice - afterStore;
    const pricePerPerson = afterStore / people.length;
    const savedPerPerson = saved / people.length;
    people.forEach(p => {
      subtotals[p] = (subtotals[p] ?? 0) + pricePerPerson;
      savings[p] = (savings[p] ?? 0) + savedPerPerson;
    });
  }

  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);

  const splits: PersonSplit[] = Array.from(allPeople).map(id => {
    const sub = subtotals[id] ?? 0;
    const proportion = totalSubtotal > 0 ? sub / totalSubtotal : 0;
    const voucherSaving = proportion * session.voucher;
    const feeShare = proportion * session.extraFees;
    const total = Math.max(0, sub - voucherSaving + feeShare);
    return {
      friendId: id,
      name: id === ME ? 'Me' : (friendMap[id] ?? id),
      subtotal: round(sub),
      discount: round(savings[id] ?? 0),
      feeShare: round(feeShare),
      voucherSaving: round(voucherSaving),
      total: round(total),
    };
  });

  return {
    session,
    type: 'universal',
    splits,
    grandTotal: round(splits.reduce((s, p) => s + p.total, 0)),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
