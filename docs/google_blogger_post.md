# [Google Blogger 구글 블로그 포스팅 문서]

> 공식 구글 블로그([https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)) 게시용 원고입니다.  
> 아래 **[작성 모드 (서식 있는 텍스트)]** 또는 **[HTML 편집 모드]** 중 사용하시는 에디터 모드에 맞춰 그대로 복사하여 게시하세요.

---

## 1️⃣ [작성 모드 (서식 있는 텍스트)]

# AhBiShare OneClick v1.3.1 — Windows 7~11 원클릭 공유폴더 · 자료 자동 백업 · 사용장소 프로필 유틸리티

## 프로그램 소개
**AhBiShare OneClick**은 Windows PC 간 폴더 공유 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 **무료 오픈소스 유틸리티**입니다.

---

## ✨ 이번 업데이트 주요 내용 (v1.3.1 · 2026-11-26)
- **SemVer 동적 검증 · 패치노트 자동 기록 · 공식 문서 및 블로거 HTML 정비 (`v1.3.1 · PATCH`)**:
  - `docs/PATCH_NOTES.md` `최신 변경 내역` 섹션 신설 및 `scripts/bump_version.js` 자동 누적·문서 일괄 동기화 확장, `docs/blogger_post.html` 신설 및 `.gitignore` 백업/로그 제외 규칙 정비, `scripts/verify_portable_release.js` 동적 SemVer 일치 검증 및 15대 무결성 스위트 정비를 완료했습니다.
- **자료 자동 백업 & 시점 복원 시스템 (`<appDir>/backup`) · OS 매트릭스 ↔ 마법사 양방향 동기화 (`v1.3.0 · MINOR`)**:
  - **앱 실행 폴더 하위 `backup` 폴더 자동 생성 & AES-256-GCM 암호화 백업**: 포터블 설정(`.portable.json`)·사용장소 프로필(`.location.json`)·USB 오류 티켓(`troubleshootTickets`) 전체를 실행 폴더 하위 `backup` 폴더에 기존 AES-256-GCM 암호화 상태로 자동·수동 백업합니다.
  - **삭제·변경·초기화·복원 직전 자동 안전 백업 & 최근 20개 회전 보관**: 데이터 삭제·변경·초기화·복원 직전 자동 안전 백업(동일 해시 중복 스킵)을 생성하고 최대 20개 스냅샷(`BACKUP_MAX_SNAPSHOTS = 20`)을 회전 보관해 용량 과다 누적을 방지합니다.
  - **전용 백업·복원 모달(`BackupRestoreModal`) & 단축 버튼 연동**: 백업 목록 조회, 필터·검색, 수동 백업 메모 생성, 원클릭 시점 복원(복원 전 안전 백업 선행), 개별 삭제 및 백업 폴더 열기를 제공하며 상단 바(`TopBar`) 및 실행 이력(`logs`) 화면에서 즉시 실행할 수 있습니다.
  - **OS 호환성 매트릭스 ↔ USB 해결 마법사 양방향 실시간 동기화(`SyncAwarePolicyBadge`)**: 로컬 `policyStatus`를 실시간 대조해 이미 시스템 패치로 충족된 마법사 단계는 `Policy Matched` 배지와 함께 자동 완료·건너뛰기 처리하며 재부팅/대기 작업을 일관 동기화합니다.
