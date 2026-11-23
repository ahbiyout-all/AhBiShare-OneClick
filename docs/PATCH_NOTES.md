# 🛠 AhBiShare OneClick 패치 노트 (Patch Notes)

## 📅 v1.2.1 (2026-11-22) — [PATCH] 10대 보안 원복 심층 감사 · 전문가 레지스트리 비교 · 사용장소 프로필 내용 수정 · 사전 검증 · 스마트 인증 감지 · 탐색기 UNC 열기 · USB 쓰기 안전성 & 7~17차 자아성찰 오류 수정
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.2.1.exe`, `AhBiShare_OneClick-Lite_v1.2.1.exe`, `AhBiShare_OneClick_Win7_v1.2.1.exe`, `AhBiShare_OneClick-Setup_v1.2.1.exe`

### 주요 변경 및 특이점 기록
1. **10개 핵심 보안 정책 원복 심층 감사 보고서(`SecurityRollbackReport`) & 호스트-클라이언트 불일치 색상 배지**: 보안 원복 후 SMB 서명·게스트 차단·NTLM·LSA 등 10대 핵심 항목의 기본값 복구 여부를 판정하고, 대상 호스트 기대 정책과의 불일치를 항목별 색상 배지(`일치`·`주의`·`충돌`)로 시각화했습니다.
2. **전문가 레지스트리 원시 값 좌우 비교 뷰(`ExpertComparisonView`)**: 로컬 PC와 연결된 대상 호스트의 10대 보안 정책 실제 레지스트리 경로·키·원시 값(`REG_DWORD` 등)을 수집(`buildRawSecurityRegistryScript`)해 나란히 비교·복사할 수 있습니다.
3. **저장된 사용장소별 프로필(`.location.json`) 파일 내용 직접 수정 기능(`LocationProfileEditView` · `saveEditedLocationProfile`)**: 장소 관리 모달과 상단 프로필 바(`내용 수정`)에서 기존 프로필의 이름·메모·참고 네트워크 대역·선호 호환 모드·호스트 공유폴더(TTL/계정 암호 포함)·클라이언트 드라이브 타깃·호스트 폼 프리셋을 직접 편집하고 AES-256-GCM 재암호화·`ABSHARE://` 연결 코드 동기화 저장을 지원합니다.
4. **사용장소 일괄 적용 사전 검증(Pre-flight Check: `LocationPreflightModal` · `preflightLocationProfileBatch` · `buildLocationPreflightScript`)**: 일괄 적용 실행 직전 읽기 전용 검사를 선행하여 관리자 권한·SMB 서비스·참고 네트워크 대역 일치 여부, 호스트 공유폴더 경로 존재·NTFS ACL 읽기 권한·드라이브 문자 및 기존 SMB 공유 충돌·계정 암호 유효성, 클라이언트 드라이브 문자 충돌·대상 호스트 TCP 445 포트 응답·자격증명 복원 가능 여부를 항목별 `통과`·`주의`·`오류` 배지로 표시하며, 모달에서 `다시 검사` 또는 `프로필 내용 수정`으로 즉시 이동 후 일괄 적용(`WorkProgressModal`)을 진행할 수 있습니다.
5. **보안 계정 편의성(비밀번호 눈 아이콘 토글 · 5종 숫자 암호 프리셋) & 전 탭 통합 새로고침 (`v1.2.1`)**:
   - `ClientPanel` 및 `LegacySharingPanel` 클라이언트 보안 계정 암호 입력란에 비밀번호 가시성 토글(`Eye` / `EyeOff`)과 다중 출처 자격증명 자동 매칭(`resolveClientAccountCredentials`)을 적용해 오타를 방지하고 재입력 부담을 줄였습니다.
   - `PresetPasswordGrid` 컴포넌트를 신설해 메인 PC(개설)·클라이언트 PC(접속)·구형 OS(Step 1/2) 보안 계정 폼 상단에 사무실 표준 5종 숫자 암호 프리셋(`AhBiShare/123456`, `Admin/789012`, `Manager/202620`, `Staff/555555`, `Visitor/111111`)을 원클릭 적용 버튼으로 배치했습니다.
   - 워크스페이스 전 탭(공유 개설·클라이언트 연결·OS 호환성 매트릭스·구형 OS 공유·실행 이력·보안 원복) 상단에 통합 `새로고침` 버튼(`handleRefreshTab`)을 배치해 네트워크 정보, 공유·드라이브 Live 상태, USB 포터블·사용장소 프로필, OS 보안 정책 및 LAN 탐색 결과를 즉시 재동기화할 수 있습니다.
