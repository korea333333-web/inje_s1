import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiWeatherProvider,
  INJE_GIMHAE_CAMPUS,
  normalizeKSkillWeather,
  parseKSkillPlaces,
} from "../../lib/campusplan/index.ts";

function weatherItem(category, fcstDate, fcstTime, fcstValue) {
  return { category, fcstDate, fcstTime, fcstValue };
}

test("k-skill 기상청 응답을 CampusPlan 날씨 형식으로 변환한다", () => {
  const payload = {
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
      body: {
        items: {
          item: [
            weatherItem("TMP", "20260714", "1800", "28"),
            weatherItem("SKY", "20260714", "1800", "4"),
            weatherItem("PTY", "20260714", "1800", "1"),
            weatherItem("POP", "20260714", "1800", "70"),
            weatherItem("PCP", "20260714", "1800", "1.0mm"),
            weatherItem("REH", "20260714", "1800", "78"),
            weatherItem("WSD", "20260714", "1800", "4.2"),
            weatherItem("VEC", "20260714", "1800", "208"),
            weatherItem("TMN", "20260714", "1800", "22"),
            weatherItem("TMX", "20260714", "1800", "30"),
            weatherItem("TMP", "20260714", "1900", "27"),
            weatherItem("SKY", "20260714", "1900", "3"),
            weatherItem("PTY", "20260714", "1900", "0"),
            weatherItem("POP", "20260714", "1900", "30"),
            weatherItem("TMP", "20260715", "0900", "25"),
            weatherItem("SKY", "20260715", "0900", "1"),
            weatherItem("PTY", "20260715", "0900", "0"),
            weatherItem("POP", "20260715", "0900", "10"),
          ],
        },
      },
    },
    proxy: { requested_at: "2026-07-14T09:43:40.260Z" },
  };

  const result = normalizeKSkillWeather(payload, INJE_GIMHAE_CAMPUS);

  assert.equal(result.current.temperature, 28);
  assert.equal(result.current.condition, "rain");
  assert.equal(result.current.humidity, 78);
  assert.equal(result.current.windDirection, "남서풍");
  assert.equal(result.hourly.length, 3);
  assert.equal(result.daily.length, 2);
  assert.deepEqual(
    { high: result.daily[0].high, low: result.daily[0].low },
    { high: 30, low: 22 },
  );
  assert.equal(result.advisories[0].kind, "rain");
});

test("k-skill 카카오 장소 응답에서 안전한 지도 항목만 추출한다", () => {
  const result = parseKSkillPlaces({
    documents: [
      {
        id: "123",
        place_name: "인제대학교 김해캠퍼스",
        category_name: "교육,학문 > 학교 > 대학교",
        address_name: "경남 김해시 어방동",
        road_address_name: "경남 김해시 인제로 197",
        phone: "055-000-0000",
        place_url: "https://place.map.kakao.com/123",
        x: "128.902",
        y: "35.249",
        distance: "120",
      },
      { place_name: "좌표 없는 항목" },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "인제대학교 김해캠퍼스");
  assert.equal(result[0].latitude, 35.249);
  assert.equal(result[0].distanceMeters, 120);
});

test("브라우저 날씨 공급자는 내부 API만 호출한다", async () => {
  let requestedUrl = "";
  const snapshot = normalizeKSkillWeather(
    {
      response: {
        header: { resultCode: "00" },
        body: {
          items: {
            item: [
              weatherItem("TMP", "20260714", "1800", "28"),
              weatherItem("SKY", "20260714", "1800", "1"),
              weatherItem("PTY", "20260714", "1800", "0"),
            ],
          },
        },
      },
    },
    INJE_GIMHAE_CAMPUS,
  );
  const provider = new ApiWeatherProvider({
    fetcher: async (input) => {
      requestedUrl = String(input);
      return Response.json(snapshot);
    },
  });

  await provider.getWeather(INJE_GIMHAE_CAMPUS);

  assert.match(requestedUrl, /^\/api\/weather\?/);
  assert.match(requestedUrl, /lat=35.249/);
  assert.match(requestedUrl, /lon=128.902/);
  assert.doesNotMatch(requestedUrl, /key|secret/i);
});
