# 🛠 AhBiShare OneClick v1.0.0 노트 (Release Notes)

## 📅 릴리즈 개요
- **버전**: v1.0.0 (Standalone Independent Release)
- **배포일**: 2026년 11월 16일
- **구분**: 독립 앱 전환 및 초기화 (Standalone Release)

## 🔍 핵심 기능 및 구조 정리
### 1. AhBiShare OneClick 단독 독립 애플리케이션 승격 (`main.js`, `vite.config.ts`, `package.json`, `src/*`)
- 기존 통합 스위트 내 모든 무관한 기능(시스템 튜닝, 클리너, 복구, AI 기능, C++ 네이티브 바이너리, Tauri 및 중복 빌드 스크립트)을 완전히 제거하고, **AhBiShare OneClick** 단일 루트 앱(`v1.0.0`)으로 재편했습니다.
- 웹 개발/미리보기(`vite`, 포트 3000)와 관리자 권한 Windows Electron 포터블 EXE(`AhBiShare_OneClick.exe`, `portableStore.js` AES-256-GCM USB 동기화, PowerShell 엔진)를 단일 루트 구성에서 일관되게 지원합니다.

### 2. 핵심 내장 기능 요약
- **공유 개설 & 클라이언트 연결**: 1클릭 공유폴더 개설, `ABSHARE://` 연결 코드·QR 발급, USB 포터블 JSON 자동 채우기, LAN 탐색 및 네트워크 드라이브 마운트, 만료 타이머 지원.
- **OS 호환성 매트릭스**: 호스트-클라이언트 정책 불일치(SMB 서명·게스트·NTLM·프린터 RPC·UAC 토큰 필터) 실시간 감지 및 1클릭 일괄 자동 정렬.
- **구형 OS 공유(Win 7·8·8.1 ⇄ Win 10·11)**: SMB 2.1/3.0 비암호화 호환 브릿지 1클릭 적용, 2단계 확인 기반 SMB 1.0 제어, 사전 스냅샷 정밀 원복, 순정 Win 7 안전 `.bat` + UTF-16LE `.reg` 4종 키트 생성.

### 3. Win 7~11 호환 경량(용량 감소) 포터블 EXE 빌드 추가 (`build-config-lite.json`, `scripts/prune_electron_pack.js`, `scripts/build_lite_exe.js`)
- 표준 EXE(`AhBiShare_OneClick.exe`)와 병행하여, 이미 번들된 `node_modules` 중복 포함 제거, 한국어·영어(`ko`, `en-US`) 외 미사용 로케일 제거, Chromium 라이선스 HTML 및 미사용 WebGPU·Vulkan 소프트웨어 DLL 정리를 적용한 **경량 포터블 EXE(`AhBiShare_OneClick-Lite.exe`)** 로컬 빌드 스크립트(`npm run electron:build:lite`, `npm run electron:build:all`)를 추가했습니다.
- Windows 7~11 단독 실행에 필수적인 ANGLE·V8·ICU·FFmpeg 코어 바이너리는 100% 보존했습니다.

## 🌐 제작자 및 공식 채널 안내
- **개발자**: AhBiYout
- **GitHub 저장소**: https://github.com/AhBiYout-all
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **소속**: https://www.cisnet.co.kr
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr)
