export type Friend = {
  id: string;
  name: string;
  color: string;
};

export type Group = {
  id: string;
  name: string;
  memberIds: string[]; // friend IDs (excludes 'me' — me is always included)
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
  date: string;
  storeDiscount: number; // 5 or 10 (%)
  voucher: number;
  items: WoolworthsItem[];
};

// ─── Restaurant / DoorDash ────────────────────────────────────────────────────

export type RestaurantItem = {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
};

export type RestaurantSession = {
  id: string;
  date: string;
  label: string;
  items: RestaurantItem[];
  extraFees: number;
};

// ─── Universal (Smart Split) ──────────────────────────────────────────────────

export type UniversalItem = {
  id: string;
  name: string;
  originalPrice: number;
  productDiscount: number; // % off per item (0 if none)
  assignedTo: string[];
};

export type UniversalSession = {
  id: string;
  date: string;
  label: string;
  storeDiscount: number; // % (0 if none)
  voucher: number;       // flat $ off
  extraFees: number;     // delivery/service/tax $
  items: UniversalItem[];
};

// ─── Split Results ────────────────────────────────────────────────────────────

export type PersonSplit = {
  friendId: string;
  name: string;
  subtotal: number;
  discount: number;
  feeShare: number;
  voucherSaving: number;
  total: number;
};

export type SplitResult = {
  session: WoolworthsSession | RestaurantSession | UniversalSession;
  type: 'woolworths' | 'restaurant' | 'universal';
  splits: PersonSplit[];
  grandTotal: number;
};

// ─── History ──────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  id: string;
  date: string;
  label: string;
  type: 'woolworths' | 'restaurant' | 'universal';
  grandTotal: number;
  splits: PersonSplit[];
};

// ─── Journal ─────────────────────────────────────────────────────────────────

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
  type: 'dev' | 'personal';
};
