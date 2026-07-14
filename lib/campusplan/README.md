# CampusPlan 도메인 하니스

이 폴더는 화면 구성과 분리된 일정·날짜·날씨·저장 규칙을 제공합니다. 모든 달력 계산은 `YYYY-MM-DD` 형식의 `LocalDate`와 명시적인 기준일을 사용하므로 시스템 시각에 의존하지 않고 테스트할 수 있습니다.

## 사용 진입점

```ts
import {
  getTaskUrgency,
  getTodayTasks,
  parseKoreanTaskInput,
  MockWeatherProvider,
  createCampusPlanStorage,
} from "@/lib/campusplan/index.ts";
```

- `dates.ts`: 한국 시간 변환, 고정 시계, 달력 날짜 연산
- `urgency.ts`: 지남 / D-0~2 / D-3~7 / D-8+ 분류와 정렬
- `filters.ts`: 오늘·이번 주·전체 및 과목·유형·완료 필터
- `natural-language.ts`: 오늘·내일·모레 해석
- `weather.ts`: 실제 API와 교체 가능한 `WeatherProvider` 및 모의 날씨
- `storage.ts`: 버전이 있는 localStorage 직렬화와 검증

실제 날씨 API를 연결할 때는 `WeatherProvider.getWeather()`를 구현하는 새 클래스를 만들고 UI에 주입합니다. API 비밀키는 이 브라우저 모듈에 저장하지 않고 서버 또는 서버리스 프록시에서 관리해야 합니다.

## 검증

```bash
npm run test:domain
```

테스트는 기준일을 `2026-07-14`로 고정하고 긴급도 경계, 월말·윤년, 필터, 자연어 날짜, 날씨 실패·취소, 저장 손상 복구를 확인합니다.
