# AhBiShare OneClick v1.3.1

[![Version](https://img.shields.io/badge/version-v1.3.1-4f46e5?style=flat-square)](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest)
[![Platform](https://img.shields.io/badge/Windows-7%20SP1%20~%2011%2026H2%20(x64)-0284c7?style=flat-square)](#edition-overview)
[![License](https://img.shields.io/badge/license-MIT-16a34a?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-docs%2FREADME.md-0f766e?style=flat-square)](docs/README.md)

[한국어](README.md) | **English** · [Download Latest Release](https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest) · [Patch Notes](docs/PATCH_NOTES.md) · [Documentation Hub](docs/README.md)

**AhBiShare OneClick** is a standalone web & Electron portable desktop utility that solves Windows LAN folder sharing (Host PC), one-click network drive mounting (Client PC), cross-PC SMB policy auto-alignment (Win 10/11), per-location AES-256-GCM configuration profiles with batch apply, Windows 7/8/8.1 legacy OS compatibility bridges & offline `.bat`/`.reg` kit generation, and `<appDir>/backup` encrypted snapshot backup/restore in a single click.

---

## 📦 Edition Overview (`v1.3.1`)

| Deliverable | Target OS | Description |
| :--- | :--- | :--- |
| **`AhBiShare_OneClick_v1.3.1.exe`** | Windows 10 / 11 (x64) | Standard standalone portable executable (zero-install USB use) |
| **`AhBiShare_OneClick-Lite_v1.3.1.exe`** | Windows 10 / 11 (x64) | Size-optimized portable build without unused locales, WebGPU, or Vulkan |
| **`AhBiShare_OneClick_Win7_v1.3.1.exe`** | Windows 7 SP1 / 8 / 8.1 (x64) | Legacy OS Electron 21 compatible portable build |
| **`AhBiShare_OneClick-Setup_v1.3.1.exe`** | Windows 7 ~ 11 (x64) | Inno Setup installer (shortcuts & Windows Firewall rules) |

---

## ✨ Key Features

- **Host PC (1-Click Share Setup)**:
  - Switches network profile to Private, opens Windows Firewall TCP ports `445` and `139` inbound, and starts `LanmanServer`, `FDResPub`, `fdPHost`, and `SSDPSrv`.
  - Supports both **No-Password Easy Mode** and **Account-Authenticated Security Mode** (with 5 one-click numeric-password office presets safe from built-in `Guest` collisions), Win 11 24H2–26H2 coexistence (`forceguest=0`, `accounts /minpwlen:0`, and `EmptyPasswordPolicyToggle` for `LimitBlankPasswordUse`), expiring share timers (`TTL`), `ABSHARE://` connection codes & QR codes, and **Open in Explorer (`탐색기에서 열기`) on ActiveShare items to launch UNC paths (`\\IP\Share`) directly**.
- **Client PC (1-Click & Manual Drive Mount)**:
  - Scans `/24` local subnet SMB `445` / NetBIOS hosts (with non-blocking 4s timeout `net view` auth-mode hint inference) and performs **Smart Auth Detection (`detectSmartShareAuth` & `probeSmbTarget` & `ShareAuthProbeBar`)**: automatic IPv4 `useEffect` probe, 30s TTL cache, in-flight deduplication, idle `IPC$` filtering, one-click conflicting `1219` session cleanup, cross-panel suppression sync, auto-switch to Account Mode, and 1-click undo.
  - Auto-fills portable credentials stored in `AhBiShare_OneClick.portable.json` (AES-256-GCM encrypted), provides **multi-source IP/hostname credential resolution, password visibility toggles**, pre-mount `0x80070035`/`1272`/`5`/`58`/`86`/`1219`/`1385` diagnostics, and a **unified Refresh button across all 6 workspace tabs**.
- **Per-Location Profiles & 1-Click Batch Apply (`locations/*.location.json`)**:
  - Saves separate AES-256-GCM encrypted profiles per site (Office, Home, Field), preserves active account-authenticated client mounts/credentials in snapshots, supports `.json` export/import, **in-app profile content editing** (with Windows SAM username validation), and **Pre-flight validated 1-click batch apply**.
- **OS Compatibility Matrix (Win 10 ~ Win 11 26H2)**:
  - Detects host-client policy mismatches in real time with **color-coded discrepancy badges**, provides a **10-point Security Rollback Audit Report** (with `LmCompatibilityLevel < 3` remediation), an **Expert Raw Registry Comparison View**, **KB5065426 duplicate Machine SID mitigation (KIR `1517186191=0`)**, **1-click batch auto-alignment**, and reboot evaluation.
- **Legacy OS Sharing & Bidirectional Bridge (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - Guided 2-step flow (**Step 1: Main Host PC** / **Step 2: Client PC**) with 1-click SMB 2.1/3.0 unencrypted compatibility bridging, 2-step acknowledged SMB 1.0 control (with Win 7 `mrxsmb10` symmetric rollback), snapshot + `forceguest=0` rollback, `Error 58` diagnostics, Win 7 `HNetCfg.FwPolicy2` detection, **Open in Explorer (UNC)**, and Step 2 recovery actions.
  - Generates pure Windows 7 `cmd.exe`-compatible `.bat` (`upgradedHostGuestUnblock.bat`, `[char]34`-safe quoting, baseline-first-then-backup overlay, locale-independent firewall rules) + UTF-16LE BOM `.reg` 4-file offline USB kits (with `atomicWriteBuffer`) and **Win 10/11 ⇄ Win 7/8 bidirectional JSON data bridging**.
- **Automated Encrypted Backup & Point-in-Time Restore (`<appDir>/backup`) · Daily Logging (`<appDir>/log`)**:
  - Automatically and manually snapshots `.portable.json`, `locations/*.location.json`, and `troubleshootTickets` into `<appDir>/backup/*.backup.json` preserving AES-256-GCM ciphertexts with a **20-snapshot rotation cap (`BACKUP_MAX_SNAPSHOTS = 20`)**.
  - Creates pre-modify, pre-delete, pre-reset, and pre-restore safety backups (skipping identical content hashes), provides a dedicated **`BackupRestoreModal`** from the Top Bar and Logs tab, and writes daily credential-scrubbed UTF-8 BOM logs to `<appDir>/log/`.
- **USB Bidirectional Error Handoff & 3-Step Troubleshooting Wizard ↔ Matrix Sync**:
  - Saves sanitized error tickets (`troubleshootTickets`, with `ABSHARE://` tokens and `/pass:` credentials masked) inside `AhBiShare_OneClick.portable.json`, surfacing a top handoff banner and **3-step interactive wizard** on the matching PC.
  - Uses **`SyncAwarePolicyBadge` (`Policy Matched`)** to reconcile local `OsNetworkPolicyStatus` in real time, automatically marking satisfied steps completed/skipped and staying in bidirectional sync with the OS Compatibility Matrix, HostPanel, and `pendingHostActions`.
- **GitHub Auto-Update Detection & USB-Safe Portable Self-Replace**:
  - Checks GitHub Releases (REST API + fault-tolerant Atom/`expanded_assets` fallback), verifies official GitHub URLs and Windows PE (`MZ`) headers with cancel-race protection, enforces **USB write-safety (`wx` probes with `exit 4` guard, AV-lock safe `loadPortableData`)**, and **replaces and relaunches the running portable EXE** while preserving all user data.

---

## 🛠️ Build, Verification & Semantic Versioning

```bash
npm install
npm run dev                  # Vite web dev server (http://localhost:3000)
npm run lint                 # TypeScript type-check (tsc --noEmit)
npm run build                # Production bundle (dist/, Chromium 106 compatible)
npm run verify               # 15-suite integrity, security, backup, sync, updater & SemVer verifier
npm run electron:build       # Standard portable & NSIS EXE (AhBiShare_OneClick_v1.3.1.exe)
npm run electron:build:lite  # Size-reduced Lite portable EXE (AhBiShare_OneClick-Lite_v1.3.1.exe)
npm run electron:build:win7  # Windows 7 SP1~8.1 portable EXE (AhBiShare_OneClick_Win7_v1.3.1.exe)
npm run electron:build:all   # Build Standard + Lite EXEs and compare file sizes
npm run version:bump -- patch --summary "Summary" --note "Detail"  # SemVer sync + patch notes
```

On Windows, running root `build.bat` verifies dependencies, executes `lint` and `verify`, builds Standard, Lite, and Win 7 portable EXEs plus the Inno Setup installer (`AhBiShare_OneClick-Setup_v1.3.1.exe`) with metadata-synced version suffixes, and opens the `release\` output folder.

### Lite Edition (`AhBiShare_OneClick-Lite_v1.3.1.exe`) Size Optimization (Win 7–11 Standalone)
- Excludes redundant `node_modules` already bundled by Vite from `app.asar`.
- Retains `ko` and `en-US` locales while pruning unused Chromium locale `.pak` files and large license HTML assets.
- Removes non-essential WebGPU DXC (`dxcompiler.dll`, `dxil.dll`) and Vulkan software rasterizer (`vk_swiftshader.dll`, `vulkan-1.dll`) binaries.
- Preserves essential Windows 7–11 runtime components (`icudtl.dat`, `ffmpeg.dll`, `libGLESv2.dll`, `libEGL.dll`, `d3dcompiler_47.dll`, `v8_context_snapshot.bin`) under maximum LZMA compression.

---

## 📁 Core Repository Layout

```text
├── .github/workflows/release.yml   # Windows x64 4-edition EXE CI build & versioned release publishing
├── docs/                           # Documentation hub, patch notes, SemVer policy, release & Blogger docs
├── installer/setup.iss             # Inno Setup multi-file installer script
├── scripts/
│   ├── bump_version.js             # 3-tier SemVer bump + PATCH_NOTES.md & docs auto-sync
│   ├── verify_portable_release.js  # 15-suite integrity, security, backup, sync & updater verifier
│   ├── build_lite_exe.js           # Standard / Lite portable build orchestrator
│   ├── build_win7_exe.js           # Windows 7 SP1~8.1 Electron 21 isolated build
│   ├── prune_electron_pack.js      # Lite edition locale & GPU binary pruning hook
│   └── upgradedHostGuestUnblock.bat# Win 11 24H2–26H2 coexistence & blank-password/guest unblocker
├── src/                            # React 19 + TypeScript UI, PowerShell engine & playbook services
├── main.js                         # Electron main process, PowerShell 2.0/5.1 runner, IPC & self-updater
├── preload.js                      # Secure contextBridge IPC APIs
├── portableStore.js                # AES-256-GCM portable, location, backup (20-cap rotation) & log store
├── portableUpdater.js              # Edition detector, PE(MZ) verifier & GitHub self-replace engine
└── build.bat                       # Windows 1-click local multi-edition build script
```

> Runtime files (`/backup/`, `/locations/`, `/log/`, `*.portable.json`, `*.location.json`, `*.backup.json`), build outputs (`/dist/`, `/release*/`), and local maintainer scripts (`push_github*.bat`, `build_release.bat`) are strictly excluded via `.gitignore`. See [`docs/github_release_guide.md`](docs/github_release_guide.md) for details.

---

## 📚 Official Documentation (`docs/`)

| Document | Purpose |
| :--- | :--- |
| [**`docs/README.md`**](docs/README.md) | Documentation hub & SemVer / verification quick reference |
| [**`docs/PATCH_NOTES.md`**](docs/PATCH_NOTES.md) | Latest changes & full `v1.0.0`–`v1.3.1` patch notes (CI release notes source) |
| [**`docs/VERSIONING.md`**](docs/VERSIONING.md) | Semantic Versioning (`MAJOR.MINOR.PATCH`) 3-tier policy |
| [**`docs/github_release_post.md`**](docs/github_release_post.md) | GitHub Releases & repository technical overview |
| [**`docs/github_release_guide.md`**](docs/github_release_guide.md) | Core Tree `.gitignore` rules & GitHub Actions CI release guide |
| [**`docs/google_blogger_post.md`**](docs/google_blogger_post.md) | Google Blogger Compose Mode & HTML Edit Mode drafts |
| [**`docs/blogger_post.html`**](docs/blogger_post.html) | Standalone inline-CSS HTML post for Blogger `[<> HTML 보기]` |

---

## 👨‍💻 Author & Official Links
- **Developer & Copyright**: **AhBiYout** (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **Organization**: [Cheongwoon Information System Co., Ltd. / (주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub Repository**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **Official Blog**: https://ahbiyoutvibe.blogspot.com/
- **License**: [MIT License](LICENSE)