6. **7·8차 자아성찰 심층 점검 오류 수정**:
   - IPv4 주소 점(`.5`, `.86` 등)이 SMB 에러 코드 `5`·`86`·`53`으로 오분류되던 오류 차단 및 HTTPS 리다이렉트 `settled` 가드 추가
   - `LocationProfileEditView` `PATCH_MODE_OPTIONS` 11종 전체 보존, 보안 계정 모드 필수 비밀번호·중복 드라이브 검증, TTL 변경 시 만료 시각 초기화, `LocationManagerModal` 비동기 편집 로드 race-condition 분리, `applyLocationProfileBatch` 빈 `sourceHostName` `LOCATION` 캐시 폴백 및 `guest` 프리셋 잔류 암호 제거 적용
   - 만료 보안 원복 시 LAN 피어 목록 자동 새로고침 및 로컬 게스트 계정·익명 SID 판정 보강
7. **9차 자아성찰 심층 점검 오류 수정**:
   - `portableStore.js`: 비밀번호 재입력 없이 `username`만 수정 저장 시 기존 `encryptedCredentials` 암호문 내부의 이전 사용자명이 수정된 상위 `username`을 덮어쓰던 우선순위 역전(`shares`·`clientTargets`·`hostPreset`) 수정
   - `App.tsx`: `hostPreset` 없는 사용장소 프로필의 `savedShares[0]` 폴백 적용 시 `guest` 모드에서 직전 작업 중이던 `hostDraft.password`가 잔류 유입되던 누출 차단
   - `LocationProfileEditView.tsx` · `LocationManagerModal.tsx`: 공유/클라이언트 행 삭제 시 `visiblePasswords` 인덱스 재정렬(삭제 직후 다음 행 비밀번호 노출 방지), `hostPreset` TTL 비활성화 시 `autoRevokeOnExpiry` 자동 해제, 상단 바 편집 진입 시 목록 화면 깜빡임 제거용 로딩 상태 표시 추가
   - `powershellEngine.ts`: `buildRawSecurityRegistryScript` 원격 레지스트리 `Wait-Job` 타임아웃을 `3초`에서 `6초`로 상향해 PowerShell 콜드 스타트 오탐 타임아웃 방지
8. **10차 자아성찰 심층 점검 오류 수정**:
   - `App.tsx` (`handleFullSecurityRollback`) · `RollbackPanel.tsx`: 전체 보안 원복 실행 시 실제 성공 여부(`allOk`), 진행 중 충돌(`!jobKey`), 예외 오류 메시지를 그대로 반환·표시해 실패 시에도 성공 배너가 뜨던 문제 수정
   - `shareBridge.ts` (`loadWebPreviewPortable` · `saveLocationProfile`): 웹 프리뷰 로더에서 수정된 상위 `username`이 `dec.username`보다 우선하도록 정렬하고, Electron 프로필 저장 직후 복호화된 `res.profile` 자격증명을 런타임 캐시에 재보관해 암호 미재입력 저장 직후 일괄 적용 실패 방지
   - `App.tsx` (`applyLocationProfileToWorkspace`) · `HostPanel.tsx`: 암호 없는 사용장소 프로필 전환 시 직전 프로필/작업의 `prev.password`가 새 호스트 폼으로 유입되던 교차 누출 차단
   - `LocationManagerModal.tsx` · `LocationProfileEditView.tsx`: 편집 데이터 비동기 로드 중 `Escape` 모달 종료 차단(`!loadingEditId`) 및 인증 방식을 `guest`로 전환 시 잔류 `encryptedCredentials`·암호 상태 즉시 초기화
   - `main.js` (`install-portable-update`): `fs.mkdtempSync` 스테이징 폴더 생성을 `try/catch` 내부로 이동하고 null-safe `cleanupStaging`을 적용해 임시 폴더 생성 실패 시 미처리 IPC 예외 방지
9. **11차 자아성찰 심층 점검 오류 수정**:
   - `powershellEngine.ts` · `types/share.ts` · `shareBridge.ts`: `legacy_bridge_rollback` 실행 시 사전 스냅샷의 `guestAccountEnabled` 상태를 복원해 내장 `*-501` Guest 계정을 비활성화하도록 보강하고, 웹 프리뷰 시뮬레이션 정책(`rollbackPolicies` · `legacy_bridge_compat` · `legacy_bridge_rollback`) 대칭 필드(`everyoneIncludesAnonymous`, `ahbiFirewallRulePresent`, `smbEncryptData`, `limitBlankPasswordUse`, `restrictAnonymous`, `guestAccountEnabled`) 정렬
   - `shareBridge.ts` (`saveLocationProfile` · `loadLocationProfile`): Electron 저장 시 실패 전 조기 캐시 파기를 제거(성공 후 재캐시)하고, 웹 프리뷰 모드에서도 `encryptWebSimCredentials` / `decryptWebSimCredentials` 기반 AES-GCM 암호화 저장 및 암호 미재입력 편집 시 기존 자격증명 보존 적용
   - `networkEvolution.ts` (`deriveRawRegistrySnapshotFromHostSnap`): 실측 `rawRegistrySnapshot`이 없는 USB 호스트 스냅샷(`!isPreset`)에서 미측정 클라이언트 서명(`cliRequireSig`) 및 `everyoneincludesanonymous`(`everyAnon`) 값을 추정 생성하지 않고 `<미측정>`(`null`)으로 표시
   - `LocationProfileEditView.tsx` · `connectionCode.ts` · `main.js` · `updateChecker.ts`: `hostPreset` 보안 계정 필수 비밀번호 및 `validateShareName` · `validateFolderPath` · `validateTargetHost` 일괄 검증 추가, 하이픈(`-`) 시작 호스트 CLI 옵션 오인 차단, `openExternalReleaseUrl` HTTPS/HTTP 검증 및 `window.open` 제거
