import path from 'path';

export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function generateUniqueFilename(originalName: string, taskType: string, docNumber: string, description?: string): string {
    const extension = path.extname(originalName);
    const now = new Date();
    const year = now.getFullYear();

    // Use pure hash/timestamp to avoid Thai characters or spaces in the URL completely.
    // The human readable name is now stored in the JSON array payload, not the filename.
    const uniqueCode12 = Math.random().toString(36).substring(2, 14).padEnd(12, '0').substring(0, 12);
    const ts = Date.now().toString(36);
    const newName = `${ts}-${uniqueCode12}${extension}`;
    
    return `${year}/${newName}`;
}

export function parseSupportedDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const monthOnlyMatch = trimmed.match(/^(\d{4})[-/](\d{2})$/);
  if (monthOnlyMatch) {
    const [, year, month] = monthOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, 1);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) {
    const [year, month, day] = isoMatch[1].split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function formatThaiBuddhistDateParts(date: Date) {
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear() + 543;

  return {
    thdate_full: `${day} ${THAI_MONTHS_FULL[monthIndex]} ${year}`,
    thdate_short: `${day} ${THAI_MONTHS_SHORT[monthIndex]} ${year}`,
    thmonth_full: `${THAI_MONTHS_FULL[monthIndex]} ${year}`,
    thmonth_short: `${THAI_MONTHS_SHORT[monthIndex]} ${year}`,
  };
}

export function normalizeTemplateValue(value: any): any {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(normalizeTemplateValue);
  if (typeof value === "object" && !(value instanceof Date)) {
    const normalized: Record<string, any> = {};
    Object.entries(value).forEach(([key, innerValue]) => {
      normalized[key] = normalizeTemplateValue(innerValue);
      
      // Inject fallback empty strings to prevent ReferenceErrors in word templates
      normalized[`${key}_thdate_full`] = "";
      normalized[`${key}_thdate_short`] = "";
      normalized[`${key}_thmonth_full`] = "";
      normalized[`${key}_thmonth_short`] = "";

      const parsedDate = parseSupportedDate(innerValue);
      if (parsedDate) {
        const formatted = formatThaiBuddhistDateParts(parsedDate);
        normalized[`${key}_thdate_full`] = formatted.thdate_full;
        normalized[`${key}_thdate_short`] = formatted.thdate_short;
        normalized[`${key}_thmonth_full`] = formatted.thmonth_full;
        normalized[`${key}_thmonth_short`] = formatted.thmonth_short;
      }
    });
    return normalized;
  }
  return value;
}

export function buildFineFeeItems(source: Record<string, any>) {
  const additionalFees = Array.isArray(source.fn_additionalFees) ? source.fn_additionalFees : [];
  const feeItems = additionalFees.map((fee: any, index: number) => ({
    index: index + 1,
    name: String(fee?.name ?? "").trim(),
    amount: String(fee?.amount ?? "").trim(),
  }));

  const fineAmount = String(source.fn_amount ?? "").trim();
  if (fineAmount) {
    feeItems.push({
      index: feeItems.length + 1,
      name: "ค่าละเมิด",
      amount: fineAmount,
    });
  }

  return feeItems;
}

export function withThaiDateVariants(source: Record<string, any>) {
  // --- Backwards compatibility proxy for legacy word templates ---
  if (Array.isArray(source.op_details) && source.op_details.length > 0) {
    const first = source.op_details[0];
    source.op_ReferenceNumber = source.op_ReferenceNumber || first.op_ReferenceNumber;
    source.op_customerName = source.op_customerName || first.op_customerName;
    source.op_OverdueBillStart = source.op_OverdueBillStart || first.op_OverdueBillStart;
    source.op_overdueBillEnd = source.op_overdueBillEnd || first.op_overdueBillEnd;
    source.op_amount = source.op_amount || first.op_amount;
  }
  if (Array.isArray(source.fn_details) && source.fn_details.length > 0) {
    const first = source.fn_details[0];
    source.fn_fineType = source.fn_fineType || first.fn_fineType;
    source.fn_ReferenceNumber = source.fn_ReferenceNumber || first.fn_ReferenceNumber;
    source.fn_customerName = source.fn_customerName || first.fn_customerName;
    source.fn_OverdueBillStart = source.fn_OverdueBillStart || first.fn_OverdueBillStart;
    source.fn_OverdueBillEnd = source.fn_OverdueBillEnd || first.fn_OverdueBillEnd;
    source.fn_amount = source.fn_amount || first.fn_amount;
  }
  // -------------------------------------------------------------

  let result = normalizeTemplateValue(source);
  if (typeof result !== 'object' || result === null) result = {};

  const fineFeeItems = buildFineFeeItems(source);
  result.fn_feeItems = fineFeeItems;
  result.fn_feeItemsText = fineFeeItems
    .map((item) => `${item.index}. ${item.name} รวมเป็นเงิน ${item.amount} บาท`)
    .join("\n");
  result.fn_feeItemsBlock = result.fn_feeItemsText;
  result.fn_feeItemsParagraphs = fineFeeItems.map((item) => ({
    text: `${item.index}. ${item.name} รวมเป็นเงิน ${item.amount} บาท`,
  }));

  return result;
}
