const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export type ParsedReceipt = {
  items: ParsedItem[];
  storeDiscount: number;  // % (e.g. 5 or 10)
  voucher: number;        // flat $ off
  extraFees: number;      // net delivery/service/tax $ (after any fee discounts/credits)
};

export type ParsedItem = {
  name: string;
  price: number;          // original/shelf price
  productDiscount: number; // % off (0 if none)
};

const PROMPT = `You are a receipt parser. Analyse this receipt image and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "items": [
    { "name": "string", "price": number, "productDiscount": number }
  ],
  "storeDiscount": number,
  "voucher": number,
  "extraFees": number
}

Rules:
- "items" = only purchased products/food items — never fees, never totals, never subtotals
- "price" = the original shelf price BEFORE any discount on that item
- "productDiscount" = % off for that specific item (0 if none). IMPORTANT: if a negative line like "WW Product Discount -$X", "Member Savings -$X", "Promo -$X" immediately follows an item, it is a per-item discount — calculate productDiscount = (X / item_price) * 100 and apply it to that item. Do NOT include such lines separately.
- "storeDiscount" = overall store/member discount % applied to all items simultaneously (0 if none). Woolworths Everyday Rewards = 5 or 10.
- "voucher" = flat dollar voucher or reward code deducted at checkout (0 if none)
- "extraFees" = NET extra fees ADDED ON TOP of the subtotal: delivery fee + service fee + surcharges. SUBTRACT any credits on those fees. Result must be >= 0.
  CRITICAL: GST / tax shown as "including GST", "incl. GST", or "GST included in prices" is already inside the item prices — do NOT add it to extraFees. Only add tax that is a SEPARATE line added to the subtotal.
- Return ONLY the JSON object, nothing else`;

export async function parseReceiptImage(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png',
  apiKey: string,
): Promise<ParsedReceipt> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ParsedReceipt;
    parsed.storeDiscount = Number(parsed.storeDiscount) || 0;
    parsed.voucher = Number(parsed.voucher) || 0;
    parsed.extraFees = Math.max(0, Number(parsed.extraFees) || 0); // clamp: net fees can't be negative
    parsed.items = (parsed.items ?? []).map(item => ({
      name: String(item.name ?? 'Item'),
      price: Math.abs(Number(item.price) || 0),
      productDiscount: Number(item.productDiscount) || 0,
    }));
    return parsed;
  } catch {
    throw new Error('Could not parse receipt. Try a clearer photo.');
  }
}
