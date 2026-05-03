// Parse spoken number text (zh-CN or arabic digits) into integer.
// Returns null if it cannot extract a number.

const DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 幺: 1, 壹: 1,
  二: 2, 两: 2, 兩: 2, 贰: 2,
  三: 3, 叁: 3, 四: 4, 肆: 4,
  五: 5, 伍: 5, 六: 6, 陆: 6,
  七: 7, 柒: 7, 八: 8, 捌: 8,
  九: 9, 玖: 9,
};

export function parseSpokenNumber(input: string): number | null {
  if (!input) return null;
  let text = input
    .replace(/\s/g, "")
    .replace(/[，,。.！!？?、]/g, "")
    .toLowerCase();

  // Arabic digits first
  const arabic = text.match(/-?\d+/);
  if (arabic) return parseInt(arabic[0], 10);

  // Negative
  let negative = false;
  if (text.startsWith("负") || text.startsWith("减")) {
    negative = true;
    text = text.slice(1);
  }

  if (!text) return null;

  let total = 0;
  let section = 0;
  let current = 0;
  let matched = false;

  for (const ch of text) {
    if (ch in DIGITS) {
      current = DIGITS[ch];
      matched = true;
    } else if (ch === "十" || ch === "拾") {
      section += (current || 1) * 10;
      current = 0;
      matched = true;
    } else if (ch === "百" || ch === "佰") {
      section += (current || 1) * 100;
      current = 0;
      matched = true;
    } else if (ch === "千" || ch === "仟") {
      section += (current || 1) * 1000;
      current = 0;
      matched = true;
    } else if (ch === "万" || ch === "萬") {
      total += (section + current) * 10000;
      section = 0;
      current = 0;
      matched = true;
    } else if (ch === "亿" || ch === "億") {
      total = (total + section + current) * 100_000_000;
      section = 0;
      current = 0;
      matched = true;
    }
    // ignore other chars
  }
  if (!matched) return null;
  total += section + current;
  return negative ? -total : total;
}
