export function formatRupiah(value: number): string {
  return 'Rp ' + Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

export function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toRomanMonth(month1To12: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[month1To12 - 1] || 'I';
}

export function generateSequentialDocNumber(
  docCode: string,
  existingNumbers: string[] = [],
  dateStr?: string
): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const romanMonth = toRomanMonth(validDate.getMonth() + 1);
  const year = validDate.getFullYear();
  const suffix = `/${docCode}/${romanMonth}/${year}`;

  let maxSeq = 0;
  for (const no of existingNumbers) {
    const trimmed = String(no || '').trim();
    if (trimmed.endsWith(suffix)) {
      const seqPart = trimmed.slice(0, trimmed.length - suffix.length);
      const parsed = parseInt(seqPart, 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${nextSeq}${suffix}`;
}

export function generateSalesOrderNumber(existingNumbers: string[] = [], dateStr?: string): string {
  return generateSequentialDocNumber('PCS-SO', existingNumbers, dateStr);
}

export function generateSuratJalanKeluarNumber(existingNumbers: string[] = [], dateStr?: string): string {
  return generateSequentialDocNumber('PCS-SJ', existingNumbers, dateStr);
}

export function generateDocNumber(prefix: string): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}/${ym}/${rand}`;
}

export function parseCsvOrJson(rawText: string): Record<string, any>[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return [parsed];
  }

  // CSV / Semicolon / Tab delimited parser
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(headerLine).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').replace(/^"|"$/g, '').trim();
    });
    rows.push(obj);
  }

  return rows;
}
