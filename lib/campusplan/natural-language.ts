import { addCalendarDays } from "./dates.ts";
import type {
  KoreanRelativeDateKeyword,
  LocalDate,
  ParsedKoreanTaskInput,
} from "./types.ts";

const OFFSETS: Record<KoreanRelativeDateKeyword, number> = {
  오늘: 0,
  내일: 1,
  모레: 2,
};

const RELATIVE_DATE_PATTERN = /(^|\s)(오늘|내일|모레)(까지)?(?=\s|$|[,.!?])/;

export function resolveKoreanRelativeDate(
  keyword: KoreanRelativeDateKeyword,
  referenceDate: LocalDate,
): LocalDate {
  return addCalendarDays(referenceDate, OFFSETS[keyword]);
}

export function parseKoreanTaskInput(
  input: string,
  referenceDate: LocalDate,
): ParsedKoreanTaskInput {
  const original = input;
  const normalized = input.trim().replace(/\s+/g, " ");
  const match = RELATIVE_DATE_PATTERN.exec(normalized);

  if (!match) {
    return {
      original,
      title: normalized,
      dueDate: null,
      matchedKeyword: null,
    };
  }

  const keyword = match[2] as KoreanRelativeDateKeyword;
  const title = `${normalized.slice(0, match.index)} ${normalized.slice(
    match.index + match[0].length,
  )}`
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[,.;!?]\s*/, "")
    .replace(/\s*[,.;!?]$/, "")
    .trim();

  return {
    original,
    title,
    dueDate: resolveKoreanRelativeDate(keyword, referenceDate),
    matchedKeyword: keyword,
  };
}
