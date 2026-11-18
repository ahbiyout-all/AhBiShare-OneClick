# 🚀 AhBiShare OneClick v1.1.0 — GitHub 릴리즈 & 배포 문서

> **Windows 7 SP1 ~ Windows 11 26H2** 환경에서 클릭 한 번으로 공유폴더 개설, 네트워크 드라이브 연결, 사용장소별 프로필 일괄 적용, 구형 OS(SMB) 호환 브릿지 구성을 지원하는 오픈소스 유틸리티입니다.

---

## 📦 배포 파일 안내 (`v1.1.0` · GitHub Releases)

| 파일명 | 권장 대상 | 특징 |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.1.0.exe`** | Windows 10 / 11 (x64) | 표준 단일 포터블 실행 파일 (무설치 USB 휴대 실행) |
| **`AhBiShare_OneClick-Lite_v1.1.0.exe`** | Windows 10 / 11 (x64) | 불필요한 로케일/WebGPU/Vulkan 제거 경량 포터블 버전 |
| **`AhBiShare_OneClick_Win7_v1.1.0.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | 레거시 OS 전용 Electron 21 기반 호환 포터블 빌드 |
| **`AhBiShare_OneClick-Setup_v1.1.0.exe`** | Windows 7 ~ 11 (x64) | Inno Setup 설치형 (시작 메뉴·바탕 화면·방화벽 자동 등록) |

---

## ✨ v1.1.0 주요 변경 내역 (Semantic Versioning: `MINOR`)

### 🟢 신규 기능 (`MINOR`)
- **사용장소별 개별 프로필(`.location.json`) & 1클릭 일괄 적용**:
  - 사무실·집·현장 등 사용장소별 호스트 공유 및 클라이언트 드라이브 타깃을 개별 암호화 파일(`locations/*.location.json`)로 저장하고 목록 전환·JSON 내보내기/불러오기·**원클릭 일괄 적용**을 지원합니다.
- **GitHub 자동 업데이트 감지 + 기존 포터블 종료·제거·자동 교체(Self-Replace)**:
  - 실행 중인 포터블 에디션(`Standard` / `Lite` / `Win7`)을 자동 판별해 동일 에디션의 최신 `.exe`를 내려받고, 공식 GitHub URL 허용 목록 및 PE 실행 헤더(`MZ`) 검증을 거친 뒤 기존 포터블 프로세스를 종료·파일 제거 후 새 파일로 교체·재실행합니다.
  - 기존 공유 데이터(`.portable.json`) 및 사용장소 프로필(`locations/`)은 안전하게 보존됩니다.

### 🔧 특이점 및 버그 수정 (`PATCH` 포함)
- **Windows 7 화면 및 PowerShell 2.0 호환성**: Tailwind CSS v4 `oklch()` 색상을 `chrome106`/`chrome100` 타깃으로 컴파일 변환해 Win 7(Electron 21) 검은 화면 문제를 해결하고, PowerShell 2.0 `$PSDefaultParameterValues`/`[Console]` 핸들 예외를 가드했습니다.
- **네트워크 · 스트림 · UI 안정화**: 에디션 판별 시 상위 폴더명 오인 차단, HTTP 청크 스트림 완료 검증 및 취소 동기화(`cleanupPromise`), USB 루트 드라이브(`E:\`) 저장 경로 검증 수정, 모달 위 토스트 표시(`z-[60]`), SemVer 2.0 pre-release 비교 보완을 완료했습니다.

---

## 🔒 보안 및 무결성 아키텍처
- **AES-256-GCM 암호화**: 포터블 저장소(`.portable.json`)와 장소 프로필(`.location.json`)의 계정 자격증명은 디스크에 평문 저장되지 않습니다.
- **업데이트 다운로드 검증**: `github.com/ahbiyout-all/AhBiShare-OneClick` 및 GitHub CDN(`*.githubusercontent.com`) HTTPS 주소만 허용하며 PE 헤더(`MZ`)와 파일 크기를 사전 검증합니다.
- **관리자 권한 및 스냅샷 원복**: Windows 방화벽·SMB 레지스트리 정책 변경 전 사전 스냅샷을 보관하여 안전한 원복을 지원합니다.

---

## 📜 릴리즈 이력 요약
- **`v1.1.0` (2026-11-18)**: 사용장소 프로필(`.location.json`)·1클릭 일괄 적용, GitHub 포터블 자동 교체(Self-Replace), Win 7 UI/PS 2.0 호환성 및 심층 점검 버그 수정
- **`v1.0.0` (2026-11-16)**: AhBiShare OneClick 정식 출범, 구형 OS 공유(Win 7/8 ⇄ Win 10/11) 2단계 브릿지·오프라인 키트, Lite/Win7/Setup 배포 체계 확립

---

## 👨‍💻 제작자 및 공식 링크
- **개발자 · 저작권**: **AhBiYout** (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **라이선스**: [MIT License](../LICENSE)