- **10대 보안 원복 심층 감사 · 호스트 불일치 배지 · 전문가 레지스트리 비교 뷰 & 사용장소 프로필 수정 (`v1.2.1`)**:
  - 보안 원복 직후 SMB 서명·게스트 차단·NTLM·LSA 등 10개 핵심 항목의 복구 상태를 정밀 검증하는 **보안 원복 심층 감사 보고서**, 대상 호스트와의 차이를 표시하는 **항목별 색상 배지**, 로컬·호스트 실제 레지스트리 원시 값을 나란히 비교하는 **전문가 비교 뷰**를 추가했습니다.
  - 저장된 사용장소 프로필(`.location.json`)의 이름·메모·네트워크 대역·호스트 공유·클라이언트 드라이브·프리셋을 앱 내에서 직접 고칠 수 있는 **프로필 내용 수정 기능**과, 일괄 적용 실행 직전에 로컬 폴더 존재·NTFS 접근 권한·드라이브 문자 충돌·TCP 445 포트 응답·계정 자격증명·관리자/SMB 서비스 상태를 읽기 전용으로 미리 진단하고 결과(`통과`·`주의`·`오류`)를 보여주는 **일괄 적용 사전 검증(Pre-flight Check)** 단계를 도입했습니다.
  - **보안 계정 편의성 & 전 탭 새로고침**: 클라이언트/구형 OS 암호 입력란에 **비밀번호 표시/숨김(눈 아이콘) 토글** 및 IP·호스트명 교차 자격증명 자동 복원을 적용하고, 메인·클라이언트·구형 OS 보안 계정 폼에 **사무실 표준 5종 숫자 암호 프리셋(`AhBiShare/123456` ~ `Visitor/111111`)** 및 **6개 전 탭 통합 새로고침 버튼**을 추가했습니다.
  - **스마트 인증 감지 (`detectSmartShareAuth` · `probeSmbTarget`) & `ActiveShare` `'탐색기에서 열기'` & USB 쓰기 안전성 강화**: 유효 IPv4 입력 시 자동 `probeSmbTarget`(`useEffect`)과 30초 TTL 캐시·중복 병합·비매핑 Win32 `WNetAddConnection2` 프로브로 대상 NAS·공유폴더가 **무비밀번호 허용**인지 **보안 계정 필수(오류 86/1223/1326/5)**인지 연결 전 고지하고, `탐지 시 자동 전환` 옵션에 따라 보안 계정 모드 전환·다중 자격증명 조합 제안·토스트 안내·`무비밀번호로 유지` 되돌리기·`1219` 세션 일괄 정리 복구를 지원합니다. 또한 메인·구형 OS `ActiveShare` 리스트에 **`탐색기에서 열기`** 버튼(`\\IP\공유명` UNC 바로 열기)을 추가하고, USB 쓰기 금지 요소 비주입 검증·비파괴 `wx` 쓰기 가능 프로브(`exit 4` 자가 교체 가드)·`atomicWriteBuffer` 원자적 저장을 적용했습니다.
  - **USB 양방향 오류 전달 & 3단계 단계별 해결 마법사 (`troubleshootTickets` · `TroubleshootHandoffBanner` · `TroubleshootWizardModal`)**: 메인 PC·클라이언트 PC·구형 OS 실행 중 발생한 연결/개설 오류를 별도 파일이 아닌 기존 **`AhBiShare_OneClick.portable.json` 내부(`troubleshootTickets`, 평문 비밀번호 자동 마스킹)에 통합 저장**합니다. USB를 반대편 PC로 옮겨 실행하면 일치하는 미해결 티켓을 자동 감지해 **상단 배너 표시 및 3단계 해결 마법사(`01. 원인 및 현황` · `02. 단계별 해결 실행` · `03. 검증 및 전달 · 완료`)**를 자동 오픈하여 양단 원클릭 복구 후 사용자가 직접 정리할 때까지 이력을 보존합니다.
  - **7~17차 자아성찰 & 구형 OS(Win 7·8·8.1) 전수 검증 심층 점검**: 제17차 점검에서 `evaluateSmartAuthDecision` 패널/앱 억제 동기화·`probeSmbTarget` 정책 우회 제거·`pendingClientAuthMode` 자동 전환 배너 유지·수동 Host/Share 수정 시 잔류 `ABSHARE://` 토큰 초기화 및 `portableStore.js` `loadPortableData` AV 파일 잠금(`EBUSY`/`EACCES`)·쓰기 금지 환경 `.corrupt` 오인 격리 방지·`main.js` 중복 프로브 정리/`writeProtected` 전파를 완료했으며, 프로브 `IPC$` 오탐 제거·Win32 우선순위·`net view` 4초 타임아웃·`onBlur/onSubmit` 경합(`inFlightProbeRef`) 해결·구형 OS 토폴로지 방향/방화벽/1385/USB `.bat` `[char]34`·선초기화 복원/`Error 58`/`HNetCfg.FwPolicy2`/`mrxsmb10`·모달 `onCloseRef`·`Enter` 중복 제출 가드·Atom 예외 방어·SAM 계정 검증·업데이터 취소 경합 차단·NTLM 복원·내장 `Guest` 충돌 제거(`Visitor`)를 반영했습니다.
- **실시간 작업 진행 모션창(`WorkProgressModal`) & 6차 자아성찰 심층 점검 안정화 (`v1.2.0 · MINOR`)**:
  - 공유 개설·해제, 드라이브 연결·해제, OS 정책 변경·자동 정렬, 구형 OS 통합 개설·접속, 사용장소 일괄 적용, 보안 원복까지 주요 작업 11종 전체에 **듀얼 링 회전 모션 + 실시간 단계 진행 타임라인 + 경과 시간 표시 모달**을 도입했습니다(실행 중 배경 잠금·포커스 트랩·성공 1.5초 후 자동 닫힘·오류 시 수동 확인 유지).
  - `prefers-reduced-motion` 환경 고속 깜빡임 제거(`animation-iteration-count: 1`), 만료 공유 원복(`handleExpirySecurityRollback`) 실패 검증 및 실패 단계 추적, 정책 실패 시 완료 토스트 오표시 수정, 사용장소 일괄 적용 `validShares` 인덱스 불일치를 해결했습니다.
- **5차 자아성찰 심층 점검 — 보안 정책 따옴표 보존 · Null 세션 · Live 상태 동기화 개선 (`v1.1.5`)**:
  - `secedit` UTF-16LE INF 읽기 시 `[System.Text.Encoding]::Unicode`를 명시 지정하고, `SeDenyNetworkLogonRight`에서 비게스트 항목의 기존 따옴표를 손실 없이 보존하도록 수정했습니다(오프라인 USB `.bat` 키트 포함).
  - 보안 계정 모드에서 `/`·`*` 시작 암호의 `net.exe` CLI 파싱 충돌을 회피해 Win32 `WNetAddConnection2`로 직접 연결하고, Guest 모드에 명시적 Win32 SMB Null 세션(빈 계정/빈 암호) 폴백을 추가했습니다.
  - `syncLiveState`에서 공유폴더 경로(`folderPath`) 변경 및 드라이브 문자 외부 재매핑 시 Live UNC 불일치 기존 메타데이터 재사용을 차단했습니다.
- **4차 심층 점검 — 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (`v1.1.4`)**:
  - PowerShell 5.1 네이티브 `net.exe` 인자 이스케이프 과정에서 `Guest`/`Anonymous` 빈 암호가 리터럴 `""` 문자열로 전달되어 **시스템 오류 86(암호 불일치)** 및 **오류 1223**이 발생하던 결함을 Win32 `WNetAddConnection2`(`mpr.dll`) 및 `ProcessStartInfo` 원시 빈 암호 전달(`Guest`/`Host\Guest`/`Anonymous` 우선)로 근본 해결했습니다.
  - 호스트 `*-501` `Guest` 계정 빈 암호(`/passwordreq:no`) 명시 초기화·`S-1-5-7` 익명 공유 권한 부여, 안전/구형 호환 패치 및 오프라인 USB 키트 `LimitBlankPasswordUse=0` 정렬, `secedit` UTF-16LE INF 읽기(`[System.IO.File]::ReadAllLines`)를 보강했습니다.
