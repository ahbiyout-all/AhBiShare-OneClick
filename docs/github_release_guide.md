# AhBiShare OneClick — GitHub 저장소 및 릴리즈 안내

## 저장소 및 공식 채널
- **개발자**: AhBiYout (GitHub 계정명: `AhBiYout-all`)
- **GitHub 저장소**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **공식 구글 블로그**: https://ahbiyoutvibe.blogspot.com/
- **소속회사**: (주)청운정보시스템 (cisnet.co.kr) — https://www.cisnet.co.kr

---

## GitHub 추적 대상(Core Tree) 및 제외 규칙 (`.gitignore`)

GitHub 저장소에는 앱 빌드·실행·배포에 꼭 필요한 **핵심 파일만** 선별하여 업로드합니다.

- **포함 (추적 대상)**:
  - 핵심 소스코드: `src/**/*`, `main.js`, `preload.js`, `portableStore.js`, `index.html`, `public/config.json`, `icon.ico`
  - 빌드·설정·CI: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `build.bat`, `build-config-lite.json`, `build-config-win7.json`, `scripts/*`, `installer/setup.iss`, `.github/workflows/release.yml`, `.gitattributes`, `.gitignore`, `.env.example`
  - 공식 문서·라이선스: `README.md`, `LICENSE`, `docs/*`
- **제외 (`.gitignore` 엄격 차단 대상)**:
  - 로컬 자동화 푸시 스크립트: `push_github.bat`, `build_release.bat`, `RELEASE_CHANGELOG.md`
  - 중첩 경로 및 플랫폼 메타데이터: `/app/`, `.aistudio/`, `metadata.json`
  - 런타임 생성 파일·자격증명·네트워크 키트: `*.portable.json`, `AhBiShare_CrossOS_Sync_Bridge*.json`, `AhBiShare_Legacy_Win7_Win8_Kit/`, `Backup_Before_Apply/`
  - 빌드 바이너리·임시 산출물: `node_modules/`, `bun.lock`, `/dist/`, `/release/`, `/release-lite/`, `/release-win7/`, `/release-github/`, `*.exe`, `*.dll`, `*.asar`, `builder-debug.yml`, `.env*` (`.env.example` 제외)

> 로컬에서 `push_github.bat` 실행 시 사전에 `npm run lint` 및 `npm run verify`를 수행하고, 기존 원격 저장소에 잘못 추적되어 있던 `app/`·`metadata.json` 등 제외 대상 파일이 있으면 Git 인덱스에서만 안전하게 제거(`git rm --cached`)한 뒤 푸시합니다. `push_github.bat` 자체는 `.gitignore`에 의해 GitHub에 업로드되지 않습니다.

---

## Semantic Versioning (MAJOR.MINOR.PATCH) 원칙
- **MAJOR (`X.0.0`)**: 호환되지 않는 구조 개편 또는 아키텍처 전면 전환
- **MINOR (`1.X.0`)**: 하위 호환성을 유지하는 신규 기능 추가
- **PATCH (`1.0.X`)**: 버그 수정, 보안 정책 보완, PowerShell/OS 호환성 개선

---

## GitHub Actions 릴리즈 자산 규칙 (빌드 버전 번호 파일 전용)
- 워크플로 위치: `.github/workflows/release.yml`
- 지원 플랫폼: **Windows x64 전용** (APK/iOS 모바일 빌드 제외)
- GitHub Releases에는 **버전 번호(`_vX.Y.Z`)가 붙은 실행 파일만** 생성·첨부됩니다:
  - `AhBiShare_OneClick_v<version>.exe` (표준 포터블)
  - `AhBiShare_OneClick-Lite_v<version>.exe` (용량 감소 경량 포터블)
  - `AhBiShare_OneClick_Win7_v<version>.exe` (Windows 7 SP1 ~ 8.1 전용 포터블)
  - `AhBiShare_OneClick-Setup_v<version>.exe` (Windows 설치 프로그램)
