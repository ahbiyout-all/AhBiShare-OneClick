# 🚀 AhBiShare OneClick v1.3.1 — GitHub 릴리즈 & 저장소 소개 문서

[⬅️ 루트 `README.md`](../README.md) · [패치 노트 (`docs/PATCH_NOTES.md`)](PATCH_NOTES.md) · [문서 허브 (`docs/README.md`)](README.md) · [GitHub 운영 가이드 (`docs/github_release_guide.md`)](github_release_guide.md)

> **Windows 7 SP1 ~ Windows 11 26H2** 환경에서 클릭 한 번으로 공유폴더 개설, 네트워크 드라이브 연결, 사용장소별 프로필(`.location.json`) 일괄 적용, `<appDir>/backup` 암호화 자동 백업·시점 복원, 구형 OS(SMB) 호환 브릿지 구성을 지원하는 **독립형 오픈소스 유틸리티**입니다.

---

## 📦 배포 파일 안내 (`v1.3.1` · GitHub Releases)

| 파일명 | 권장 대상 | 특징 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.3.1.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.3.1.exe`** | Windows 10 / 11 (x64) | 불필요한 로케일·WebGPU·Vulkan 제거 경량 포터블 버전 |
| **`AhBiShare_OneClick_Win7_v1.3.1.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 레거시 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.3.1.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (바로가기·바탕 화면·방화벽 자동 등록) |

👉 **최신 릴리즈 다운로드**: [GitHub Releases (`v1.3.1`)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)

---

## ✨ v1.3.x 주요 변경 내역 (최신 `v1.3.1` · Semantic Versioning: `MINOR` + `PATCH`)

### 🟢 신규 기능 및 고도화 (`v1.2.0` ~ `v1.3.1`)
- **패치노트·블로거 HTML·동적 SemVer 검증 및 GitHub Core Tree 자동화 정비 (`v1.3.1` · `PATCH`)**:
  - `docs/PATCH_NOTES.md`에 `## 📌 최신 변경 내역` 섹션을 신설하고 `scripts/bump_version.js`가 해당 섹션 하단에 패치 이력을 자동 누적 기록하며 `docs/README.md`·`docs/blogger_post.html`·`docs/github_release_post.md`까지 일괄 동기화하도록 확장했습니다.
  - `docs/blogger_post.html`을 신설하고 `.gitignore`·`docs/github_release_guide.md`에 런타임 백업/로그 제외 규칙을 반영했으며, `scripts/verify_portable_release.js` Check 1을 동적 SemVer 교차 검증(`package.json`, `public/config.json`, `src/version.ts`, `main.js`, `installer/setup.iss`, `build.bat`)으로 개선했습니다.
- **자료 자동 백업 및 시점 복원 시스템 (`<appDir>/backup` · `BackupRestoreModal`) (`v1.3.0`)**:
  - 앱 실행 폴더 하위 `backup` 폴더에 포터블 설정(`.portable.json`), 사용장소 프로필(`.location.json`), USB 오류 티켓(`troubleshootTickets`) 전체를 기존 AES-256-GCM 암호화 상태로 자동 및 수동 백업합니다.
  - 삭제·변경·초기화·복원 직전 자동 안전 백업(동일 해시 중복 스킵)을 생성하며, 최근 20개 스냅샷(`BACKUP_MAX_SNAPSHOTS = 20`) 회전 보관을 유지합니다.
  - 전용 **백업·복원 모달(`BackupRestoreModal`)**에서 백업 목록 조회, 필터/검색, 수동 백업 생성, 원클릭 시점 복원(복원 전 안전 백업 선행), 개별 삭제 및 백업 폴더 열기를 지원하며, 상단 바(`TopBar`) 및 실행 이력(`logs`) 단축 버튼과 연동됩니다.
- **OS 호환성 매트릭스 ↔ USB 해결 마법사 양방향 실시간 동기화 (`SyncAwarePolicyBadge`) (`v1.3.0`)**:
  - `TroubleshootWizardModal` 렌더링 시 로컬 `policyStatus`와 각 단계를 실시간 비교하여 이미 시스템 패치로 충족된 단계를 자동으로 완료·건너뛰기(`Policy Matched`) 처리하고, 매트릭스와 마법사 간 재부팅/대기 작업을 일관 동기화합니다.
- **10대 보안 원복 심층 감사 보고서 · 호스트 불일치 색상 배지 · 전문가 레지스트리 원시 값 비교 뷰 (`v1.2.1`)**:
  - 보안 원복 직후 SMB 서명·게스트 차단·NTLM·LSA 등 10개 핵심 항목의 기본값 복구 상태를 정밀 검증하는 **보안 원복 심층 감사 보고서(`SecurityRollbackReport`)** 와 대상 호스트 기대 정책과의 **항목별 색상 배지(`일치`·`주의`·`충돌`)** 를 제공합니다.
  - **전문가 비교 뷰(`ExpertComparisonView`)** 를 통해 로컬 PC와 대상 호스트의 10대 보안 정책 원시 레지스트리 경로·키·실측 값을 좌우 나란히 비교할 수 있습니다.