- **3차 자아성찰 심층 점검 — 업데이터 롤백 & 프로필 복원 안정화 (`v1.1.3`)**:
  - 포터블 자동 교체 전 기존 EXE 사전 백업(`old_portable_backup.exe`), 복사 직후 PE `MZ` 헤더 검증 및 실패 시 자동 백업 롤백 복구와 업데이터 `spawn` 실패 시 앱 강제 종료 방지 가드를 추가했습니다.
  - 파일명을 변경해 복사한 `.location.json`도 내부 `profileId`로 조회·삭제되도록 보완하고, 클라이언트 마운트·사용장소 프로필 로드 시 계정 사용자명·비밀번호 런타임 캐시 복원을 통합했습니다.
- **Win 11 25H2 ↔ 24H2 시스템 오류 1385·1223 및 콘솔 한자 깨짐 해결 (`v1.1.1` ~ `v1.1.2`)**:
  - 로컬 보안 정책(`SeDenyNetworkLogonRight`)의 Guest/Guests(`*S-1-5-32-546`, `*-501`) 네트워크 로그온 차단을 `secedit`로 자동 해제해 시스템 오류 1385를 해결했고, 오프라인 USB `.bat` 키트에도 동일 백업/복원 보호를 탑재했습니다.
  - 클라이언트 `net.exe` 대화형 프롬프트 중단(오류 1223)과 콘솔 출력 한자 깨짐(`decodeWindowsBuffer` UTF-16LE 오판)을 수정했습니다.
- **2차 자아성찰 심층 점검 안정화 (`v1.1.2`)**:
  - 업데이터 `fetchTextHttps` URL·HTTPS 프로토콜·리다이렉트 검증 및 포터블 교체 이중 실행 방지 가드를 보강하고, 다운로드 중 KB/미상 용량 표시를 개선했습니다.
  - 사용장소 프로필(`.location.json`) 1클릭 일괄 적용 시 `ABSHARE://` 연결 코드·캐시에서 계정 암호를 자동 복원하며, 구형 OS 통합 원클릭·장소 적용 직후 OS 네트워크 정책 상태를 즉시 재동기화합니다.
- **사용장소별 개별 프로필(`.location.json`) & 포터블 자동 교체 (`v1.1.0`)**:
  - 작업 장소별 호스트/클라이언트 구성을 **AES-256-GCM 암호화**로 분리 저장·원클릭 일괄 적용하며, GitHub 최신 버전 감지 후 **기존 포터블 EXE를 종료·제거하고 새 버전으로 자동 교체 및 재실행**합니다. (`.portable.json` 및 `locations/` 유지)
- **Windows 7 화면 및 PowerShell 2.0 호환성 강화**:
  - Tailwind CSS v4 `oklch()` 색상을 Electron 21(Chromium 106) 호환 색상으로 변환해 Win 7 검은 화면 문제를 해결하고, PowerShell 2.0 콘솔/변수 예외를 보완했습니다.

---

## 📦 배포 파일 안내 (4종)
| 배포 파일명 | 권장 운영체제 | 설명 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.3.1.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.3.1.exe`** | Windows 10 / 11 (x64) | 불필요한 로케일·그래픽 모듈을 경량화한 포터블 버전 |
| **`AhBiShare_OneClick_Win7_v1.3.1.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 구형 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.3.1.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (바로가기 및 방화벽 자동 등록) |

---

## 🖼️ 앱 미리보기 (스크린샷)
> [이곳에 AhBiShare OneClick 메인 워크스페이스, 사용장소 프로필 바, 포터블 자동 교체 업데이트 확인창 실행 화면 캡처를 삽입하세요]

---

## 📥 공식 다운로드
- 🔗 **[AhBiShare OneClick v1.3.1 공식 다운로드 (GitHub Releases)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)**

---

## 🏷️ 버전 및 시스템 요구 사항
- **현재 버전**: v1.3.1 (Semantic Versioning: `MAJOR.MINOR.PATCH`)
- **배포 파일**: `AhBiShare_OneClick_v1.3.1.exe`, `AhBiShare_OneClick-Lite_v1.3.1.exe`, `AhBiShare_OneClick_Win7_v1.3.1.exe`, `AhBiShare_OneClick-Setup_v1.3.1.exe`
- **지원 운영체제**: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)
- **실행 권한**: 관리자 권한 필수 (SMB 서비스, 방화벽 TCP 445·139 및 레지스트리 정책 적용)

---

