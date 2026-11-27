# AhBiShare OneClick v1.3.1

[![Version](https://img.shields.io/badge/version-v1.3.1-4f46e5?style=flat-square)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)
[![Platform](https://img.shields.io/badge/Windows-7%20SP1%20~%2011%2026H2%20(x64)-0284c7?style=flat-square)](#배포-에디션-안내)
[![License](https://img.shields.io/badge/license-MIT-16a34a?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-docs%2FREADME.md-0f766e?style=flat-square)](docs/README.md)

**한국어** | [English](README.en.md) · [최신 릴리즈 다운로드](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest) · [패치 노트](docs/PATCH_NOTES.md) · [공식 문서 허브](docs/README.md)

Windows 컴퓨터 간 공유폴더 개설(메인 PC)과 원격 드라이브 연결(클라이언트 PC), Windows 10·11 호스트–클라이언트 SMB 정책 불일치 자동 정렬, 사용장소별 암호화 프로필(`.location.json`) 일괄 적용, Windows 7/8/8.1 구형 OS 호환 브릿지·오프라인 USB 키트 생성, 그리고 `<appDir>/backup` 자동 암호화 백업·시점 복원을 클릭 한 번으로 해결하는 **독립형 웹 / Electron 포터블 애플리케이션**입니다.

---

## 📦 배포 에디션 안내 (`v1.3.1`)

| 배포 파일명 | 권장 환경 | 특징 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.3.1.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.3.1.exe`** | Windows 10 / 11 (x64) | 미사용 로케일·WebGPU·Vulkan 제거 경량 포터블 |
| **`AhBiShare_OneClick_Win7_v1.3.1.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 구형 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.3.1.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (바로가기·바탕 화면·방화벽 자동 등록) |

---

## ✨ 주요 기능

- **메인 PC (원클릭 공유폴더 개설)**:
  - 네트워크 프로필 개인(Private) 전환, Windows 방화벽 TCP `445`·`139` 인바운드 허용, `LanmanServer`·`FDResPub`·`fdPHost`·`SSDPSrv` 서비스 자동 가동
  - **무비밀번호 간편 모드** 및 **보안 계정 모드**(사무실 표준 5종 숫자 암호 프리셋 `PresetPasswordGrid` 포함) 동시 지원, Win 11 24H2~26H2 공존(`forceguest=0`·`accounts /minpwlen:0`·`LimitBlankPasswordUse` 토글 `EmptyPasswordPolicyToggle`), 임시 공유 만료 타이머(TTL), `ABSHARE://` 연결 코드·QR 코드 발급 및 **`ActiveShare` 리스트 `'탐색기에서 열기'`(`\\IP\공유명` UNC 바로 열기)** 제공
- **클라이언트 PC (원클릭·수동 네트워크 드라이브 연결)**:
  - `/24` 로컬 서브넷 SMB `445`·NetBIOS 자동 탐색(비차단 4초 타임아웃 `net view` 기반 계정/게스트 힌트 추정)
  - **스마트 SMB 인증 감지(`detectSmartShareAuth` · `probeSmbTarget` · `ShareAuthProbeBar`)**: 유효 IPv4 입력 시 자동 탐지(`useEffect`), 30초 TTL 캐시·중복 요청 병합·비매핑 Win32 `WNetAddConnection2` 프로브·유휴 `IPC$` 세션 제외·`1219` 충돌 세션 일괄 정리·자동 계정 모드 전환 및 1클릭 되돌리기 지원
  - USB 포터블 설정(`AhBiShare_OneClick.portable.json`) 자동 채우기, **저장 자격증명(IP/호스트명 교차 매칭)·비밀번호 눈 아이콘 토글**, Windows `0x80070035`/`1272`/`5`/`58`/`86`/`1219`/`1385` 자동 진단 및 **6개 전 탭 통합 새로고침 버튼** 제공
- **사용장소별 개별 프로필 및 1클릭 일괄 적용 (`locations/*.location.json`)**:
  - 사무실·집·현장 등 장소별 호스트/클라이언트 구성을 **AES-256-GCM 암호화** 파일로 분리 저장(활성 보안 계정 클라이언트 모드/자격증명 보존) 및 JSON 내보내기/불러오기
  - **저장된 프로필 내용 직접 수정 에디터**(Windows SAM 계정 검증 포함) 및 **사전 검증(Pre-flight Check)** 모달을 통한 원클릭 일괄 적용 지원
- **OS 호환성 매트릭스 (Win 10 ~ Win 11 26H2)**:
  - 호스트–클라이언트 정책 불일치 실시간 감지·**항목별 색상 비교 배지**·**10대 핵심 보안 정책 원복 심층 감사 보고서**(`LmCompatibilityLevel < 3` 복원 포함)·**전문가 레지스트리 원시 값 좌우 비교 뷰**·**KB5065426 중복 Machine SID 우회(KIR `1517186191=0`)**·원클릭 일괄 자동 정렬 및 재부팅 판단 제공
- **구형 OS 공유 및 양방향 브릿지 (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - 2단계 안내 흐름(`1단계 메인 PC` / `2단계 클라이언트 PC`), SMB 2.1/3.0 비암호화 호환 브릿지, 2단계 확인 기반 SMB 1.0 안전 제어(`mrxsmb10` 대칭 원복), `forceguest=0` 정밀 원복, `Error 58` 진단, Win 7 `HNetCfg.FwPolicy2` 프로필 판별, **`ActiveShare` `'탐색기에서 열기'`(UNC)** 및 **실패 진단 복구 액션** 제공
  - 순정 Win 7 `cmd.exe` 호환 `.bat`(`upgradedHostGuestUnblock.bat` 및 `[char]34`·선초기화 복원·로케일 무관 방화벽) + UTF-16LE BOM `.reg` 4종 오프라인 USB 키트 생성 및 **Win 10/11 ⇄ Win 7/8 양방향 JSON 데이터 브릿지** 지원
- **자료 자동 백업 & 시점 복원 (`<appDir>/backup` · `BackupRestoreModal`) · 일일 로깅 (`<appDir>/log`)**:
  - 앱 실행 폴더 하위 `backup` 폴더에 `.portable.json`·`locations/*.location.json`·`troubleshootTickets` 전체를 기존 AES-256-GCM 암호화 상태로 자동/수동 백업하고 **최근 20개 스냅샷(`BACKUP_MAX_SNAPSHOTS = 20`) 회전 보관** 및 삭제·변경·초기화·복원 직전 자동 안전 백업(중복 해시 스킵) 생성
  - 상단 바·실행 이력 화면에서 전용 **백업·복원 모달**을 열어 검색·필터·수동 백업·원클릭 시점 복원·백업 폴더 열기를 수행하며, 실행 로그는 `<appDir>/log/AhBiShare_YYYY-MM-DD.log`(UTF-8 BOM·자격증명 마스킹)에 일일 기록
- **USB 양방향 오류 전달 & 3단계 해결 마법사 ↔ OS 매트릭스 실시간 동기화**:
  - 오류 티켓(`troubleshootTickets`, 평문 비밀번호·토큰 자동 마스킹)을 `.portable.json`에 통합 저장해 반대편 PC에서 상단 배너 및 3단계 해결 마법사를 자동 표시
  - **`SyncAwarePolicyBadge`(`Policy Matched`)** 로 로컬 OS 정책 상태를 실시간 대조해 이미 충족된 마법사 단계를 자동 완료·건너뛰기 처리하고, OS 호환성 매트릭스·호스트 패널·대기 작업(`pendingHostActions`)과 양방향 동기화
- **GitHub 자동 업데이트 & USB 쓰기 안전 포터블 자가 교체(Self-Replace)**:
  - GitHub Releases(REST API + Atom/`expanded_assets` 폴백) 감지, 공식 도메인·PE(`MZ`) 헤더 검증, 취소 race-condition 차단, **비파괴 `wx` 쓰기 프로브(`exit 4` 가드) · AV 잠금 `loadPortableData` 보호** 및 기존 포터블 종료·제거 후 자동 교체·재실행

---

## 🛠️ 실행, 빌드 및 Semantic Versioning 관리

```bash
npm install
npm run dev                  # 웹 개발 서버 (http://localhost:3000)
npm run lint                 # TypeScript 타입 검증 (tsc --noEmit)
npm run build                # 프로덕션 웹 번들 빌드 (dist/, Chromium 106 호환)
npm run verify               # 15개 릴리즈·보안·백업·양방향 동기화·업데이터·SemVer 무결성 검증
npm run electron:build       # Windows 표준 포터블/설치형 EXE (AhBiShare_OneClick_v1.3.1.exe)
npm run electron:build:lite  # Windows 경량 포터블 EXE (AhBiShare_OneClick-Lite_v1.3.1.exe)
npm run electron:build:win7  # Windows 7 SP1~8.1 전용 EXE (AhBiShare_OneClick_Win7_v1.3.1.exe)
npm run electron:build:all   # 표준 + 경량 포터블 EXE 일괄 빌드 및 용량 비교
npm run version:bump -- patch --summary "변경 요약" --note "세부 기록"  # SemVer 버전 동기화 + 패치노트 자동 기록
```

Windows 환경에서 루트 `build.bat`을 실행하면 의존성 확인, `lint`/`verify` 검증, 표준·경량·Win 7 포터블 EXE 및 Inno Setup 인스톨러(`AhBiShare_OneClick-Setup_v1.3.1.exe`)를 메타데이터 버전 번호와 함께 자동 빌드하고 `release\` 폴더를 엽니다.

### 경량 버전(`AhBiShare_OneClick-Lite_v1.3.1.exe`) 용량 최적화 내역 (Win 7~11 단독 실행 유지)
- Vite로 이미 번들된 `node_modules` 중복 패키징 제외 (`app.asar` 대폭 축소)
- `ko`, `en-US` 로케일만 유지하고 미사용 다국어 `.pak` 및 방대한 Chromium 라이선스 HTML 제거
- UI 렌더링과 무관한 WebGPU DXC(`dxcompiler.dll`, `dxil.dll`) 및 Vulkan 소프트웨어 래스터라이저(`vk_swiftshader.dll`, `vulkan-1.dll`) 제거
- Windows 7~11 호환 필수 코어(`icudtl.dat`, `ffmpeg.dll`, `libGLESv2.dll`, `libEGL.dll`, `d3dcompiler_47.dll`, `v8_context_snapshot.bin`) 보존 및 최대 LZMA 압축 적용

---

## 📁 저장소 구조 (Core Tree)

```text
├── .github/workflows/release.yml   # Windows x64 4종 버전별 EXE 자동 빌드 및 Release 자산 정리
├── docs/                           # 공식 문서 허브, 패치노트, SemVer 규약, 릴리즈·블로거 원고
├── installer/setup.iss             # Inno Setup 다중 파일 설치 스크립트
├── scripts/
│   ├── bump_version.js             # SemVer 3단계 버전 승격 + PATCH_NOTES.md & 문서 자동 동기화
│   ├── verify_portable_release.js  # 15개 독립 무결성·보안·백업·동기화·업데이터 검증 스위트
│   ├── build_lite_exe.js           # 표준/Lite 포터블 빌드 오케스트레이터
│   ├── build_win7_exe.js           # Windows 7 SP1~8.1 Electron 21 격리 빌드
│   ├── prune_electron_pack.js      # Lite 에디션 불필요 로케일·GPU 바이너리 경량화 훅
│   └── upgradedHostGuestUnblock.bat# Win 11 24H2~26H2 공존 및 게스트/빈 암호 차단 해제 스크립트
├── src/                            # React 19 + TypeScript 프론트엔드, PowerShell/플레이북 엔진
├── main.js                         # Electron 메인 프로세스, PowerShell 2.0/5.1 실행, IPC·업데이터
├── preload.js                      # contextBridge IPC 보안 브릿지
├── portableStore.js                # AES-256-GCM 포터블·장소·백업(20개 회전)·일일 로그 저장소
├── portableUpdater.js              # 에디션 판별, PE(MZ) 검증, GitHub 포터블 자가 교체 엔진
└── build.bat                       # Windows 원클릭 로컬 통합 빌드 스크립트
```

> 런타임 생성 데이터(`/backup/`, `/locations/`, `/log/`, `*.portable.json`, `*.location.json`, `*.backup.json`), 빌드 출력(`/dist/`, `/release*/`), 로컬 푸시 스크립트(`push_github*.bat`, `build_release.bat`)는 `.gitignore`로 Git 추적에서 엄격히 제외됩니다. 자세한 정책은 [`docs/github_release_guide.md`](docs/github_release_guide.md)를 참고하세요.

---

## 📚 공식 문서 모음 (`docs/`)

| 문서 | 설명 |
| :--- | :--- |
| [**`docs/README.md`**](docs/README.md) | 공식 문서 허브 및 버전·검증 명령 안내 |
| [**`docs/PATCH_NOTES.md`**](docs/PATCH_NOTES.md) | `최신 변경 내역` 및 `v1.0.0`~`v1.3.1` 전체 패치 노트 (CI 릴리즈 본문 원본) |
| [**`docs/VERSIONING.md`**](docs/VERSIONING.md) | Semantic Versioning(`MAJOR.MINOR.PATCH`) 3단계 관리 규약 |
| [**`docs/github_release_post.md`**](docs/github_release_post.md) | GitHub Releases 및 저장소 상세 소개 문서 |
| [**`docs/github_release_guide.md`**](docs/github_release_guide.md) | Core Tree `.gitignore` 추적 정책 및 GitHub Actions 릴리즈 운영 가이드 |
| [**`docs/google_blogger_post.md`**](docs/google_blogger_post.md) | Google Blogger `[작성 모드]` / `[HTML 편집 모드]` 원고 완본 |
| [**`docs/blogger_post.html`**](docs/blogger_post.html) | Google Blogger `[<> HTML 보기]` 직접 붙여넣기 전용 HTML 게시물 |

---

## 👨‍💻 제작자 및 공식 채널 안내
- **개발자 · 저작권**: **AhBiYout** (`Copyright © 2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **라이선스 · 고지**: [MIT License](LICENSE) · [NOTICE](NOTICE) · [Third-Party Notices](THIRD-PARTY-NOTICES.md)