- **저장된 사용장소별 프로필(`.location.json`) 내용 직접 수정 에디터 (`v1.2.1`)**:
  - 저장된 사용장소 파일의 기본 정보·참고 네트워크 대역·선호 호환 모드·호스트 공유폴더(TTL/계정 암호)·클라이언트 드라이브·호스트 프리셋을 앱 내에서 직접 편집(`내용 수정`)하고 AES-256-GCM 재암호화 저장을 지원합니다.
- **사용장소 일괄 적용 사전 검증(Pre-flight Check) 단계 및 결과 모달 (`v1.2.1`)**:
  - 사용장소 1클릭 일괄 적용 직전 `LocationPreflightModal`을 통해 관리자 권한·SMB 서비스·참고 네트워크 대역, 호스트 공유폴더 경로 존재·NTFS ACL 권한·기존 공유 충돌·자격증명, 클라이언트 드라이브 문자 충돌·대상 호스트 TCP 445 포트 연결 가능 여부를 읽기 전용으로 사전 점검(`buildLocationPreflightScript` · `preflightLocationProfileBatch`)하고 `통과`·`주의`·`오류` 배지 및 `다시 검사`·`프로필 내용 수정`·`일괄 적용 실행` 액션을 제공합니다.
- **보안 계정 편의 UI(비밀번호 가시성 토글 · 5종 숫자 암호 프리셋) & 전 탭 통합 새로고침 (`v1.2.1`)**:
  - `ClientPanel` 및 `LegacySharingPanel` 클라이언트 암호 입력란에 비밀번호 가시성 토글(`Eye`/`EyeOff`)과 다중 출처 자격증명 자동 매칭(`resolveClientAccountCredentials` · `hostCandidates`)을 적용해 오타를 방지합니다.
  - `PresetPasswordGrid`를 통해 메인·클라이언트·구형 OS 보안 계정 폼 상단에 5종 사무실 표준 숫자 암호 프리셋(`AhBiShare/123456` ~ `Visitor/111111`)을 제공하며, 워크스페이스 전 6개 탭 상단에 통합 **새로고침 버튼(`handleRefreshTab`)**을 배치했습니다.
- **수동 NAS·공유폴더 스마트 SMB 인증 감지 (`detectSmartShareAuth` · `probeSmbTarget` · `ShareAuthProbeBar`) (`v1.2.1`)**:
  - 수동 IP/공유명 입력(`App.tsx` 유효 IPv4 자동 `probeSmbTarget` `useEffect` · `onBlur` · `650ms` 디바운스), LAN 탐색 선택(`authModeHint` 추론 포함), `인증 방식 확인` 버튼 및 연결 실행 전 가드를 통해 드라이브를 점유하지 않는 비매핑 Win32 `WNetAddConnection2` + `WNetCancelConnection2` 프로브를 수행하며 **30초 TTL 캐시 및 중복 프로브 병합**으로 반응 속도를 높였습니다.
  - 대상 NAS 또는 공유폴더가 **무비밀번호 허용**인지 **보안 계정 필수(Error 86/1223/1326/5)**, **로컬 게스트 차단(1272)**, **호스트 게스트 거부(1385)**, **공유폴더 없음(67)**, **기존 세션 활성(1219)**인지를 연결 전 고지하며, **`탐지 시 자동 전환`** 옵션 활성 시 즉시 보안 계정 모드 전환·다중 출처 저장 자격증명 자동 채움·토스트 안내 및 **`무비밀번호로 유지`** 되돌리기, `1219` 세션 일괄 정리 복구를 지원합니다.
- **`ActiveShare` 리스트 `'탐색기에서 열기'`(UNC 바로 열기) & USB 쓰기 안전성 강화 (`v1.2.1`)**:
  - 메인 PC 공유 개설 및 구형 OS 1단계 활성 공유 목록(`ActiveShare`)에 **`탐색기에서 열기`** 버튼을 추가해 `resolveActiveShareUncPath`(`\\IP\공유명`) 경로를 Windows 탐색기(`explorer.exe`)로 즉시 열 수 있습니다.
  - USB 휴대 실행 시 쓰기 금지 요소(`StorageDevicePolicies`, `diskpart readonly`, `attrib +R`, `IsReadOnly=$true`, `autorun.inf` 등)를 일절 주입하지 않으며, 비파괴 0바이트 `wx` 배타 프로브(`probeDirectoryWriteSafety`)·`EROFS`/`EPERM`/`ENOSPC` 오류 분류·레거시 USB 키트 `atomicWriteBuffer` 원자적 기록 및 포터블 업데이트 전 `exit 4` 쓰기 보호 가드로 USB 데이터 무결성을 보호합니다.