10. **12차 자아성찰 심층 점검 오류 수정**:
   - `PresetPasswordGrid.tsx` · `connectionCode.ts` · `HostPanel.tsx` · `LegacySharingPanel.tsx`: 보안 계정 모드에서 PowerShell(`h_auth`)이 Windows 내장 `*-501` `Guest` 계정을 자동 비활성화 및 `SeDenyNetworkLogonRight`로 차단함에 따라 발생하던 프리셋 충돌을 제거(`Guest` → 전용 `Visitor / 111111` 프리셋 교체)하고, `validateAccountUsername`으로 호스트 폼에서 내장 `Guest`/`게스트` 및 특수문자·길이 초과 ID 입력을 사전 차단
   - `ClientPanel.tsx` · `LegacySharingPanel.tsx`: 연결 실패 진단 배너의 `보안 계정 모드로 즉시 전환` 버튼(`#btn-failure-switch-account`)이 자격증명 자동 복원 없이 모드만 바꾸던 누락을 공통 `switchToAccountMode`로 통합 수정하고, 모든 `resolveClientAccountCredentials` 호출에 LAN 피어 IP·호스트명 매칭 기반 `hostCandidates`를 전달해 IP 변경·호스트명 전환 시에도 저장 암호가 일관 복원되도록 개선
   - `HostPanel.tsx` · `ClientPanel.tsx` · `LegacySharingPanel.tsx` · `RollbackPanel.tsx` · `App.tsx`: `PresetPasswordGrid` 상태 갱신을 함수형 업데이터(`setConfig((prev) => ...)`)로 전환하고, 탭 새로고침 중 중복 실행 방지(`disabled={... || isRefreshing}`, `handleScanLan` / `handleInspectOsPolicy` `refreshTabInFlightRef` 가드) 및 `handleRefreshTab` 내 활성 사용장소 프로필(`activeLocationProfileRef`) 자동 재동기화·삭제 정리 적용
11. **13차 자아성찰 심층 점검 오류 수정**:
   - `LocationProfileEditView.tsx` · `LocationManagerModal.tsx`: 사용장소 프로필 편집 저장 시 호스트 공유폴더 및 `hostPreset` 보안 계정 ID에도 `validateAccountUsername`을 적용해 내장 `Guest`/특수문자/20자 초과 SAM 계정 저장을 사전 차단하고, 프로필 편집 데이터 비동기 로드(`loadingEditId`) 및 일괄 적용(`isBatchApplying`) 중 배경 닫기·닫기(`X`)·JSON 가져오기·저장 버튼 중복 조작 잠금 가드를 정렬
   - `shareBridge.ts` (`buildLocationProfileSnapshot` · `saveLocationProfile` · `loadLocationProfile` · `preflightLocationProfileBatch`): OS `net use` 동기화 드라이브가 `guest`로 판별되더라도 활성 `clientConfig`가 동일 타깃의 `account` 모드일 때 `resolvedAuthMode`와 비밀번호를 스냅샷에 온전히 보존하도록 수정하고, 웹 프리뷰 위치 프로필 저장·로드 시 `decodeConnectionCode`·`'LOCATION'` 캐시 폴백 보강 및 일괄 적용 사전 검증 `pingHost(host, [], netInfo)` 서브넷 컨텍스트 전달 적용
   - `main.js` (`install-portable-update`): 다운로드 완료 직후 및 PowerShell self-replace `spawn` 직전에 `downloadState.cancelled`를 재검사해 취소 경쟁 조건(cancel race condition) 발생 시 스테이징 폴더만 정리하고 교체·재실행을 안전 중단하도록 보강
   - `powershellEngine.ts` · `shareBridge.ts` · `SecurityRollbackReport.tsx`: `strict_26h2_default` 보안 원복 시 하향된 `LmCompatibilityLevel < 3` 레지스트리 값을 NTLMv2 전용(`3`)으로 실제 복원하도록 추가하고, OS 기본 NTLM(`LmCompatibilityLevel=null`, 조치 불필요 `partial`) 환경에서 `#btn-harden-remaining-policies` 버튼이 무한 반복 노출되던 조건(`report!.partialCount > 0` → `recommendedModes.length > 0 || failedCount > 0 || hasAhbiFirewallRule || activeShareCount > 0 || activeMountCount > 0`)을 수정
