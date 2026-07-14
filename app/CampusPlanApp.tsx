"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiWeatherProvider,
  DEFAULT_MOCK_WEATHER,
  INJE_GIMHAE_CAMPUS,
  getTaskUrgency,
  parseKoreanTaskInput,
  searchCampusPlaces,
  toLocalDate,
  type CampusPlace,
  type LocalDate,
  type WeatherCondition,
  type WeatherSnapshot,
} from "@/lib/campusplan/index.ts";

type AppView =
  | "today"
  | "week"
  | "timetable"
  | "calendar"
  | "subjects"
  | "settings"
  | "map"
  | "weather";
type TaskType = "과제" | "시험" | "개인";
type TaskFilter = "전체" | TaskType;
type WeatherStatus = "ready" | "loading" | "error" | "offline";
type MapStatus = "idle" | "loading" | "ready" | "empty" | "error";

type Task = {
  id: string;
  title: string;
  subjectId: string;
  type: TaskType;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  notes: string;
  createdAt: string;
};

type Subject = {
  id: string;
  name: string;
  color: string;
  professor: string;
  classroom: string;
};

type ClassSession = {
  id: string;
  subjectId: string;
  day: number;
  start: string;
  end: string;
  room: string;
};

type WeatherHour = {
  time: string;
  icon: string;
  temperature: number;
  precipitation: number;
  condition: string;
};

type WeatherDay = {
  offset: number;
  icon: string;
  condition: string;
  high: number;
  low: number;
  precipitation: number;
};

type WeatherData = {
  location: string;
  icon: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  high: number;
  low: number;
  precipitation: number;
  humidity: number;
  wind: string;
  rainfall: string;
  updatedAt: string;
  hours: WeatherHour[];
  days: WeatherDay[];
};

type Settings = {
  weekStartsMonday: boolean;
  showCompleted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  weatherAlerts: boolean;
  locationMode: "campus" | "current" | "manual";
};

type StoredState = {
  tasks: Task[];
  subjects: Subject[];
  settings: Settings;
};

const STORAGE_KEY = "campusplan.state.v1";
const DAY_MS = 86_400_000;
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const weekDays = ["월", "화", "수", "목", "금"];

const defaultSubjects: Subject[] = [
  {
    id: "data",
    name: "자료구조",
    color: "#8f6f43",
    professor: "김교수",
    classroom: "공학관 302호",
  },
  {
    id: "design",
    name: "디자인씽킹",
    color: "#7f9b8d",
    professor: "이교수",
    classroom: "창의관 201호",
  },
  {
    id: "business",
    name: "경영학개론",
    color: "#b17c77",
    professor: "박교수",
    classroom: "인문관 102호",
  },
  {
    id: "parttime",
    name: "알바",
    color: "#778caa",
    professor: "",
    classroom: "카페",
  },
  {
    id: "club",
    name: "동아리",
    color: "#a78eaf",
    professor: "",
    classroom: "학생회관",
  },
];

const defaultClasses: ClassSession[] = [
  { id: "c1", subjectId: "data", day: 2, start: "10:00", end: "11:30", room: "공학관 302호" },
  { id: "c2", subjectId: "design", day: 2, start: "14:00", end: "15:30", room: "창의관 201호" },
  { id: "c3", subjectId: "business", day: 3, start: "13:00", end: "14:30", room: "인문관 102호" },
  { id: "c4", subjectId: "data", day: 4, start: "09:00", end: "10:30", room: "공학관 302호" },
  { id: "c5", subjectId: "design", day: 5, start: "11:00", end: "12:30", room: "창의관 201호" },
];

const defaultSettings: Settings = {
  weekStartsMonday: true,
  showCompleted: true,
  reducedMotion: false,
  highContrast: false,
  weatherAlerts: true,
  locationMode: "campus",
};

const weatherProvider = new ApiWeatherProvider();

function weatherIcon(condition: WeatherCondition) {
  if (condition === "rain" || condition === "shower" || condition === "thunderstorm") return "☂";
  if (condition === "clear") return "☀";
  if (condition === "snow") return "❄";
  if (condition === "wind") return "≋";
  return "☁";
}

function toWeatherData(snapshot: WeatherSnapshot): WeatherData {
  const current = snapshot.current;
  const fetchedAt = new Date(snapshot.fetchedAt);
  return {
    location: snapshot.location.name,
    icon: weatherIcon(current.condition),
    temperature: current.temperature,
    feelsLike: current.feelsLike ?? current.temperature,
    condition: current.conditionLabel,
    high: current.dailyHigh ?? current.temperature,
    low: current.dailyLow ?? current.temperature,
    precipitation: current.precipitationProbability ?? 0,
    humidity: current.humidity ?? 0,
    wind: `${current.windDirection ?? "바람"} ${current.windSpeed ?? 0}m/s`,
    rainfall: current.precipitationAmount ? `${current.precipitationAmount}mm` : "강수 없음",
    updatedAt: new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(fetchedAt),
    hours: snapshot.hourly.map((hour) => {
      const date = new Date(hour.forecastAt);
      return {
        time: `${date.getHours()}시`,
        icon: weatherIcon(hour.condition),
        temperature: hour.temperature,
        precipitation: hour.precipitationProbability ?? 0,
        condition: hour.conditionLabel,
      };
    }),
    days: snapshot.daily.map((day) => ({
      offset: Math.max(0, diffDays(day.date)),
      icon: weatherIcon(day.condition),
      condition: day.conditionLabel,
      high: day.high,
      low: day.low,
      precipitation: day.precipitationProbability ?? 0,
    })),
  };
}

const initialWeather = toWeatherData(DEFAULT_MOCK_WEATHER);