- **USB 양방향 오류 전달 & 3단계 단계별 해결 마법사 (`troubleshootTickets` · `TroubleshootHandoffBanner` · `TroubleshootWizardModal`) (`v1.2.1`)**:
  - 메인 PC·클라이언트 PC·구형 OS 실행 중 발생한 연결/개설 오류 티켓을 별도 파일 없이 기존 **`AhBiShare_OneClick.portable.json` 내부(`troubleshootTickets`)에 통합 저장**하며, `stripSensitiveCredentialText`로 `ABSHARE://` 토큰 및 `/pass:` 평문 비밀번호를 자동 마스킹합니다.
  - USB를 반대편 PC에 연결해 실행·새로고침하면 `evaluateTroubleshootTicketsForPc`가 대상 PC와 일치하는 미해결 티켓(`open` / `host_fixed` / `client_fixed`)을 감지해 **상단 배너 표시 및 3단계 해결 마법사(`01. 원인 및 양단 현황` · `02. 단계별 해결 실행` · `03. 검증 및 전달 · 완료`)를 자동 오픈**합니다. `Error 1385`·`1223`·`0x80070035/1272`·`5/86/1326`·`58`·`53`·`1219`·`85` 및 호스트 개설 실패에 대한 양측 원클릭 복구(`지금 적용`·`건너뛰기`·`명령 복사`·`445 도달성 점검`)를 지원하고, 완료 후 사용자가 직접 정리할 때까지 이력을 보존합니다.

- **실시간 작업 진행 모션창 (`WorkProgressModal`) — 주요 작업 11종 전면 적용 (`v1.2.0`)**:
  - 공유 개설·해제, 네트워크 드라이브 연결·해제, OS 정책 변경·자동 정렬, 구형 OS(Win 7/8) 통합 개설·접속, 사용장소 일괄 적용, 호스트·클라이언트·만료 보안 원복까지 모든 주요 작업 시 **듀얼 링 SVG 회전 모션 + 실시간 단계 진행 타임라인 + 경과 시간 표시창**을 제공합니다.
  - 실행 중에는 닫기·ESC·배경 클릭·키보드(`Enter`/`Space`/`Tab`) 재실행을 차단하는 중앙 잠금 및 본문 스크롤 잠금을 적용하며, 작업 성공 시 **1.5초 카운트다운 자동 닫힘**, 오류 발생 시 원인 안내와 함께 수동 확인 시까지 창을 유지합니다.
- **사용장소별 개별 프로필(`.location.json`) & 1클릭 일괄 적용**:
  - 사무실·집·현장 등 사용장소별 호스트 공유 및 클라이언트 드라이브 타깃을 개별 AES-256-GCM 암호화 파일(`locations/*.location.json`)로 저장하고 목록 전환·JSON 내보내기/불러오기·**원클릭 일괄 적용**을 지원합니다.
- **GitHub 자동 업데이트 감지 + 기존 포터블 종료·제거·자동 교체(Self-Replace)**:
  - GitHub Releases(API + Atom/`expanded_assets` 이중 폴백)에서 최신 버전을 감지해 업데이트 확인창으로 안내합니다.
  - 실행 중인 포터블 에디션(`Standard` / `Lite` / `Win7`)을 파일명(`basename`)과 앱 식별자로 정확히 판별해 동일 에디션의 최신 `.exe`를 내려받고, 공식 GitHub URL 허용 목록 및 Windows PE 실행 헤더(`MZ`) 무결성 검증을 거친 뒤 **기존 포터블 프로세스를 종료·삭제하고 새 파일로 교체·재실행**합니다.
  - 기존 공유 데이터(`.portable.json`) 및 사용장소 프로필(`locations/`)은 안전하게 보존됩니다.

### 🔧 24H2/25H2 공유 오류 해결 & 심층 점검(Deep Audit) (`v1.1.1` ~ `v1.2.1`)
- **17차 자아성찰 심층 점검 — 스마트 인증 정책 엄격 정렬 · 배너 유지 · USB `loadPortableData` AV 잠금 보호 (`v1.2.1`)**:
  - `App.tsx` · `shareBridge.ts` · `ClientPanel.tsx` · `LegacySharingPanel.tsx`: `evaluateSmartAuthDecision` 억제 상태를 전 패널·`App.tsx`에서 공통 동기화(`isSmartAuthSuppressed`/`setSmartAuthSuppressed`)하고 `probeSmbTarget`의 정책 우회를 제거했으며, `pendingClientAuthMode` 수신 시 `ClientPanel` 650ms 디바운스 재탐지로 자동 전환 배너·`Undo` 버튼이 사라지지 않도록 `probeTimerRef` 취소·`completedProbeRef`/`smartResult`/`autoSwitchedFrom` 동기화를 반영하고, 호스트/공유명 수동 수정 시 잔류 `ABSHARE://` 연결 코드 토큰을 정리했습니다.
  - `portableStore.js` · `main.js`: `readUtf8WithRetrySync` 및 읽기 오류 vs JSON 손상 분리 처리를 통해 일시적 AV 파일 잠금(`EBUSY`/`EACCES`) 또는 읽기 전용(`writeProtected`) USB 환경에서 정상 `AhBiShare_OneClick.portable.json`이 `.corrupt-*.json`으로 오인 변경되지 않도록 수정하고, `save-legacy-scripts` 중복 프로브 정리 및 `export-location-profile-file` `writeProtected` 오류 전파를 반영했습니다.
