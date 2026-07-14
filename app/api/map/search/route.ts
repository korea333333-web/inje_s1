import { INJE_GIMHAE_CAMPUS } from "@/lib/campusplan/weather.ts";
import { parseKSkillPlaces } from "@/lib/campusplan/map.ts";

const KSKILL_MAP_SEARCH_URL =
  "https://k-skill-proxy.nomadamas.org/v1/kakao-map/search/keyword";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return Response.json(
      { error: "검색어는 2자 이상 80자 이하로 입력해 주세요." },
      { status: 400 },
    );
  }

  const latitude = finiteNumber(
    requestUrl.searchParams.get("lat"),
    INJE_GIMHAE_CAMPUS.latitude,
  );
  const longitude = finiteNumber(
    requestUrl.searchParams.get("lon"),
    INJE_GIMHAE_CAMPUS.longitude,
  );
  const radius = Math.min(
    20_000,
    Math.max(100, finiteNumber(requestUrl.searchParams.get("radius"), 3_000)),
  );

  const upstreamUrl = new URL(KSKILL_MAP_SEARCH_URL);
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set("x", String(longitude));
  upstreamUrl.searchParams.set("y", String(latitude));
  upstreamUrl.searchParams.set("radius", String(radius));
  upstreamUrl.searchParams.set("sort", "distance");
  upstreamUrl.searchParams.set("size", "15");

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`k-skill map ${response.status}`);
    const places = parseKSkillPlaces(await response.json());
    return Response.json(
      { places, center: { latitude, longitude }, source: "k-skill-proxy" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "장소 검색 서비스에 일시적으로 연결할 수 없습니다." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function finiteNumber(rawValue: string | null, fallback: number): number {
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}
