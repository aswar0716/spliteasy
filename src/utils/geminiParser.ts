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

const PROMPT = `You are an expert receipt parser for a bill-splitting app. Read the ENTIRE receipt top to bottom before producing output. Return ONLY valid JSON — no markdown, no explanation.

Output format:
{"items":[{"name":"string","price":number,"productDiscount":number}],"storeDiscount":number,"voucher":number,"extraFees":number}

═══ ITEMS ═══
• Include ONLY purchased product/food/grocery lines — NOT fees, totals, subtotals, or discount summary lines
• "price" = the original shelf/list price BEFORE any discount (always a positive number)
• "productDiscount" = the discount DOLLAR AMOUNT for THIS specific item (NOT a percentage):
  - A negative line printed DIRECTLY BELOW or adjacent to the item in the same product block = that item's discount
  - Labels: "WW Discount", "WW Product Discount", "Half Price Save", "Promo Save", "Member Price Save", "Loyalty Save"
  - Example: "Eggs $6.50" then "WW Discount -$0.60" → price=6.50, productDiscount=0.60
  - productDiscount is always POSITIVE (e.g. if receipt shows -$0.60, set 0.60)
  - Set to 0 if no per-item discount for this product

═══ STORE DISCOUNT % (storeDiscount) ═══
• ONLY for a PERCENTAGE discount applied to ALL items at once via membership
• Labels: "Everyday Rewards 5%", "10% off your shop", "Member Discount 10%"
• Set to 5 or 10 (Woolworths) or the relevant %, or 0 if none
• Do NOT use this for dollar-amount discounts

═══ DISCOUNTS & VOUCHERS (voucher) ═══
This field captures ALL flat-dollar deductions that appear in the TOTALS section — both general discounts AND payment vouchers. Sum them all into one number.
TWO TYPES that both go here:
  1. DISCOUNTS (in the totals/savings section): "Team Discount -$X", "Additional Discount -$X", "Member Discount -$X", "Savings -$X", "Promotional Discount -$X"
  2. VOUCHERS/PAYMENTS (in the payment section at the bottom): "Voucher -$X", "Gift Card -$X", "Reward Dollars -$X", "Promo Code -$X", "eVoucher -$X"
• Sum ALL of the above into voucher; always return a POSITIVE number
• Set to 0 if none

═══ EXTRA FEES (extraFees) ═══
• NET fees added ON TOP of the subtotal: delivery fee + service fee + surcharges
• SUBTRACT matching credits (e.g. "Delivery $5.49" + "Delivery Discount -$5.49" = net 0)
• Result >= 0
• CRITICAL: "Including GST", "incl. GST $X", "GST included" = tax already in item prices, do NOT add to extraFees
• Only add tax shown as a SEPARATE line explicitly added to the subtotal

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
      productDiscount: Math.abs(Number(item.productDiscount) || 0), // dollar amount
    }));
    return parsed;
  } catch {
    throw new Error('Could not parse receipt. Try a clearer photo.');
  }
}