- **구형 OS(Win 7·8·8.1 ⇄ Win 10·11) 공유 전수 검증 및 개선 (15차 심층 점검 · `v1.2.1`)**:
  - `LegacySharingPanel.tsx`: `modern_to_legacy` ↔ `legacy_to_modern` 토폴로지 방향 판별 역전을 바로잡아 호스트/클라이언트 차단 진단이 정확한 방향에서 동작하도록 수정하고, 호스트 측 TCP 445 방화벽(`firewall445Allowed === false`) 및 Guest 네트워크 로그온 거부(`guestNetworkLogonDenied`) 진단을 추가했습니다.
  - `legacyScriptEngine.ts` (USB 오프라인 키트): PowerShell `-Command "..."` 내부 `\"` 따옴표 파싱 깨짐을 `[char]34`로 교정하고 한글 `게스트$` 정책 토큰을 인식하도록 보강했으며, `Rollback.bat` 복원 순서를 **표준 보안값 선초기화 → 사전 백업(`LanmanWorkstationPolicy.reg` 포함) 덮어쓰기**로 고쳐 신규 생성된 완화 키가 잔류하지 않게 개선하고, `forceguest=0`·로케일 무관 방화벽 그룹(`@FirewallAPI.dll,-28502`/`-32752`)·`profile=any`·`Public→Private`·`DISM /all`을 적용했습니다.
  - `powershellEngine.ts` · `networkEvolution.ts` · `shareBridge.ts` · `App.tsx`: `host`·`legacy_bridge_rollback`·`strict_26h2_default` 원복에 `forceguest=0` 초기화를 추가하고, Win 7 `HNetCfg.FwPolicy2` 활성 프로필 판별·`AhBiShare-Legacy-SMB-445`/`파일 및 프린터 공유(SMB-In)` 인식·`mrxsmb10 start= demand` 대칭 원복·`net user` 상세 오류 캡처를 구현했으며, SMB 전송 암호화·방언 불일치 **`Error 58`** 진단 분류, Win 7/8.1 `osDisplayVersion`(`SP1`/`8.0`/`8.1`) 보정 및 구형 OS **보안 계정 모드** 연결 시 불필요한 로컬 `Guest(*-501)` 개방 대신 `ensureLegacyRollbackSnapshot`만 확보하도록 개선했습니다.
- **16차 자아성찰 심층 점검 — 수동 NAS 사전 프로브 `IPC$` 오탐·`onBlur/onSubmit` 경합·Win32 우선순위·LAN 스캔 타임아웃 개선 (`v1.2.1`)**:
  - `powershellEngine.ts` (`buildShareAuthProbeScript`): LAN 탐색이나 탐색기 잔류 유휴 `IPC$` 연결을 활성 세션 충돌(`1219`)로 오인하지 않도록 필터링하고, 명시적 계정 거부(`86/1326/2202`) > Win11 게스트 차단(`1272/384`) > 일반 거부(`5/1223`) 순으로 Win32 판정 우선순위를 교정했습니다.
  - `main.js` (`scan-lan-peers`): `net.exe view`에 `ProcessStartInfo`(`StandardInput.Close()` + 4초 `WaitForExit`)를 적용해 자격증명 프롬프트/무응답 지연으로 인한 스캔 정지를 방지했습니다.
  - `ClientPanel.tsx` · `LegacySharingPanel.tsx`: `onBlur` 프로브 진행 중 `[원클릭 연결]` 제출 시 진행 중 프로브 Promise(`inFlightProbeRef`)를 대기하지 않고 Guest 연결이 출발하던 경쟁 조건을 해결하고, 탭 전환 시 프로브 취소·패널 간 `탐지 시 자동 전환` 옵션 동기화·프로필/코드 적재 시 배너 정리를 반영했습니다.
