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
- OpenStreetMap 지도와 k-skill 프록시를 이용한 캠퍼스 주변 장소 검색
- 로컬 저장, JSON 백업·복원, 데이터 초기화
- 키보드 포커스, 화면 낭독기 레이블, 고대비·동작 줄이기 설정

## 실행 방법

Node.js 22.13 이상과 pnpm이 필요합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

기본 실행과 빌드는 Vercel이 요구하는 Next.js 출력물(`.next`)을 생성합니다. Cloudflare Sites용 빌드가 필요할 때만 별도 명령을 사용합니다.

```bash
pnpm dev:sites
pnpm build:sites
pnpm start:sites
```

## 품질 확인

```bash
pnpm test
pnpm lint
pnpm build
```

테스트는 날짜 경계, 긴급도, 정렬·필터, 자연어 입력, 저장소 마이그레이션, 날씨 공급자 계약과 주요 화면 구성을 검증합니다.

Next.js 프로덕션 빌드를 로컬에서 확인할 때는 다음 명령을 사용합니다.

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

## 날씨·지도 API 연결

`/api/weather`는 k-skill 공개 프록시의 기상청 단기예보를 호출하고 `WeatherSnapshot`으로 정규화합니다. 브라우저는 `ApiWeatherProvider`를 통해 같은 출처의 내부 API만 호출하며, 공개 프록시 장애 시 기존 모의 날씨를 오프라인 정보로 표시합니다.

`/api/map/search`는 k-skill의 카카오 장소 검색 프록시를 호출합니다. 실제 지도 화면은 OpenStreetMap 임베드 지도를 사용합니다. 개인 API 키나 환경변수는 필요하지 않지만, 두 데이터 경로 모두 제3자 공개 서비스이므로 캐시·시간 제한·오류 대체 처리를 유지해야 합니다.

`k-skill`은 우리에게 별도 API 키를 발급하는 서비스가 아닙니다. 운영자가 보유한 기상청·카카오 키를 서버에서 관리하고 공개 프록시 엔드포인트로 JSON을 전달하는 구조입니다. 정식 장기 운영 시에는 자체 키 또는 대체 제공자를 준비하는 것이 좋습니다.

## 데이터 정책

현재 일정과 설정은 브라우저의 `localStorage`에 저장됩니다. 백엔드가 추가되기 전에는 브라우저나 기기를 바꾸면 자동 동기화되지 않으므로 설정 화면의 JSON 내보내기·가져오기를 사용하세요.