12. **14차 자아성찰 심층 점검 오류 수정**:
   - `WorkProgressModal.tsx` · `LocationPreflightModal.tsx`: `onClose` 콜백을 `onCloseRef`(`useRef`)에 보관하고 1.5초 자동 닫힘 타이머 및 `Escape`/포커스 트랩 `keydown` `useEffect` 의존성 배열에서 제거해, 부모 컴포넌트의 1초 타이머 틱·상태 재렌더링 시 자동 닫힘 카운트다운이 리셋되거나 전역 키 리스너가 반복 재등록되던 문제 수정
   - `LegacySharingPanel.tsx` · `App.tsx`: 구형 OS `2단계 클라이언트` 연결 실패 배너(`diag.isHostAuthOrGuestIssue`)에 `통합 해결 가이드 & 도구 열기`(`onOpenDiagnostics`), `보안 계정 모드로 즉시 전환`(`switchToAccountMode`), `호스트 원클릭 복구 명령 복사`(`buildHostGuestUnlockPsCommand`) 복구 액션을 `ClientPanel`과 동일하게 보강하고, 드라이브 선택 목록에 비표준/현재 연결 드라이브(`driveLetterOptions`)가 누락되던 결함 수정
   - `HostPanel.tsx` · `ClientPanel.tsx` · `LegacySharingPanel.tsx`: 폼 제출 버튼(`disabled`)이 잠긴 실행·새로고침 중에도 입력란에서 `Enter` 키를 누르면 `onSubmit`이 우회 실행되던 중복 제출 가드(`if (isExecuting || isRefreshing) return;` / `if (isConnecting || isRefreshing) return;` / `if (isBusy) return;`) 추가
   - `main.js` (`check-github-updates`): Atom 릴리즈 폴백에서 비정상 `%` 인코딩이 포함된 태그 URL 시 `decodeURIComponent(tagMatch[1])` 미처리 `URIError` 예외로 전체 폴백이 중단되지 않도록 `try/catch` 안전 처리 추가
13. **구형 OS 공유(Win 7·8·8.1 ⇄ Win 10·11) 전수 검증 및 개선 (15차 심층 점검)**:
   - `LegacySharingPanel.tsx`: `modern_to_legacy`(최신 PC 메인 → 구형 클라이언트) vs `legacy_to_modern`(구형 PC 메인 → 최신 클라이언트) 진단 방향 판별식이 반대로 뒤집혀 호스트/클라이언트 차단 경고가 누락되던 결함 수정 및 TCP 445 방화벽(`firewall445Allowed === false`)·Guest 네트워크 로그온 거부(`guestNetworkLogonDenied`) 호스트 측 진단 추가
   - `legacyScriptEngine.ts` (오프라인 USB `.bat`/`.reg`): `cmd.exe` 내부 PowerShell 인자 `\"` 파싱 깨짐을 `[char]34`로 교정하고 한글 Windows `게스트$` 로컬 보안 정책 토큰 인식 추가, `AhBiShare_Legacy_Rollback.bat` 실행 시 **신규 생성된 완화 키를 먼저 표준 보안값으로 초기화한 뒤** 사전 백업(`LanmanWorkstationPolicy.reg` 포함)을 덮어씌우도록 복원 순서 수정, `forceguest=0` 복원·로케일 무관 방화벽 그룹 ID(`@FirewallAPI.dll,-28502`/`-32752`)·`profile=any`·Win 8~11 `Public→Private` 전환·`DISM /all` 적용
   - `powershellEngine.ts` · `networkEvolution.ts` · `shareBridge.ts` · `App.tsx`: `host`·`legacy_bridge_rollback`·`strict_26h2_default` 원복 시 `Control\Lsa\forceguest=0` 복원, Win 7(`build < 10240`) `HNetCfg.FwPolicy2` 활성 방화벽 프로필 판별·`AhBiShare-Legacy-SMB-445` 및 `파일 및 프린터 공유(SMB-In)` 규칙 인식·`mrxsmb10 start= demand` 대칭 원복·`net user` 상세 오류 메시지 전파, SMB 암호화·방언 불일치 **`Error 58`** 전용 진단 분류 및 `osBuild === 0` SMBv1 오판 가드 추가, Win 7/8/8.1 `osDisplayVersion` `22H2` 오표기 수정(`SP1`/`8.0`/`8.1`), 구형 OS 클라이언트 **보안 계정 모드** 연결 시 불필요한 로컬 `Guest(*-501)` 개방 대신 원복 스냅샷(`ensureLegacyRollbackSnapshot`)만 확보하고 클라이언트 정책만 정렬하도록 보안 강화
