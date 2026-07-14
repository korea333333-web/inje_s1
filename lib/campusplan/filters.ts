import {
  compareLocalDates,
  endOfWeek,
  isDateInRange,
  startOfWeek,
} from "./dates.ts";
import { sortTasksByUrgency } from "./urgency.ts";
import type {
  CompletionSummary,
  LocalDate,
  Task,
  TaskFilterOptions,
} from "./types.ts";

export function filterTasks(
  tasks: readonly Task[],
  options: TaskFilterOptions,
): Task[] {
  const {
    referenceDate,
    view = "all",
    subjectId = "all",
    type = "all",
    completed = "all",
    query = "",
    includeOverdue = true,
    weekStartsOn = 1,
  } = options;
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const weekStart = startOfWeek(referenceDate, weekStartsOn);
  const weekEnd = endOfWeek(referenceDate, weekStartsOn);

  const filtered = tasks.filter((task) => {
    if (!matchesView(task, view, referenceDate, weekStart, weekEnd, includeOverdue)) {
      return false;
    }
    if (subjectId !== "all" && task.subjectId !== subjectId) return false;
    if (type !== "all" && task.type !== type) return false;
    if (completed !== "all" && task.completed !== completed) return false;
    if (
      normalizedQuery &&
      !`${task.title} ${task.notes}`
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery)
    ) {
      return false;
    }
    return true;
  });

  return sortTasksByUrgency(filtered, referenceDate);
}

export function getTodayTasks(
  tasks: readonly Task[],
  referenceDate: LocalDate,
  options: Omit<TaskFilterOptions, "referenceDate" | "view"> = {},
): Task[] {
  return filterTasks(tasks, { ...options, referenceDate, view: "today" });
}

export function getThisWeekTasks(
  tasks: readonly Task[],
  referenceDate: LocalDate,
  options: Omit<TaskFilterOptions, "referenceDate" | "view"> = {},
): Task[] {
  return filterTasks(tasks, { ...options, referenceDate, view: "week" });
}

export function getCompletionSummary(
  tasks: readonly Pick<Task, "completed">[],
): CompletionSummary {
  const total = tasks.length;
  const completed = tasks.reduce(
    (count, task) => count + (task.completed ? 1 : 0),
    0,
  );

  return {
    total,
    completed,
    remaining: total - completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function matchesView(
  task: Task,
  view: TaskFilterOptions["view"],
  referenceDate: LocalDate,
  weekStart: LocalDate,
  weekEnd: LocalDate,
  includeOverdue: boolean,
): boolean {
  if (view === "all") return true;

  const isUnfinishedOverdue =
    includeOverdue &&
    !task.completed &&
    compareLocalDates(task.dueDate, referenceDate) < 0;

  if (view === "today") {
    return task.dueDate === referenceDate || isUnfinishedOverdue;
  }

  return (
    isDateInRange(task.dueDate, weekStart, weekEnd) || isUnfinishedOverdue
  );
}
