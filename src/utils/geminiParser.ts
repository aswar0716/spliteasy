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

const PROMPT = `You are an expert receipt parser for a bill-splitting app. Read the ENTIRE receipt carefully before producing output. Return ONLY valid JSON — no markdown, no explanation, no extra text.

Output format:
{"items":[{"name":"string","price":number,"productDiscount":number}],"storeDiscount":number,"voucher":number,"extraFees":number}

═══ ITEMS ═══
• Include ONLY purchased products/food/grocery lines
• "price" = the original shelf/list price BEFORE any discount (always positive)
• "productDiscount" = % discount on THIS specific item:
  - Look for a negative line printed DIRECTLY BELOW the item it belongs to (same product block)
  - These are labelled things like: "WW Discount", "WW Product Discount", "Half Price Save", "Member Price Save", "Promo Save", "Loyalty Save", "Discount -$X"
  - Formula: productDiscount = round((discountAmount / originalPrice) × 100, 1)
  - Example: "Eggs $6.50" then "WW Discount -$0.60" → price=6.50, productDiscount=9.2
  - If no per-item discount exists, set productDiscount=0
• NEVER include totals, subtotals, GST notes, fee lines, or discount summary lines as items

═══ STORE DISCOUNT (storeDiscount) ═══
• A single % off applied to ALL items at once (e.g. Everyday Rewards 5% or 10%)
• Usually labelled "5% off your shop", "Member Discount 10%", "Rewards Discount"
• Set to 0 if not present

═══ VOUCHER (voucher) ═══
• Flat $ amount taken off the bill total — appear in the TOTALS SECTION, not next to a specific item
• Examples: "Voucher -$10", "Gift Card -$20", "$5 Everyday Rewards", "Promo Code -$3", "Discount -$X" in totals
• Also include any general discount lines in the totals section that are NOT per-item
• Sum all such deductions; always return a POSITIVE number (e.g. receipt shows -$5 → set 5)
• Set to 0 if none

═══ EXTRA FEES (extraFees) ═══
• NET of all fees added ON TOP of the subtotal: delivery + service fee + surcharges
• If a fee has a matching credit/discount (e.g. "Delivery $5.49" AND "Delivery Discount -$5.49"), they cancel out — net = 0
• Result must be >= 0
• CRITICAL — do NOT add GST/tax to extraFees if receipt says "including GST", "incl. GST $X", "GST included in prices" — that tax is already inside the item prices
• Only include tax that is a SEPARATE line explicitly ADDED to the subtotal (rare)

Return ONLY the JSON object. Nothing else.`;

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
