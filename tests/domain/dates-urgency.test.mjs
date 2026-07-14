import test from "node:test";
import assert from "node:assert/strict";

import {
  addCalendarDays,
  createFixedClock,
  differenceInCalendarDays,
  endOfWeek,
  getTaskUrgency,
  isLocalDate,
  sortTasksByUrgency,
  startOfWeek,
  todayFromClock,
} from "../../lib/campusplan/index.ts";
import { makeTask } from "./fixtures.mjs";

test("한국 시간 기준 날짜를 고정 시계에서 결정론적으로 얻는다", () => {
  const clock = createFixedClock("2026-07-13T15:30:00.000Z");
  assert.equal(todayFromClock(clock), "2026-07-14");
  assert.equal(todayFromClock(clock, "UTC"), "2026-07-13");
  assert.notStrictEqual(clock.now(), clock.now());
});

test("달력 날짜 검증과 날짜 연산은 월말·윤년을 안전하게 처리한다", () => {
  assert.equal(isLocalDate("2024-02-29"), true);
  assert.equal(isLocalDate("2025-02-29"), false);
  assert.equal(isLocalDate("2026-7-14"), false);
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  assert.equal(differenceInCalendarDays("2026-07-14", "2026-07-10"), 4);
});

test("주간 범위는 기본적으로 월요일부터 일요일까지다", () => {
  assert.equal(startOfWeek("2026-07-14"), "2026-07-13");
  assert.equal(endOfWeek("2026-07-14"), "2026-07-19");
  assert.equal(startOfWeek("2026-07-14", 0), "2026-07-12");
  assert.equal(endOfWeek("2026-07-14", 0), "2026-07-18");
});

test("D-day 긴급도 경계값을 정확히 분류한다", () => {
  const referenceDate = "2026-07-14";
  const cases = [
    ["2026-07-13", "overdue", -1, "1일 지남"],
    ["2026-07-14", "urgent", 0, "D-Day"],
    ["2026-07-16", "urgent", 2, "D-2"],
    ["2026-07-17", "warning", 3, "D-3"],
    ["2026-07-21", "warning", 7, "D-7"],
    ["2026-07-22", "relaxed", 8, "D-8"],
  ];

  for (const [dueDate, level, daysRemaining, label] of cases) {
    assert.deepEqual(getTaskUrgency(dueDate, referenceDate), {
      level,
      daysRemaining,
      label,
      sortRank: { overdue: 0, urgent: 1, warning: 2, relaxed: 3 }[level],
    });
  }
});

test("정렬은 미완료를 먼저 두고 마감일과 시각을 따르며 원본을 바꾸지 않는다", () => {
  const tasks = [
    makeTask({ id: "done", dueDate: "2026-07-12", completed: true }),
    makeTask({ id: "later", dueDate: "2026-07-16" }),
    makeTask({ id: "evening", dueTime: "18:00" }),
    makeTask({ id: "morning", dueTime: "09:00" }),
    makeTask({ id: "overdue", dueDate: "2026-07-13" }),
  ];
  const originalOrder = tasks.map((task) => task.id);

  assert.deepEqual(
    sortTasksByUrgency(tasks, "2026-07-14").map((task) => task.id),
    ["overdue", "morning", "evening", "later", "done"],
  );
  assert.deepEqual(tasks.map((task) => task.id), originalOrder);
});
