import type {
  DailyForecast,
  LocalDate,
  WeatherCondition,
  WeatherLocation,
  WeatherSnapshot,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

type ForecastGroup = {
  date: LocalDate;
  forecastAt: string;
  values: Record<string, string>;
};

const CONDITION_PRIORITY: Record<WeatherCondition, number> = {
  clear: 0,
  "partly-cloudy": 1,
  cloudy: 2,
  fog: 2,
  wind: 2,
  rain: 3,
  shower: 4,
  snow: 5,
  thunderstorm: 6,
};

export function normalizeKSkillWeather(
  payload: unknown,
  location: WeatherLocation,
): WeatherSnapshot {
  const root = asRecord(payload);
  const response = asRecord(root?.response);
  const header = asRecord(response?.header);
  if (header?.resultCode !== "00") {
    throw new Error(
      typeof header?.resultMsg === "string"
        ? header.resultMsg
        : "기상청 예보 응답이 정상적이지 않습니다.",
    );
  }

  const body = asRecord(response?.body);
  const items = asRecord(body?.items)?.item;
  if (!Array.isArray(items)) {
    throw new Error("기상청 예보 항목이 없습니다.");
  }

  const groups = groupForecastItems(items);
  if (groups.length === 0) {
    throw new Error("표시할 수 있는 날씨 예보가 없습니다.");
  }

  const hourly = groups
    .filter((group) => Number.isFinite(toNumber(group.values.TMP)))
    .slice(0, 6)
    .map((group) => {
      const condition = resolveCondition(group.values);
      return {
        forecastAt: group.forecastAt,
        temperature: toNumber(group.values.TMP) ?? 0,
        condition: condition.condition,
        conditionLabel: condition.label,
        precipitationProbability: toNumber(group.values.POP),
        precipitationAmount: parseAmount(group.values.PCP),
        windSpeed: toNumber(group.values.WSD),
      };
    });

  if (hourly.length === 0) {
    throw new Error("시간별 기온 예보가 없습니다.");
  }

  const daily = buildDailyForecast(groups);
  const currentGroup = groups.find((group) => group.values.TMP !== undefined) ?? groups[0];
  const currentCondition = resolveCondition(currentGroup.values);
  const currentDay = daily.find((day) => day.date === currentGroup.date) ?? daily[0];
  const precipitationProbability = toNumber(currentGroup.values.POP);
  const precipitationAmount = parseAmount(currentGroup.values.PCP);
  const windSpeed = toNumber(currentGroup.values.WSD);

  const proxy = asRecord(root?.proxy);
  const fetchedAt =
    typeof proxy?.requested_at === "string"
      ? proxy.requested_at
      : new Date().toISOString();

  const rainyHour = hourly.find(
    (forecast) =>
      forecast.condition === "rain" ||
      forecast.condition === "shower" ||
      forecast.condition === "thunderstorm" ||
      (forecast.precipitationProbability ?? 0) >= 60,
  );

  return {
    location: { ...location },
    fetchedAt,
    current: {
      observedAt: currentGroup.forecastAt,
      temperature: toNumber(currentGroup.values.TMP) ?? hourly[0].temperature,
      feelsLike: toNumber(currentGroup.values.TMP) ?? hourly[0].temperature,
      condition: currentCondition.condition,
      conditionLabel: currentCondition.label,
      precipitationProbability,
      precipitationAmount,
      humidity: toNumber(currentGroup.values.REH),
      windDirection: directionLabel(toNumber(currentGroup.values.VEC)),
      windSpeed,
      dailyHigh: currentDay?.high ?? null,
      dailyLow: currentDay?.low ?? null,
    },
    hourly,
    daily,
    advisories: rainyHour
      ? [
          {
            id: `rain-${rainyHour.forecastAt}`,
            kind: "rain",
            severity: "warning",
            title: "가까운 시간에 비 가능성이 있어요.",
            description: "캠퍼스 이동 전에 우산을 챙기고 강수확률을 확인하세요.",
            startsAt: rainyHour.forecastAt,
            endsAt: null,
          },
        ]
      : [],
  };
}

function groupForecastItems(items: unknown[]): ForecastGroup[] {
  const groups = new Map<string, ForecastGroup>();

  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const category = typeof record.category === "string" ? record.category : null;
    const date = typeof record.fcstDate === "string" ? record.fcstDate : null;
    const time = typeof record.fcstTime === "string" ? record.fcstTime : null;
    const value = typeof record.fcstValue === "string" ? record.fcstValue : null;
    if (!category || !date || !time || value === null) continue;
    if (!/^\d{8}$/.test(date) || !/^\d{4}$/.test(time)) continue;

    const localDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` as LocalDate;
    const forecastAt = `${localDate}T${time.slice(0, 2)}:${time.slice(2, 4)}:00+09:00`;
    const group = groups.get(forecastAt) ?? {
      date: localDate,
      forecastAt,
      values: {},
    };
    group.values[category] = value;
    groups.set(forecastAt, group);
  }

  return [...groups.values()].sort((a, b) => a.forecastAt.localeCompare(b.forecastAt));
}

function buildDailyForecast(groups: ForecastGroup[]): DailyForecast[] {
  const days = new Map<
    LocalDate,
    {
      temperatures: number[];
      lows: number[];
      highs: number[];
      probabilities: number[];
      conditions: ReturnType<typeof resolveCondition>[];
    }
  >();

  for (const group of groups) {
    const day = days.get(group.date) ?? {
      temperatures: [],
      lows: [],
      highs: [],
      probabilities: [],
      conditions: [],
    };
    pushNumber(day.temperatures, toNumber(group.values.TMP));
    pushNumber(day.lows, toNumber(group.values.TMN));
    pushNumber(day.highs, toNumber(group.values.TMX));
    pushNumber(day.probabilities, toNumber(group.values.POP));
    day.conditions.push(resolveCondition(group.values));
    days.set(group.date, day);
  }

  return [...days.entries()].map(([date, day]) => {
    const condition = day.conditions.reduce((selected, candidate) =>
      CONDITION_PRIORITY[candidate.condition] > CONDITION_PRIORITY[selected.condition]
        ? candidate
        : selected,
    );
    const lowCandidates = day.lows.length > 0 ? day.lows : day.temperatures;
    const highCandidates = day.highs.length > 0 ? day.highs : day.temperatures;
    return {
      date,
      condition: condition.condition,
      conditionLabel: condition.label,
      high: Math.round(Math.max(...highCandidates)),
      low: Math.round(Math.min(...lowCandidates)),
      precipitationProbability:
        day.probabilities.length > 0 ? Math.max(...day.probabilities) : null,
    };
  });
}

function resolveCondition(values: Record<string, string>): {
  condition: WeatherCondition;
  label: string;
} {
  const precipitationType = toNumber(values.PTY) ?? 0;
  if (precipitationType === 3 || precipitationType === 7) {
    return { condition: "snow", label: "눈" };
  }
  if (precipitationType === 4) {
    return { condition: "shower", label: "소나기" };
  }
  if (precipitationType > 0) {
    return { condition: "rain", label: precipitationType === 2 ? "비 또는 눈" : "비" };
  }

  const sky = toNumber(values.SKY) ?? 1;
  if (sky >= 4) return { condition: "cloudy", label: "흐림" };
  if (sky >= 3) return { condition: "partly-cloudy", label: "구름 많음" };
  return { condition: "clear", label: "맑음" };
}

function directionLabel(value: number | null): string | null {
  if (value === null) return null;
  const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  return `${directions[Math.round(value / 45) % directions.length]}풍`;
}

function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  if (value.includes("없음")) return 0;
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function pushNumber(target: number[], value: number | null): void {
  if (value !== null) target.push(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}
