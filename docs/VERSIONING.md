# 🏷️ AhBiShare OneClick 버전 관리 원칙 (Semantic Versioning)

[⬅️ 문서 허브 (`docs/README.md`)](README.md) · [패치 노트 (`docs/PATCH_NOTES.md`)](PATCH_NOTES.md) · [GitHub 운영 가이드 (`docs/github_release_guide.md`)](github_release_guide.md)

**AhBiShare OneClick**은 [Semantic Versioning 2.0.0 (`MAJOR.MINOR.PATCH`)](https://semver.org/) 원칙에 따라 변경 규모와 하위 호환성 영향을 3단계로 명확히 구분하여 버전을 관리합니다.

---

## 1. 3단계 버전 구분 기준 (`MAJOR.MINOR.PATCH`)

### 🔴 1단계: `MAJOR` (`X.0.0`) — 비호환 구조 개편
- 기존 설정 파일 포맷(`.portable.json`, `.location.json`, `.backup.json`)이나 `ABSHARE://` 연결 코드 스키마가 하위 호환되지 않도록 개편되는 경우
- 아키텍처 전면 재설계, 지원 OS 범위 축소/전면 전환, UI/프로토콜 브레이킹 체인지가 발생한 경우
- 승격 시 `MINOR`와 `PATCH`는 `0`으로 초기화 (`예: 1.3.1 → 2.0.0`)

### 🟡 2단계: `MINOR` (`1.X.0`) — 하위 호환 신규 기능 추가
- 기존 데이터·설정과의 하위 호환성을 유지하면서 **새로운 사용자 기능·화면·프로세스**가 추가되는 경우
- 예시 (`v1.1.0` · `v1.2.0` · `v1.3.0`):
  - 사용장소별 `.location.json` 프로필 저장·불러오기·내보내기 및 1클릭 일괄 적용 추가 (`v1.1.0`)
  - GitHub Releases 기반 포터블 EXE 자동 다운로드·기존 파일 종료/제거/교체·재실행 업데이터 도입 (`v1.1.0`)
  - 주요 작업 11종 실시간 작업 진행 모션창(`WorkProgressModal`) 도입 (`v1.2.0`)
  - 앱 하위 `backup` 폴더 AES-256-GCM 자동/수동 백업·20개 회전 보관 및 원클릭 시점 복원 모달 추가 (`v1.3.0`)
- 승격 시 `PATCH`는 `0`으로 초기화 (`예: 1.0.0 → 1.1.0`, `1.2.1 → 1.3.0`)

### 🟢 3단계: `PATCH` (`1.X.Y`) — 버그 수정 · 보안 · OS 호환성 · 문서/검증 정비
- 신규 기능 추가 없이 **오류 수정, 보안 가드레일 보강, Windows/PowerShell 호환성 개선, UI 접근성·성능 안정화, 문서/검증/빌드 스크립트 정비**만 수행한 경우
- 예시 (`v1.1.1` · `v1.2.1` · `v1.3.1`):
  - Windows 7 PowerShell 2.0 `$PSDefaultParameterValues` / `[Console]` 핸들 예외 보완, Win 11 `SeDenyNetworkLogonRight` 오류 1385 해소 (`v1.1.1`)
  - 10대 보안 원복 감사 · 스마트 인증 감지 · USB 양방향 오류 전달 마법사 및 7~17차 심층 점검 수정 (`v1.2.1`)
  - `docs/PATCH_NOTES.md` `최신 변경 내역` 구조화, `docs/blogger_post.html` 신설 및 동적 SemVer 15대 무결성 검증 정비 (`v1.3.1`)
- `PATCH` 숫자만 1 증가 (`예: 1.3.0 → 1.3.1`)

---

## 2. 특이점 감지 시 자동 패치 노트 기록 및 버전 동기화 규칙

코드 수정 중 다음과 같은 **특이점(Milestone / Significant Change)** 이 발생하면 반드시 버전을 판정하고 `docs/PATCH_NOTES.md`의 `## 📌 최신 변경 내역` 섹션에 누적 기록한 뒤 전체 메타데이터를 동기화합니다.

- **특이점 기준**:
  1. 새로운 사용자 기능 또는 워크플로 추가 (`MINOR`)
  2. 스키마/아키텍처 비호환 변경 (`MAJOR`)
  3. 실사용 장애를 유발하는 런타임/OS/PowerShell/보안 결함 수정 및 문서·검증 체계 정비 (`PATCH`)
- **자동 동기화 명령어 (`scripts/bump_version.js`)**:
  ```bash
  npm run version:bump -- <major|minor|patch> --summary "특이점 요약" --note "세부 내용 1" --note "세부 내용 2"
  ```
- **동기화 대상 파일 (자동 일괄 갱신)**:
  - 앱/런타임·빌드 설정: `package.json`, `public/config.json`, `src/version.ts`, `main.js`, `installer/setup.iss`, `build.bat` (로컬 전용 `build_release.bat`·`push_github.bat` 기본 버전 폴백 포함)
  - 공식 문서: `README.md`, `README.en.md`, `docs/README.md`, `docs/PATCH_NOTES.md` (`## 📌 최신 변경 내역` 하단 누적 기록), `docs/google_blogger_post.md`, `docs/blogger_post.html`, `docs/github_release_post.md`

---

## 3. 버전 정합성 검증
모든 릴리즈 전 `npm run verify` (`scripts/verify_portable_release.js` 15개 무결성 스위트)를 통해:
- `package.json`, `public/config.json`, `src/version.ts`, `main.js`, `installer/setup.iss`, `build.bat`, `README.md`, `README.en.md`, `docs/PATCH_NOTES.md`, `docs/google_blogger_post.md`, `docs/blogger_post.html`, `docs/github_release_post.md` 간 버전 일치 및 `## 📌 최신 변경 내역` 구조 여부
- `scripts/bump_version.js`의 3단계 SemVer 증분 및 패치 노트 자동 삽입 동작 무결성
을 자동으로 검증합니다.
