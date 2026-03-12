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
- "items" = only actual purchased products/food items, never fees or totals
- "price" = the original/shelf price before any per-item discount
- "productDiscount" = % discount on that specific item (0 if none)
- "storeDiscount" = overall store/member discount % applied to all items (0 if none); Woolworths Everyday Rewards = 5 or 10
- "voucher" = any flat dollar voucher, reward, or promo code deducted from the total (0 if none)
- "extraFees" = NET sum of ALL fee lines: add delivery fee + service fee + surcharge + tax, then SUBTRACT any fee discounts or credits (e.g. if delivery is $5.49 and there is a -$5.49 discounted delivery line, they net to $0). Result must be >= 0
- Never include negative-priced items in the items array — if a line is a discount on a specific item, express it as productDiscount %; if it is a fee credit, include it in the extraFees netting
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
