export interface CampusPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  phone: string;
  kakaoUrl: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
}

type UnknownRecord = Record<string, unknown>;

export function parseKSkillPlaces(payload: unknown): CampusPlace[] {
  const root = asRecord(payload);
  const documents = root?.documents;
  if (!Array.isArray(documents)) {
    throw new Error("장소 검색 응답 형식이 올바르지 않습니다.");
  }

  return documents.flatMap((document) => {
    const item = asRecord(document);
    if (!item) return [];
    const latitude = toFiniteNumber(item.y);
    const longitude = toFiniteNumber(item.x);
    const name = stringValue(item.place_name);
    if (latitude === null || longitude === null || !name) return [];

    return [
      {
        id: stringValue(item.id) || `${latitude}-${longitude}-${name}`,
        name,
        category: stringValue(item.category_name),
        address: stringValue(item.address_name),
        roadAddress: stringValue(item.road_address_name),
        phone: stringValue(item.phone),
        kakaoUrl: stringValue(item.place_url),
        latitude,
        longitude,
        distanceMeters: toFiniteNumber(item.distance),
      },
    ];
  });
}

export async function searchCampusPlaces(
  query: string,
  options: {
    latitude?: number;
    longitude?: number;
    radius?: number;
    signal?: AbortSignal;
  } = {},
): Promise<CampusPlace[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(options.latitude ?? 35.249),
    lon: String(options.longitude ?? 128.902),
    radius: String(options.radius ?? 3000),
  });
  const response = await fetch(`/api/map/search?${params}`, {
    signal: options.signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("장소를 검색하지 못했습니다.");
  const payload = (await response.json()) as { places?: CampusPlace[] };
  if (!Array.isArray(payload.places)) {
    throw new Error("장소 검색 응답 형식이 올바르지 않습니다.");
  }
  return payload.places;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toFiniteNumber(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}