const CAMPUS_MAP_PLACE: CampusPlace = {
  id: INJE_GIMHAE_CAMPUS.id,
  name: INJE_GIMHAE_CAMPUS.name,
  category: "대학교",
  address: "경상남도 김해시 인제로 197",
  roadAddress: "경남 김해시 인제로 197",
  phone: "",
  kakaoUrl: "",
  latitude: INJE_GIMHAE_CAMPUS.latitude,
  longitude: INJE_GIMHAE_CAMPUS.longitude,
  distanceMeters: 0,
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const result = startOfDay(value);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function diffDays(dueDate: string, now = new Date()) {
  return Math.round((startOfDay(parseDate(dueDate)).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function formatKoreanDate(value: Date, includeYear = true) {
  const prefix = includeYear ? `${value.getFullYear()}년 ` : "";
  return `${prefix}${value.getMonth() + 1}월 ${value.getDate()}일 ${weekdays[value.getDay()]}요일`;
}

function taskUrgency(task: Task, now = new Date()) {
  if (task.completed) return { level: "completed", label: "완료" };
  const urgency = getTaskUrgency(task.dueDate as LocalDate, toLocalDate(now));
  return {
    level: urgency.level,
    label: urgency.daysRemaining === 0 ? "오늘 마감" : urgency.label,
  };
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return `${a.dueDate}T${a.dueTime || "23:59"}`.localeCompare(
      `${b.dueDate}T${b.dueTime || "23:59"}`,
    );
  });
}

function createSeedTasks(now = new Date()): Task[] {
  const createdAt = now.toISOString();
  return [
    {
      id: "task-overdue",
      title: "경영학 보고서 제출",
      subjectId: "business",
      type: "과제",
      dueDate: isoDate(addDays(now, -1)),
      dueTime: "23:59",
      completed: false,
      notes: "보고서 표지와 참고문헌을 마지막으로 확인하기",
      createdAt,
    },
    {
      id: "task-urgent",
      title: "자료구조 중간고사 준비",
      subjectId: "data",
      type: "시험",
      dueDate: isoDate(addDays(now, 1)),
      dueTime: "14:00",
      completed: false,
      notes: "연결 리스트와 트리 단원 복습",
      createdAt,
    },
    {
      id: "task-warning",
      title: "팀 프로젝트 발표자료 완성",
      subjectId: "design",
      type: "과제",
      dueDate: isoDate(addDays(now, 5)),
      dueTime: "18:00",
      completed: false,
      notes: "팀원 피드백 반영",
      createdAt,
    },
    {
      id: "task-relaxed",
      title: "동아리 정기회의 안건 정리",
      subjectId: "club",
      type: "개인",
      dueDate: isoDate(addDays(now, 10)),
      dueTime: "18:00",
      completed: false,
      notes: "",
      createdAt,
    },
    {
      id: "task-done",
      title: "도서관 대출 도서 반납",
      subjectId: "club",
      type: "개인",
      dueDate: isoDate(now),
      dueTime: "12:00",
      completed: true,
      notes: "",
      createdAt,
    },
  ];
}

function parseQuickInput(input: string, now = new Date()) {
  const parsedDate = parseKoreanTaskInput(input, toLocalDate(now));
  const timeMatch = input.match(/(?:오전|오후)?\s*(\d{1,2})시/);
  let hour = timeMatch ? Number(timeMatch[1]) : 23;
  if (/오후/.test(timeMatch?.[0] ?? "") && hour < 12) hour += 12;
  if (/오전/.test(timeMatch?.[0] ?? "") && hour === 12) hour = 0;
  const title = parsedDate.title
    .replace(/오늘|내일|모레/g, "")
    .replace(/(?:오전|오후)?\s*\d{1,2}시(?:\s*\d{1,2}분)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title: title || input.trim(),
    dueDate: parsedDate.dueDate ?? isoDate(now),
    dueTime: timeMatch ? `${String(hour).padStart(2, "0")}:00` : "23:59",
  };
}

function loadInitialState(): StoredState {
  if (typeof window === "undefined") {
    return { tasks: createSeedTasks(), subjects: defaultSubjects, settings: defaultSettings };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: createSeedTasks(), subjects: defaultSubjects, settings: defaultSettings };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : createSeedTasks(),
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : defaultSubjects,
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { tasks: createSeedTasks(), subjects: defaultSubjects, settings: defaultSettings };
  }
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export function CampusPlanApp() {
  const initial = useMemo(() => loadInitialState(), []);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [subjects, setSubjects] = useState<Subject[]>(initial.subjects);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [view, setView] = useState<AppView>("today");
  const [filter, setFilter] = useState<TaskFilter>("전체");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [quickInput, setQuickInput] = useState("");
  const [quickFocused, setQuickFocused] = useState(false);
  const [taskModal, setTaskModal] = useState<null | { mode: "add" | "edit"; task?: Task }>(null);
  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>("ready");
  const [weather, setWeather] = useState<WeatherData>(initialWeather);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [deletedTask, setDeletedTask] = useState<Task | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(startOfDay(new Date()));
  const importRef = useRef<HTMLInputElement>(null);

  const loadWeather = useCallback(async () => {
    setWeatherStatus("loading");
    try {
      const snapshot = await weatherProvider.getWeather(INJE_GIMHAE_CAMPUS);
      setWeather(toWeatherData(snapshot));
      setWeatherStatus("ready");
      return true;
    } catch {
      setWeatherStatus("offline");
      return false;
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, subjects, settings }));
  }, [tasks, subjects, settings]);

  useEffect(() => {
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.documentElement.dataset.motion = settings.reducedMotion ? "reduced" : "full";
  }, [settings.highContrast, settings.reducedMotion]);

  useEffect(() => {
    if (!snackbar) return;
    const timer = window.setTimeout(() => setSnackbar(null), 10000);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWeather(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWeather]);

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const typeMatch = filter === "전체" || task.type === filter;
      const subjectMatch = subjectFilter === "all" || task.subjectId === subjectFilter;
      return typeMatch && subjectMatch;
    });
    return sortTasks(filtered);
  }, [tasks, filter, subjectFilter]);

  const navigate = (next: AppView) => {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: settings.reducedMotion ? "auto" : "smooth" });
  };

  const saveTask = (task: Task) => {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      return exists ? current.map((item) => (item.id === task.id ? task : item)) : [...current, task];
    });
    setTaskModal(null);
    setSelectedTask(null);
    setSnackbar("일정이 저장되었습니다");
  };

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)),
    );
  };

  const deleteTask = (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setDeletedTask(task);
    setSelectedTask(null);
    setTaskModal(null);
    setSnackbar("일정이 삭제되었습니다");
  };

  const undoDelete = () => {
    if (!deletedTask) return;
    setTasks((current) => [...current, deletedTask]);
    setDeletedTask(null);
    setSnackbar("삭제를 취소했습니다");
  };

  const addQuickTask = () => {
    if (!quickInput.trim()) return;
    const parsed = parseQuickInput(quickInput);
    const subject = subjects.find((item) => parsed.title.includes(item.name));
    const type: TaskType = /시험|중간고사|기말고사/.test(parsed.title) ? "시험" : /과제|제출|발표/.test(parsed.title) ? "과제" : "개인";
    saveTask({
      id: crypto.randomUUID(),
      title: parsed.title,
      subjectId: subject?.id ?? subjects[0]?.id ?? "personal",
      type,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      completed: false,
      notes: "",
      createdAt: new Date().toISOString(),
    });
    setQuickInput("");
    setQuickFocused(false);
  };

  const refreshWeather = async () => {
    const updated = await loadWeather();
    setSnackbar(
      updated
        ? "날씨 정보를 업데이트했습니다"
        : "실시간 날씨를 불러오지 못해 임시 정보를 표시합니다",
    );
  };

  const saveSubject = (subject: Subject) => {
    setSubjects((current) => {
      const exists = current.some((item) => item.id === subject.id);
      return exists ? current.map((item) => (item.id === subject.id ? subject : item)) : [...current, subject];
    });
    setSubjectModal(null);
    setSnackbar("과목이 저장되었습니다");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ tasks, subjects, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campusplan-${isoDate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as StoredState;
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.subjects)) throw new Error("invalid");
      setTasks(parsed.tasks);
      setSubjects(parsed.subjects);
      setSettings({ ...defaultSettings, ...parsed.settings });
      setSnackbar("데이터를 불러왔습니다");
    } catch {
      setSnackbar("올바른 CampusPlan 데이터가 아닙니다");
    }
  };

  const resetData = () => {
    if (!window.confirm("모든 일정과 설정을 초기화할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    setTasks(createSeedTasks());
    setSubjects(defaultSubjects);
    setSettings(defaultSettings);
    setSnackbar("데이터를 초기화했습니다");
  };

  const renderView = () => {
    const shared: ViewProps = {
      tasks: visibleTasks,
      allTasks: tasks,
      subjects,
      subjectMap,
      settings,
      weather,
      weatherStatus,
      filter,
      setFilter,
      toggleTask,
      editTask: (task) => setTaskModal({ mode: "edit", task }),
      openTask: setSelectedTask,
      deleteTask,
      navigate,
    };
    if (view === "week") return <WeekView {...shared} />;
    if (view === "timetable") return <TimetableView {...shared} classes={defaultClasses} />;
    if (view === "calendar") return <CalendarView {...shared} date={calendarDate} setDate={setCalendarDate} />;
    if (view === "subjects") return <SubjectsView {...shared} editSubject={setSubjectModal} />;
    if (view === "map") return <MapView />;
    if (view === "settings") {
      return (
        <SettingsView
          {...shared}
          updateSettings={(patch) => setSettings((current) => ({ ...current, ...patch }))}
          exportData={exportData}
          importData={() => importRef.current?.click()}
          resetData={resetData}
        />
      );
    }
    if (view === "weather") {
      return <WeatherView {...shared} refresh={refreshWeather} setStatus={setWeatherStatus} />;
    }
    return <TodayView {...shared} classes={defaultClasses} />;
  };

  return (
    <div className="campus-shell">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <Sidebar
        view={view}
        subjects={subjects}
        subjectFilter={subjectFilter}
        setSubjectFilter={setSubjectFilter}
        weather={weather}
        navigate={navigate}
        addSubject={() => setSubjectModal("new")}
      />
      <div className="app-stage">
        <Header
          value={quickInput}
          setValue={setQuickInput}
          focused={quickFocused}
          setFocused={setQuickFocused}
          submit={addQuickTask}
          openAdd={() => setTaskModal({ mode: "add" })}
          openWeather={() => navigate("weather")}
          weather={weather}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          navigate={navigate}
        />
        <main id="main-content" className="main-content">{renderView()}</main>
      </div>
      <MobileNavigation view={view} navigate={navigate} />
      <button className="floating-add" type="button" onClick={() => setTaskModal({ mode: "add" })} aria-label="새 일정 추가">+</button>
      {taskModal && (
        <TaskModal
          mode={taskModal.mode}
          task={taskModal.task}
          subjects={subjects}
          save={saveTask}
          close={() => setTaskModal(null)}
          remove={deleteTask}
        />
      )}
      {subjectModal && (
        <SubjectModal
          subject={subjectModal === "new" ? undefined : subjectModal}
          save={saveSubject}
          close={() => setSubjectModal(null)}
        />
      )}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          subject={subjectMap[selectedTask.subjectId]}
          close={() => setSelectedTask(null)}
          edit={() => setTaskModal({ mode: "edit", task: selectedTask })}
          remove={() => deleteTask(selectedTask)}
          toggle={() => toggleTask(selectedTask.id)}
        />
      )}
      {snackbar && (
        <div className="snackbar" role="status">
          <span>{snackbar}</span>
          {deletedTask && snackbar === "일정이 삭제되었습니다" && <button type="button" onClick={undoDelete}>실행 취소</button>}
          <button className="snackbar-close" type="button" onClick={() => setSnackbar(null)} aria-label="알림 닫기">×</button>
        </div>
      )}
      <input
        ref={importRef}
        className="sr-only"
        type="file"
        accept="application/json"
        onChange={(event) => event.target.files?.[0] && importData(event.target.files[0])}
      />
    </div>
  );
}

