const fs = require('fs');
const path = require('path');

const KEEP_LOCALES = new Set(['ko.pak', 'en-us.pak']);

// Non-essential Electron/Chromium files for a Win 7~11 2D DOM desktop utility:
// - LICENSES.chromium.html / LICENSE.electron.txt (~19 MB static license text)
// - dxcompiler.dll / dxil.dll (~26.5 MB WebGPU HLSL compiler, unused by standard DOM UI)
// - vk_swiftshader* / vulkan-1.dll (~6.3 MB Vulkan software rasterizer fallback)
// Note: ffmpeg.dll, libGLESv2.dll, libEGL.dll, d3dcompiler_47.dll, icudtl.dat,
// v8_context_snapshot.bin, snapshot_blob.bin, resources.pak, chrome_*_percent.pak
// are preserved for full Windows 7 SP1 ~ Windows 11 26H2 runtime compatibility.
const PRUNABLE_ROOT_FILES = new Set([
  'licenses.chromium.html',
  'license.electron.txt',
  'dxcompiler.dll',
  'dxil.dll',
  'vk_swiftshader.dll',
  'vk_swiftshader_icd.json',
  'vulkan-1.dll',
]);

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

module.exports = async function pruneElectronPack(context) {
  if (process.env.AHBISHARE_SKIP_PRUNE === '1') {
    console.log('[pruneElectronPack] Skipped via AHBISHARE_SKIP_PRUNE=1');
    return;
  }

  const appOutDir = context?.appOutDir;
  if (!appOutDir || !fs.existsSync(appOutDir)) {
    return;
  }

  let removedCount = 0;
  let removedBytes = 0;

  // 1. Prune unused Chromium locales (keep only ko.pak and en-US.pak)
  const localesDir = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir)) {
      if (!KEEP_LOCALES.has(entry.toLowerCase())) {
        const target = path.join(localesDir, entry);
        try {
          const stat = fs.statSync(target);
          if (stat.isFile()) {
            fs.unlinkSync(target);
            removedCount++;
            removedBytes += stat.size;
          }
        } catch (err) {
          console.warn(`[pruneElectronPack] Warning removing locale ${entry}: ${err.message}`);
        }
      }
    }
  }

  // 2. Prune non-essential root files (licenses, WebGPU DXC, Vulkan software rasterizer)
  for (const entry of fs.readdirSync(appOutDir)) {
    if (PRUNABLE_ROOT_FILES.has(entry.toLowerCase())) {
      const target = path.join(appOutDir, entry);
      try {
        const stat = fs.statSync(target);
        if (stat.isFile()) {
          fs.unlinkSync(target);
          removedCount++;
          removedBytes += stat.size;
        }
      } catch (err) {
        console.warn(`[pruneElectronPack] Warning removing ${entry}: ${err.message}`);
      }
    }
  }

  console.log(
    `[pruneElectronPack] Removed ${removedCount} non-essential files (${formatMb(removedBytes)} unpacked saved) from ${path.basename(appOutDir)}`
  );
};