14. **수동 NAS·공유폴더 SMB 인증 방식 사전 탐지 · 사용자 고지 · 자동 전환 (`ShareAuthProbeBar` · `probeShareAuthMode`)**:
   - `powershellEngine.ts` (`buildShareAuthProbeScript`) · `shareBridge.ts` (`probeShareAuthMode`) · `types/share.ts` (`ShareAuthProbeResult`): TCP 445 연결성(2초), 기존 SMB 세션/드라이브 매핑 충돌 회피 검사, 로컬 Win 11 게스트 정책 차단 검사, 드라이브 문자 미점유(`lpLocalName = $null`) Win32 `WNetAddConnection2` 무비밀번호(Guest·Host\Guest·Null) 프로브 및 즉시 `WNetCancelConnection2` 정리로 대상 NAS·공유폴더가 무비밀번호 허용인지 보안 계정 필수(`Error 86/1326/5/1223`)인지 사전 판별합니다.
   - `ClientPanel.tsx` · `LegacySharingPanel.tsx` · `ShareAuthProbeBar.tsx`: IP·공유명 수동 입력·`onBlur`·LAN 피어 공유 선택 시 자동 사전 탐지(`650ms` 디바운스)를 수행하고, 원클릭 알림 배너로 판정 결과를 고지하며 `탐지 시 자동 전환`(기본 ON, `localStorage` 유지) 설정에 따라 무비밀번호 ↔ 보안 계정 모드를 자동 전환(저장된 자격증명 자동 복원 및 수동 되돌리기 가드 포함)합니다. 또한 연결 실행 직전 미검사 대상의 사전 검사를 거쳐 Error 86/1223 실패를 사전 예방합니다.
   - `main.js` (`scan-lan-peers`): LAN 피어 탐색 단계에서 `net.exe view` 익명 열거 응답을 함께 점검해 피어별 `authModeHint`(`account` / `guest` / `unknown`) 힌트를 제공합니다.
15. **16차 자아성찰 심층 점검 오류 수정 (`v1.2.1`)**:
   - `powershellEngine.ts` (`buildShareAuthProbeScript`): `scan-lan-peers`의 `net view` 또는 탐색기 접근으로 남은 유휴 `IPC$`-전용 SMB 연결(`Get-SmbConnection` · `net use` `\IPC$`)을 활성 사용자 세션으로 오인해 `existing_session_conflict(1219)`를 반환하며 사전 판별을 건너뛰던 오탐을 수정하고, Win32 응답 판정 우선순위를 교정해 명시적 계정 거부(`86`/`1326`/`2202`)가 `WNet-Null` 폴백 `1272`보다 먼저 `account_required`로, `1272`/`384`가 범용 `5`/`1223`보다 먼저 `client_guest_blocked`로 판별되도록 정렬했습니다.
   - `main.js` (`scan-lan-peers`): `net.exe view` 호출 시 `ProcessStartInfo`(`RedirectStandardInput = $true` · `StandardInput.Close()` · `WaitForExit(4000)`)를 적용해 보안 NAS/호스트의 자격증명 프롬프트 또는 무응답 지연으로 스캔이 최대 12초씩 멈추는 현상을 차단했습니다.
   - `ClientPanel.tsx` · `LegacySharingPanel.tsx`: 입력란 이탈(`onBlur`)과 연결 버튼 클릭(`onSubmit`)이 동시에 일어날 때 진행 중이던 비동기 프로브(`inFlightProbeRef`)가 무시되고 Guest 연결이 즉시 실행되던 경쟁 조건(race condition)을 수정(`await inFlightProbeRef.current.promise` 및 `completedProbeRef` 분리)하고, `LegacySharingPanel` `1단계 ↔ 2단계` 탭 전환 시 진행 중 프로브 취소·`ahbishare:autoswitch-changed` 패널 간 자동 전환 옵션 동기화·프로필/연결 코드 수동 적재 시 잔류 자동 전환 배너 초기화·UNC 경로 유효 안내 문구 구분을 적용했습니다.
16. **`ActiveShare` 리스트 `'탐색기에서 열기'`(UNC 바로 열기) 기능 추가 (`v1.2.1`)**:
   - `connectionCode.ts` (`resolveActiveShareUncPath`) · `HostPanel.tsx` · `LegacySharingPanel.tsx` · `shareBridge.ts` · `main.js`: 메인 PC 공유 개설 및 구형 OS 1단계 활성 공유 목록(`ActiveShare`) 각 항목에 **`탐색기에서 열기`** 버튼을 추가했습니다. `share.uncPath` 또는 호스트 IP/호스트명 기반 `\\IP\공유명` UNC 경로를 즉시 산출하고, Electron `open-folder`가 `\\...` UNC 경로를 허용해 Windows 탐색기(`explorer.exe`)로 바로 열어 접근 상태를 즉시 확인할 수 있습니다.
