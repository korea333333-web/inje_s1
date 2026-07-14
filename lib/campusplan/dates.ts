import type { Clock, LocalDate } from "./types.ts";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MILLISECONDS = 86_400_000;

export const SYSTEM_CLOCK: Clock = {
  now: () => new Date(),
};

export function createFixedClock(value: Date | string): Clock {
  const instant = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`유효하지 않은 고정 시각입니다: ${String(value)}`);
  }

  const timestamp = instant.getTime();
  return { now: () => new Date(timestamp) };
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;

  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function assertLocalDate(value: string): asserts value is LocalDate {
  if (!isLocalDate(value)) {
    throw new RangeError(`유효하지 않은 날짜입니다: ${value}`);
  }
}

export function toLocalDate(
  value: Date = SYSTEM_CLOCK.now(),
  timeZone = "Asia/Seoul",
): LocalDate {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("유효하지 않은 Date 객체입니다.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("날짜 형식을 계산하지 못했습니다.");
  }

  return `${year}-${month}-${day}` as LocalDate;
}

export function todayFromClock(
  clock: Clock = SYSTEM_CLOCK,
  timeZone = "Asia/Seoul",
): LocalDate {
  return toLocalDate(clock.now(), timeZone);
}

export function localDateToEpochDay(date: LocalDate): number {
  assertLocalDate(date);
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MILLISECONDS);
}

export function addCalendarDays(date: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) {
    throw new RangeError("더할 날짜 수는 정수여야 합니다.");
  }

  const next = new Date((localDateToEpochDay(date) + amount) * DAY_IN_MILLISECONDS);
  return formatUtcDate(next);
}

export function differenceInCalendarDays(
  targetDate: LocalDate,
  baseDate: LocalDate,
): number {
  return localDateToEpochDay(targetDate) - localDateToEpochDay(baseDate);
}

export function compareLocalDates(left: LocalDate, right: LocalDate): number {
  return Math.sign(differenceInCalendarDays(left, right));
}

export function startOfWeek(
  date: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): LocalDate {
  const epochDay = localDateToEpochDay(date);
  const dayOfWeek = new Date(epochDay * DAY_IN_MILLISECONDS).getUTCDay();
  const daysSinceStart = (dayOfWeek - weekStartsOn + 7) % 7;
  return addCalendarDays(date, -daysSinceStart);
}

export function endOfWeek(
  date: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): LocalDate {
  return addCalendarDays(startOfWeek(date, weekStartsOn), 6);
}

export function isDateInRange(
  date: LocalDate,
  start: LocalDate,
  end: LocalDate,
): boolean {
  const value = localDateToEpochDay(date);
  return value >= localDateToEpochDay(start) && value <= localDateToEpochDay(end);
}

function formatUtcDate(value: Date): LocalDate {
  const year = String(value.getUTCFullYear()).padStart(4, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as LocalDate;
}
