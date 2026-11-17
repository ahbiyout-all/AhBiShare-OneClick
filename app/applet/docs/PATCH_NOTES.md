# 🛠 AhBiShare OneClick Patch Notes & Version History

## 📅 Version SemVer 1.0.0 (Standalone Production Release)
- **Release Date**: November 16, 2026
- **Developer**: AhBiYout
- **Organization**: (주)청운정보시스템 (cisnet.co.kr)

### Major Features & Improvements
1. **Independent App Architecture (`v1.0.0`)**:
   - Streamlined standalone architecture for `AhBiShare OneClick` with React 19, Vite, and Electron.
   - Robust PowerShell execution engine supporting Windows 7 SP1 through Windows 11 26H2.
2. **Legacy OS Sharing & Offline Kits**:
   - Tabbed Main (Step 1) & Client (Step 2) legacy sharing workflow.
   - 1-click compatibility bridge + folder sharing / drive mapping.
   - USB offline 4-file `.bat/.reg` kit generator and snapshot-based rollback.
3. **Multi-EXE Build Pipeline & Lite Version**:
   - Standard Portable EXE (`AhBiShare_OneClick_v1.0.0.exe`) and Size-Reduced Lite Portable EXE (`AhBiShare_OneClick-Lite_v1.0.0.exe`).
   - Automated pruning of unused Chromium locales (`ko`, `en-US` kept), WebGPU DXC, and Vulkan software rasterizers while keeping Win 7–11 core DLLs intact.
4. **Professional Inno Setup Installer**:
   - Unpacked multi-file installation, forced process termination (`taskkill`), uninstall/overwrite prompt, desktop shortcut, Add/Remove Programs registry registration, and silent firewall rule registration.
5. **GitHub Releases Real-Time Auto-Update System**:
   - Built-in GitHub releases API checker (`https://api.github.com/repos/ahbiyout-all/AhBiShare-OneClick/releases/latest`) with popup notification.
