# AhBiShare OneClick - GitHub Release & Development Guide

## Repository Information
- **Repository**: `ahbiyout-all/AhBiShare-OneClick`
- **URL**: [https://github.com/ahbiyout-all/AhBiShare-OneClick](https://github.com/ahbiyout-all/AhBiShare-OneClick)
- **Developer**: AhBiYout
- **Organization**: (주)청운정보시스템 (cisnet.co.kr) (`https://www.cisnet.co.kr`)
- **Official Blog**: [https://ahbiyoutvibe.blogspot.com/](https://ahbiyoutvibe.blogspot.com/)

---

## Semantic Versioning (MAJOR.MINOR.PATCH)
This project follows Semantic Versioning:
- **MAJOR (v1.x.x)**: Incompatible architectural changes or major platform rewrites.
- **MINOR (vx.1.x)**: New feature additions (e.g., legacy OS sharing, auto-align matrix) maintaining backwards compatibility.
- **PATCH (vx.x.1)**: Bug fixes, security patches, PowerShell compatibility adjustments, and packaging improvements.

---

## Automated Build Scripts (English, CRLF)
- `build_release.bat`: Executes frontend build, packages standard EXE (`AhBiShare_OneClick_v1.0.0.exe`) and size-reduced Lite EXE (`AhBiShare_OneClick-Lite_v1.0.0.exe`), and opens the output folder (`release/`) upon successful completion.
- `push_github.bat`: Automated git commit & push script (excluded from version control via `.gitignore`).

---

## GitHub Actions Release CI/CD Workflow
Located at `.github/workflows/release.yml`. Automatically triggers on git tags (`v*`) or manual dispatch, building the Windows x64 application and publishing installers (`AhBiShare_OneClick-Setup.exe`) and portable executables to GitHub Releases.
