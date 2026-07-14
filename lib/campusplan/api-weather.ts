import type {
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
  WeatherSnapshot,
} from "./types.ts";

type Fetcher = typeof fetch;

export interface ApiWeatherProviderOptions {
  endpoint?: string;
  fetcher?: Fetcher;
}

export class ApiWeatherProvider implements WeatherProvider {
  private readonly endpoint: string;
  private readonly fetcher: Fetcher;

  constructor(options: ApiWeatherProviderOptions = {}) {
    this.endpoint = options.endpoint ?? "/api/weather";
    this.fetcher = options.fetcher ?? fetch;
  }

  async getWeather(
    location: WeatherLocation,
    options: WeatherRequestOptions = {},
  ): Promise<WeatherSnapshot> {
    const params = new URLSearchParams({
      lat: String(location.latitude),
      lon: String(location.longitude),
    });
    const response = await this.fetcher(`${this.endpoint}?${params}`, {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("날씨 정보를 불러오지 못했습니다.");
    }

    const snapshot = (await response.json()) as WeatherSnapshot;
    if (!snapshot?.current || !Array.isArray(snapshot.hourly) || !Array.isArray(snapshot.daily)) {
      throw new Error("날씨 응답 형식이 올바르지 않습니다.");
    }
    return snapshot;
  }
}
