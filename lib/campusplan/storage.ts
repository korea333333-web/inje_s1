import { isLocalDate } from "./dates.ts";
import type {
  CampusPlanPreferences,
  CampusPlanState,
  CampusPlanStorage,
  StateParseResult,
  StorageLike,
  Subject,
  SubjectSchedule,
  Task,
  TaskType,
  TaskView,
  WeatherLocation,
} from "./types.ts";

export const CAMPUSPLAN_STORAGE_KEY = "campusplan.state.v1";
export const CURRENT_SCHEMA_VERSION = 1 as const;

export function createEmptyCampusPlanState(): CampusPlanState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    subjects: [],
    preferences: {
      defaultView: "today",
      showCompleted: true,
      weekStartsOn: 1,
      weatherLocation: null,
    },
  };
}

export function serializeCampusPlanState(state: CampusPlanState): string {
  const result = validateCampusPlanState(state);
  if (!result.ok) throw result.error;
  return JSON.stringify(result.value);
}

export function tryDeserializeCampusPlanState(
  serialized: string | null,
): StateParseResult {
  if (serialized === null || serialized.trim() === "") {
    return { ok: true, value: createEmptyCampusPlanState() };
  }

  try {
    return validateCampusPlanState(JSON.parse(serialized));
  } catch (error) {
    return {
      ok: false,
      error: toError(error, "저장된 데이터를 읽지 못했습니다."),
    };
  }
}

export function deserializeCampusPlanState(
  serialized: string | null,
  fallback: CampusPlanState = createEmptyCampusPlanState(),
): CampusPlanState {
  const result = tryDeserializeCampusPlanState(serialized);
  return result.ok ? result.value : structuredClone(fallback);
}

export function createCampusPlanStorage(
  storage: StorageLike,
  key = CAMPUSPLAN_STORAGE_KEY,
): CampusPlanStorage {
  return {
    load: () => deserializeCampusPlanState(storage.getItem(key)),
    save: (state) => storage.setItem(key, serializeCampusPlanState(state)),
    clear: () => storage.removeItem(key),
  };
}

function validateCampusPlanState(value: unknown): StateParseResult {
  try {
    const record = asRecord(value, "상태");
    if (record.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`지원하지 않는 저장 형식입니다: ${String(record.schemaVersion)}`);
    }

    return {
      ok: true,
      value: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: asArray(record.tasks, "tasks").map(parseTask),
        subjects: asArray(record.subjects, "subjects").map(parseSubject),
        preferences: parsePreferences(record.preferences),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: toError(error, "저장된 데이터 형식이 올바르지 않습니다."),
    };
  }
}

function parseTask(value: unknown, index: number): Task {
  const item = asRecord(value, `tasks[${index}]`);
  const dueDate = stringValue(item.dueDate, `tasks[${index}].dueDate`);
  if (!isLocalDate(dueDate)) throw new Error(`유효하지 않은 마감일입니다: ${dueDate}`);

  return {
    id: nonEmptyString(item.id, `tasks[${index}].id`),
    title: nonEmptyString(item.title, `tasks[${index}].title`),
    subjectId:
      item.subjectId === null
        ? null
        : nonEmptyString(item.subjectId, `tasks[${index}].subjectId`),
    type: taskType(item.type),
    dueDate,
    dueTime: item.dueTime === null ? null : time(item.dueTime, `tasks[${index}].dueTime`),
    completed: booleanValue(item.completed, `tasks[${index}].completed`),
    notes: stringValue(item.notes, `tasks[${index}].notes`),
    createdAt: isoTimestamp(item.createdAt, `tasks[${index}].createdAt`),
    updatedAt: isoTimestamp(item.updatedAt, `tasks[${index}].updatedAt`),
  };
}

