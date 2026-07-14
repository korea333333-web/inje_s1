export type LocalDate = `${number}-${number}-${number}`;

export type TaskType = "assignment" | "exam" | "personal";

export type TaskView = "today" | "week" | "all";

export type UrgencyLevel = "overdue" | "urgent" | "warning" | "relaxed";

export interface Task {
  id: string;
  title: string;
  subjectId: string | null;
  type: TaskType;
  dueDate: LocalDate;
  dueTime: string | null;
  completed: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectSchedule {
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startTime: string;
  endTime: string;
  classroom?: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  professor: string;
  classroom: string;
  schedule: SubjectSchedule[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskUrgency {
  level: UrgencyLevel;
  daysRemaining: number;
  label: string;
  sortRank: 0 | 1 | 2 | 3;
}

export interface TaskFilterOptions {
  referenceDate: LocalDate;
  view?: TaskView;
  subjectId?: string | "all";
  type?: TaskType | "all";
  completed?: boolean | "all";
  query?: string;
  includeOverdue?: boolean;
  weekStartsOn?: 0 | 1;
}

export interface CompletionSummary {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
}

export type KoreanRelativeDateKeyword = "오늘" | "내일" | "모레";

export interface ParsedKoreanTaskInput {
  original: string;
  title: string;
  dueDate: LocalDate | null;
  matchedKeyword: KoreanRelativeDateKeyword | null;
}

export interface Clock {
  now(): Date;
}

export interface WeatherLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  nx?: number;
  ny?: number;
}

export type WeatherCondition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "shower"
  | "snow"
  | "thunderstorm"
  | "fog"
  | "wind";

export interface CurrentWeather {
  observedAt: string;
  temperature: number;
  feelsLike: number | null;
  condition: WeatherCondition;
  conditionLabel: string;
  precipitationProbability: number | null;
  precipitationAmount: number | null;
  humidity: number | null;
  windDirection: string | null;
  windSpeed: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
}

export interface HourlyForecast {
  forecastAt: string;
  temperature: number;
  condition: WeatherCondition;
  conditionLabel: string;
  precipitationProbability: number | null;
  precipitationAmount: number | null;
  windSpeed: number | null;
}

export interface DailyForecast {
  date: LocalDate;
  condition: WeatherCondition;
  conditionLabel: string;
  high: number;
  low: number;
  precipitationProbability: number | null;
}

export type WeatherAdvisoryKind =
  | "rain"
  | "snow"
  | "heat"
  | "cold"
  | "wind"
  | "temperature-gap";

export interface WeatherAdvisory {
  id: string;
  kind: WeatherAdvisoryKind;
  severity: "info" | "warning";
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
}

export interface WeatherSnapshot {
  location: WeatherLocation;
  fetchedAt: string;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  advisories: WeatherAdvisory[];
}

export interface WeatherRequestOptions {
  signal?: AbortSignal;
}

export interface WeatherProvider {
  getWeather(
    location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<WeatherSnapshot>;
}

export interface CampusPlanPreferences {
  defaultView: TaskView;
  showCompleted: boolean;
  weekStartsOn: 0 | 1;
  weatherLocation: WeatherLocation | null;
}

export interface CampusPlanState {
  schemaVersion: 1;
  tasks: Task[];
  subjects: Subject[];
  preferences: CampusPlanPreferences;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CampusPlanStorage {
  load(): CampusPlanState;
  save(state: CampusPlanState): void;
  clear(): void;
}

export type StateParseResult =
  | { ok: true; value: CampusPlanState }
  | { ok: false; error: Error };
