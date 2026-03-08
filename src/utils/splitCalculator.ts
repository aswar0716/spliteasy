import { WoolworthsSession, RestaurantSession, PersonSplit, SplitResult } from '../types';

const ME = 'me';

// ─── Woolworths ───────────────────────────────────────────────────────────────

/**
 * For each item:
 *   1. Apply product-specific discount → discounted price
 *   2. Apply store-wide discount → final item price
 *   3. Split final item price equally among assignees
 *
 * Then apply voucher proportionally to each person's subtotal.
 */
export function calculateWoolworthsSplit(
  session: WoolworthsSession,
  friendMap: Record<string, string>, // id → name
): SplitResult {
  // Accumulate each person's subtotal & savings
  const subtotals: Record<string, number> = {};
  const savings: Record<string, number> = {};

  const allPeople = new Set<string>([ME]);
  session.items.forEach(item => {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    people.forEach(p => allPeople.add(p));
  });

  allPeople.forEach(p => {
    subtotals[p] = 0;
    savings[p] = 0;
  });

  for (const item of session.items) {
    const people = item.assignedTo.length > 0 ? item.assignedTo : [ME];
    const share = people.length;

    // Step 1: product discount
    const afterProductDiscount =
      item.originalPrice * (1 - item.productDiscount / 100);

    // Step 2: store discount
    const storeDiscountAmt = afterProductDiscount * (session.storeDiscount / 100);
    const finalItemPrice = afterProductDiscount - storeDiscountAmt;

    const totalSavingPerItem =
      item.originalPrice - finalItemPrice;

    const pricePerPerson = finalItemPrice / share;
    const savingPerPerson = totalSavingPerItem / share;

    people.forEach(p => {
      subtotals[p] = (subtotals[p] ?? 0) + pricePerPerson;
      savings[p] = (savings[p] ?? 0) + savingPerPerson;
    });
  }

  // Step 3: proportional voucher
  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);

  const splits: PersonSplit[] = Array.from(allPeople).map(id => {
    const sub = subtotals[id] ?? 0;
    const voucherSaving =
      totalSubtotal > 0 ? (sub / totalSubtotal) * session.voucher : 0;
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

  const grandTotal = splits.reduce((s, p) => s + p.total, 0);

  return {
    session,
    type: 'woolworths',
    splits,
    grandTotal: round(grandTotal),
  };
}

// ─── Restaurant / DoorDash ────────────────────────────────────────────────────

/**
 * For each item:
 *   - Split equally among assignees
 *
 * Extra fees (delivery, service, tax) split proportionally by item subtotal.
 */
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

  // Proportional extra fees
  const totalSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);

  const splits: PersonSplit[] = Array.from(allPeople).map(id => {
    const sub = subtotals[id] ?? 0;
    const feeShare =
      totalSubtotal > 0 ? (sub / totalSubtotal) * session.extraFees : 0;
    const total = sub + feeShare;

    return {
      friendId: id,
      name: id === ME ? 'Me' : (friendMap[id] ?? id),
      subtotal: round(sub),
      discount: 0,
      feeShare: round(feeShare),
      voucherSaving: 0,
      total: round(total),
    };
  });

  const grandTotal = splits.reduce((s, p) => s + p.total, 0);

  return {
    session,
    type: 'restaurant',
    splits,
    grandTotal: round(grandTotal),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
