# 🚀 AhBiShare OneClick v1.1.0 — GitHub 릴리즈 & 저장소 소개 문서

> **Windows 7 SP1 ~ Windows 11 26H2** 환경에서 클릭 한 번으로 공유폴더 개설, 네트워크 드라이브 연결, 사용장소별 프로필(`.location.json`) 일괄 적용, 구형 OS(SMB) 호환 브릿지 구성을 지원하는 **독립형 오픈소스 유틸리티**입니다.

---

## 📦 배포 파일 안내 (`v1.1.0` · GitHub Releases)

| 파일명 | 권장 대상 | 특징 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.1.0.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.1.0.exe`** | Windows 10 / 11 (x64) | 불필요한 로케일·WebGPU·Vulkan 제거 경량 포터블 버전 |
| **`AhBiShare_OneClick_Win7_v1.1.0.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 레거시 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.1.0.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (시작 메뉴·바탕 화면·방화벽 자동 등록) |

👉 **최신 릴리즈 다운로드**: [GitHub Releases (`v1.1.0`)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)

---

## ✨ v1.1.0 주요 변경 내역 (Semantic Versioning: `MINOR`)

### 🟢 신규 기능 (`MINOR`)
- **사용장소별 개별 프로필(`.location.json`) & 1클릭 일괄 적용**:
  - 사무실·집·현장 등 사용장소별 호스트 공유 및 클라이언트 드라이브 타깃을 개별 AES-256-GCM 암호화 파일(`locations/*.location.json`)로 저장하고 목록 전환·JSON 내보내기/불러오기·**원클릭 일괄 적용**을 지원합니다.
- **GitHub 자동 업데이트 감지 + 기존 포터블 종료·제거·자동 교체(Self-Replace)**:
  - GitHub Releases(API + Atom/`expanded_assets` 이중 폴백)에서 최신 버전을 감지해 업데이트 확인창으로 안내합니다.
  - 실행 중인 포터블 에디션(`Standard` / `Lite` / `Win7`)을 파일명(`basename`)과 앱 식별자로 정확히 판별해 동일 에디션의 최신 `.exe`를 내려받고, 공식 GitHub URL 허용 목록 및 Windows PE 실행 헤더(`MZ`) 무결성 검증을 거친 뒤 **기존 포터블 프로세스를 종료·삭제하고 새 파일로 교체·재실행**합니다.
  - 기존 공유 데이터(`.portable.json`) 및 사용장소 프로필(`locations/`)은 안전하게 보존됩니다.

### 🔧 심층 점검(Deep Audit) · 호환성 · 저장소 정비 (`PATCH` 포함)
- **Windows 7 화면 및 PowerShell 2.0 호환성**:
  - Tailwind CSS v4 `oklch()` 색상을 `chrome106`/`chrome100` 타깃으로 컴파일 변환해 Win 7(Electron 21) 검은 화면 문제를 해결하고, PowerShell 2.0 `$PSDefaultParameterValues`·`[Console]` 핸들 예외·`$null` NetBT 루프를 가드했습니다.
- **네트워크 · 업데이터 스트림 · UI 안정화**:
  - HTTP 청크 다운로드 스트림 완료(`res.complete`) 검증 및 `cleanupPromise` 취소 동기화, USB 루트 드라이브(`E:\`) 저장 경로 접두사 수정, 모달 위 토스트 표시(`z-[60]`), 클라이언트 드라이브 문자 덮어쓰기 방지, Atom XML/HTML 디코딩 순서 및 SemVer 2.0 pre-release 비교 보완을 완료했습니다.
- **GitHub 저장소 Core Tree 정비 & 무결성 검증 체계**:
  - `.gitignore` 전면 개편을 통해 로컬 전용 스크립트(`push_github*.bat`, `build_release.bat`), 플랫폼 메타/첨부 이미지(`.aistudio/`, `metadata.json`, `/public/assets/aistudio/`), 업데이터 임시 파일(`_ahbishare_update/`, `*.part`, `*apply_portable_update.ps1`), 런타임 프로필·생성 키트(`*.portable.json`, `*.location.json`, `locations/`, `AhBiShare_*.bat`/`.reg`)를 업로드 대상에서 엄격히 분리했습니다.
  - CI 및 로컬 빌드 전 `npm run lint` (`tsc --noEmit`) 및 `npm run verify` (10대 포터블·암호화·업데이터·SemVer 무결성 스위트) 통과를 의무화했습니다.

---

## 🔒 보안 및 무결성 아키텍처
- **AES-256-GCM 암호화**: 포터블 저장소(`.portable.json`)와 장소 프로필(`.location.json`)의 계정 자격증명은 디스크에 평문 저장되지 않습니다.
- **업데이트 다운로드 검증**: `github.com/ahbiyout-all/AhBiShare-OneClick` 및 GitHub CDN(`*.githubusercontent.com`) HTTPS 주소만 허용하며 PE 헤더(`MZ`)와 다운로드 바이트 무결성을 사전 검증합니다.
- **관리자 권한 및 스냅샷 원복**: Windows 방화벽·SMB 레지스트리 정책 변경 전 사전 스냅샷(`Backup_Before_Apply`)을 보관하여 안전한 원복을 지원합니다.

---

## 🛠️ 로컬 빌드 및 문서·버전 관리
```bash
npm install
npm run lint                 # TypeScript 정적 타입 검증
npm run verify               # 10개 독립 무결성·보안·업데이터·SemVer 검증 스위트
npm run build                # Windows 7 Chromium 106 호환 프로덕션 번들 (dist/)
npm run version:bump -- patch --summary "패치 요약" --note "세부 기록"
```
- Windows 환경에서는 루트 `build.bat`으로 표준·Lite·Win7·Setup 4종 버전별 EXE를 일괄 빌드합니다.
- GitHub 저장소 추적 규칙 및 CI 배포 절차는 [`docs/github_release_guide.md`](github_release_guide.md), 전체 버전 관리 원칙은 [`docs/VERSIONING.md`](VERSIONING.md)를 참고하세요.

---

## 📜 릴리즈 이력 요약
- **`v1.1.0` (2026-11-18)**: 사용장소 프로필(`.location.json`)·1클릭 일괄 적용, GitHub 포터블 자동 교체(Self-Replace), Win 7 UI/PS 2.0 호환성 개선, GitHub Core Tree(`.gitignore`) 정비 및 심층 점검 버그 수정
- **`v1.0.0` (2026-11-16)**: AhBiShare OneClick 정식 출범, 구형 OS 공유(Win 7/8 ⇄ Win 10/11) 2단계 브릿지·오프라인 키트, Lite/Win7/Setup 배포 체계 확립

---

## 👨‍💻 제작자 및 공식 링크
- **개발자 · 저작권**: **AhBiYout** (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **라이선스**: [MIT License](../LICENSE)
