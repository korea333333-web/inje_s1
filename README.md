# CampusPlan

CampusPlan은 바쁜 대학생이 수업, 과제, 시험, 개인 일정을 한곳에서 관리하고 캠퍼스 날씨까지 함께 확인할 수 있는 반응형 웹 애플리케이션입니다. 데스크톱과 스마트폰에서 같은 사용 흐름을 제공합니다.

![CampusPlan 미리보기](public/og.png)

## 주요 기능

- 오늘·이번 주·전체 일정 및 시간표 화면
- 과제, 시험, 수업, 개인 일정의 등록·수정·완료·삭제·실행 취소
- `오늘`, `내일`, `모레`를 이해하는 한국어 빠른 일정 입력
- D-day와 마감 시각을 반영한 긴급도 분류 및 정렬
- 과목·일정 유형 필터와 완료율 표시
- 과목 및 색상 관리
- 인제대학교 김해캠퍼스 기준 날씨 요약, 시간별·주간 예보, 일정 연계 알림
- 로컬 저장, JSON 백업·복원, 데이터 초기화
- 키보드 포커스, 화면 낭독기 레이블, 고대비·동작 줄이기 설정

## 실행 방법

Node.js 22.13 이상과 pnpm이 필요합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 품질 확인

```bash
pnpm test
pnpm lint
pnpm build
```

테스트는 날짜 경계, 긴급도, 정렬·필터, 자연어 입력, 저장소 마이그레이션, 날씨 공급자 계약과 주요 화면 구성을 검증합니다.

빌드 결과를 로컬 Cloudflare 런타임에서 확인할 때는 다음 명령을 사용합니다.

```bash
pnpm build
pnpm start
```

## 구조

- `app/CampusPlanApp.tsx`: 화면, 상호작용, 반응형 내비게이션
- `app/globals.css`: Handcrafted Ivory 디자인 시스템과 반응형 스타일
- `lib/campusplan/`: 날짜·긴급도·필터·자연어·저장소·날씨 도메인 모듈
- `tests/`: 화면 계약 및 도메인 단위 테스트
- `public/og.png`: 링크 공유용 소셜 미리보기

## 날씨 API 연결

현재는 `MockWeatherProvider`가 실제 API와 동일한 `WeatherProvider` 계약으로 데이터를 제공합니다. 추후 실제 날씨 API를 연결할 때는 `lib/campusplan/weather.ts`의 인터페이스를 구현하는 서버 전용 공급자를 추가하고, 앱에는 정규화된 `WeatherSnapshot`만 전달하면 됩니다.

API 키는 클라이언트 코드나 Git 저장소에 넣지 말고 서버 환경 변수로 관리해야 합니다. 위치 기본값은 `INJE_GIMHAE_CAMPUS` 상수로 분리되어 있으며, 로딩·오류·오프라인 상태는 이미 UI에 구현되어 있습니다.

## 데이터 정책

현재 일정과 설정은 브라우저의 `localStorage`에 저장됩니다. 백엔드가 추가되기 전에는 브라우저나 기기를 바꾸면 자동 동기화되지 않으므로 설정 화면의 JSON 내보내기·가져오기를 사용하세요.
