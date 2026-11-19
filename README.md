# AhBiShare OneClick v1.1.1

**한국어** | [English](README.en.md)

Windows 컴퓨터 간 공유폴더 개설(메인 PC)과 원격 드라이브 연결(클라이언트 PC), Win 10·11 호스트-클라이언트 정책 불일치 자동 정렬, 사용장소별 설정 프로필 일괄 적용, Windows 7/8/8.1 구형 OS 브릿지·양방향 데이터 공유 및 USB 오프라인 스크립트 생성을 클릭 한 번으로 해결하는 **독립형 웹 / Electron 포터블 애플리케이션**입니다.

## 주요 기능

- **메인 PC (공유 개설)**:
  - 네트워크 프로필 개인(Private) 전환 및 방화벽 TCP 445·139 인바운드 허용
  - `LanmanServer`, `FDResPub`, `fdPHost`, `SSDPSrv` 서비스 자동 가동
  - **간편 무비밀번호 모드** 및 **보안 계정 모드** 동시 지원, 임시 공유 만료 타이머 및 `ABSHARE://` 연결 코드·QR 코드 발급
- **클라이언트 PC (원클릭 연결)**:
  - 로컬 서브넷(`/24`) SMB 445 포트·NetBIOS 자동 탐색 및 USB 포터블 설정(`AhBiShare_OneClick.portable.json`) 자동 채우기
  - Windows 10/11 `0x80070035`, `1272`, `5`, `1219` 오류 원인 자동 진단 및 드라이브 마운트
- **사용장소별 개별 프로필 및 1클릭 일괄 적용 (`v1.1.1`)**:
  - 사무실·집·현장 등 장소별 개별 `.location.json` 프로필 생성(AES-256-GCM 암호화), JSON 파일 내보내기/불러오기, 자동 채움 및 **원클릭 일괄 적용** 지원
- **OS 호환성 매트릭스 (Win 10 ~ Win 11 26H2)**:
  - 호스트-클라이언트 양단 정책 불일치 실시간 감지 및 **원클릭 일괄 자동 정렬**, 재부팅 필요 여부 판정
- **구형 OS 공유 및 양방향 브릿지 (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - `SMB 2.1 / 3.0` 비암호화 호환 브릿지 1클릭 적용, 2단계 위험 확인 기반 SMB 1.0 안전 제어, 사전 스냅샷 기반 정밀 원복
  - 순정 Windows 7 `cmd.exe` 호환 `.bat` + UTF-16LE BOM `.reg` 적용·원복 4종 스크립트 생성 및 **Win 10/11 ⇄ Win 7/8 양방향 JSON 데이터 브릿지** 지원
- **GitHub 자동 업데이트 & 포터블 원클릭 교체 (`v1.1.1`)**:
  - GitHub Releases 실시간 업데이트 감지 및 확인창 제공
  - 실행 중인 포터블 에디션(`Standard` / `Lite` / `Win7`) 자동 판별, PE 실행 헤더 무결성 검증, **기존 포터블 종료·제거 후 새 포터블 자동 교체 및 재실행** 지원

## 실행, 빌드 및 Semantic Versioning 관리

```bash
npm install
npm run dev                  # 웹 개발 서버 (http://localhost:3000)
npm run lint                 # TypeScript 타입 검증
npm run build                # 프로덕션 웹 번들 빌드 (dist/)
npm run verify               # 표준·경량·Win7 EXE 구성, 업데이터 및 보안 가드레일 무결성 검증
npm run electron:build       # Windows 표준 포터블/설치형 EXE (AhBiShare_OneClick_v1.1.1.exe)
npm run electron:build:lite  # Windows 경량 포터블 EXE (AhBiShare_OneClick-Lite_v1.1.1.exe)
npm run electron:build:win7  # Windows 7 SP1~8.1 전용 EXE (AhBiShare_OneClick_Win7_v1.1.1.exe)
npm run electron:build:all   # 표준 + 경량 포터블 EXE 일괄 빌드 및 용량 비교
npm run version:bump -- minor --summary "변경 요약" --note "세부 기록"  # SemVer 버전 동기화 + 패치노트 자동 기록
```

Windows 환경에서는 루트 디렉터리의 `build.bat`을 실행하면 의존성 확인, 검증, 표준·경량·Win 7 포터블 EXE 및 Inno Setup 인스톨러(`AhBiShare_OneClick-Setup_v1.1.1.exe`)를 메타데이터 버전 번호와 함께 자동 빌드하고 완료 후 `release` 폴더를 엽니다.

### 경량 버전(`AhBiShare_OneClick-Lite_v1.1.1.exe`) 용량 최적화 내역 (Win 7~11 전 세대 단독 실행 유지)
- Vite로 이미 번들된 `node_modules` 중복 패키징 제외 (`app.asar` 대폭 축소)
- `ko`, `en-US` 로케일만 유지하고 미사용 다국어 `.pak` 및 방대한 Chromium 라이선스 HTML 제거
- UI 렌더링과 무관한 WebGPU DXC(`dxcompiler.dll`, `dxil.dll`) 및 Vulkan 소프트웨어 래스터라이저(`vk_swiftshader.dll`, `vulkan-1.dll`) 제거
- Windows 7~11 호환 필수 코어(`icudtl.dat`, `ffmpeg.dll`, `libGLESv2.dll`, `libEGL.dll`, `d3dcompiler_47.dll`, `v8_context_snapshot.bin`) 보존 및 최대 LZMA 압축 적용

## 공식 문서 모음 (`docs/`)
- [문서 허브 (`docs/README.md`)](docs/README.md)
- [패치 노트 (`docs/PATCH_NOTES.md`)](docs/PATCH_NOTES.md)
- [버전 관리 원칙 (`docs/VERSIONING.md`)](docs/VERSIONING.md)
- [구글 블로거 포스팅용 문서 (`docs/google_blogger_post.md`)](docs/google_blogger_post.md)
- [GitHub 릴리즈 소개 문서 (`docs/github_release_post.md`)](docs/github_release_post.md)
- [GitHub 저장소 · 릴리즈 운영 가이드 (`docs/github_release_guide.md`)](docs/github_release_guide.md)

## 제작자 및 공식 채널 안내
- **개발자 · 저작권**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