## 👨‍💻 제작자 및 공식 채널 안내
- **개발자 · 저작권**: AhBiYout (`Copyright © 2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: [https://github.com/ahbiyout-all/AhBiShare-OneClick](https://github.com/ahbiyout-all/AhBiShare-OneClick)
- **공식 구글 블로그**: [https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)
- **라이선스**: MIT License

---

## 📜 전체 업데이트 누적 이력
- **v1.3.1 (2026-11-26 · PATCH)**
  - `docs/PATCH_NOTES.md` `최신 변경 내역` 섹션 신설 및 `scripts/bump_version.js` 자동 누적·공식 문서 동기화 확장
  - `docs/blogger_post.html` 신설, `.gitignore` 백업/로그 제외 규칙 반영 및 `scripts/verify_portable_release.js` 동적 SemVer·15대 무결성 검증 정비
- **v1.3.0 (2026-11-25 · MINOR)**
  - 앱 실행 폴더 하위 `backup` 폴더에 포터블 설정·사용장소 프로필·USB 오류 티켓 전체 AES-256-GCM 암호화 자동/수동 백업 및 최근 20개 스냅샷 회전 보관 추가
  - 삭제·변경·초기화·복원 직전 자동 안전 백업, 전용 백업·복원 모달(`BackupRestoreModal` 목록·검색·수동 백업·원클릭 시점 복원·폴더 열기) 및 상단 바·실행 이력 단축 버튼 추가
  - OS 호환성 매트릭스 ↔ USB 해결 마법사 양방향 실시간 동기화(`SyncAwarePolicyBadge` `Policy Matched` 자동 완료/건너뛰기 및 재부팅 판단 통일) 적용
- **v1.2.1 (2026-11-22 · PATCH)**
  - 10대 보안 원복 심층 감사 보고서, 호스트-클라이언트 정책 불일치 색상 배지 및 전문가 레지스트리 원시 값 좌우 비교 뷰 추가
  - 저장된 사용장소 프로필(`.location.json`) 파일 내용 직접 수정 에디터, 상단 바/목록 `수정` 진입점 및 **일괄 적용 사전 검증(Pre-flight Check: 경로·NTFS ACL 권한·드라이브 충돌·TCP 445 포트·자격증명 사전 진단 모달)** 추가
  - 클라이언트 비밀번호 가시성 눈 아이콘 토글·IP/호스트명 교차 자격증명 자동 복원, 사무실 표준 5종 숫자 암호 프리셋(`PresetPasswordGrid`), **`ActiveShare` `'탐색기에서 열기'`(UNC 바로 열기)**, **스마트 SMB 인증 감지(`detectSmartShareAuth` · `probeSmbTarget` · 유효 IPv4 자동 탐지 `useEffect` · TTL 캐시)**, **USB 쓰기 안전성 강화(쓰기 금지 비주입 검증 · 비파괴 `wx` 프로브 · `atomicWriteBuffer`)**, **USB 양방향 오류 전달(`.portable.json` 통합 `troubleshootTickets`) & 3단계 해결 마법사(`TroubleshootHandoffBanner` · `TroubleshootWizardModal`)** 및 전 6개 탭 통합 새로고침 버튼 추가
  - 7~17차 자아성찰·구형 OS 전수 검증 심층 점검: `evaluateSmartAuthDecision` 엄격 준수·패널 간 억제 동기화·`pendingClientAuthMode` 배너 유지·`loadPortableData` AV 잠금 `.corrupt` 오인 격리 방지, 프로브 `IPC$` 오탐 제거·Win32 우선순위·`net view` 4초 타임아웃·`onBlur/onSubmit` 경합(`inFlightProbeRef`), 구형 OS 토폴로지 방향/방화벽/USB `.bat` `[char]34`/선초기화 복원/`Error 58`/`HNetCfg.FwPolicy2`/`mrxsmb10` 개선, 모달 `onCloseRef` 안정화·`Enter` 중복 제출 가드·Atom 예외 방어·SAM 계정 검증·업데이터 취소 경합 차단·NTLM 복원·내장 `Guest` 프리셋 충돌 제거(`Visitor`) 및 자격증명 보존 개선
- **v1.2.0 (2026-11-19 · MINOR)**
  - 주요 작업 11종 전체에 실시간 작업 진행 모션창(`WorkProgressModal`: 듀얼 링 모션·단계 진행 목록·경과 시간·성공 1.5초 자동 닫힘/오류 수동 유지·실행 중 포커스/스크롤 잠금) 추가
  - 6차 자아성찰 심층 점검: `prefers-reduced-motion` 깜빡임 방지, 만료 보안 원복 및 OS 정책 패치 실패 판정/토스트 오류 수정, 사용장소 일괄 적용 `validShares` 진행 인덱스 불일치 수정
- **v1.1.5 (2026-11-19 · PATCH)**
  - 5차 자아성찰 심층 점검: `secedit` UTF-16LE INF `[System.Text.Encoding]::Unicode` 명시 & `SeDenyNetworkLogonRight` 비게스트 따옴표 보존, `c_mount` `/`·`*` 암호 `net.exe` 회피 및 Guest Win32 Null 세션 폴백 추가, `syncLiveState` 경로·UNC 변경 감지 강화
- **v1.1.4 (2026-11-19 · PATCH)**
  - 4차 심층 점검: 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (`WNetAddConnection2` · `ProcessStartInfo` 빈 암호 전달, 호스트 `Guest` `/passwordreq:no`·`S-1-5-7` 공유 권한, `LimitBlankPasswordUse=0` 및 `secedit` UTF-16LE INF `ReadAllLines` 보강)
- **v1.1.3 (2026-11-19 · PATCH)**
  - 3차 자아성찰 심층 점검: 포터블 교체 전 기존 EXE 백업·복사 후 PE(`MZ`) 검증 및 실패 시 자동 롤백, 업데이터 `spawn` 오류 시 `exitTimer` 취소 가드, 이름 변경 `.location.json` 폴백 조회·삭제, 클라이언트/사용장소 자격증명 캐시 복원 보강
- **v1.1.2 (2026-11-19 · PATCH)**
  - 2차 자아성찰 심층 점검: HTTPS 리다이렉트·이중 교체 가드, 사용장소 일괄 적용 암호 복원/차단, 구형 OS·장소 적용 후 OS 정책 재동기화, 오프라인 USB `.bat` 1385 방어, 모달/업데이터 UI 수정
- **v1.1.1 (2026-11-19 · PATCH)**
  - Win 11 25H2 ↔ 24H2 공유 오류 1385(`SeDenyNetworkLogonRight`)·1223(`stdin` 격리)·콘솔 한자 깨짐(`decodeWindowsBuffer`)·USB 호스트 정책 스냅샷 동기화 수정
- **v1.1.0 (2026-11-18 · MINOR)**
  - 사용장소별 개별 프로필(`.location.json`, AES-256-GCM 암호화), JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가
  - GitHub Releases 업데이트 확인창 및 기존 포터블 종료·제거 후 새 포터블 자동 교체·재실행(Self-Replace) 기능 추가
  - Win 7 Chromium 106 CSS(`oklch()`) 호환성, PowerShell 2.0 가드, USB 루트 경로, 다운로드 스트림 취소 동기화 등 심층 오류 수정 및 저장소 Core Tree·문서 체계 정비
- **v1.0.0 (2026-11-16 · MAJOR)**
  - AhBiShare OneClick 단독 독립형 애플리케이션 정립 및 Win 7~11 전 세대 통합 지원
  - 구형 OS 공유 2단계(메인·클라이언트) 통합 원클릭·오프라인 `.bat`/`.reg` 4종 키트·양방향 JSON 데이터 브릿지 추가
  - 표준·경량 Lite·Win 7 전용 포터블 EXE 및 Inno Setup 인스톨러·GitHub 실시간 업데이트 알림 구축

---

## 🏷️ 추천 태그
AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, 데이터백업, 시점복원, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, DataBackup, PortableTool, 청운정보시스템, AhBiYout

---

## 2️⃣ [HTML 편집 모드]

> Google Blogger 글쓰기 화면 상단 왼쪽 `<> (HTML 보기)` 모드로 전환한 뒤 아래 HTML 코드를 통째로 붙여넣으세요.

```html
<div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1e293b; line-height: 1.75; max-width: 840px; margin: 0 auto; font-size: 15px;">
  <h2 style="color: #4338ca; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px; line-height: 1.4;">
    AhBiShare OneClick v1.3.1 — Windows 7~11 원클릭 공유폴더 · 자료 자동 백업 · 사용장소 프로필 유틸리티
  </h2>

  <p style="margin-bottom: 18px;">
    <strong>AhBiShare OneClick</strong>은 Windows PC 간 폴더 공유 개설(메인 PC), 네트워크 드라이브 연결(클라이언트 PC), 사용장소별(사무실·집·현장) 설정 파일 저장 및 원클릭 일괄 적용, Windows 10·11 정책 불일치 자동 정렬, 그리고 Windows 7·8·8.1 구형 OS 호환 브릿지 및 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 <strong>무료 오픈소스 유틸리티</strong>입니다.
  </p>

  <div style="background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 16px 18px; margin: 20px 0;">
    <h3 style="color: #312e81; margin: 0 0 10px 0; font-size: 17px;">✨ 이번 업데이트 주요 내용 (v1.3.1 · 2026-11-26)</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;"><strong>SemVer 동적 검증 · 패치노트 자동 기록 · 공식 문서 및 블로거 HTML 정비 (v1.3.1 · PATCH)</strong>: <code>docs/PATCH_NOTES.md</code> <code>최신 변경 내역</code> 섹션 신설 및 <code>scripts/bump_version.js</code> 자동 누적·문서 일괄 동기화 확장, <code>docs/blogger_post.html</code> 신설 및 <code>.gitignore</code> 백업/로그 제외 규칙 정비, <code>scripts/verify_portable_release.js</code> 동적 SemVer 일치 검증 및 15대 무결성 스위트 정비를 완료했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>자료 자동 백업 &amp; 시점 복원 시스템(<code>&lt;appDir&gt;/backup</code>) · OS 매트릭스 ↔ 마법사 양방향 동기화 (v1.3.0 · MINOR)</strong>: 실행 폴더 하위 <code>backup</code> 폴더에 포터블 설정(<code>.portable.json</code>)·사용장소 프로필(<code>.location.json</code>)·USB 오류 티켓 전체를 AES-256-GCM 암호화 상태로 자동/수동 백업하고, 삭제·변경·초기화·복원 직전 자동 안전 백업 및 최근 20개 스냅샷 회전 보관(<code>BACKUP_MAX_SNAPSHOTS = 20</code>)을 적용했습니다. 전용 <strong>백업·복원 모달(<code>BackupRestoreModal</code>)</strong>에서 목록 조회·필터·수동 백업 생성·원클릭 시점 복원·폴더 열기를 지원하며, 상단 바 및 실행 이력 화면에서 즉시 실행할 수 있습니다. 또한 <code>SyncAwarePolicyBadge</code>를 통해 이미 시스템 패치로 충족된 마법사 단계를 자동 완료·건너뛰기 처리합니다.</li>
      <li style="margin-bottom: 8px;"><strong>10대 보안 원복 감사 · 프로필 수정 · 사전 검증 · 스마트 인증 감지 · 탐색기 UNC 열기 · USB 쓰기 안전성 · USB 양방향 오류 전달 마법사 &amp; 7~17차 심층 점검 (v1.2.1)</strong>: 보안 원복 후 10개 핵심 항목 감사 보고서·항목별 색상 배지·<strong>전문가 레지스트리 좌우 비교 뷰</strong>, 저장된 <code>.location.json</code> <strong>프로필 직접 수정 에디터</strong>, <strong>일괄 적용 사전 검증 모달</strong>, 클라이언트 <strong>비밀번호 눈 아이콘 토글</strong>·<strong>5종 숫자 암호 프리셋</strong>·<strong>전 6개 탭 새로고침 버튼</strong>·<strong><code>ActiveShare</code> <code>탐색기에서 열기</code></strong>(<code>\\IP\공유명</code> UNC 바로 열기), 유효 IPv4 자동 <code>probeSmbTarget</code> <code>useEffect</code>·30초 TTL 캐시·자격증명 조합 제안·<code>1219</code> 세션 정리를 결합한 <strong>스마트 인증 감지(<code>detectSmartShareAuth</code> · <code>ShareAuthProbeBar</code>)</strong>, <strong>USB 쓰기 안전성 강화</strong>(쓰기 금지 비주입 검증·비파괴 <code>wx</code> 프로브·<code>atomicWriteBuffer</code>·<code>exit 4</code> 가드) 및 <strong>USB 양방향 오류 전달 &amp; 3단계 해결 마법사</strong>(기존 <code>AhBiShare_OneClick.portable.json</code> 내 <code>troubleshootTickets</code> 평문 마스킹 통합 저장 · 반대편 PC 자동 매칭 상단 배너 및 3단계 마법사 자동 오픈 · 수동 정리까지 이력 보존)를 도입했으며, 제17차 점검(<code>evaluateSmartAuthDecision</code> 엄격 준수·패널 억제 동기화·<code>pendingClientAuthMode</code> 배너 유지·<code>loadPortableData</code> AV 잠금 <code>.corrupt</code> 오인 격리 방지) 및 <code>IPC$</code> 오탐·<code>onBlur/onSubmit</code> 경합·구형 OS 토폴로지/방화벽/<code>.bat</code> <code>[char]34</code>/<code>Error 58</code>·모달 <code>onCloseRef</code>·업데이터 취소 경합·NTLM 복원 등 7~17차 심층 점검 오류를 수정했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>실시간 작업 진행 모션창(WorkProgressModal) &amp; 6차 자아성찰 심층 점검 안정화 (v1.2.0 · MINOR)</strong>: 공유 개설·해제, 드라이브 연결·해제, OS 정책 변경·자동 정렬, 구형 OS 통합, 사용장소 일괄 적용, 보안 원복 등 주요 작업 11종에 <strong>듀얼 링 모션 · 실시간 단계 목록 · 경과 시간 표시창</strong>(실행 중 배경·포커스 잠금, 성공 1.5초 자동 닫힘, 오류 수동 확인)을 도입하고, <code>prefers-reduced-motion</code> 깜빡임 방지·만료 보안 원복/OS 패치 실패 판정·<code>validShares</code> 일괄 적용 인덱스 일치를 반영했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>5차 자아성찰 심층 점검 — 보안 정책 따옴표 보존 · Null 세션 · Live 동기화 정확도 개선 (v1.1.5)</strong>: <code>secedit</code> UTF-16LE INF 읽기에 <code>[System.Text.Encoding]::Unicode</code>를 명시하고 <code>SeDenyNetworkLogonRight</code> 비게스트 항목의 기존 따옴표를 보존했으며(오프라인 USB 키트 포함), <code>c_mount</code> 내 <code>/</code>·<code>*</code> 시작 암호의 <code>net.exe</code> 충돌 회피·Win32 SMB Null 세션(빈 계정/빈 암호) 폴백 추가 및 <code>syncLiveState</code> 경로/UNC 변경 감지를 보강했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>4차 심층 점검 — 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (v1.1.4)</strong>: PowerShell 배열 이스케이프로 <code>net.exe</code>에 리터럴 <code>""</code> 암호가 전달되어 <code>Guest</code>/<code>Anonymous</code> <strong>오류 86·1223</strong>이 발생하던 결함을 Win32 <code>WNetAddConnection2</code> 및 <code>ProcessStartInfo</code> 원시 빈 암호 전달로 해결하고, 호스트 <code>*-501</code> 빈 암호(<code>/passwordreq:no</code>)·<code>S-1-5-7</code> 공유 권한·<code>LimitBlankPasswordUse=0</code>·<code>secedit</code> INF <code>ReadAllLines</code> 인코딩 정렬을 추가했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>3차 자아성찰 심층 점검 — 업데이터 롤백 &amp; 프로필 복원 안정화 (v1.1.3)</strong>: 포터블 교체 전 기존 EXE 사전 백업·PE(<code>MZ</code>) 검증·실패 시 자동 롤백 및 <code>spawn</code> 오류 시 강제 종료 방지 가드를 추가하고, 이름 변경 <code>.location.json</code> 폴백 조회·삭제 및 클라이언트·사용장소 자격증명 캐시 복원을 보강했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>Win 11 25H2 ↔ 24H2 공유 오류 1385·1223 및 콘솔 한자 깨짐 해결 (v1.1.1 ~ v1.1.2)</strong>: 로컬 보안 정책(<code>SeDenyNetworkLogonRight</code>)의 Guest/Guests 차단을 <code>secedit</code>로 자동 해제(오프라인 USB <code>.bat</code> 포함)하고, <code>net.exe</code> 1223 중단 및 콘솔 UTF-16LE 깨짐을 수정했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>2차 자아성찰 심층 점검 안정화 (v1.1.2)</strong>: 업데이터 HTTPS/리다이렉트 검증 및 이중 교체 가드, 장소 일괄 적용 시 <code>ABSHARE://</code> 암호 복원, 구형 OS·장소 적용 직후 OS 정책 재동기화 및 KB/미상 용량 진행 표시를 보완했습니다.</li>
      <li style="margin-bottom: 8px;"><strong>사용장소별 개별 프로필(.location.json) &amp; 포터블 자동 교체 (v1.1.0)</strong>: 장소별 구성을 <strong>AES-256-GCM 암호화</strong> 저장·1클릭 일괄 적용하며, PE 헤더(<code>MZ</code>) 검증 후 <strong>기존 포터블 EXE를 종료·제거하고 새 버전으로 자동 교체</strong>합니다.</li>
      <li><strong>Windows 7 화면 &amp; PowerShell 2.0 호환성 강화</strong>: Win 7(Electron 21) 화면 미표시 문제(<code>oklch()</code> 색상 호환 변환)와 PowerShell 2.0 콘솔·변수 예외를 해결해 Win 7 SP1 ~ Win 11 26H2 전 세대 안정성을 확보했습니다.</li>
    </ul>
  </div>

  <h3 style="color: #312e81; margin-top: 26px; font-size: 17px;">📦 배포 파일 안내 (4종)</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0 22px 0; font-size: 14px;">
    <thead>
      <tr style="background: #f1f5f9; color: #0f172a; text-align: left;">
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">배포 파일명</th>
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">권장 운영체제</th>
        <th style="padding: 10px 12px; border: 1px solid #cbd5e1;">설명</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick_v1.3.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 10 / 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행)</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick-Lite_v1.3.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 10 / 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">불필요한 로케일·WebGPU·Vulkan 제거 경량 포터블</td>
      </tr>
      <tr>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick_Win7_v1.3.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 7 SP1 / 8 / 8.1 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">구형 OS 전용 Electron 21 기반 호환 포터블 빌드</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;"><code>AhBiShare_OneClick-Setup_v1.3.1.exe</code></td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Windows 7 ~ 11 (x64)</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1;">Inno Setup 설치형 (바로가기·방화벽 자동 등록)</td>
      </tr>
    </tbody>
  </table>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">🖼️ 앱 미리보기 (스크린샷)</h3>
  <div style="background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 10px; padding: 26px; text-align: center; margin: 12px 0 22px 0;">
    <p style="margin: 0; color: #64748b; font-size: 13px;">[이곳에 AhBiShare OneClick 메인 화면 / 사용장소 프로필 바 / 포터블 자동 업데이트 창 스크린샷 이미지를 삽입하세요]</p>
  </div>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">📥 공식 다운로드</h3>
  <p style="margin: 12px 0 22px 0;">
    <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">AhBiShare OneClick v1.3.1 공식 다운로드 (GitHub Releases)</a>
  </p>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">🏷️ 버전 및 시스템 요구 사항</h3>
  <ul style="padding-left: 20px;">
    <li><strong>최신 버전</strong>: v1.3.1 (Semantic Versioning: MAJOR.MINOR.PATCH)</li>
    <li><strong>배포 파일</strong>: <code>AhBiShare_OneClick_v1.3.1.exe</code> · <code>AhBiShare_OneClick-Lite_v1.3.1.exe</code> · <code>AhBiShare_OneClick_Win7_v1.3.1.exe</code> · <code>AhBiShare_OneClick-Setup_v1.3.1.exe</code></li>
    <li><strong>운영체제</strong>: Windows 7 SP1, Windows 8 / 8.1, Windows 10, Windows 11 (21H2 ~ 26H2, x64)</li>
    <li><strong>실행 권한</strong>: 관리자 권한 필수 (SMB 서비스, 방화벽 TCP 445·139 및 레지스트리 정책 적용)</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">👨‍💻 제작자 및 공식 채널 안내</h3>
  <ul style="padding-left: 20px;">
    <li><strong>개발자 · 저작권</strong>: AhBiYout (Copyright © 2026 AhBiYout. All rights reserved.)</li>
    <li><strong>소속회사</strong>: <a href="https://www.cisnet.co.kr" target="_blank" rel="noopener noreferrer">(주)청운정보시스템 (cisnet.co.kr)</a></li>
    <li><strong>GitHub 저장소</strong>: <a href="https://github.com/ahbiyout-all/AhBiShare-OneClick" target="_blank" rel="noopener noreferrer">https://github.com/ahbiyout-all/AhBiShare-OneClick</a></li>
    <li><strong>공식 구글 블로그</strong>: <a href="https://ahbiyoutvibe.blogspot.com/" target="_blank" rel="noopener noreferrer">https://ahbiyoutvibe.blogspot.com/</a></li>
    <li><strong>라이선스</strong>: MIT License</li>
  </ul>

  <h3 style="color: #312e81; margin-top: 24px; font-size: 17px;">📜 전체 업데이트 누적 이력</h3>
  <p style="margin-bottom: 6px;"><strong>v1.3.1 (2026-11-26 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li><code>docs/PATCH_NOTES.md</code> <code>최신 변경 내역</code> 섹션 신설 및 <code>scripts/bump_version.js</code> 자동 누적·공식 문서 동기화 확장</li>
    <li><code>docs/blogger_post.html</code> 신설, <code>.gitignore</code> 백업/로그 제외 규칙 반영 및 <code>scripts/verify_portable_release.js</code> 동적 SemVer·15대 무결성 검증 정비</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.3.0 (2026-11-25 · MINOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>앱 실행 폴더 하위 <code>backup</code> 폴더에 포터블 설정·사용장소 프로필·USB 오류 티켓 전체 AES-256-GCM 암호화 자동/수동 백업 및 최근 20개 스냅샷 회전 보관 추가</li>
    <li>삭제·변경·초기화·복원 직전 자동 안전 백업, 전용 백업·복원 모달(<code>BackupRestoreModal</code> 목록·필터·수동 백업·원클릭 시점 복원·폴더 열기) 및 상단 바·실행 이력 단축 버튼 추가</li>
    <li>OS 호환성 매트릭스 ↔ USB 해결 마법사 양방향 실시간 동기화(<code>SyncAwarePolicyBadge</code> 충족 단계 자동 완료·건너뛰기 및 재부팅 판단 통일) 적용</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.2.1 (2026-11-22 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>10대 보안 원복 심층 감사 보고서, 호스트-클라이언트 불일치 색상 배지 및 전문가 레지스트리 원시 값 좌우 비교 뷰 추가</li>
    <li>저장된 사용장소 프로필(<code>.location.json</code>) 파일 내용 직접 수정 에디터, 일괄 적용 사전 검증(<code>Pre-flight Check</code>) 모달, <code>ActiveShare</code> <code>탐색기에서 열기</code>(UNC), 스마트 SMB 인증 감지(<code>detectSmartShareAuth</code> · <code>probeSmbTarget</code> · IPv4 자동 탐지 <code>useEffect</code>), USB 쓰기 안전성 강화(비파괴 <code>wx</code> 프로브 · <code>atomicWriteBuffer</code> · 쓰기 금지 비주입), USB 양방향 오류 전달(<code>.portable.json</code> 통합 <code>troubleshootTickets</code> · 평문 마스킹) 및 3단계 해결 마법사(상단 배너 · 일치 PC 자동 오픈), 클라이언트 비밀번호 눈 아이콘·5종 프리셋·전 6개 탭 새로고침 추가 및 7~17차 자아성찰·구형 OS 전수 검증 심층 점검 반영</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.2.0 (2026-11-19 · MINOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>주요 작업 11종 전체에 실시간 작업 진행 모션창(<code>WorkProgressModal</code>: 듀얼 링 모션·실시간 단계 목록·경과 시간·성공 1.5초 자동 닫힘/오류 유지·실행 중 포커스/스크롤 잠금) 적용</li>
    <li>6차 자아성찰 심층 점검: <code>prefers-reduced-motion</code> 고속 깜빡임 방지, 만료 보안 원복·OS 패치 실패 검증 및 토스트 오표시 수정, 사용장소 일괄 적용 <code>validShares</code> 단계 인덱스 불일치 해결</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.5 (2026-11-19 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>5차 자아성찰 심층 점검: <code>secedit</code> UTF-16LE INF <code>[System.Text.Encoding]::Unicode</code> 명시 및 <code>SeDenyNetworkLogonRight</code> 비게스트 따옴표 보존, <code>c_mount</code> <code>/</code>·<code>*</code> 암호 <code>net.exe</code> 회피 및 Guest Win32 Null 세션 폴백 추가, <code>syncLiveState</code> 경로·UNC 변경 감지 강화</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.4 (2026-11-19 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>4차 심층 점검: 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (<code>WNetAddConnection2</code> · <code>ProcessStartInfo</code> 빈 암호 전달, 호스트 <code>*-501</code> <code>/passwordreq:no</code>·<code>S-1-5-7</code> 공유 권한, <code>LimitBlankPasswordUse=0</code> 및 <code>secedit</code> INF <code>ReadAllLines</code> 인코딩 정렬)</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.3 (2026-11-19 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>3차 자아성찰 심층 점검: 포터블 교체 전 기존 EXE 백업·복사 후 PE(<code>MZ</code>) 검증 및 실패 시 자동 롤백, 업데이터 <code>spawn</code> 오류 시 <code>exitTimer</code> 취소 가드, 이름 변경 <code>.location.json</code> 폴백 조회·삭제, 클라이언트·사용장소 자격증명 캐시 복원 보강</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.2 (2026-11-19 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>2차 자아성찰 심층 점검: HTTPS 리다이렉트·이중 교체 가드, 사용장소 일괄 적용 암호 복원/누락 차단, 정책 적용 후 OS 상태 재동기화, 오프라인 USB <code>.bat</code> 1385 방어, 모달·업데이터 UI 수정</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.1 (2026-11-19 · PATCH)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>Win 11 25H2 ↔ 24H2 공유 오류 1385(<code>SeDenyNetworkLogonRight</code>)·1223(<code>stdin</code> 격리)·콘솔 한자 깨짐(<code>decodeWindowsBuffer</code>)·USB 호스트 정책 스냅샷 동기화 수정</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.1.0 (2026-11-18 · MINOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>사용장소별 개별 프로필(<code>.location.json</code>) AES-256-GCM 암호화 저장, JSON 내보내기/불러오기 및 1클릭 일괄 적용 추가</li>
    <li>GitHub Releases 실시간 업데이트 확인창 및 기존 포터블 종료·제거·새 파일 자동 교체(Self-Replace) 기능 추가</li>
    <li>Windows 7 Electron 21 화면 렌더링(<code>oklch()</code> 변환), PowerShell 2.0 호환성, USB 루트 드라이브 저장, 다운로드 무결성·취소 동기화 수정 및 저장소/문서 체계 정비</li>
  </ul>
  <p style="margin-bottom: 6px;"><strong>v1.0.0 (2026-11-16 · MAJOR)</strong></p>
  <ul style="padding-left: 20px; margin-top: 0;">
    <li>AhBiShare OneClick 단독 독립형 애플리케이션 출범 및 Win 7~11 전 세대 호환 파이프라인 정립</li>
    <li>구형 OS 공유 2단계(메인·클라이언트) 통합 원클릭 및 순정 Win 7 오프라인 <code>.bat</code>/<code>.reg</code> 4종 키트 생성기 추가</li>
    <li>Win 10·11 ⇄ Win 7·8 간 공유 설정 양방향 JSON 데이터 브릿지 동기화 기능 추가</li>
    <li>표준·경량 Lite·Win 7 전용 포터블 EXE 및 방화벽 자동 등록 Inno Setup 인스톨러 구축</li>
  </ul>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="font-size: 12px; color: #64748b;">
    <strong>추천 태그</strong>: AhBiShare, 폴더공유, 윈도우공유, SMB공유, 네트워크드라이브, 데이터백업, 시점복원, Win7공유, Win11공유, LANShare, WindowsSharing, SMBBridge, DataBackup, PortableTool, 청운정보시스템, AhBiYout
  </p>
</div>
```
