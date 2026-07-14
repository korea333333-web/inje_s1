import { differenceInCalendarDays } from "./dates.ts";
import type { LocalDate, Task, TaskUrgency } from "./types.ts";

export function getTaskUrgency(
  taskOrDueDate: Pick<Task, "dueDate"> | LocalDate,
  referenceDate: LocalDate,
): TaskUrgency {
  const dueDate =
    typeof taskOrDueDate === "string" ? taskOrDueDate : taskOrDueDate.dueDate;
  const daysRemaining = differenceInCalendarDays(dueDate, referenceDate);

  if (daysRemaining < 0) {
    return {
      level: "overdue",
      daysRemaining,
      label: `${Math.abs(daysRemaining)}일 지남`,
      sortRank: 0,
    };
  }

  if (daysRemaining <= 2) {
    return {
      level: "urgent",
      daysRemaining,
      label: daysRemaining === 0 ? "D-Day" : `D-${daysRemaining}`,
      sortRank: 1,
    };
  }

  if (daysRemaining <= 7) {
    return {
      level: "warning",
      daysRemaining,
      label: `D-${daysRemaining}`,
      sortRank: 2,
    };
  }

  return {
    level: "relaxed",
    daysRemaining,
    label: `D-${daysRemaining}`,
    sortRank: 3,
  };
}

export function sortTasksByUrgency(
  tasks: readonly Task[],
  referenceDate: LocalDate,
): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      if (left.task.completed !== right.task.completed) {
        return left.task.completed ? 1 : -1;
      }

      const leftUrgency = getTaskUrgency(left.task, referenceDate);
      const rightUrgency = getTaskUrgency(right.task, referenceDate);
      if (leftUrgency.sortRank !== rightUrgency.sortRank) {
        return leftUrgency.sortRank - rightUrgency.sortRank;
      }
      if (leftUrgency.daysRemaining !== rightUrgency.daysRemaining) {
        return leftUrgency.daysRemaining - rightUrgency.daysRemaining;
      }

      const timeOrder = (left.task.dueTime ?? "23:59").localeCompare(
        right.task.dueTime ?? "23:59",
      );
      if (timeOrder !== 0) return timeOrder;

      return left.index - right.index;
    })
    .map(({ task }) => task);
}