type ViewProps = {
  tasks: Task[];
  allTasks: Task[];
  subjects: Subject[];
  subjectMap: Record<string, Subject>;
  settings: Settings;
  weather: WeatherData;
  weatherStatus: WeatherStatus;
  filter: TaskFilter;
  setFilter: (filter: TaskFilter) => void;
  toggleTask: (id: string) => void;
  editTask: (task: Task) => void;
  openTask: (task: Task) => void;
  deleteTask: (task: Task) => void;
  navigate: (view: AppView) => void;
};

function Sidebar({
  view,
  subjects,
  subjectFilter,
  setSubjectFilter,
  weather,
  navigate,
  addSubject,
}: {
  view: AppView;
  subjects: Subject[];
  subjectFilter: string;
  setSubjectFilter: (id: string) => void;
  weather: WeatherData;
  navigate: (view: AppView) => void;
  addSubject: () => void;
}) {
  const items: { id: AppView; label: string; icon: string }[] = [
    { id: "today", label: "오늘", icon: "▦" },
    { id: "week", label: "이번 주", icon: "▥" },
    { id: "timetable", label: "시간표", icon: "▤" },
    { id: "calendar", label: "전체 일정", icon: "□" },
    { id: "map", label: "캠퍼스 지도", icon: "⌖" },
  ];
  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      <button className="brand" type="button" onClick={() => navigate("today")}>
        <strong>CampusPlan</strong>
        <span>University Life Planner</span>
      </button>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)}>
            <Icon>{item.icon}</Icon><span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-section">
        <div className="sidebar-label"><span>내 과목</span><button type="button" onClick={() => navigate("subjects")}>관리</button></div>
        <button className={subjectFilter === "all" ? "subject-filter active" : "subject-filter"} type="button" onClick={() => setSubjectFilter("all")}>전체 과목</button>
        {subjects.map((subject) => (
          <button key={subject.id} className={subjectFilter === subject.id ? "subject-filter active" : "subject-filter"} type="button" onClick={() => setSubjectFilter(subject.id)}>
            <span className="subject-dot" style={{ backgroundColor: subject.color }} />{subject.name}
          </button>
        ))}
        <button className="outline-action" type="button" onClick={addSubject}>+ 과목 추가</button>
      </div>
      <button className="sidebar-weather" type="button" onClick={() => navigate("weather")}>
        <span className="weather-symbol">{weather.icon ?? "☁"}</span>
        <span><strong>김해시 {weather.temperature}°</strong><small>{weather.condition}</small></span>
      </button>
      <button className={view === "settings" ? "sidebar-settings active" : "sidebar-settings"} type="button" onClick={() => navigate("settings")}>
        <Icon>⚙</Icon> 설정
      </button>
    </aside>
  );
}

