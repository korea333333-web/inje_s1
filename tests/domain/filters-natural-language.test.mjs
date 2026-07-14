import test from "node:test";
import assert from "node:assert/strict";

import {
  filterTasks,
  getCompletionSummary,
  getThisWeekTasks,
  getTodayTasks,
  parseKoreanTaskInput,
  resolveKoreanRelativeDate,
} from "../../lib/campusplan/index.ts";
import { makeTask } from "./fixtures.mjs";

const REFERENCE_DATE = "2026-07-14";
const TASKS = [
  makeTask({ id: "old-open", dueDate: "2026-07-10", title: "지난 보고서" }),
  makeTask({ id: "old-done", dueDate: "2026-07-10", completed: true }),
  makeTask({ id: "today-open", dueDate: "2026-07-14", type: "exam", title: "자료구조 시험" }),
  makeTask({ id: "today-done", dueDate: "2026-07-14", completed: true }),
  makeTask({ id: "week", dueDate: "2026-07-19", subjectId: "design", title: "팀 발표" }),
  makeTask({ id: "next-week", dueDate: "2026-07-20" }),
];

test("오늘 보기는 오늘 일정과 아직 끝내지 않은 지연 일정을 함께 보여준다", () => {
  assert.deepEqual(
    getTodayTasks(TASKS, REFERENCE_DATE).map((task) => task.id),
    ["old-open", "today-open", "today-done"],
  );
  assert.deepEqual(
    getTodayTasks(TASKS, REFERENCE_DATE, { includeOverdue: false }).map(
      (task) => task.id,
    ),
    ["today-open", "today-done"],
  );
});

test("이번 주 보기는 월~일 일정과 미완료 지연 일정을 포함한다", () => {
  assert.deepEqual(
    getThisWeekTasks(TASKS, REFERENCE_DATE).map((task) => task.id),
    ["old-open", "today-open", "week", "today-done"],
  );
});

test("과목·유형·완료·검색 조건을 조합할 수 있다", () => {
  assert.deepEqual(
    filterTasks(TASKS, {
      referenceDate: REFERENCE_DATE,
      view: "all",
      type: "exam",
      completed: false,
      query: "자료구조",
    }).map((task) => task.id),
    ["today-open"],
  );
  assert.deepEqual(
    filterTasks(TASKS, {
      referenceDate: REFERENCE_DATE,
      subjectId: "design",
    }).map((task) => task.id),
    ["week"],
  );
});

test("완료 요약은 빈 목록과 일반 목록에서 안정적으로 계산된다", () => {
  assert.deepEqual(getCompletionSummary([]), {
    total: 0,
    completed: 0,
    remaining: 0,
    percentage: 0,
  });
  assert.deepEqual(getCompletionSummary(TASKS.slice(0, 4)), {
    total: 4,
    completed: 2,
    remaining: 2,
    percentage: 50,
  });
});

test("오늘·내일·모레를 기준일에서 해석하고 제목에서는 날짜 표현을 제거한다", () => {
  assert.deepEqual(parseKoreanTaskInput("내일 자료구조 과제 제출", REFERENCE_DATE), {
    original: "내일 자료구조 과제 제출",
    title: "자료구조 과제 제출",
    dueDate: "2026-07-15",
    matchedKeyword: "내일",
  });
  assert.equal(
    parseKoreanTaskInput("팀 발표 모레까지", REFERENCE_DATE).dueDate,
    "2026-07-16",
  );
  assert.equal(resolveKoreanRelativeDate("오늘", REFERENCE_DATE), REFERENCE_DATE);
});

test("날짜 표현이 없거나 단어 일부일 때는 억지로 해석하지 않는다", () => {
  assert.deepEqual(parseKoreanTaskInput("자료구조 복습", REFERENCE_DATE), {
    original: "자료구조 복습",
    title: "자료구조 복습",
    dueDate: null,
    matchedKeyword: null,
  });
  assert.equal(parseKoreanTaskInput("내일을 위한 계획", REFERENCE_DATE).dueDate, null);
});
