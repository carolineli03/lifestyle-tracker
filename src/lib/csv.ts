/**
 * CSV for the data export. RFC 4180 quoting, plus a guard against spreadsheet
 * formula injection: a food named "=HYPERLINK(...)" must open as text, not run.
 */

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T extends Record<string, CsvValue>>(rows: readonly T[], columns: ReadonlyArray<keyof T & string>): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  // A BOM so Excel opens UTF-8 (café, ½ cup) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
