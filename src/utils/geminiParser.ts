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
• "productDiscount" = the discount DOLLAR AMOUNT for THIS specific item. Check BOTH patterns:

  PATTERN A — Next line discount:
  A negative line printed DIRECTLY BELOW the item belongs to that item.
  Labels: "WW Discount", "WW Product Discount", "Half Price Save", "Promo Save", "Member Price Save", "Loyalty Save", "Special Save", any line with a negative $ directly under a product.
  Example: "Eggs  $6.50" / "WW Discount  -$0.60" → price=6.50, productDiscount=0.60

  PATTERN B — Strikethrough / two prices on same line:
  When an item shows TWO prices — one crossed out (original) and one active (sale price) — OR shows "Was $X Now $Y".
  Use the HIGHER (original/crossed-out) price as "price" and the DIFFERENCE as "productDiscount".
  Example: "Chicken  ~~$12.00~~  $9.00" → price=12.00, productDiscount=3.00
  Example: "Milk  Was $3.50  Now $2.80" → price=3.50, productDiscount=0.70

  • productDiscount is always POSITIVE
  • Set to 0 if no discount applies to this item

═══ STORE DISCOUNT % (storeDiscount) ═══
For percentage-based discounts applied across the whole bill. Two ways to detect:
  A) Explicitly stated %: "Everyday Rewards 5%", "10% off your shop", "Member Discount 10%" → use that %
  B) Dollar amount that IS a % discount: "Team Discount -$X", "Everyday Rewards -$X", "Member Discount -$X" where the amount ÷ item subtotal ≈ 5% or 10% → set storeDiscount to 5 or 10
• Allowed values: 0, 5, 10 (round to nearest of these)
• If detected as storeDiscount, do NOT also add to voucher

═══ VOUCHERS (voucher) ═══
ONLY flat-dollar deductions that are NOT percentage-based store discounts.
  • INCLUDE: "Voucher -$X", "Gift Card -$X", "Reward Dollars -$X", "Promo Code -$X", "eVoucher -$X", "Membership Benefit -$X", "Special Offers -$X", flat promotional credits in the payment section
  • EXCLUDE: anything already captured as storeDiscount
  • EXCLUDE: fee-related discounts (e.g. "Delivery Discount") — those net against fees, not here
  • EXCLUDE: promotional SUMMARY banners (e.g. "$14.65 Uber One savings and other promotions applied", "Total savings: $X") — these are display summaries, NOT individual discount lines
• Sum only individual itemised lines; always return a POSITIVE number. Set to 0 if none.

═══ EXTRA FEES (extraFees) ═══
• NET fees added ON TOP of the subtotal: delivery fee + service fee + surcharges
• SUBTRACT matching fee credits from the same fee type:
  e.g. "Delivery Fee $9.49" + "Delivery Discount -$9.49" = net $0 for delivery
  e.g. "Service Fee $3.43" with no credit = +$3.43
• Result >= 0
• Do NOT include fee-related discounts in voucher — they belong here as a reduction
• CRITICAL: "Including GST", "incl. GST $X", "GST included", "#Total includes GST" = tax already in item prices — do NOT add to extraFees

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
      model: 'gpt-4o',
      max_tokens: 2048,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a precise receipt OCR and parser. You carefully read every line of a receipt image, paying special attention to discount lines that appear directly below product lines. You always return valid JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
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