- **7~14차 자아성찰 심층 점검 — 모달 타이머·구형 OS 실패 복구·Enter 중복 제출·Atom URL & NTLM 복원 안정화 (`v1.2.1`)**:
  - `WorkProgressModal` · `LocationPreflightModal` `onCloseRef` 안정화로 1.5초 자동 닫힘/전역 키보드 리스너 재등록을 차단하고, `LegacySharingPanel` `2단계 클라이언트` 실패 배너에 `통합 해결 가이드`·`보안 계정 전환`(`switchToAccountMode`)·`호스트 복구 명령 복사` 및 비표준 드라이브 선택(`driveLetterOptions`)을 보강했으며, `HostPanel`/`ClientPanel`/`LegacySharingPanel` `Enter` 키 중복 제출 가드와 `main.js` Atom 태그 `decodeURIComponent` 예외 방어를 추가했습니다.
  - `LocationProfileEditView` · `LocationManagerModal` 내 `validateAccountUsername` SAM 계정 검증 및 `loadingEditId`/`isBatchApplying` 모달 잠금 가드 정렬, `shareBridge.ts` 내 활성 `account` 클라이언트 스냅샷 `resolvedAuthMode` 보존·웹 프리뷰 `decodeConnectionCode`/`LOCATION` 자격증명 복원·`pingHost(host, [], netInfo)` 서브넷 전달, `main.js` 포터블 업데이터 `downloadState.cancelled` 취소 경쟁 조건(cancel race) 차단, `strict_26h2_default` `LmCompatibilityLevel < 3` 실제 복원 및 `SecurityRollbackReport` 미복구 버튼 무한 루프 방지(`recommendedModes` 기반 판정)를 반영했습니다.
  - Windows 보안 계정 모드에서 자동 비활성화되는 내장 `*-501` `Guest` 계정과의 프리셋 충돌을 제거(`Visitor / 111111` 교체 및 `validateAccountUsername` 사전 차단)하고, 실패 배너의 `보안 계정 모드로 즉시 전환`(`switchToAccountMode`)·LAN 피어 기반 `hostCandidates` 교차 매칭·전 탭 새로고침 동시성 가드(`isRefreshing` / `refreshTabInFlightRef`)·활성 사용장소 프로필 재동기화를 반영했습니다.
  - IPv4 주소 점(`.5`, `.86` 등) 에러코드 오분류 차단, HTTPS 리다이렉트 `settled` · 업데이터 `mkdtempSync` 가드, 전체 보안 원복(`handleFullSecurityRollback` · `RollbackPanel`) 실제 판정 배너 전파, `legacy_bridge_rollback` `*-501` Guest 비활성화 및 웹 프리뷰 시뮬레이션 정책 대칭 정렬을 반영했습니다.
  - `LocationProfileEditView` 내 11종 정책 모드·공유명/경로/호스트/`hostPreset` 암호 검증·행 삭제 가시성·`guest` 초기화 및 `LocationManagerModal` `Escape` 가드를 보완하고, `portableStore.js` 및 `shareBridge.ts` 내 `username` 우선 보존·웹 프리뷰 프로필 AES-GCM 암호화 저장/복호화·Electron 저장 후 캐시 재보관·프로필 전환 시 `prev.password` 누출 차단·실측 누락 스냅샷(`<미측정>`) 처리·하이픈(`-`) 호스트 차단·`openExternalReleaseUrl` HTTPS 검증을 적용했습니다.
- **6차 자아성찰 심층 점검 — 진행 모션창 포커스·모션 접근성 & 만료 원복·장소 일괄 적용 오류 수정 (`v1.2.0`)**:
  - `WorkProgressModal.tsx` · `index.css`: 실행 중 배경 버튼 키보드 재호출(`Enter`/`Space`/`Tab`) 차단 포커스 트랩·이전 포커스 복원·본문 스크롤 잠금을 구현하고, `prefers-reduced-motion: reduce` 환경에 `animation-iteration-count: 1 !important`를 추가해 무한 회전 깜빡임(Strobing)을 제거했습니다.
  - `App.tsx` (`handleExpirySecurityRollback` · `handleApplyOsPatch`): 만료 공유 보안 원복 시 `rollbackPolicies`·`strict_26h2_default` 양측 성공 여부를 검증해 실패 시 만료 알림 유지·오류 단계 추적(`failProgressJob`)을 적용하고, 정책 적용 실패 토스트가 완료 문구를 표시하던 버그를 수정했습니다.
  - `shareBridge.ts` (`applyLocationProfileBatch`): 누락된 공유 항목을 건너뛸 때 진행률 인덱스(`호스트 공유폴더(i/N)`)가 `App.tsx` `validShares` 목록과 어긋나던 인덱스 불일치 버그를 수정했습니다.
- **5차 자아성찰 심층 점검 — 보안 정책 따옴표 보존 · Null 세션 · Live 상태 동기화 정확도 개선 (`v1.1.5`)**:
  - `powershellEngine.ts` · `legacyScriptEngine.ts`: `secedit` UTF-16LE INF 파일 읽기 시 `[System.Text.Encoding]::Unicode`를 명시적으로 지정하고, `SeDenyNetworkLogonRight`에서 비게스트(공백 포함 그룹 등) 항목의 기존 따옴표(`$rawTok`/`$rawTk`)가 손실되지 않도록 보존했습니다.
  - `powershellEngine.ts` (`c_mount`): 보안 계정 모드에서 `/` 또는 `*`로 시작하는 암호가 `net.exe` CLI 옵션/프롬프트와 충돌하지 않도록 Win32 `WNetAddConnection2` 경로로 직행하게 수정하고, Guest 모드에 명시적 Win32 SMB **Null 세션**(빈 계정/빈 암호 `Invoke-WNetMap '' ''`) 폴백을 추가했습니다.
  - `shareBridge.ts` (`syncLiveState`): 외부에서 공유 로컬 경로(`folderPath`)가 변경되었거나 드라이브 문자가 다른 UNC 경로로 재매핑된 경우 기존 저장 메타데이터를 재사용하지 않고 최신 Live 상태로 정확히 갱신합니다.