function parseSubject(value: unknown, index: number): Subject {
  const item = asRecord(value, `subjects[${index}]`);
  return {
    id: nonEmptyString(item.id, `subjects[${index}].id`),
    name: nonEmptyString(item.name, `subjects[${index}].name`),
    color: nonEmptyString(item.color, `subjects[${index}].color`),
    professor: stringValue(item.professor, `subjects[${index}].professor`),
    classroom: stringValue(item.classroom, `subjects[${index}].classroom`),
    schedule: asArray(item.schedule, `subjects[${index}].schedule`).map(parseSchedule),
    createdAt: isoTimestamp(item.createdAt, `subjects[${index}].createdAt`),
    updatedAt: isoTimestamp(item.updatedAt, `subjects[${index}].updatedAt`),
  };
}

function parseSchedule(value: unknown, index: number): SubjectSchedule {
  const item = asRecord(value, `schedule[${index}]`);
  const dayOfWeek = numberValue(item.dayOfWeek, `schedule[${index}].dayOfWeek`);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("요일은 1(월)부터 7(일) 사이여야 합니다.");
  }

  return {
    dayOfWeek: dayOfWeek as SubjectSchedule["dayOfWeek"],
    startTime: time(item.startTime, `schedule[${index}].startTime`),
    endTime: time(item.endTime, `schedule[${index}].endTime`),
    ...(item.classroom === undefined
      ? {}
      : { classroom: stringValue(item.classroom, `schedule[${index}].classroom`) }),
  };
}

function parsePreferences(value: unknown): CampusPlanPreferences {
  const item = asRecord(value, "preferences");
  return {
    defaultView: taskView(item.defaultView),
    showCompleted: booleanValue(item.showCompleted, "preferences.showCompleted"),
    weekStartsOn: weekStart(item.weekStartsOn),
    weatherLocation:
      item.weatherLocation === null
        ? null
        : parseLocation(item.weatherLocation, "preferences.weatherLocation"),
  };
}

function parseLocation(value: unknown, name: string): WeatherLocation {
  const item = asRecord(value, name);
  return {
    id: nonEmptyString(item.id, `${name}.id`),
    name: nonEmptyString(item.name, `${name}.name`),
    latitude: numberValue(item.latitude, `${name}.latitude`),
    longitude: numberValue(item.longitude, `${name}.longitude`),
    ...(item.nx === undefined ? {} : { nx: numberValue(item.nx, `${name}.nx`) }),
    ...(item.ny === undefined ? {} : { ny: numberValue(item.ny, `${name}.ny`) }),
  };
}

function taskType(value: unknown): TaskType {
  if (value === "assignment" || value === "exam" || value === "personal") return value;
  throw new Error(`지원하지 않는 일정 유형입니다: ${String(value)}`);
}

function taskView(value: unknown): TaskView {
  if (value === "today" || value === "week" || value === "all") return value;
  throw new Error(`지원하지 않는 보기 유형입니다: ${String(value)}`);
}

function weekStart(value: unknown): 0 | 1 {
  if (value === 0 || value === 1) return value;
  throw new Error("한 주의 시작 요일은 0(일) 또는 1(월)이어야 합니다.");
}

function time(value: unknown, name: string): string {
  const result = stringValue(value, name);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) {
    throw new Error(`${name}은 HH:mm 형식이어야 합니다.`);
  }
  return result;
}

function isoTimestamp(value: unknown, name: string): string {
  const result = stringValue(value, name);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${name}이 올바른 시각이 아닙니다.`);
  return result;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name}은 객체여야 합니다.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name}은 배열이어야 합니다.`);
  return value;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name}은 문자열이어야 합니다.`);
  return value;
}

function nonEmptyString(value: unknown, name: string): string {
  const result = stringValue(value, name);
  if (!result.trim()) throw new Error(`${name}은 비어 있을 수 없습니다.`);
  return result;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${name}은 boolean이어야 합니다.`);
  return value;
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name}은 유한한 숫자여야 합니다.`);
  }
  return value;
}

function toError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