function Header({
  value,
  setValue,
  focused,
  setFocused,
  submit,
  openAdd,
  openWeather,
  weather,
  menuOpen,
  setMenuOpen,
  navigate,
}: {
  value: string;
  setValue: (value: string) => void;
  focused: boolean;
  setFocused: (value: boolean) => void;
  submit: () => void;
  openAdd: () => void;
  openWeather: () => void;
  weather: WeatherData;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  navigate: (view: AppView) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submit();
    if (event.key === "Escape") setFocused(false);
  };
  return (
    <header className="top-header">
      <button className="mobile-brand" type="button" onClick={() => navigate("today")}>CampusPlan</button>
      <div className="quick-add-wrap">
        <label className="sr-only" htmlFor="quick-add">빠르게 일정 추가</label>
        <span aria-hidden="true">＋</span>
        <input
          id="quick-add"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="할 일을 입력하세요 · 예: 내일 자료구조 과제 제출"
        />
        <button type="button" onClick={submit} disabled={!value.trim()}>추가</button>
        {focused && (
          <div className="quick-suggestions">
            <strong>이렇게 입력해 보세요</strong>
            {["오늘 오후 6시 알바", "내일 자료구조 과제 제출", "모레 디자인씽킹 발표 준비"].map((suggestion) => (
              <button key={suggestion} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setValue(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}
      </div>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="알림"><Icon>♢</Icon><span className="notification-dot" /></button>
        <button className="weather-button" type="button" onClick={openWeather} aria-label="캠퍼스 날씨 보기"><span>{weather.icon}</span><strong>{weather.temperature}°</strong><small>{weather.condition}</small></button>
        <button className="primary-button desktop-add" type="button" onClick={openAdd}>+ 일정 추가</button>
        <button className="avatar" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="내 정보 메뉴">민</button>
        {menuOpen && (
          <div className="profile-menu">
            <strong>김민지</strong><span>인제대학교</span>
            <button type="button" onClick={() => navigate("settings")}>설정 열기</button>
          </div>
        )}
      </div>
    </header>
  );
}

function MobileNavigation({ view, navigate }: { view: AppView; navigate: (view: AppView) => void }) {
  const items: { id: AppView; label: string; icon: string }[] = [
    { id: "today", label: "오늘", icon: "▣" },
    { id: "timetable", label: "시간표", icon: "◷" },
    { id: "calendar", label: "캘린더", icon: "▦" },
    { id: "map", label: "지도", icon: "⌖" },
    { id: "settings", label: "내 정보", icon: "♙" },
  ];
  return (
    <nav className="mobile-nav" aria-label="모바일 메뉴">
      {items.map((item) => (
        <button key={item.id} type="button" className={view === item.id || (item.id === "calendar" && view === "week") ? "active" : ""} onClick={() => navigate(item.id)}>
          <span>{item.icon}</span><small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function PageHeading({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {aside && <div className="page-heading-aside">{aside}</div>}
    </div>
  );
}

function ProgressCard({ tasks, label = "오늘" }: { tasks: Task[]; label?: string }) {
  const relevant = tasks.filter((task) => diffDays(task.dueDate) === 0 || label === "이번 주");
  const completed = relevant.filter((task) => task.completed).length;
  const percent = relevant.length ? Math.round((completed / relevant.length) * 100) : 0;
  return (
    <div className="progress-card">
      <div className="progress-copy"><span>{label} {relevant.length}개 중 {completed}개 완료</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="progressbar" aria-label={`${label} 일정 완료율`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FilterChips({ filter, setFilter }: { filter: TaskFilter; setFilter: (filter: TaskFilter) => void }) {
  return (
    <div className="filter-row" aria-label="일정 유형 필터">
      {(["전체", "과제", "시험", "개인"] as TaskFilter[]).map((item) => (
        <button key={item} className={filter === item ? "filter-chip active" : "filter-chip"} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>
      ))}
      <span className="sort-label">마감 임박순</span>
    </div>
  );
}

function WeatherSummary({
  weather,
  status,
  openDetails,
  compact = false,
}: {
  weather: WeatherData;
  status: WeatherStatus;
  openDetails: () => void;
  compact?: boolean;
}) {
  if (status === "loading") {
    return <section className="weather-card weather-loading" aria-live="polite"><div className="skeleton weather-skeleton" /><p>날씨 정보를 불러오는 중이에요</p></section>;
  }
  if (status === "error") {
    return (
      <section className="weather-card weather-state" role="status">
        <span className="weather-symbol">!</span><div><h2>날씨 정보를 불러오지 못했어요</h2><p>일정 기능은 계속 사용할 수 있어요.</p></div>
        <button type="button" onClick={openDetails}>다시 시도</button>
      </section>
    );
  }
  return (
    <section className={compact ? "weather-card compact" : "weather-card"} aria-labelledby="weather-title">
      {status === "offline" && <div className="offline-banner">오프라인 상태 · 마지막 저장 날씨를 표시합니다</div>}
      <button className="weather-main" type="button" onClick={openDetails}>
        <span className="weather-symbol">☂</span>
        <span className="weather-current">
          <small id="weather-title">{weather.location}</small>
          <strong>{weather.temperature}°</strong>
          <span>{weather.condition}</span>
        </span>
        <span className="weather-details">
          <small>체감 {weather.feelsLike}°</small>
          <small>최고 {weather.high}° · 최저 {weather.low}°</small>
          <small>강수확률 {weather.precipitation}%</small>
        </span>
      </button>
      {!compact && (
        <div className="hourly-strip" aria-label="시간별 날씨">
          {weather.hours.slice(0, 5).map((hour) => (
            <div key={hour.time} className="hour-weather"><span>{hour.time}</span><b aria-hidden="true">{hour.icon}</b><strong>{hour.temperature}°</strong><small>{hour.precipitation}%</small></div>
          ))}
        </div>
      )}
      <div className="weather-advice"><span aria-hidden="true">☂</span><strong>오후 수업 이동 시 우산을 챙기세요.</strong><small>{weather.updatedAt} 업데이트</small></div>
    </section>
  );
}

function WeatherAlert({ dismissible = false }: { dismissible?: boolean }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <aside className="weather-alert" aria-label="일정과 관련된 날씨 안내">
      <span className="alert-icon" aria-hidden="true">△</span>
      <div><strong>강의실 이동 주의</strong><p>오후 3시부터 비 예보가 있어요. 디자인씽킹 수업 이동 시 우산을 준비하세요.</p></div>
      {dismissible && <button type="button" onClick={() => setVisible(false)} aria-label="날씨 안내 닫기">×</button>}
    </aside>
  );
}

function TaskCard({
  task,
  subject,
  toggle,
  open,
  edit,
  remove,
}: {
  task: Task;
  subject?: Subject;
  toggle: () => void;
  open: () => void;
  edit: () => void;
  remove: () => void;
}) {
  const urgency = taskUrgency(task);
  const [menu, setMenu] = useState(false);
  return (
    <article className={`task-card urgency-${urgency.level}`}>
      <label className="task-check">
        <input type="checkbox" checked={task.completed} onChange={toggle} aria-label={`${task.title} 완료 상태`} />
        <span aria-hidden="true">✓</span>
      </label>
      <button className="task-body" type="button" onClick={open}>
        <strong>{task.title}</strong>
        <span className="task-meta">
          {subject && <span><i className="subject-dot" style={{ backgroundColor: subject.color }} />{subject.name}</span>}
          <span>{task.type}</span>
          <span>{task.dueDate.slice(5).replace("-", ".")} {task.dueTime}</span>
        </span>
      </button>
      <span className={`urgency-badge ${urgency.level}`}><span aria-hidden="true">{urgency.level === "overdue" ? "!" : "◷"}</span>{urgency.label}</span>
      <div className="task-menu-wrap">
        <button className="more-button" type="button" onClick={() => setMenu(!menu)} aria-label={`${task.title} 메뉴`} aria-expanded={menu}>•••</button>
        {menu && (
          <div className="task-menu">
            <button type="button" onClick={open}>상세 보기</button>
            <button type="button" onClick={edit}>수정</button>
            <button className="danger-text" type="button" onClick={remove}>삭제</button>
          </div>
        )}
      </div>
    </article>
  );
}

function TaskList({
  tasks,
  subjectMap,
  toggleTask,
  openTask,
  editTask,
  deleteTask,
  emptyTitle = "등록된 일정이 없어요",
}: Pick<ViewProps, "tasks" | "subjectMap" | "toggleTask" | "openTask" | "editTask" | "deleteTask"> & { emptyTitle?: string }) {
  if (!tasks.length) {
    return <div className="empty-state"><span aria-hidden="true">□</span><strong>{emptyTitle}</strong><p>새 일정을 추가하거나 필터를 변경해 보세요.</p></div>;
  }
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} subject={subjectMap[task.subjectId]} toggle={() => toggleTask(task.id)} open={() => openTask(task)} edit={() => editTask(task)} remove={() => deleteTask(task)} />
      ))}
    </div>
  );
}

function ClassList({ classes, subjects, day = new Date().getDay() }: { classes: ClassSession[]; subjects: Subject[]; day?: number }) {
  const sessions = classes.filter((session) => session.day === day);
  const subjectMap = Object.fromEntries(subjects.map((subject) => [subject.id, subject]));
  if (!sessions.length) return <div className="empty-state small"><strong>예정된 수업이 없어요</strong><p>오늘은 수업 사이에 여유가 있어요.</p></div>;
  return (
    <div className="class-list">
      {sessions.map((session) => {
        const subject = subjectMap[session.subjectId];
        return (
          <article className="class-card" key={session.id} style={{ borderLeftColor: subject?.color }}>
            <div className="class-time"><strong>{session.start}</strong><span>~</span><strong>{session.end}</strong></div>
            <div><small>{subject?.professor || "수업"}</small><h3>{subject?.name ?? "과목"}</h3><p>⌖ {session.room}</p></div>
            {session.end >= "15:00" && <span className="rain-note">수업 종료 무렵 비 가능</span>}
          </article>
        );
      })}
    </div>
  );
}

function TodayView(props: ViewProps & { classes: ClassSession[] }) {
  const today = startOfDay(new Date());
  const todayTasks = props.tasks.filter((task) => diffDays(task.dueDate, today) <= 0 || diffDays(task.dueDate, today) <= 10);
  const active = todayTasks.filter((task) => !task.completed);
  const completed = todayTasks.filter((task) => task.completed);
  const urgentCount = active.filter((task) => ["overdue", "urgent"].includes(taskUrgency(task).level)).length;
  return (
    <div className="view today-view">
      <PageHeading title={formatKoreanDate(today)} subtitle={urgentCount ? `마감이 임박한 일정이 ${urgentCount}개 있어요` : "오늘 일정은 여유로워요"} aside={<span className="today-marker">TODAY</span>} />
      <ProgressCard tasks={props.allTasks} />
      <div className="weather-grid">
        <WeatherSummary weather={props.weather} status={props.weatherStatus} openDetails={() => props.navigate("weather")} />
        {props.settings.weatherAlerts && <WeatherAlert dismissible />}
      </div>
      <FilterChips filter={props.filter} setFilter={props.setFilter} />
      <div className="today-columns">
        <section className="content-section"><div className="section-heading"><h2><Icon>◇</Icon> 오늘의 수업</h2><span>{formatKoreanDate(today, false)}</span></div><ClassList classes={props.classes} subjects={props.subjects} day={today.getDay()} /></section>
        <section className="content-section"><div className="section-heading"><h2><Icon>☷</Icon> 해야 할 일</h2><span>{active.length}개 남음</span></div><TaskList {...props} tasks={active} /></section>
      </div>
      {props.settings.showCompleted && (
        <details className="completed-section" open>
          <summary>완료한 일 <span>{completed.length}</span></summary>
          <TaskList {...props} tasks={completed} emptyTitle="아직 완료한 일정이 없어요" />
        </details>
      )}
    </div>
  );
}

function WeekView(props: ViewProps) {
  const now = startOfDay(new Date());
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = addDays(now, mondayOffset);
  const sunday = addDays(monday, 6);
  const weekTasks = props.tasks.filter((task) => {
    const date = parseDate(task.dueDate);
    return date >= monday && date <= sunday;
  });
  const completed = weekTasks.filter((task) => task.completed).length;
  const urgent = weekTasks.filter((task) => !task.completed && ["overdue", "urgent"].includes(taskUrgency(task).level)).length;
  return (
    <div className="view week-view">
      <PageHeading title="이번 주" subtitle={`${monday.getMonth() + 1}월 ${monday.getDate()}일 – ${sunday.getMonth() + 1}월 ${sunday.getDate()}일`} aside={<div className="segmented"><button className="active" type="button">목록 보기</button><button type="button">주간 보드</button></div>} />
      <div className="summary-grid">
        <div className="summary-card"><span aria-hidden="true">✓</span><strong>{completed} / {weekTasks.length}</strong><small>완료된 일정</small></div>
        <div className="summary-card urgent"><span aria-hidden="true">△</span><strong>{urgent}</strong><small>마감 임박</small></div>
        <div className="summary-card"><span aria-hidden="true">☂</span><strong>{props.weather.days.filter((day) => day.precipitation >= 50).length}일</strong><small>비 예보 있음</small></div>
      </div>
      <div className="weekly-weather" aria-label="이번 주 날씨">
        {props.weather.days.map((day) => {
          const date = addDays(now, day.offset);
          return <div key={day.offset} className={day.offset === 0 ? "weather-day today" : "weather-day"}><span>{weekdays[date.getDay()]} {date.getDate()}</span><b>{day.icon}</b><strong>{day.high}° / {day.low}°</strong><small>{day.precipitation}%</small></div>;
        })}
      </div>
      <div className="week-timeline">
        {Array.from({ length: 7 }, (_, index) => addDays(monday, index)).map((date) => {
          const dayTasks = weekTasks.filter((task) => task.dueDate === isoDate(date));
          return (
            <section className={isoDate(date) === isoDate(now) ? "day-group today" : "day-group"} key={isoDate(date)}>
              <div className="day-heading"><span className="timeline-dot" /><h2>{date.getMonth() + 1}.{date.getDate()} {weekdays[date.getDay()]}요일</h2>{isoDate(date) === isoDate(now) && <span className="today-chip">오늘</span>}</div>
              <TaskList {...props} tasks={dayTasks} emptyTitle="예정된 일정이 없어요" />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TimetableView(props: ViewProps & { classes: ClassSession[] }) {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);
  return (
    <div className="view timetable-view">
      <PageHeading title="시간표" subtitle="2026학년도 2학기" aside={<div className="page-actions"><button type="button">‹ 이전 주</button><button type="button">이번 주</button><button type="button">다음 주 ›</button></div>} />
      <div className="mobile-day-tabs">
        {weekDays.map((day, index) => <button key={day} type="button" className={selectedDay === index + 1 ? "active" : ""} onClick={() => setSelectedDay(index + 1)}>{day}</button>)}
      </div>
      <div className="timetable-grid" role="table" aria-label="주간 수업 시간표">
        <div className="time-corner" />
        {weekDays.map((day, index) => {
          const forecast = props.weather.days[index];
          return <div className="timetable-day-header" key={day}><strong>{day}</strong><span>{forecast.icon} {forecast.high}°</span>{forecast.precipitation >= 50 && <small>우산 필요</small>}</div>;
        })}
        {Array.from({ length: 10 }, (_, index) => index + 9).map((hour) => <div key={`time-${hour}`} className="time-label" style={{ gridRow: `${hour - 7} / span 1` }}>{String(hour).padStart(2, "0")}:00</div>)}
        {props.classes.map((session) => {
          const subject = props.subjectMap[session.subjectId];
          const startHour = Number(session.start.split(":")[0]);
          const startMinute = Number(session.start.split(":")[1]);
          const endHour = Number(session.end.split(":")[0]);
          const endMinute = Number(session.end.split(":")[1]);
          const top = (startHour - 9) * 72 + startMinute * 1.2;
          const height = Math.max(64, (endHour * 60 + endMinute - startHour * 60 - startMinute) * 1.2);
          return (
            <article key={session.id} className={`timetable-event mobile-day-${session.day}`} style={{ gridColumn: session.day + 1, top: `${top + 78}px`, height: `${height}px`, borderLeftColor: subject?.color, display: selectedDay === session.day ? undefined : undefined }}>
              <strong>{subject?.name}</strong><span>{session.start}–{session.end}</span><small>{session.room}</small>{session.day === 2 && session.end >= "15:00" && <em>☂ 종료 무렵 비</em>}
            </article>
          );
        })}
        <div className="timetable-lines">{Array.from({ length: 10 }, (_, index) => <span key={index} />)}</div>
      </div>
      <div className="mobile-timetable-list"><WeatherSummary weather={props.weather} status={props.weatherStatus} openDetails={() => props.navigate("weather")} compact /><ClassList classes={props.classes} subjects={props.subjects} day={selectedDay} /></div>
    </div>
  );
}

function CalendarView(props: ViewProps & { date: Date; setDate: (date: Date) => void }) {
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const first = new Date(props.date.getFullYear(), props.date.getMonth(), 1);
  const last = new Date(props.date.getFullYear(), props.date.getMonth() + 1, 0);
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: last.getDate() }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1)),
  ];
  const selectedTasks = props.tasks.filter((task) => task.dueDate === isoDate(props.date));
  const moveMonth = (offset: number) => props.setDate(new Date(props.date.getFullYear(), props.date.getMonth() + offset, 1));
  return (
    <div className="view calendar-view">
      <PageHeading title="전체 일정" subtitle={`${props.date.getFullYear()}년 ${props.date.getMonth() + 1}월`} aside={<div className="segmented"><button className={mode === "calendar" ? "active" : ""} type="button" onClick={() => setMode("calendar")}>캘린더</button><button className={mode === "list" ? "active" : ""} type="button" onClick={() => setMode("list")}>목록</button></div>} />
      <div className="calendar-toolbar"><button type="button" onClick={() => moveMonth(-1)}>‹ 이전 달</button><button type="button" onClick={() => props.setDate(startOfDay(new Date()))}>오늘</button><button type="button" onClick={() => moveMonth(1)}>다음 달 ›</button></div>
      {mode === "list" ? (
        <div className="calendar-list"><FilterChips filter={props.filter} setFilter={props.setFilter} /><TaskList {...props} /></div>
      ) : (
        <div className="calendar-layout">
          <div className="month-calendar">
            {weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {cells.map((date, index) => {
              if (!date) return <div className="calendar-cell empty" key={`empty-${index}`} />;
              const dateTasks = props.allTasks.filter((task) => task.dueDate === isoDate(date));
              const isToday = isoDate(date) === isoDate(new Date());
              const selected = isoDate(date) === isoDate(props.date);
              const weather = props.weather.days.find((day) => day.offset === Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / DAY_MS));
              return (
                <button key={isoDate(date)} className={`calendar-cell${isToday ? " today" : ""}${selected ? " selected" : ""}`} type="button" onClick={() => props.setDate(date)}>
                  <span className="calendar-date">{date.getDate()}</span>{weather && <span className="calendar-weather">{weather.icon}</span>}
                  <span className="calendar-events">{dateTasks.slice(0, 3).map((task) => <span key={task.id} className={`mini-event ${taskUrgency(task).level}`}>{task.title}</span>)}{dateTasks.length > 3 && <small>+{dateTasks.length - 3}개 더보기</small>}</span>
                </button>
              );
            })}
          </div>
          <aside className="selected-date-panel">
            <div><small>선택한 날짜</small><h2>{formatKoreanDate(props.date, false)}</h2></div>
            <div className="mini-weather"><span>☂</span><strong>{props.weather.temperature}°</strong><small>강수 {props.weather.precipitation}%</small></div>
            <TaskList {...props} tasks={selectedTasks} emptyTitle="이날 등록된 일정이 없어요" />
            <button className="primary-button full" type="button" onClick={() => document.querySelector<HTMLButtonElement>(".floating-add")?.click()}>+ 이 날짜에 일정 추가</button>
          </aside>
        </div>
      )}
    </div>
  );
}

function SubjectsView(props: ViewProps & { editSubject: (subject: Subject | "new") => void }) {
  return (
    <div className="view subjects-view">
      <PageHeading title="과목 관리" subtitle="과목과 수업 정보를 한곳에서 관리하세요" aside={<button className="primary-button" type="button" onClick={() => props.editSubject("new")}>+ 과목 추가</button>} />
      <div className="subject-grid">
        {props.subjects.map((subject) => {
          const remaining = props.allTasks.filter((task) => task.subjectId === subject.id && !task.completed).length;
          return (
            <article className="subject-card" key={subject.id} style={{ borderTopColor: subject.color }}>
              <div className="subject-card-heading"><span className="subject-dot large" style={{ backgroundColor: subject.color }} /><h2>{subject.name}</h2><button type="button" onClick={() => props.editSubject(subject)}>수정</button></div>
              <dl><div><dt>담당 교수</dt><dd>{subject.professor || "등록 안 됨"}</dd></div><div><dt>강의실</dt><dd>{subject.classroom || "등록 안 됨"}</dd></div><div><dt>남은 일정</dt><dd>{remaining}개</dd></div></dl>
              <button className="outline-action" type="button" onClick={() => { props.navigate("today"); }}>일정 보기</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView(
  props: ViewProps & {
    updateSettings: (patch: Partial<Settings>) => void;
    exportData: () => void;
    importData: () => void;
    resetData: () => void;
  },
) {
  return (
    <div className="view settings-view">
      <PageHeading title="내 정보와 설정" subtitle="CampusPlan을 나에게 맞게 조정하세요" />
      <section className="profile-card"><div className="profile-avatar">민</div><div><h2>김민지</h2><p>인제대학교 · 김해캠퍼스</p><small>데이터는 이 브라우저에 안전하게 저장됩니다.</small></div></section>
      <div className="settings-grid">
        <section className="settings-section"><h2>기본 설정</h2><Toggle label="한 주를 월요일부터 시작" checked={props.settings.weekStartsMonday} setChecked={(value) => props.updateSettings({ weekStartsMonday: value })} /><Toggle label="완료한 일정 표시" checked={props.settings.showCompleted} setChecked={(value) => props.updateSettings({ showCompleted: value })} /></section>
        <section className="settings-section"><h2>위치 및 날씨</h2><div className="setting-block"><label htmlFor="location-mode">날씨 위치</label><select id="location-mode" value={props.settings.locationMode} onChange={(event) => props.updateSettings({ locationMode: event.target.value as Settings["locationMode"] })}><option value="campus">인제대학교 김해캠퍼스</option><option value="current">현재 위치 사용</option><option value="manual">지역 직접 선택</option></select><small>현재 위치는 날씨 정보를 표시하는 용도로만 사용됩니다.</small></div><Toggle label="수업과 관련된 날씨 경고" checked={props.settings.weatherAlerts} setChecked={(value) => props.updateSettings({ weatherAlerts: value })} /></section>
        <section className="settings-section"><h2>접근성</h2><Toggle label="모션 줄이기" checked={props.settings.reducedMotion} setChecked={(value) => props.updateSettings({ reducedMotion: value })} /><Toggle label="고대비 표시" checked={props.settings.highContrast} setChecked={(value) => props.updateSettings({ highContrast: value })} /></section>
        <section className="settings-section data-settings"><h2>데이터 관리</h2><p>일정과 과목을 JSON 파일로 백업하거나 복원할 수 있어요.</p><div><button type="button" onClick={props.exportData}>데이터 내보내기</button><button type="button" onClick={props.importData}>데이터 불러오기</button></div><button className="danger-button" type="button" onClick={props.resetData}>모든 데이터 초기화</button></section>
      </div>
    </div>
  );
}

function Toggle({ label, checked, setChecked }: { label: string; checked: boolean; setChecked: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function MapView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MapStatus>("idle");
  const [places, setPlaces] = useState<CampusPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace>(CAMPUS_MAP_PLACE);
  const quickSearches = ["카페", "편의점", "병원", "버스정류장"];

  const runSearch = async (searchTerm: string) => {
    const normalized = searchTerm.trim();
    if (normalized.length < 2) {
      setStatus("empty");
      return;
    }

    setQuery(normalized);
    setStatus("loading");
    try {
      const results = await searchCampusPlaces(normalized, {
        latitude: INJE_GIMHAE_CAMPUS.latitude,
        longitude: INJE_GIMHAE_CAMPUS.longitude,
        radius: 3_000,
      });
      setPlaces(results);
      setStatus(results.length > 0 ? "ready" : "empty");
      if (results[0]) setSelectedPlace(results[0]);
    } catch {
      setStatus("error");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <div className="view map-view">
      <PageHeading
        title="캠퍼스 지도"
        subtitle="인제대학교 주변 장소를 검색하고 지도에서 확인하세요"
        aside={<span className="today-marker">K-SKILL + OPENSTREETMAP</span>}
      />
      <form className="map-search" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="map-search-input">캠퍼스 주변 장소 검색</label>
        <input
          id="map-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="카페, 편의점, 병원처럼 검색해 보세요"
        />
        <button className="primary-button" type="submit" disabled={status === "loading" || query.trim().length < 2}>
          {status === "loading" ? "검색 중…" : "검색"}
        </button>
      </form>
      <div className="map-quick-searches" aria-label="빠른 장소 검색">
        {quickSearches.map((item) => (
          <button key={item} type="button" onClick={() => void runSearch(item)}>{item}</button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSelectedPlace(CAMPUS_MAP_PLACE);
            setQuery("");
            setPlaces([]);
            setStatus("idle");
          }}
        >
          캠퍼스 중심
        </button>
      </div>
      <div className="campus-map-layout">
        <section className="campus-map-panel" aria-label={`${selectedPlace.name} 지도`}>
          <iframe
            src={openStreetMapEmbedUrl(selectedPlace.latitude, selectedPlace.longitude)}
            title={`${selectedPlace.name} 주변 OpenStreetMap 지도`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="map-selected-place">
            <span className="map-pin" aria-hidden="true">⌖</span>
            <div>
              <small>{selectedPlace.category || "선택한 장소"}</small>
              <strong>{selectedPlace.name}</strong>
              <p>{selectedPlace.roadAddress || selectedPlace.address}</p>
            </div>
            <a
              href={`https://www.openstreetmap.org/?mlat=${selectedPlace.latitude}&mlon=${selectedPlace.longitude}#map=17/${selectedPlace.latitude}/${selectedPlace.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              큰 지도
            </a>
          </div>
        </section>
        <section className="map-results" aria-live="polite">
          <div className="section-heading"><h2>주변 장소</h2><span>{places.length > 0 ? `${places.length}곳` : "3km 이내"}</span></div>
          {status === "idle" && <div className="map-empty"><span>⌕</span><strong>찾을 장소를 검색하세요</strong><p>검색 결과는 가까운 순서로 표시됩니다.</p></div>}
          {status === "loading" && <div className="map-empty"><span>…</span><strong>주변 장소를 찾고 있어요</strong></div>}
          {status === "empty" && <div className="map-empty"><span>!</span><strong>검색 결과가 없습니다</strong><p>다른 검색어를 입력해 보세요.</p></div>}
          {status === "error" && <div className="map-empty error"><span>!</span><strong>장소 정보를 불러오지 못했습니다</strong><button type="button" onClick={() => void runSearch(query)}>다시 시도</button></div>}
          {status === "ready" && (
            <div className="map-result-list">
              {places.map((place) => (
                <article key={place.id} className={selectedPlace.id === place.id ? "selected" : ""}>
                  <button type="button" onClick={() => setSelectedPlace(place)}>
                    <span className="map-result-number">{formatDistance(place.distanceMeters)}</span>
                    <span className="map-result-copy">
                      <strong>{place.name}</strong>
                      <small>{place.category || "장소"}</small>
                      <p>{place.roadAddress || place.address}</p>
                    </span>
                  </button>
                  {place.kakaoUrl && <a href={place.kakaoUrl} target="_blank" rel="noreferrer" aria-label={`${place.name} 카카오맵에서 보기`}>↗</a>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="map-attribution">지도 © OpenStreetMap contributors · 장소 정보 Kakao via k-skill proxy</p>
    </div>
  );
}

function openStreetMapEmbedUrl(latitude: number, longitude: number): string {
  const longitudeDelta = 0.012;
  const latitudeDelta = 0.007;
  const params = new URLSearchParams({
    bbox: [
      longitude - longitudeDelta,
      latitude - latitudeDelta,
      longitude + longitudeDelta,
      latitude + latitudeDelta,
    ].join(","),
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters === null) return "거리 미상";
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)}m`;
  return `${(distanceMeters / 1_000).toFixed(1)}km`;
}

function WeatherView(props: ViewProps & { refresh: () => void; setStatus: (status: WeatherStatus) => void }) {
  return (
    <div className="view weather-view">
      <PageHeading title="캠퍼스 날씨" subtitle={props.weather.location} aside={<button className="outline-button" type="button" onClick={props.refresh} disabled={props.weatherStatus === "loading"}>{props.weatherStatus === "loading" ? "업데이트 중…" : "↻ 새로고침"}</button>} />
      {props.weatherStatus === "error" ? (
        <div className="weather-full-state"><span>!</span><h2>날씨 정보를 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요. 일정 기능은 정상적으로 사용할 수 있습니다.</p><button className="primary-button" type="button" onClick={props.refresh}>다시 시도</button></div>
      ) : (
        <>
          {props.weatherStatus === "offline" && <div className="offline-banner large">오프라인 상태입니다. {props.weather.updatedAt}에 저장된 날씨를 표시합니다.</div>}
          <div className="weather-hero">
            <div className="hero-condition"><span className="weather-symbol">☂</span><div><small>현재 날씨</small><strong>{props.weather.temperature}°</strong><p>{props.weather.condition}</p></div></div>
            <div className="weather-metrics"><div><small>체감</small><strong>{props.weather.feelsLike}°</strong></div><div><small>최고 / 최저</small><strong>{props.weather.high}° / {props.weather.low}°</strong></div><div><small>강수확률</small><strong>{props.weather.precipitation}%</strong></div><div><small>습도</small><strong>{props.weather.humidity}%</strong></div><div><small>바람</small><strong>{props.weather.wind}</strong></div><div><small>예상 강수량</small><strong>{props.weather.rainfall}</strong></div></div>
          </div>
          <WeatherAlert dismissible />
          <section className="forecast-section"><div className="section-heading"><h2>시간별 날씨</h2><span>다음 6시간</span></div><div className="hourly-forecast-grid">{props.weather.hours.map((hour) => <article key={hour.time}><span>{hour.time}</span><b>{hour.icon}</b><strong>{hour.temperature}°</strong><p>{hour.condition}</p><small>강수 {hour.precipitation}%</small></article>)}</div></section>
          <section className="forecast-section"><div className="section-heading"><h2>주간 날씨</h2><span>{props.weather.days.length}일 예보</span></div><div className="daily-forecast-list">{props.weather.days.map((day) => { const date = addDays(new Date(), day.offset); return <article key={day.offset}><div><strong>{day.offset === 0 ? "오늘" : weekdays[date.getDay()] + "요일"}</strong><small>{date.getMonth() + 1}.{date.getDate()}</small></div><b>{day.icon}</b><span>{day.condition}</span><strong>{day.high}° / {day.low}°</strong><small>강수 {day.precipitation}%</small></article>; })}</div></section>
          <section className="weather-schedule-section"><div className="section-heading"><h2>날씨와 내 일정</h2><span>준비가 필요한 일정</span></div><div className="weather-related-card"><span>☂</span><div><strong>디자인씽킹 · 오늘 14:00</strong><p>수업 종료 무렵 비 가능성이 있어요.</p></div><button type="button" onClick={() => props.navigate("today")}>일정 보기</button></div><div className="weather-related-card"><span>△</span><div><strong>동아리 야외 행사 · 금요일 17:00</strong><p>소나기 가능성 60% · 실내 대안을 확인하세요.</p></div><button type="button" onClick={() => props.navigate("week")}>이번 주 보기</button></div></section>
          {process.env.NODE_ENV !== "production" && (
            <div className="weather-dev-tools" aria-label="날씨 상태 시험 도구"><small>개발용 날씨 상태 확인</small><button type="button" onClick={() => props.setStatus("ready")}>정상</button><button type="button" onClick={() => props.setStatus("loading")}>로딩</button><button type="button" onClick={() => props.setStatus("error")}>오류</button><button type="button" onClick={() => props.setStatus("offline")}>오프라인</button></div>
          )}
        </>
      )}
    </div>
  );
}

function TaskModal({ mode, task, subjects, save, close, remove }: { mode: "add" | "edit"; task?: Task; subjects: Subject[]; save: (task: Task) => void; close: () => void; remove: (task: Task) => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? subjects[0]?.id ?? "");
  const [type, setType] = useState<TaskType>(task?.type ?? "과제");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? isoDate(new Date()));
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "23:59");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [showMore, setShowMore] = useState(Boolean(task?.notes));
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError("일정 제목을 입력해 주세요."); return; }
    save({ id: task?.id ?? crypto.randomUUID(), title: title.trim(), subjectId, type, dueDate, dueTime, completed: task?.completed ?? false, notes: notes.trim(), createdAt: task?.createdAt ?? new Date().toISOString() });
  };
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal-heading"><div><small>{mode === "add" ? "QUICK PLAN" : "EDIT PLAN"}</small><h2 id="task-modal-title">{mode === "add" ? "새 일정 추가" : "일정 수정"}</h2></div><button type="button" onClick={close} aria-label="창 닫기">×</button></div>
        <form onSubmit={submit}>
          <label className="field full"><span>일정 제목 *</span><input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder="예: 자료구조 과제 제출" />{error && <small className="field-error">{error}</small>}</label>
          <div className="form-grid"><label className="field"><span>과목</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><fieldset className="field type-options"><legend>유형</legend>{(["과제", "시험", "개인"] as TaskType[]).map((item) => <label key={item}><input type="radio" name="task-type" value={item} checked={type === item} onChange={() => setType(item)} /><span>{item}</span></label>)}</fieldset><label className="field"><span>마감일</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="field"><span>시간</span><input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></label></div>
          <button className="more-options-button" type="button" onClick={() => setShowMore(!showMore)}>{showMore ? "− 추가 옵션 닫기" : "+ 추가 옵션"}</button>
          {showMore && <label className="field full"><span>메모</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="준비할 내용이나 참고 사항을 적어 주세요" rows={3} /></label>}
          <div className="modal-actions">{mode === "edit" && task && <button className="danger-button" type="button" onClick={() => remove(task)}>일정 삭제</button>}<span className="action-spacer" /><button type="button" onClick={close}>취소</button><button className="primary-button" type="submit">{mode === "add" ? "일정 추가" : "변경사항 저장"}</button></div>
        </form>
      </section>
    </div>
  );
}

function SubjectModal({ subject, save, close }: { subject?: Subject; save: (subject: Subject) => void; close: () => void }) {
  const [name, setName] = useState(subject?.name ?? "");
  const [professor, setProfessor] = useState(subject?.professor ?? "");
  const [classroom, setClassroom] = useState(subject?.classroom ?? "");
  const [color, setColor] = useState(subject?.color ?? "#8f6f43");
  const colors = ["#8f6f43", "#7f9b8d", "#b17c77", "#778caa", "#a78eaf", "#b0935a"];
  return (
    <div className="modal-backdrop" role="presentation"><section className="modal subject-modal" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title"><div className="modal-heading"><h2 id="subject-modal-title">{subject ? "과목 수정" : "과목 추가"}</h2><button type="button" onClick={close} aria-label="창 닫기">×</button></div><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) save({ id: subject?.id ?? crypto.randomUUID(), name: name.trim(), color, professor: professor.trim(), classroom: classroom.trim() }); }}><label className="field full"><span>과목명 *</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field full"><span>담당 교수</span><input value={professor} onChange={(event) => setProfessor(event.target.value)} /></label><label className="field full"><span>강의실</span><input value={classroom} onChange={(event) => setClassroom(event.target.value)} /></label><fieldset className="color-options"><legend>과목 색상</legend>{colors.map((item) => <label key={item} style={{ backgroundColor: item }}><input type="radio" name="subject-color" value={item} checked={color === item} onChange={() => setColor(item)} /><span className="sr-only">색상 {item}</span></label>)}</fieldset><div className="modal-actions"><span className="action-spacer" /><button type="button" onClick={close}>취소</button><button className="primary-button" type="submit">저장</button></div></form></section></div>
  );
}

function TaskDetail({ task, subject, close, edit, remove, toggle }: { task: Task; subject?: Subject; close: () => void; edit: () => void; remove: () => void; toggle: () => void }) {
  const urgency = taskUrgency(task);
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="task-detail-title"><div className="modal-heading"><div><small>일정 상세</small><h2 id="task-detail-title">{task.title}</h2></div><button type="button" onClick={close} aria-label="상세 닫기">×</button></div><span className={`urgency-badge ${urgency.level}`}>{urgency.label}</span><dl className="task-detail-list"><div><dt>과목</dt><dd>{subject?.name ?? "개인"}</dd></div><div><dt>유형</dt><dd>{task.type}</dd></div><div><dt>마감</dt><dd>{task.dueDate} {task.dueTime}</dd></div><div><dt>메모</dt><dd>{task.notes || "등록된 메모가 없습니다."}</dd></div></dl><div className="detail-weather"><span>☁</span><div><small>예정 시간 날씨</small><strong>흐림 · 27° · 강수확률 30%</strong></div></div><div className="drawer-actions"><button type="button" onClick={toggle}>{task.completed ? "완료 취소" : "완료하기"}</button><button className="primary-button" type="button" onClick={edit}>수정</button><button className="danger-button" type="button" onClick={remove}>삭제</button></div></aside></div>
  );
}
