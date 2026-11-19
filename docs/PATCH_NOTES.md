# 🛠 AhBiShare OneClick 패치 노트 (Patch Notes)

## 📅 v1.1.1 (2026-11-19) — [PATCH] Win 11 25H2 호스트 <- 24H2 클라이언트 공유 오류 1385·1223 및 콘솔 출력 깨짐(Mojibake) 수정
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.1.exe`, `AhBiShare_OneClick-Lite_v1.1.1.exe`, `AhBiShare_OneClick_Win7_v1.1.1.exe`, `AhBiShare_OneClick-Setup_v1.1.1.exe`

### 주요 변경 및 특이점 기록
1. 호스트 무비밀번호 공유 개설(h_auth) 및 안전 호환 패치 시 로컬 보안 정책 SeDenyNetworkLogonRight의 Guest/Guests SID(*S-1-5-32-546, *-501) 네트워크 로그온 차단을 secedit로 자동 해제하여 시스템 오류 1385 해결
2. 클라이언트 net.exe 실행 시 stdio stdin을 ignore로 격리해 1223 대화형 암호 프롬프트 중단 방지 및 /user:Anonymous·cmdkey 캐시 정리 폴백 보강
3. Electron main.js decodeWindowsBuffer의 UTF-16LE 판별 오작동(UTF-8 내 단일 NULL 바이트 포함 시 蓫뢊... 한자 깨짐) 수정 및 실패 진단기 Error 1385·1223 우선 분류 추가

## 📅 v1.1.0 (2026-11-18) — [MINOR] 사용장소 프로필 & 포터블 원클릭 자가 교체 업데이트
- **변경 구분**: `MINOR` (하위 호환 신규 기능 추가 및 심층 안정화)
- **개발자 · 저작권**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **배포 파일**: `AhBiShare_OneClick_v1.1.0.exe`, `AhBiShare_OneClick-Lite_v1.1.0.exe`, `AhBiShare_OneClick_Win7_v1.1.0.exe`, `AhBiShare_OneClick-Setup_v1.1.0.exe`

### 1. 신규 기능 (`MINOR`)
1. **사용장소별 개별 프로필(`.location.json`) 저장 · 재사용 · 1클릭 일괄 적용**:
   - 사무실·집·현장 등 작업 장소마다 개별 데이터 파일(`locations/*.location.json`)을 생성·전환하고, 파일 내보내기/불러오기(`.json`)를 지원합니다.
   - 기존 `.portable.json`과 동일하게 **AES-256-GCM 암호화**를 적용해 저장 시 평문 비밀번호가 디스크에 노출되지 않습니다.
   - 저장된 장소 선택 시 호스트/클라이언트 설정을 자동 채움하고, **`1클릭 일괄 적용`** 버튼으로 공유 폴더 개설 및 네트워크 드라이브 연결을 한 번에 구성합니다.
2. **GitHub 자동 업데이트 감지 및 포터블 원클릭 자가 교체(Self-Replace)**:
   - GitHub Releases(API 및 Atom + `expanded_assets` 이중 fallback)에서 최신 릴리즈를 자동/수동 감지해 업데이트 확인창으로 안내합니다.
   - 실행 중인 포터블 에디션(`Standard`, `Lite`, `Win7`)을 자동 판별해 동일 에디션의 `.exe`를 권장 선택하고, 공식 GitHub 도메인 검증 및 Windows PE 실행 헤더(`MZ`) 무결성 검증을 수행합니다.
   - 업데이트 실행 시 진행률(%)·다운로드 용량 표시 및 취소 기능을 제공하며, 다운로드 검증 완료 후 **기존 포터블 EXE를 종료·삭제하고 새 포터블 EXE로 교체·자동 재실행**합니다(기존 `.portable.json` 및 `locations/` 데이터 유지).

### 2. 특이점 및 심층 점검 오류 수정 (`Deep Audit & PATCH` 반영)
1. **Windows 7 화면 렌더링 및 PowerShell 2.0 호환성 수정**:
   - Vite/LightningCSS 빌드 타깃을 `chrome106`/`chrome100`으로 낮춰 Tailwind CSS v4 `oklch()` 색상으로 인해 Windows 7(Electron 21) 화면이 검게 표시되던 문제를 해결했습니다.
   - 콘솔이 연결되지 않은 GUI 환경에서 `[Console]::InputEncoding`/`OutputEncoding` 예외를 안전 처리하고, PowerShell 2.0에 없는 `$PSDefaultParameterValues` 참조 및 `$null` NetBT 루프를 가드했습니다.
2. **에디션 오인·스트림 취소·경로 검증·UI 겹침 결함 해결**:
   - 포터블 에디션 판별 시 상위 폴더명이 아닌 실행 파일명(`basename`)과 앱 이름만 검사해 폴더명에 의한 에디션 오인을 차단했습니다.
   - HTTP 청크 다운로드 스트림 완료(`res.complete`) 검증 및 `cleanupPromise` 기반 취소 동기화로 불완전 파일 실행과 재시도 충돌을 방지했습니다.
   - USB 루트 드라이브(`E:\`)에서 구형 OS 키트 저장 시 경로 접두사 검증이 실패하던 문제와 모달 뒤 토스트 가림(`z-[60]`), 클라이언트 드라이브 문자 덮어쓰기, Atom HTML 엔티티 디코딩 순서, SemVer 2.0 pre-release 비교 오류를 모두 수정했습니다.
3. **저작권 일원화 및 문서/버전 자동 관리 체계 구축**:
   - 전체 UI·메타데이터·스크립트·라이선스 저작권을 `AhBiYout`으로 통일하고 `scripts/bump_version.js` 기반 SemVer 3단계 자동 버전 동기화(`build.bat`, `build_release.bat`, `push_github.bat` 폴백 포함) 및 패치 노트 기록 체계를 도입했습니다.
4. **GitHub 저장소 선별 동기화(`.gitignore` 전면 개편) 및 로컬 푸시 스크립트 보안 정비**:
   - 원격 저장소(`main`) 실사를 통해 불필요하게 추적되던 프롬프트 첨부 이미지(`/public/assets/aistudio/`)를 식별하고, 로컬 전용 스크립트(`push_github*.bat`, `build_release.bat`), 플랫폼 메타(`.aistudio/`, `metadata.json`), 업데이터 임시 파일(`_ahbishare_update/`, `*.part`, `*apply_portable_update.ps1`), 런타임 프로필·스크립트(`*.portable.json`, `*.location.json`, `locations/`, `AhBiShare_*.bat`/`.reg`)를 `.gitignore`로 엄격 차단했습니다.
   - `push_github.bat`에 `core.quotepath=false` 비ASCII 인덱스 해제, 사전 `npm run lint`·`npm run verify` 검증 게이트, 제외 파일 스테이징 하드 차단 가드를 적용해 핵심 소스코드·공식 문서·빌드 설정만 안전하게 푸시되도록 개편했습니다.

---

## 📅 v1.0.0 (2026-11-16) — [MAJOR] Semantic Versioning 정식 릴리즈
- **개발자**: AhBiYout
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick

### 주요 기능 및 개선 사항
1. **독립형 단일 애플리케이션 정립 (`v1.0.0`)**:
   - Windows 컴퓨터 간 원클릭 공유폴더 개설(메인 PC) 및 네트워크 드라이브 마운트(클라이언트 PC), `ABSHARE://` 연결 코드·QR 발급, USB 포터블 AES-256-GCM 암호화 동기화(`AhBiShare_OneClick.portable.json`) 구축.
   - PowerShell 2.0/5.1 듀얼 폴백 엔진을 통해 Windows 7 SP1 ~ Windows 11 26H2 전 세대 지원.
2. **구형 OS 공유 및 양방향 데이터 브릿지 (Win 7·8·8.1 ⇄ Win 10·11)**:
   - `1단계 메인 PC` / `2단계 클라이언트 PC` 2단계 통합 원클릭 구성 및 SMB 2.1/3.0 비암호화 호환 브릿지·2단계 SMB 1.0 안전 제어·사전 스냅샷 원복 탑재.
   - 순정 Win 7 `cmd.exe` 호환 `.bat` + UTF-16LE BOM `.reg` 오프라인 4종 키트 생성기 및 **Win 10/11 ⇄ Win 7/8 양방향 설정 데이터 브릿지(JSON)** 지원.
3. **표준·경량(Lite)·Win 7 포터블 EXE 및 버전 자동 표기 빌드 체계**:
   - 표준 포터블(`AhBiShare_OneClick_v1.0.0.exe`), 용량 감소 경량 포터블(`AhBiShare_OneClick-Lite_v1.0.0.exe`), 레거시 Win 7 전용(`AhBiShare_OneClick_Win7_v1.0.0.exe`), 설치 파일(`AhBiShare_OneClick-Setup_v1.0.0.exe`)에 버전 번호 자동 부여.
4. **Inno Setup 인스톨러 & GitHub Releases 실시간 자동 업데이트**:
   - 개별 파일 풀림(Unpacked Multi-File) 설치, 기존 프로세스 강제 종료, 기존 설치 제거/덮어쓰기 선택, 무인 설치(`/SILENT`, `/VERYSILENT`), 프로그램 추가/제거 등록, 기본명·버전명 방화벽 자동 등록 지원.
   - GitHub Releases API 연동 실시간 업데이트 감지 및 알림 팝업창 탑재.