- **4차 심층 점검 — 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (`v1.1.4`)**:
  - `powershellEngine.ts` (`c_mount`): PowerShell 배열 인자 `'""'` 전달 시 네이티브 `net.exe`에 리터럴 문자열 `""`가 암호로 전달되어 `Guest`/`Anonymous` 모두 **시스템 오류 86(지정된 네트워크 암호가 맞지 않습니다)**을 일으키던 결함을 Win32 `WNetAddConnection2`(`mpr.dll`) 및 `ProcessStartInfo` 원시 `Arguments`(`""`, `Guest`/`Host\Guest`/`Anonymous` 우선) 호출로 근본 해결했습니다.
  - `powershellEngine.ts` (`h_auth` / `h_share` / `safe_compat` / `legacy_bridge_compat`): 호스트 `*-501` `Guest` 계정 빈 암호(`/passwordreq:no`) 명시 초기화·`S-1-5-7`(`ANONYMOUS LOGON`) 공유 권한 추가, 안전/구형 호환 패치 내 `LimitBlankPasswordUse=0`·LSA 익명 정책 정렬 및 `secedit` UTF-16LE INF 읽기(`[System.IO.File]::ReadAllLines`)를 보강했습니다.
  - `legacyScriptEngine.ts` · `networkEvolution.ts`: 오프라인 USB `.bat`/`.reg` 키트에도 `LimitBlankPasswordUse=0/1` 대칭 및 `ReadAllLines($inf)`를 적용하고, 시스템 오류 86(빈 암호 제한/Guest 암호 불일치) 실패 진단 가이드를 보강했습니다.
- **3차 자아성찰 심층 점검 안정화 (`v1.1.3`)**:
  - `portableUpdater.js`: 포터블 자동 교체 전 기존 EXE를 스테이징 백업(`old_portable_backup.exe`)하고, 대상 경로 복사 직후 PowerShell 2.0 호환 PE(`MZ`) 헤더 검증(`Test-ValidPeExe`) 및 실패 시 자동 백업 복원 롤백을 추가했습니다.
  - `main.js` · `bump_version.js`: 업데이터 PowerShell `spawn` PID 미생성/오류(`updaterProc.once('error')`) 시 `exitTimer`를 취소하고 에러를 안내하여 앱 무응답 강제 종료를 방지했으며, `APP_PKG_VERSION` 폴백 버전도 SemVer 스크립트로 자동 동기화합니다.
  - `portableStore.js`: USB 간 수동 복사·이름 변경으로 파일명과 내부 `profileId`가 달라진 `.location.json` 프로필도 조회·삭제할 수 있도록 `findLocationFileByProfileId` 폴백 탐색을 구현했습니다.
  - `shareBridge.ts` · `types/share.ts`: 클라이언트 마운트 시 `MountedDrive.username`과 비밀번호 런타임 캐시(`setCachedPassword`)를 함께 보존하고, Electron 사용장소 로드·가져오기 직후 `cacheLocationProfileCredentials`로 호스트·타깃 자격증명을 일괄 복원합니다.
- **Win 11 25H2 ↔ 24H2 시스템 오류 1385·1223 및 콘솔 한자 깨짐 수정 (`v1.1.1`)**:
  - 로컬 보안 정책 `SeDenyNetworkLogonRight`의 Guest/Guests(`*S-1-5-32-546`, `*-501`) 네트워크 로그온 차단을 `secedit`로 자동 해제하고, 클라이언트 `net.exe` stdin 격리 및 `decodeWindowsBuffer` UTF-16LE 오판(UTF-8 내 NULL 바이트)을 수정했습니다.
- **2차 자아성찰 심층 점검 안정화 (`v1.1.2`)**:
  - `fetchTextHttps` URL·HTTPS 프로토콜·리다이렉트 루프 검증 및 포터블 교체 이중 호출 가드(`isPortableReplacementQueued`)를 추가했습니다.
  - 사용장소 일괄 적용 시 `ABSHARE://` 코드·런타임 캐시에서 암호를 복원하고 계정 모드 암호 누락 시 무음 기본값 대체를 차단했습니다.
  - 오프라인 USB `.bat` 키트에 `UserRights.inf` 백업/복원 및 `SeDenyNetworkLogonRight` 해제를 반영하고, 구형 OS·장소 일괄 적용 직후 OS 정책 재동기화 및 업데이트 진행창 KB/미상 용량 표시·모달 입력 유지·호스트 공유명 커스텀 플래그 오류를 수정했습니다.
