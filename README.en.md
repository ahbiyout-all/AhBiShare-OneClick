# AhBiShare OneClick v1.3.1

[한국어](README.md) | **English**

**AhBiShare OneClick** is a standalone web & Electron portable desktop utility that solves Windows LAN folder sharing (Host PC), one-click network drive mounting (Client PC), cross-PC SMB policy auto-alignment (Win 10/11), per-location configuration profiles with batch apply, and Windows 7/8/8.1 legacy OS compatibility bridges & offline `.bat`/`.reg` kit generation in a single click.

## Key Features

- **Host PC (1-Click Share Setup)**:
  - Switches network profile to Private and opens Windows Firewall TCP ports `445` and `139` inbound.
  - Automatically configures and starts `LanmanServer`, `FDResPub`, `fdPHost`, and `SSDPSrv`.
  - Supports both **No-Password Easy Mode** and **Account-Authenticated Security Mode** (with 5 one-click numeric-password office presets safe from built-in `Guest` collisions), expiring temporary share timers (`TTL`), generates `ABSHARE://` connection codes & QR codes, and provides an **Open in Explorer (`탐색기에서 열기`) action on ActiveShare items to launch the UNC path (`\\IP\Share`) directly**.
- **Client PC (1-Click & Manual Drive Mount)**:
  - Scans `/24` local subnet SMB `445` / NetBIOS hosts (with non-blocking 4s timeout `net view` auth-mode hint inference), performs **Smart Auth Detection (`detectSmartShareAuth` & `probeSmbTarget`: TTL cache, in-flight deduplication, automatic IPv4 `useEffect` probe, idle `IPC$` filtering, one-click conflicting `1219` session cleanup, cross-panel suppression sync, clear status notices, auto-switch to Account Mode, and 1-click undo)**, auto-fills portable credentials stored in `AhBiShare_OneClick.portable.json` (AES-256-GCM encrypted), and provides **multi-source IP/hostname credential resolution, easy numeric presets, password visibility toggles (eye icon), and a unified Refresh button across all 6 workspace tabs**.
  - Automatically diagnoses and mitigates Windows `0x80070035`, `1272`, `5`, and `1219` SMB errors before mounting drives.
- **Per-Location Profiles & 1-Click Batch Apply (`v1.3.1`)**:
  - Saves separate AES-256-GCM encrypted profiles (`locations/*.location.json`) per site (Office, Home, Field), preserves active account-authenticated client mounts/credentials in snapshots, supports `.json` export/import, **in-app profile content editing** (metadata, network hint, host shares, client drives, host preset with Windows SAM username validation), auto-fill, and **Pre-flight validated 1-click batch apply**.
- **OS Compatibility Matrix (Win 10 ~ Win 11 26H2)**:
  - Detects host-client policy mismatches in real time with **color-coded discrepancy badges**, provides a **10-point Security Rollback Audit Report** (with NTLM `LmCompatibilityLevel < 3` remediation and clean OS default loop prevention), includes an **Expert Raw Registry Comparison View** (local vs. target host side-by-side), offers **1-click batch auto-alignment**, and evaluates reboot requirements.
- **Legacy OS Sharing & Bidirectional Bridge (Win 7 · 8 · 8.1 ⇄ Win 10 · 11)**:
  - Provides a guided 2-step flow (**Step 1: Main Host PC** / **Step 2: Client PC**) with 1-click SMB 2.1/3.0 unencrypted compatibility bridging, 2-step acknowledged SMB 1.0 control (with Win 7 `mrxsmb10` symmetric rollback), snapshot + `forceguest=0` rollback, `Error 58` SMB encryption/dialect diagnostics, account-mode client guest-unlock skip, Win 7 `HNetCfg.FwPolicy2` profile detection, custom mounted drive options, **Open in Explorer (UNC)** for active shares, and **Step 2 auth/guest failure recovery actions (Diagnostics, instant Account Mode switch, Host unlock command)**.
  - Generates pure Windows 7 `cmd.exe`-compatible `.bat` (`[char]34`-safe quoting, baseline-first-then-backup overlay, locale-independent firewall rules) + UTF-16LE BOM `.reg` 4-file offline USB kits (with non-destructive write-safety probe & `atomicWriteBuffer` writes) and supports **Win 10/11 ⇄ Win 7/8 bidirectional JSON data bridging**.
- **GitHub Auto-Update Detection & USB-Safe Portable Self-Replace (`v1.3.1`)**:
  - Checks GitHub Releases (REST API + fault-tolerant Atom/`expanded_assets` fallback) and displays an update confirmation modal.
  - Detects the running portable edition (`Standard`, `Lite`, or `Win7`), verifies official GitHub download URLs and Windows PE (`MZ`) headers with cancel-race protection, enforces **USB write-safety hardening (zero write-protection injections, `wx` writability probes with `exit 4` self-update abort guard, and AV-lock safe `loadPortableData` without false `.corrupt` quarantining)**, and **terminates/removes the old portable EXE, replaces it with the new EXE, and relaunches automatically** while preserving `.portable.json` and `locations/`.
- **USB Bidirectional Error Handoff & 3-Step Troubleshooting Wizard (`v1.3.1`)**:
  - Saves sanitized host/client connection error tickets (`troubleshootTickets`, with `ABSHARE://` tokens and `/pass:` credentials masked) directly inside `AhBiShare_OneClick.portable.json`.
  - Moving the USB drive to the matching Host or Client PC automatically surfaces a top handoff banner and opens the **3-step interactive wizard** (`Cause & Status` · `Step-by-Step Host/Client Fixes` · `TCP 445 Verification & Completion`), with **bidirectional real-time sync (`SyncAwarePolicyBadge` `Policy Matched`)** between the OS Compatibility Matrix and Wizard and preserved history until manually cleared.
- **Automated Encrypted Backup & Point-in-Time Restore (`<appDir>/backup` · `BackupRestoreModal`) (`v1.3.1`)**:
  - Automatically and manually snapshots `.portable.json`, `locations/*.location.json`, and `troubleshootTickets` into `<appDir>/backup/*.backup.json` preserving AES-256-GCM ciphertexts with a 20-snapshot rotation cap (`BACKUP_MAX_SNAPSHOTS = 20`).
  - Creates pre-modify, pre-delete, pre-reset, and pre-restore safety backups (skipping identical content hashes) and provides a dedicated **Backup & Restore Modal** accessible from the Top Bar and Logs tab.

## Build, Verification & Semantic Versioning

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
npm run version:bump -- minor --summary "Summary" --note "Detail"  # SemVer sync + patch notes
```

On Windows, running root `build.bat` verifies dependencies, executes lint and release verification, builds Standard, Lite, and Win 7 portable EXEs plus the Inno Setup installer (`AhBiShare_OneClick-Setup_v1.3.1.exe`) with metadata-synced version suffixes, and opens the `release\` output folder.

### Lite Edition (`AhBiShare_OneClick-Lite_v1.3.1.exe`) Size Optimization (Win 7–11 Standalone)
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
- [Google Blogger HTML Post (`docs/blogger_post.html`)](docs/blogger_post.html)

## Author & Official Links
- **Developer & Copyright**: AhBiYout (`Copyright © 1998-2026 AhBiYout. All rights reserved.`)
- **Organization**: [Cheongwoon Information System Co., Ltd. / (주)청운정보시스템 (cisnet.co.kr)](https://www.cisnet.co.kr)
- **GitHub Repository**: https://github.com/ahbiyout-all/AhBiShare-OneClick
- **Official Blog**: https://ahbiyoutvibe.blogspot.com/
- **License**: [MIT License](LICENSE)
