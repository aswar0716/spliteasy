const SW_BASE = 'https://secure.splitwise.com/api/v3.0';

export type SplitwiseUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

export type SplitwiseFriend = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

async function swGet(path: string, apiKey: string) {
  const res = await fetch(`${SW_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Splitwise ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getSplitwiseCurrentUser(apiKey: string): Promise<SplitwiseUser> {
  const data = await swGet('/get_current_user', apiKey);
  return data.user;
}

export async function getSplitwiseFriends(apiKey: string): Promise<SplitwiseFriend[]> {
  const data = await swGet('/get_friends', apiKey);
  return data.friends ?? [];
}

export type SplitEntry = {
  userId: number;
  owedShare: number;
  paidShare: number;
};

export async function createSplitwiseExpense(
  apiKey: string,
  description: string,
  totalCost: number,
  currencyCode: string,
  entries: SplitEntry[],
): Promise<void> {
  // Build form-encoded body (Splitwise requires this format)
  const params: Record<string, string> = {
    cost: totalCost.toFixed(2),
    description,
    currency_code: currencyCode,
    split_equally: 'false',
  };

  entries.forEach((e, i) => {
    params[`users__${i}__user_id`] = String(e.userId);
    params[`users__${i}__paid_share`] = e.paidShare.toFixed(2);
    params[`users__${i}__owed_share`] = e.owedShare.toFixed(2);
  });

  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const res = await fetch(`${SW_BASE}/create_expense`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Splitwise ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors).flat().join(', '));
  }
}

// Match SplitEasy friend names to Splitwise friends (by first name or full name)
export function matchFriends(
  splitName: string,
  swFriends: SplitwiseFriend[],
): SplitwiseFriend | null {
  const needle = splitName.trim().toLowerCase();
  return (
    swFriends.find(f => `${f.first_name} ${f.last_name}`.toLowerCase() === needle) ??
    swFriends.find(f => f.first_name.toLowerCase() === needle) ??
    swFriends.find(f => f.last_name.toLowerCase() === needle) ??
    null
  );
}
