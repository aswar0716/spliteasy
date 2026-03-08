export type Friend = {
  id: string;
  name: string;
  color: string; // for visual distinction
};

// ─── Woolworths ───────────────────────────────────────────────────────────────

export type WoolworthsItem = {
  id: string;
  name: string;
  originalPrice: number;
  productDiscount: number; // % off (0 if none)
  assignedTo: string[]; // friend ids; empty = just "me"
};

export type WoolworthsSession = {
  id: string;
  date: string; // ISO string
  storeDiscount: number; // 5 or 10 (%)
  voucher: number; // flat dollar off (e.g. 10)
  items: WoolworthsItem[];
};

// ─── Restaurant / DoorDash ────────────────────────────────────────────────────

export type RestaurantItem = {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // friend ids; empty = just "me"; multiple = shared equally
};

export type RestaurantSession = {
  id: string;
  date: string;
  label: string; // e.g. "Dinner at Nando's" or "DoorDash"
  items: RestaurantItem[];
  extraFees: number; // delivery, service, tax — always split proportionally
};

// ─── Split Results ────────────────────────────────────────────────────────────

export type PersonSplit = {
  friendId: string; // "me" for you
  name: string;
  subtotal: number; // before voucher/fees
  discount: number; // savings
  feeShare: number; // restaurant extra fees share
  voucherSaving: number; // proportional voucher saving
  total: number; // final amount owed
};

export type SplitResult = {
  session: WoolworthsSession | RestaurantSession;
  type: 'woolworths' | 'restaurant';
  splits: PersonSplit[];
  grandTotal: number;
};

// ─── History ──────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  id: string;
  date: string;
  label: string;
  type: 'woolworths' | 'restaurant';
  grandTotal: number;
  splits: PersonSplit[];
};

// ─── Journal ─────────────────────────────────────────────────────────────────

export type JournalEntry = {
  id: string;
  date: string; // ISO string
  title: string;
  body: string;
  type: 'dev' | 'personal'; // dev log or personal note
};
