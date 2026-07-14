export function makeTask(overrides = {}) {
  return {
    id: "task-1",
    title: "자료구조 과제 제출",
    subjectId: "subject-data-structures",
    type: "assignment",
    dueDate: "2026-07-14",
    dueTime: "18:00",
    completed: false,
    notes: "",
    createdAt: "2026-07-10T09:00:00+09:00",
    updatedAt: "2026-07-10T09:00:00+09:00",
    ...overrides,
  };
}

export function makeState(overrides = {}) {
  return {
    schemaVersion: 1,
    tasks: [makeTask()],
    subjects: [
      {
        id: "subject-data-structures",
        name: "자료구조",
        color: "#8FAE91",
        professor: "김교수",
        classroom: "공학관 302호",
        schedule: [
          {
            dayOfWeek: 2,
            startTime: "10:00",
            endTime: "11:30",
            classroom: "공학관 302호",
          },
        ],
        createdAt: "2026-07-01T09:00:00+09:00",
        updatedAt: "2026-07-01T09:00:00+09:00",
      },
    ],
    preferences: {
      defaultView: "today",
      showCompleted: true,
      weekStartsOn: 1,
      weatherLocation: {
        id: "inje-gimhae-campus",
        name: "인제대학교 김해캠퍼스",
        latitude: 35.249,
        longitude: 128.902,
        nx: 95,
        ny: 77,
      },
    },
    ...overrides,
  };
}
