# AhBiShare OneClick — GitHub 저장소 및 릴리즈 운영 가이드

## 저장소 및 공식 채널
- **개발자 · 저작권**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **소속회사**: [(주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)

---

## GitHub 추적 대상(Core Tree) 및 제외 규칙 (`.gitignore`)

GitHub 저장소에는 앱 빌드·실행·배포·문서화에 꼭 필요한 **핵심 파일만** 선별하여 업로드합니다.

- **포함 (추적 대상)**:
  - 핵심 소스코드: `src/**/*`, `src/version.ts`, `main.js`, `preload.js`, `portableStore.js`, `portableUpdater.js`, `index.html`, `public/config.json`, `icon.ico`
  - 빌드·설정·CI: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `build.bat`, `build-config-lite.json`, `build-config-win7.json`, `scripts/*`, `installer/setup.iss`, `.github/workflows/release.yml`, `.gitattributes`, `.gitignore`, `.env.example`
  - 공식 문서·라이선스: `README.md`, `LICENSE`, `docs/*` (`docs/README.md`, `docs/PATCH_NOTES.md`, `docs/VERSIONING.md`, `docs/google_blogger_post.md`, `docs/github_release_post.md`, `docs/github_release_guide.md`)
- **제외 (`.gitignore` 엄격 차단 대상)**:
  - 로컬 자동화 푸시 스크립트: `push_github.bat`, `push_github*.bat`, `build_release.bat`, `RELEASE_CHANGELOG.md`
  - 중첩 경로 및 플랫폼 메타·첨부 이미지: `/app/`, `.aistudio/`, `metadata.json`, `/public/assets/aistudio/`
  - 런타임 생성 파일·자격증명·장소 프로필·업데이터 임시 파일·네트워크 키트: `*.portable.json`, `*.location.json`, `/locations/`, `AhBiShare_CrossOS_Sync_Bridge*.json`, `AhBiShare_Legacy_Win7_Win8_Kit/`, `AhBiShare_*.bat`, `AhBiShare_*.reg`, `Backup_Before_Apply/`, `_ahbishare_update/`, `*.part`, `*apply_portable_update.ps1`
  - 빌드 바이너리·임시 산출물: `node_modules/`, `bun.lock`, `/dist/`, `/release/`, `/release-lite/`, `/release-win7/`, `/release-github/`, `*.exe`, `*.dll`, `*.asar`, `builder-debug.yml`, `.env*` (`.env.example` 제외)

> 로컬에서 `push_github.bat` 실행 시 사전에 `npm run lint` 및 `npm run verify`를 수행하고, 기존 원격 저장소에 잘못 추적되어 있던 `public/assets/aistudio/`·`app/`·`metadata.json` 등 제외 대상 파일이 있으면 `core.quotepath=false` 옵션으로 Git 인덱스에서만 안전하게 제거(`git rm --cached`)한 뒤 스테이징 안전 검증을 통과해야 푸시됩니다. `push_github.bat` 자체는 `.gitignore`와 사전 차단 가드에 의해 GitHub에 업로드되지 않습니다.

---

## Semantic Versioning (`MAJOR.MINOR.PATCH`) 원칙 요약
세부 규약 및 자동화 명령은 [`docs/VERSIONING.md`](VERSIONING.md)를 따릅니다.

- **MAJOR (`X.0.0`)**: 호환되지 않는 구조·데이터 스키마 개편 또는 아키텍처 전면 전환
- **MINOR (`1.X.0`)**: 하위 호환성을 유지하는 신규 기능 추가 (`npm run version:bump -- minor ...`)
- **PATCH (`1.1.X`)**: 버그 수정, 보안 정책 보완, PowerShell/OS 호환성 개선 (`npm run version:bump -- patch ...`)

---

## GitHub Actions 릴리즈 자산 규칙 (빌드 버전 번호 파일 전용)
- 워크플로 위치: `.github/workflows/release.yml`
- 사전 검증 게이트: `npm run lint` (`tsc --noEmit`) 및 `npm run verify` (`scripts/verify_portable_release.js` 10개 무결성·보안·업데이터·SemVer 검증 스위트 통과 필수)
- 지원 플랫폼: **Windows x64 전용** (APK/iOS 모바일 빌드 제외)
- 릴리즈 본문은 `docs/PATCH_NOTES.md` 내용을 자동 추출하여 반영합니다.
- 버전 승격 시 `npm run version:bump`가 `package.json`, `public/config.json`, `src/version.ts`, `installer/setup.iss`, `build.bat`, `build_release.bat`, `push_github.bat`, `README.md`, `docs/*`를 일괄 동기화합니다.
- GitHub Releases에는 **버전 번호(`_vX.Y.Z`)가 붙은 실행 파일만** 생성·첨부됩니다:
  - `AhBiShare_OneClick_v<version>.exe` (표준 포터블)
  - `AhBiShare_OneClick-Lite_v<version>.exe` (용량 감소 경량 포터블)
  - `AhBiShare_OneClick_Win7_v<version>.exe` (Windows 7 SP1 ~ 8.1 전용 포터블)
  - `AhBiShare_OneClick-Setup_v<version>.exe` (Windows 설치 프로그램)