17. **스마트 인증 감지 고도화(`detectSmartShareAuth` · `probeSmbTarget`) & `App.tsx` 유효 IPv4 자동 탐지 `useEffect` (`v1.2.1`)**:
   - `shareBridge.ts` (`detectSmartShareAuth` · `evaluateSmartAuthDecision` · `probeSmbTarget`) · `types/share.ts` (`SmartAuthDetectionResult`): 30초 TTL 캐시(`SMART_AUTH_CACHE_TTL_MS`), 동일 타깃 동시 요청 병합(`inFlightSmartProbes`), LAN 탐색 `net view` `authModeHint`·사용장소 프로필·USB 포터블·자격증명 캐시 4중 조합(`suggestedCredentials`)과 6개 판정 의사결정 엔진을 구현했습니다.
   - `App.tsx`: `isValidIpv4Address(clientDraft.targetHost)` 유효 IPv4 입력 시 `probeSmbTarget`을 자동 트리거하는 `useEffect`(650ms 디바운스·사용장소 프로필 자동 채움 직후 스킵 및 유효 `ABSHARE://` 연결 코드 보호)를 탑재해 감지된 인증 방식이 현재 입력과 다를 경우 `clientDraft.authMode`를 자동 전환하고 토스트로 즉시 안내합니다.
   - `ShareAuthProbeBar.tsx`: `smartResult` 기반 자격증명 조합 출처 배지와 `1219` 충돌 시 `기존 충돌 세션 일괄 정리 & 재검사`(`canAlignSession`) 복구 버튼을 제공합니다.
18. **USB 쓰기 안전성 확보 및 제17차 자아성찰 심층 점검 오류 수정 (`v1.2.1`)**:
   - **USB 쓰기 안전성 전수 점검 및 강화 (`portableStore.js` · `portableUpdater.js` · `main.js`)**: 앱 전역에 USB 쓰기 금지 요소(`StorageDevicePolicies`, `diskpart readonly`, `attrib +R`, `IsReadOnly=$true`, `autorun.inf`, `0o444`/`0o400`)가 일절 주입되지 않음을 검증하고, `probeDirectoryWriteSafety`(0바이트 `wx` 배타 임시 파일 생성·즉시 삭제) 및 `classifyUsbWriteError`(`EROFS`/`EPERM`/`EACCES`/`EBUSY`/`ENOSPC` 구분)를 도입해 포터블 자가 교체 전 `exit 4` 쓰기 보호 가드 및 레거시 USB `.bat`/`.reg` 키트 `atomicWriteBuffer` 원자적 기록을 적용했습니다.
   - **`loadPortableData` AV 잠금 오인 격리 방지 (`portableStore.js`)**: `readUtf8WithRetrySync`를 도입하고 파일 읽기/잠금 실패와 JSON 파싱·복호화 손상을 엄격 분리해 일시적 백신 잠금(`EBUSY`/`EACCES`)이나 쓰기 금지 USB에서 정상 `AhBiShare_OneClick.portable.json`이 `.corrupt-*.json`으로 오인 변경되지 않도록 수정했습니다.
   - **스마트 인증 동기화·배너 유지·정책 가드 수정 (`shareBridge.ts` · `App.tsx` · `ClientPanel.tsx` · `LegacySharingPanel.tsx`)**: 패널·앱 공통 억제 상태(`isSmartAuthSuppressed`/`setSmartAuthSuppressed`)를 `evaluateSmartAuthDecision`에 통합하고, `App.tsx` `probeSmbTarget`의 정책 우회(`finalDecision.action !== 'auto_switch'`)를 제거했으며, `pendingClientAuthMode` 수신 시 `ClientPanel`이 `probeTimerRef` 취소 및 `completedProbeRef`/`autoSwitchedFrom`/`smartResult` 동기화로 자동 전환 배너와 `Undo` 버튼이 650ms 후 소멸하지 않게 교정하고, 호스트/공유명 수동 수정 시 잔류 `ABSHARE://` 연결 코드 토큰을 초기화했습니다. `main.js`에서는 `save-legacy-scripts` 중복 프로브를 정리하고 `export-location-profile-file` 오류에 `writeProtected` 플래그를 전파했습니다.


