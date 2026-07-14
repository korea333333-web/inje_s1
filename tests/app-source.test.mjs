import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app/CampusPlanApp.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("주요 화면과 기능이 앱에 연결되어 있다", () => {
  for (const marker of [
    "TodayView",
    "WeekView",
    "TimetableView",
    "CalendarView",
    "SubjectsView",
    "SettingsView",
    "WeatherView",
    "MapView",
    "TaskModal",
    "TaskDetail",
    "localStorage",
    "실행 취소",
  ]) {
    assert.match(app, new RegExp(marker));
  }
});

test("날씨 공급자 교체 지점과 보안 원칙을 유지한다", async () => {
  const provider = await readFile(new URL("../lib/campusplan/weather.ts", import.meta.url), "utf8");
  assert.match(provider, /class MockWeatherProvider/);
  assert.match(app, /ApiWeatherProvider/);
  assert.doesNotMatch(app, /client[_-]?secret|api[_-]?key|x-ncp-apigw-api-key/i);
});

test("한국어 메타데이터와 반응형 접근성 장치를 제공한다", () => {
  assert.match(layout, /lang="ko"/);
  assert.match(layout, /CampusPlan/);
  assert.match(app, /skip-link/);
  assert.match(app, /aria-live|role="status"/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-width:\s*320px/);
});
