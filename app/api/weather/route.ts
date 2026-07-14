import { INJE_GIMHAE_CAMPUS } from "@/lib/campusplan/weather.ts";
import { normalizeKSkillWeather } from "@/lib/campusplan/k-skill-weather.ts";

const KSKILL_WEATHER_URL =
  "https://k-skill-proxy.nomadamas.org/v1/korea-weather/forecast";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const latitude = coordinate(
    requestUrl.searchParams.get("lat"),
    INJE_GIMHAE_CAMPUS.latitude,
    33,
    39.5,
  );
  const longitude = coordinate(
    requestUrl.searchParams.get("lon"),
    INJE_GIMHAE_CAMPUS.longitude,
    124,
    132,
  );

  if (latitude === null || longitude === null) {
    return Response.json(
      { error: "대한민국 범위의 올바른 위도와 경도를 입력해 주세요." },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(KSKILL_WEATHER_URL);
  upstreamUrl.searchParams.set("lat", String(latitude));
  upstreamUrl.searchParams.set("lon", String(longitude));
  upstreamUrl.searchParams.set("numOfRows", "2000");

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`k-skill weather ${response.status}`);

    const payload: unknown = await response.json();
    const snapshot = normalizeKSkillWeather(payload, {
      ...INJE_GIMHAE_CAMPUS,
      latitude,
      longitude,
    });

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json(
      { error: "날씨 제공 서비스에 일시적으로 연결할 수 없습니다." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function coordinate(
  rawValue: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  const value = rawValue === null ? fallback : Number(rawValue);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}
