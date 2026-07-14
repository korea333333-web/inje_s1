import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MOCK_WEATHER,
  INJE_GIMHAE_CAMPUS,
  MockWeatherProvider,
  createCampusPlanStorage,
  createEmptyCampusPlanState,
  deserializeCampusPlanState,
  serializeCampusPlanState,
  tryDeserializeCampusPlanState,
} from "../../lib/campusplan/index.ts";
import { makeState } from "./fixtures.mjs";

test("모의 날씨 공급자는 요청 위치를 반영하고 호출 간 객체를 격리한다", async () => {
  const provider = new MockWeatherProvider();
  const location = { ...INJE_GIMHAE_CAMPUS, name: "테스트 캠퍼스" };
  const first = await provider.getWeather(location);
  first.current.temperature = 999;
  const second = await provider.getWeather(location);

  assert.equal(second.location.name, "테스트 캠퍼스");
  assert.equal(second.current.temperature, DEFAULT_MOCK_WEATHER.current.temperature);
  assert.notStrictEqual(first, second);
});

test("모의 날씨 공급자는 실패와 요청 취소 상태를 재현한다", async () => {
  const failure = new Error("mock network failure");
  await assert.rejects(
    new MockWeatherProvider({ error: failure }).getWeather(INJE_GIMHAE_CAMPUS),
    failure,
  );

  const controller = new AbortController();
  const pending = new MockWeatherProvider({ latencyMs: 50 }).getWeather(
    INJE_GIMHAE_CAMPUS,
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("상태 직렬화와 역직렬화가 모든 일정·과목·환경설정을 보존한다", () => {
  const state = makeState();
  const serialized = serializeCampusPlanState(state);
  assert.deepEqual(deserializeCampusPlanState(serialized), state);
});

test("손상되거나 지원하지 않는 저장 데이터는 안전한 결과를 제공한다", () => {
  assert.equal(tryDeserializeCampusPlanState("{broken").ok, false);
  assert.equal(
    tryDeserializeCampusPlanState(JSON.stringify({ schemaVersion: 99 })).ok,
    false,
  );
  assert.deepEqual(deserializeCampusPlanState("{broken"), createEmptyCampusPlanState());
});

test("StorageLike 어댑터는 localStorage 없이도 저장·복원·초기화를 검증할 수 있다", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const repository = createCampusPlanStorage(storage, "test-key");

  repository.save(makeState());
  assert.deepEqual(repository.load(), makeState());
  repository.clear();
  assert.deepEqual(repository.load(), createEmptyCampusPlanState());
});