## 📅 v1.2.0 (2026-11-19) — [MINOR] 실시간 작업 진행 모션창(WorkProgressModal) 및 6차 자아성찰 심층 점검 안정화
- **변경 구분**: `MINOR` (하위 호환 신규 기능 추가 (MINOR))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.2.0.exe`, `AhBiShare_OneClick-Lite_v1.2.0.exe`, `AhBiShare_OneClick_Win7_v1.2.0.exe`, `AhBiShare_OneClick-Setup_v1.2.0.exe`

### 주요 변경 및 특이점 기록
1. WorkProgressModal: 공유 개설·해제, 드라이브 연결·해제, OS 정책 변경·자동 정렬, 구형 OS 통합, 장소 일괄 적용, 보안 원복 주요 작업 11종에 듀얼 링 SVG 모션·실시간 단계 타임라인·경과 시간·실행 중 잠금·성공 1.5초 자동 닫힘/오류 수동 확인 적용
2. WorkProgressModal.tsx / index.css: 실행 중 배경 버튼 키보드 재호출(Enter/Space/Tab) 차단 포커스 트랩 및 본문 스크롤 잠금 추가, prefers-reduced-motion 환경 animation-iteration-count: 1 적용으로 고속 깜빡임 제거
3. App.tsx (handleExpirySecurityRollback / handleApplyOsPatch): 만료 보안 원복 시 rollbackPolicies·strict_26h2_default 실패 검증 및 오류 알림 유지·실패 단계 추적 반영, 정책 적용 실패 토스트가 완료 문구를 표시하던 오류 수정
4. shareBridge.ts (applyLocationProfileBatch): savedShares 선행 필터링을 App.tsx validShares와 동일하게 일치시켜 장소 일괄 적용 단계 인덱스 불일치 해결

## 📅 v1.1.5 (2026-11-19) — [PATCH] 5차 자아성찰 심층 점검: SeDenyNetworkLogonRight 따옴표 보존, UTF-16LE INF 명시, SMB Null 세션 폴백 및 Live 상태 동기화 정확도 개선
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.5.exe`, `AhBiShare_OneClick-Lite_v1.1.5.exe`, `AhBiShare_OneClick_Win7_v1.1.5.exe`, `AhBiShare_OneClick-Setup_v1.1.5.exe`

### 주요 변경 및 특이점 기록
1. powershellEngine.ts / legacyScriptEngine.ts: secedit UTF-16LE INF 읽기 시 [System.Text.Encoding]::Unicode를 명시 전달하고 SeDenyNetworkLogonRight 비게스트 토큰의 기존 따옴표($rawTok/$rawTk)를 보존하도록 수정
2. powershellEngine.ts (c_mount): 계정 모드에서 슬래시(/) 또는 별표(*) 시작 암호 시 net.exe CLI 파싱 충돌을 회피해 Win32 WNetAddConnection2로 직행하도록 개선하고, Guest 모드에 명시적 Win32 SMB Null 세션(빈 계정/빈 암호) 폴백을 추가
3. shareBridge.ts (syncLiveState): 공유폴더 로컬 경로(folderPath) 변경 감지·갱신 및 드라이브 문자 외부 재매핑 시 Live UNC 불일치 기존 메타데이터 재사용 차단

## 📅 v1.1.4 (2026-11-19) — [PATCH] 무비밀번호(Guest) 마운트 오류 86·1223 근본 해결 (WNetAddConnection2 · ProcessStartInfo 빈 암호 전달 & 호스트 빈 암호/INF 인코딩 정렬)
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.4.exe`, `AhBiShare_OneClick-Lite_v1.1.4.exe`, `AhBiShare_OneClick_Win7_v1.1.4.exe`, `AhBiShare_OneClick-Setup_v1.1.4.exe`

### 주요 변경 및 특이점 기록
1. powershellEngine.ts (c_mount): PowerShell 배열 인자 `'""'` 전달 시 네이티브 net.exe에 리터럴 문자열 `""`가 암호로 전달되어 Guest/Anonymous 모두 시스템 오류 86(암호 불일치)을 유발하던 결함을 Win32 WNetAddConnection2(mpr.dll) 및 ProcessStartInfo 원시 Arguments('', Guest/Host\Guest/Anonymous 우선) 호출로 근본 해결
2. powershellEngine.ts (h_auth / safe_compat / legacy_bridge_compat): 호스트 *-501 Guest 계정 빈 암호(/passwordreq:no) 명시적 초기화·S-1-5-7(ANONYMOUS LOGON) 공유 권한 추가 및 안전/구형 호환 패치에 LimitBlankPasswordUse=0·LSA 익명 정책 정렬 추가
3. powershellEngine.ts / legacyScriptEngine.ts: PSDefaultParameterValues['*:Encoding']='utf8' 환경에서도 secedit UTF-16LE INF를 안전하게 읽도록 [System.IO.File]::ReadAllLines 적용 및 오프라인 USB 키트 LimitBlankPasswordUse=0/1 대칭 반영
4. networkEvolution.ts: 시스템 오류 86(빈 암호 제한/Guest 암호 불일치) 실패 진단 가이드 및 처방 문구 보강

## 📅 v1.1.3 (2026-11-19) — [PATCH] 3차 자아성찰 심층 점검 및 포터블 업데이터·프로필 복원 안정화
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.3.exe`, `AhBiShare_OneClick-Lite_v1.1.3.exe`, `AhBiShare_OneClick_Win7_v1.1.3.exe`, `AhBiShare_OneClick-Setup_v1.1.3.exe`

