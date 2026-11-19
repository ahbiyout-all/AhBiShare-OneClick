# AhBiShare OneClick v1.1.1

[한국어](README.md) | **English**

**AhBiShare OneClick** is a standalone web & Electron portable desktop utility that solves Windows LAN folder sharing (Host PC), one-click network drive mounting (Client PC), cross-PC SMB policy auto-alignment (Win 10/11), per-location configuration profiles with batch apply, and Windows 7/8/8.1 legacy OS compatibility bridges & offline `.bat`/`.reg` kit generation in a single click.

## Key Features

- **Host PC (1-Click Share Setup)**:
  - Switches network profile to Private and opens Windows Firewall TCP ports `445` and `139` inbound.
  - Automatically configures and starts `LanmanServer`, `FDResPub`, `fdPHost`, and `SSDPSrv`.
  - Supports both **No-Password Easy Mode** and **Account-Authenticated Security Mode**, expiring temporary share timers (`TTL`), and generates `ABSHARE://` connection codes & QR codes.
- **Client PC (1-Click Drive Mount)**:
  - Scans `/24` local subnet SMB `445` / NetBIOS hosts and auto-fills portable credentials stored in `AhBiShare_OneClick.portable.json` (AES-256-GCM encrypted).
  - Automatically diagnoses and mitigates Windows `0x80070035`, `1272`, `5`, and `1219` SMB errors before mounting drives.
- **Per-Location Profiles & 1-Click Batch Apply (`v1.1.1`)**:
  - Saves separate AES-256-GCM encrypted profiles (`locations/*.location.json`) per site (Office, Home, Field), supports `.json` export/import, auto-fills workspace fields, and applies host shares & client drives together in **1 click**.
- **OS Compatibility Matrix (Win 10 ~ Win 11 26H2)**:
  - Detects host-client policy mismatches in real time (SMB signing, insecure guest auth, RPC privacy, UAC token filtering, NTLM), provides **1-click batch auto-alignment**, and evaluates reboot requirements.
- **Legacy OS Sharing & Bidirectional Bridge (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - Provides a guided 2-step flow (**Step 1: Main Host PC** / **Step 2: Client PC**) with 1-click SMB 2.1/3.0 unencrypted compatibility bridging, 2-step acknowledged SMB 1.0 safety control, and pre-change registry snapshot rollback (`Backup_Before_Apply`).
  - Generates pure Windows 7 `cmd.exe`-compatible `.bat` + UTF-16LE BOM `.reg` 4-file offline USB kits and supports **Win 10/11 ⇄ Win 7/8 bidirectional JSON data bridging**.
- **GitHub Auto-Update Detection & Portable Self-Replace (`v1.1.1`)**:
  - Checks GitHub Releases (REST API + Atom/`expanded_assets` dual fallback) and displays an update confirmation modal.
  - Detects the running portable edition (`Standard`, `Lite`, or `Win7`), verifies official GitHub download URLs and Windows PE (`MZ`) headers, and **terminates/removes the old portable EXE, replaces it with the new EXE, and relaunches automatically** while preserving `.portable.json` and `locations/`.

## Build, Verification & Semantic Versioning

```bash
npm install
npm run dev                  # Vite web dev server (http://localhost:3000)
npm run lint                 # TypeScript type-check (tsc --noEmit)
npm run build                # Production bundle (dist/, Chromium 106 compatible)
npm run verify               # 10-suite integrity, security, updater & SemVer verifier
npm run electron:build       # Standard portable & NSIS EXE (AhBiShare_OneClick_v1.1.1.exe)
npm run electron:build:lite  # Size-reduced Lite portable EXE (AhBiShare_OneClick-Lite_v1.1.1.exe)
npm run electron:build:win7  # Windows 7 SP1~8.1 portable EXE (AhBiShare_OneClick_Win7_v1.1.1.exe)
npm run electron:build:all   # Build Standard + Lite EXEs and compare file sizes
npm run version:bump -- minor --summary "Summary" --note "Detail"  # SemVer sync + patch notes
```

On Windows, running root `build.bat` verifies dependencies, executes lint and release verification, builds Standard, Lite, and Win 7 portable EXEs plus the Inno Setup installer (`AhBiShare_OneClick-Setup_v1.1.1.exe`) with metadata-synced version suffixes, and opens the `release\` output folder.

### Lite Edition (`AhBiShare_OneClick-Lite_v1.1.1.exe`) Size Optimization (Win 7–11 Standalone)
- Excludes redundant `node_modules` already bundled by Vite from `app.asar`.
- Retains `ko` and `en-US` locales while pruning unused Chromium locale `.pak` files and large license HTML assets.
- Removes non-essential WebGPU DXC (`dxcompiler.dll`, `dxil.dll`) and Vulkan software rasterizer (`vk_swiftshader.dll`, `vulkan-1.dll`) binaries.
- Preserves essential Windows 7–11 runtime components (`icudtl.dat`, `ffmpeg.dll`, `libGLESv2.dll`, `libEGL.dll`, `d3dcompiler_47.dll`, `v8_context_snapshot.bin`) under maximum LZMA compression.

## Official Documentation (`docs/`)
- [Documentation Hub (`docs/README.md`)](docs/README.md)
- [Patch Notes (`docs/PATCH_NOTES.md`)](docs/PATCH_NOTES.md)
- [Versioning Policy (`docs/VERSIONING.md`)](docs/VERSIONING.md)
- [GitHub Release Post (`docs/github_release_post.md`)](docs/github_release_post.md)
- [GitHub Repository & Release Guide (`docs/github_release_guide.md`)](docs/github_release_guide.md)
- [Google Blogger Post Drafts (`docs/google_blogger_post.md`)](docs/google_blogger_post.md)

## Author & Official Links
- **Developer & Copyright**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **Organization**: [Cheongwoon Information System Co., Ltd. / (주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub Repository**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **Official Blog**: https://ahbiyoutvibe.blogspot.com/
- **License**: [MIT License](LICENSE)