- **Windows 7 화면 및 PowerShell 2.0 호환성 (`v1.1.0`)**:
  - Tailwind CSS v4 `oklch()` 색상을 `chrome106`/`chrome100` 타깃으로 컴파일 변환해 Win 7(Electron 21) 검은 화면 문제를 해결하고, PowerShell 2.0 `$PSDefaultParameterValues`·`[Console]` 핸들 예외·`$null` NetBT 루프를 가드했습니다.
- **GitHub 저장소 Core Tree 정비 & 무결성 검증 체계**:
  - `.gitignore` 전면 개편을 통해 로컬 전용 스크립트(`push_github*.bat`, `build_release.bat`), 플랫폼 메타/첨부 이미지(`.aistudio/`, `metadata.json`, `/public/assets/aistudio/`), 업데이터 임시 파일(`_ahbishare_update/`, `*.part`, `*apply_portable_update.ps1`), 런타임 프로필·생성 키트(`*.portable.json`, `*.location.json`, `locations/`, `AhBiShare_*.bat`/`.reg`)를 업로드 대상에서 엄격히 분리했습니다.
  - CI 및 로컬 빌드 전 `npm run lint` (`tsc --noEmit`) 및 `npm run verify` (초기 11대 → 현행 15대 포터블·암호화·백업·양방향 동기화·업데이터·SemVer 무결성 스위트) 통과를 의무화했습니다.

---

## 🔒 보안 및 무결성 아키텍처
- **AES-256-GCM 암호화 & `<appDir>/backup` 자동·수동 시점 백업**: 포터블 저장소(`.portable.json`), 장소 프로필(`.location.json`), 백업 스냅샷(`backup/*.backup.json`)의 계정 자격증명은 디스크에 평문 저장되지 않습니다. 삭제·변경·초기화·복원 직전 자동 안전 백업(`auto_before_*`)과 최근 20개 회전 보관(`BACKUP_MAX_SNAPSHOTS = 20`), `resolveSafeBackupFilePath` 경로 이탈 차단을 적용합니다.
- **`<appDir>/log` 일일 UTF-8 BOM 로깅 & 자격증명 자동 마스킹**: 실행 이력을 앱 실행 폴더 하위 `log/`에 기록하며 `password=`, `cmdkey /pass:`, `ABSHARE://` 토큰 평문을 저장 전 자동 제거합니다.
- **업데이트 다운로드 검증**: `github.com/ahbiyout-all/AhBiShare-OneClick` 및 GitHub CDN(`*.githubusercontent.com`) HTTPS 주소만 허용하며 PE 헤더(`MZ`)와 다운로드 바이트 무결성을 사전 검증합니다.
- **관리자 권한 및 스냅샷 원복**: Windows 방화벽·SMB 레지스트리 정책 변경 전 사전 스냅샷(`Backup_Before_Apply`)을 보관하여 안전한 원복을 지원합니다.

---

## 🛠️ 로컬 빌드 · GitHub 선별 추적 · 문서/버전 관리
```bash
npm install
npm run lint                 # TypeScript 정적 타입 검증
npm run verify               # 15개 독립 무결성·보안·백업·양방향 동기화·업데이터·SemVer 검증 스위트
npm run build                # Windows 7 Chromium 106 호환 프로덕션 번들 (dist/)
npm run version:bump -- patch --summary "패치 요약" --note "세부 기록"
```
- Windows 환경에서는 루트 `build.bat`으로 표준·Lite·Win7·Setup 4종 버전별 EXE를 일괄 빌드합니다.
- GitHub 저장소에는 핵심 소스코드·공식 문서(`docs/README.md`, `docs/PATCH_NOTES.md`, `docs/VERSIONING.md`, `docs/github_release_post.md`, `docs/github_release_guide.md`, `docs/google_blogger_post.md`, `docs/blogger_post.html`)·빌드 설정만 선별 추적하며, 로컬 푸시 스크립트(`push_github*.bat`) 및 런타임 사용자 데이터(`/backup/`, `/locations/`, `/log/`, `*.portable.json`, `*.location.json`, `*.backup.json`)는 `.gitignore`로 엄격히 제외됩니다.
- 상세 추적 규칙 및 CI 배포 절차는 [`docs/github_release_guide.md`](github_release_guide.md), 전체 버전 관리 원칙은 [`docs/VERSIONING.md`](VERSIONING.md)를 참고하세요.

---

