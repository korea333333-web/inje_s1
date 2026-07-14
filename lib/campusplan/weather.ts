import type {
  DailyForecast,
  LocalDate,
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
  WeatherSnapshot,
} from "./types.ts";

export const INJE_GIMHAE_CAMPUS: WeatherLocation = {
  id: "inje-gimhae-campus",
  name: "인제대학교 김해캠퍼스",
  latitude: 35.249,
  longitude: 128.902,
  nx: 95,
  ny: 77,
};

export const DEFAULT_MOCK_WEATHER: WeatherSnapshot = {
  location: INJE_GIMHAE_CAMPUS,
  fetchedAt: "2026-07-14T13:20:00+09:00",
  current: {
    observedAt: "2026-07-14T13:00:00+09:00",
    temperature: 24,
    feelsLike: 26,
    condition: "cloudy",
    conditionLabel: "흐리고 한때 비",
    precipitationProbability: 70,
    precipitationAmount: 0,
    humidity: 78,
    windDirection: "남동풍",
    windSpeed: 2.4,
    dailyHigh: 28,
    dailyLow: 22,
  },
  hourly: [
    hourly("2026-07-14T14:00:00+09:00", 24, "cloudy", "흐림", 30, 0),
    hourly("2026-07-14T15:00:00+09:00", 24, "rain", "비", 60, 1),
    hourly("2026-07-14T16:00:00+09:00", 23, "rain", "비", 70, 2),
    hourly("2026-07-14T17:00:00+09:00", 23, "cloudy", "흐림", 40, 0),
    hourly("2026-07-14T18:00:00+09:00", 22, "cloudy", "흐림", 20, 0),
  ],
  daily: [
    daily("2026-07-14", "rain", "비", 28, 22, 70),
    daily("2026-07-15", "cloudy", "흐림", 27, 21, 30),
    daily("2026-07-16", "clear", "맑음", 30, 22, 10),
    daily("2026-07-17", "shower", "소나기", 29, 23, 60),
    daily("2026-07-18", "clear", "맑음", 31, 24, 10),
  ],
  advisories: [
    {
      id: "mock-rain-20260714",
      kind: "rain",
      severity: "warning",
      title: "오후 3시부터 비가 예상돼요.",
      description: "오후 수업이나 도서관 이동 전 우산을 챙기세요.",
      startsAt: "2026-07-14T15:00:00+09:00",
      endsAt: "2026-07-14T17:00:00+09:00",
    },
  ],
};

export interface MockWeatherProviderOptions {
  snapshot?: WeatherSnapshot;
  latencyMs?: number;
  error?: Error | null;
}

export class MockWeatherProvider implements WeatherProvider {
  private readonly snapshot: WeatherSnapshot;
  private readonly latencyMs: number;
  private readonly error: Error | null;

  constructor(options: MockWeatherProviderOptions = {}) {
    this.snapshot = cloneWeather(options.snapshot ?? DEFAULT_MOCK_WEATHER);
    this.latencyMs = options.latencyMs ?? 0;
    this.error = options.error ?? null;

    if (!Number.isFinite(this.latencyMs) || this.latencyMs < 0) {
      throw new RangeError("모의 날씨 지연 시간은 0 이상의 숫자여야 합니다.");
    }
  }

  async getWeather(
    location: WeatherLocation,
    options: WeatherRequestOptions = {},
  ): Promise<WeatherSnapshot> {
    throwIfAborted(options.signal);
    if (this.latencyMs > 0) await waitFor(this.latencyMs, options.signal);
    throwIfAborted(options.signal);
    if (this.error) throw this.error;

    const response = cloneWeather(this.snapshot);
    response.location = { ...location };
    return response;
  }
}

function hourly(
  forecastAt: string,
  temperature: number,
  condition: "cloudy" | "rain",
  conditionLabel: string,
  precipitationProbability: number,
  precipitationAmount: number,
) {
  return {
    forecastAt,
    temperature,
    condition,
    conditionLabel,
    precipitationProbability,
    precipitationAmount,
    windSpeed: 2.4,
  };
}

function daily(
  date: string,
  condition: DailyForecast["condition"],
  conditionLabel: string,
  high: number,
  low: number,
  precipitationProbability: number,
): DailyForecast {
  return {
    date: date as LocalDate,
    condition,
    conditionLabel,
    high,
    low,
    precipitationProbability,
  };
}

function cloneWeather(snapshot: WeatherSnapshot): WeatherSnapshot {
  return structuredClone(snapshot);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): Error {
  const error = new Error("날씨 요청이 취소되었습니다.");
  error.name = "AbortError";
  return error;
}

function waitFor(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, milliseconds);

    function finish() {
      cleanup();
      resolve();
    }

    function cancel() {
      clearTimeout(timer);
      cleanup();
      reject(abortError());
    }

    function cleanup() {
      signal?.removeEventListener("abort", cancel);
    }

    signal?.addEventListener("abort", cancel, { once: true });
  });
}