### 주요 변경 및 특이점 기록
1. portableUpdater.js: 포터블 교체 전 기존 EXE 사전 백업(old_portable_backup.exe), 복사 후 PE MZ 헤더 검증(Test-ValidPeExe) 및 복사/검증 실패 시 자동 롤백 복구 추가
2. main.js / bump_version.js: 포터블 업데이터 spawn PID 미생성·오류(updaterProc.once('error')) 시 exitTimer 취소 및 앱 강제 종료 방지(isPortableReplacementQueued 초기화), APP_PKG_VERSION 폴백 버전 자동 동기화
3. portableStore.js: 파일명과 내부 profileId가 다른 복사·이름변경 .location.json 파일도 조회·삭제 가능하도록 findLocationFileByProfileId 폴백 탐색 구현
4. shareBridge.ts / types/share.ts: 클라이언트 마운트 시 MountedDrive.username 및 보안 계정 비밀번호 런타임 캐시 저장(setCachedPassword), Electron 사용장소 프로필 로드·가져오기 시 cacheLocationProfileCredentials 통합 복원 적용

## 📅 v1.1.2 (2026-11-19) — [PATCH] 2차 자아성찰 심층 점검: 업데이트 리다이렉트·장소 일괄 적용·오프라인 키트 1385 방어 및 UI 상태 버그 수정
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.2.exe`, `AhBiShare_OneClick-Lite_v1.1.2.exe`, `AhBiShare_OneClick_Win7_v1.1.2.exe`, `AhBiShare_OneClick-Setup_v1.1.2.exe`

### 주요 변경 및 특이점 기록
1. Electron main.js fetchTextHttps URL·프로토콜(HTTPS) 검증 및 리다이렉트 루프·예외 가드 보강, 포터블 교체 직전 이중 실행 방지(isPortableReplacementQueued) 추가
2. 사용장소 프로필(.location.json) 일괄 적용(applyLocationProfileBatch) 시 ABSHARE:// 연결 코드·캐시에서 암호 복원 및 계정 모드 암호 누락 시 무음 기본값 대체 차단
3. 구형 OS 통합 원클릭·장소 일괄 적용 실행 후 OS 네트워크 정책 자동 재검사 및 USB 호스트 정책 스냅샷 동기화 보강
4. 오프라인 USB Legacy .bat 키트에 secedit USER_RIGHTS 백업/복원 및 SeDenyNetworkLogonRight 차단 해제(Error 1385 방어) 추가
5. LocationManagerModal 열림 경계(wasOpenRef) 상태 초기화·HostPanel shareNameCustomized 조건·UpdateModal KB 단위 및 미상 용량 다운로드 진행 표시 개선

## 📅 v1.1.1 (2026-11-19) — [PATCH] Win 11 25H2 호스트 <- 24H2 클라이언트 공유 오류 1385·1223 및 콘솔 출력 깨짐(Mojibake) 수정
- **변경 구분**: `PATCH` (버그 수정 · 보안 및 호환성 패치 (PATCH))
- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)
- **배포 파일**: `AhBiShare_OneClick_v1.1.1.exe`, `AhBiShare_OneClick-Lite_v1.1.1.exe`, `AhBiShare_OneClick_Win7_v1.1.1.exe`, `AhBiShare_OneClick-Setup_v1.1.1.exe`

### 주요 변경 및 특이점 기록
1. 호스트 무비밀번호 공유 개설(h_auth) 및 안전 호환 패치 시 로컬 보안 정책 SeDenyNetworkLogonRight의 Guest/Guests SID(*S-1-5-32-546, *-501) 네트워크 로그온 차단을 secedit로 자동 해제하여 시스템 오류 1385 해결
2. 클라이언트 net.exe 실행 시 stdio stdin을 ignore로 격리해 1223 대화형 암호 프롬프트 중단 방지 및 /user:Anonymous·cmdkey 캐시 정리 폴백 보강
3. Electron main.js decodeWindowsBuffer의 UTF-16LE 판별 오작동(UTF-8 내 단일 NULL 바이트 포함 시 蓫뢊... 한자 깨짐) 수정 및 실패 진단기 Error 1385·1223 우선 분류 추가
4. `shareBridge.ts`·`portableStore.js`·`App.tsx` 간 `guestNetworkLogonDenied` USB 스냅샷 누락/동기화 지연 결함 수정, 따옴표·도메인 접두사 포함 `SeDenyNetworkLogonRight` 토큰 파싱 및 다국어 `BUILTIN\Guests(S-1-5-32-546)` 공유 권한 부여 보강

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