## 📜 릴리즈 이력 요약
- **`v1.3.1` (2026-11-26 · `PATCH`)**: `docs/PATCH_NOTES.md` `최신 변경 내역` 섹션·`scripts/bump_version.js` 자동 누적 및 문서 동기화 확장, `docs/blogger_post.html` 신설·`.gitignore` 백업/로그 제외 규칙 반영, `scripts/verify_portable_release.js` 동적 SemVer 일치 검증 및 15대 무결성 스위트 정비
- **`v1.3.0` (2026-11-25 · `MINOR`)**: 앱 실행 폴더 하위 `backup` 폴더 자동 생성 및 포터블 설정·사용장소 프로필·USB 오류 티켓 AES-256-GCM 암호화 자동/수동 백업, 삭제·변경·초기화·복원 직전 안전 백업 및 최근 20개 회전 보관, 전용 `BackupRestoreModal`·상단 바/실행 이력 단축 버튼 및 OS 호환성 매트릭스 ↔ USB 해결 마법사 양방향 실시간 동기화(`SyncAwarePolicyBadge`) 추가
- **`v1.2.1` (2026-11-22 · `PATCH`)**: 10대 보안 원복 심층 감사 보고서·호스트 불일치 색상 배지·전문가 레지스트리 원시 값 비교 뷰(`ExpertComparisonView`)·저장된 `.location.json` 프로필 내용 직접 수정 에디터·사용장소 일괄 적용 사전 검증(`LocationPreflightModal`)·클라이언트 비밀번호 가시성 토글·5종 숫자 암호 프리셋(`PresetPasswordGrid`)·전 탭 통합 새로고침 버튼·**수동 NAS/공유폴더 스마트 SMB 인증 감지(`detectSmartShareAuth` · `probeSmbTarget` · IPv4 자동 탐지 `useEffect`)**·**`ActiveShare` `'탐색기에서 열기'`(UNC)**·**USB 쓰기 안전성 강화**·**USB 양방향 오류 전달(`.portable.json` 통합 `troubleshootTickets`) & 3단계 해결 마법사(`TroubleshootHandoffBanner` · `TroubleshootWizardModal`)** 추가 및 7~17차 자아성찰·구형 OS 전수 검증 심층 점검 반영
- **`v1.2.0` (2026-11-19 · `MINOR`)**: 실시간 작업 진행 모션창(`WorkProgressModal`: 듀얼 링 모션·실시간 단계 목록·경과 시간·1.5초 자동 닫힘/오류 유지·포커스/스크롤 잠금) 주요 작업 11종 도입 및 6차 자아성찰 심층 점검(`handleExpirySecurityRollback`·`handleApplyOsPatch` 오류 검증, `applyLocationProfileBatch` `validShares` 인덱스 정렬, `prefers-reduced-motion` 개선)
- **`v1.1.5` (2026-11-19 · `PATCH`)**: 5차 자아성찰 심층 점검 — `secedit` INF `[System.Text.Encoding]::Unicode` 명시 & `SeDenyNetworkLogonRight` 비게스트 따옴표 보존, `c_mount` `/`·`*` 암호 `net.exe` 충돌 회피 및 Guest Win32 Null 세션(`''`/`''`) 폴백 추가, `syncLiveState` 공유 `folderPath`·드라이브 UNC 변경 감지 강화
- **`v1.1.4` (2026-11-19 · `PATCH`)**: 4차 심층 점검 — 무비밀번호(Guest) 마운트 `Guest: 시스템 오류 86`·`1223` 근본 해결 (`WNetAddConnection2` · `ProcessStartInfo` 원시 빈 암호 전달, 호스트 `*-501` 빈 암호(`/passwordreq:no`)·`S-1-5-7` 공유 권한, `LimitBlankPasswordUse=0` 정렬, `secedit` UTF-16LE INF `ReadAllLines` 보강)
- **`v1.1.3` (2026-11-19 · `PATCH`)**: 3차 자아성찰 심층 점검 — 포터블 교체 전 기존 EXE 백업·복사 후 PE(`MZ`) 검증 및 실패 시 자동 롤백, 업데이터 `spawn` 오류 시 `exitTimer` 취소 가드, 이름 변경 `.location.json` 폴백 조회·삭제, 클라이언트/사용장소 자격증명 캐시 복원 보강
- **`v1.1.2` (2026-11-19 · `PATCH`)**: 2차 자아성찰 심층 점검 — HTTPS 리다이렉트·이중 교체 가드, 장소 일괄 적용 암호 복원/차단, 정책 적용 후 OS 상태 재동기화, 오프라인 USB `.bat` 1385 방어, 모달·업데이터 UI 버그 수정
- **`v1.1.1` (2026-11-19 · `PATCH`)**: Win 11 25H2 ↔ 24H2 공유 오류 1385(`SeDenyNetworkLogonRight`)·1223(`stdin` 격리)·UTF-16LE 콘솔 깨짐·USB 정책 스냅샷 동기화 수정
- **`v1.1.0` (2026-11-18 · `MINOR`)**: 사용장소 프로필(`.location.json`)·1클릭 일괄 적용, GitHub 포터블 자동 교체(Self-Replace), Win 7 UI/PS 2.0 호환성 개선, GitHub Core Tree(`.gitignore`) 정비 및 1차 심층 점검 버그 수정
- **`v1.0.0` (2026-11-16 · `MAJOR`)**: AhBiShare OneClick 정식 출범, 구형 OS 공유(Win 7/8 ⇄ Win 10/11) 2단계 브릿지·오프라인 키트, Lite/Win7/Setup 배포 체계 확립

---

## 👨‍💻 제작자 및 공식 링크
- **개발자 · 저작권**: **AhBiYout** (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **라이선스**: [MIT License](../LICENSE)
