const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export type ParsedReceipt = {
  items: ParsedItem[];
  storeDiscount: number;  // % (e.g. 5 or 10)
  voucher: number;        // flat $ off
  extraFees: number;      // delivery/service/tax $
  type: 'woolworths' | 'restaurant';
};

export type ParsedItem = {
  name: string;
  price: number;          // original/listed price
  productDiscount: number; // % off (0 if none)
};

const PROMPT = `You are a receipt parser. Analyse this receipt image and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "items": [
    { "name": "string", "price": number, "productDiscount": number }
  ],
  "storeDiscount": number,
  "voucher": number,
  "extraFees": number,
  "type": "woolworths" | "restaurant"
}

Rules:
- "price" = the original/shelf price of the item (before any discount)
- "productDiscount" = % discount on that specific item (0 if none)
- "storeDiscount" = overall store/member discount % shown (0 if none); for Woolworths Everyday Rewards use 5 or 10
- "voucher" = any flat dollar voucher or reward amount deducted (0 if none)
- "extraFees" = delivery fee + service fee + any tax shown separately (0 if none)
- "type" = "woolworths" for supermarkets/grocery stores, "restaurant" for restaurants/delivery/takeaway
- Only include actual purchased items, not totals/subtotals
- Return ONLY the JSON object, nothing else`;

export async function parseReceiptImage(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png',
  apiKey: string,
): Promise<ParsedReceipt> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ParsedReceipt;
    // Sanitise numbers
    parsed.storeDiscount = Number(parsed.storeDiscount) || 0;
    parsed.voucher = Number(parsed.voucher) || 0;
    parsed.extraFees = Number(parsed.extraFees) || 0;
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
