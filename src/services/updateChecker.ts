import { APP_VERSION } from '@/version';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
  assets?: ReleaseAsset[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  release?: ReleaseInfo;
  checkedAt: string;
  source?: 'electron-ipc' | 'web-fetch';
  error?: string;
}

const GITHUB_REPO_API = 'https://api.github.com/repos/ahbiyout-all/AhBiShare-OneClick/releases/latest';
const GITHUB_RELEASES_URL = 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest';
const SKIPPED_UPDATE_TAG_KEY = 'ahbishare_skipped_update_tag_v1';

interface ParsedSemVer {
  nums: [number, number, number];
  preRelease: string;
}

function parseSemVer(verStr: string): ParsedSemVer {
  const withoutMeta = String(verStr || '').split('+')[0].replace(/^v/i, '').trim();
  const dashIdx = withoutMeta.indexOf('-');
  const core = dashIdx >= 0 ? withoutMeta.slice(0, dashIdx) : withoutMeta;
  const preRelease = dashIdx >= 0 ? withoutMeta.slice(dashIdx + 1) : '';
  const parts = core.split('.').map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  return {
    nums: [parts[0] || 0, parts[1] || 0, parts[2] || 0],
    preRelease,
  };
}

function comparePreRelease(curPre: string, remPre: string): number {
  const curParts = curPre.split('.');
  const remParts = remPre.split('.');
  const len = Math.max(curParts.length, remParts.length);
  for (let i = 0; i < len; i++) {
    const a = curParts[i];
    const b = remParts[i];
    if (a === undefined && b !== undefined) return 1;
    if (b === undefined && a !== undefined) return -1;
    if (a === b) continue;
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) {
      const diff = Number(b) - Number(a);
      if (diff !== 0) return diff > 0 ? 1 : -1;
      continue;
    }
    if (aNum && !bNum) return 1;
    if (!aNum && bNum) return -1;
    if (b > a) return 1;
    if (b < a) return -1;
  }
  return 0;
}

export function compareSemVer(current: string, remote: string): boolean {
  const cur = parseSemVer(current);
  const rem = parseSemVer(remote);

  for (let i = 0; i < 3; i++) {
    if (rem.nums[i] > cur.nums[i]) return true;
    if (rem.nums[i] < cur.nums[i]) return false;
  }
  // Same numeric major.minor.patch: stable release supersedes pre-release of the same number
  if (cur.preRelease && !rem.preRelease) return true;
  if (!cur.preRelease && rem.preRelease) return false;
  if (!cur.preRelease && !rem.preRelease) return false;
  return comparePreRelease(cur.preRelease, rem.preRelease) > 0;
}

export function getSkippedUpdateTag(): string {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(SKIPPED_UPDATE_TAG_KEY) || '' : '';
  } catch {
    return '';
  }
}

export function skipUpdateTag(tagName: string): void {
  try {
    if (typeof window !== 'undefined' && tagName) {
      window.localStorage.setItem(SKIPPED_UPDATE_TAG_KEY, tagName.trim());
    }
  } catch {}
}

export function clearSkippedUpdateTag(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SKIPPED_UPDATE_TAG_KEY);
    }
  } catch {}
}

export function shouldAutoPromptUpdate(tagName: string): boolean {
  const skipped = getSkippedUpdateTag();
  return !skipped || skipped.toLowerCase() !== String(tagName || '').trim().toLowerCase();
}

export type PortableEdition = 'standard' | 'lite' | 'win7';

export interface PortableUpdateRuntimeInfo {
  isPackaged: boolean;
  isPortable: boolean;
  canSelfReplace: boolean;
  edition: PortableEdition;
  currentVersion: string;
  portableExePath: string;
  portableDir: string;
  currentExeName: string;
  reason?: string;
}

export interface PortableUpdateProgress {
  phase: 'downloading' | 'verifying' | 'replacing' | 'error' | 'cancelled';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  message: string;
}

export function isPortableExeAsset(asset: ReleaseAsset): boolean {
  const lower = String(asset?.name || '').toLowerCase();
  return lower.endsWith('.exe') && !lower.includes('setup');
}

export function selectRecommendedPortableAsset(
  assets: ReleaseAsset[] = [],
  edition?: PortableEdition,
  osBuild?: number
): ReleaseAsset | undefined {
  const portableAssets = assets.filter(isPortableExeAsset);
  if (portableAssets.length === 0) return undefined;

  const isLegacyWin = edition === 'win7' || (typeof osBuild === 'number' && osBuild > 0 && osBuild < 10240);
  if (isLegacyWin) {
    const win7 = portableAssets.find((a) => a.name.toLowerCase().includes('win7'));
    if (win7) return win7;
  }
  if (edition === 'lite') {
    const lite = portableAssets.find((a) => a.name.toLowerCase().includes('lite'));
    if (lite) return lite;
  }
  const standard = portableAssets.find((a) => {
    const lower = a.name.toLowerCase();
    return !lower.includes('win7') && !lower.includes('lite');
  });
  return standard || portableAssets[0];
}

export async function getUpdateRuntimeInfo(): Promise<PortableUpdateRuntimeInfo | null> {
  if (!window.ahbiShareElectron?.getUpdateRuntimeInfo) return null;
  try {
    return await window.ahbiShareElectron.getUpdateRuntimeInfo();
  } catch {
    return null;
  }
}

export async function installPortableUpdate(asset: ReleaseAsset): Promise<{
  success: boolean;
  cancelled?: boolean;
  oldExePath?: string;
  targetExePath?: string;
  error?: string;
}> {
  if (!window.ahbiShareElectron?.installPortableUpdate) {
    return { success: false, error: 'Electron 데스크톱 앱에서만 포터블 자동 교체를 지원합니다.' };
  }
  return await window.ahbiShareElectron.installPortableUpdate({
    downloadUrl: asset.browserDownloadUrl,
    assetName: asset.name,
    expectedSize: asset.size,
  });
}

export async function cancelPortableUpdate(): Promise<{ success: boolean; cancelled: boolean }> {
  if (!window.ahbiShareElectron?.cancelPortableUpdate) {
    return { success: true, cancelled: false };
  }
  return await window.ahbiShareElectron.cancelPortableUpdate();
}

export function subscribeUpdateProgress(callback: (progress: PortableUpdateProgress) => void): () => void {
  if (!window.ahbiShareElectron?.onUpdateProgress) return () => {};
  return window.ahbiShareElectron.onUpdateProgress(callback);
}

export async function openExternalReleaseUrl(url: string): Promise<void> {
  const rawTarget = String(url || '').trim();
  const target = /^https?:\/\//i.test(rawTarget) ? rawTarget : GITHUB_RELEASES_URL;
  if (window.ahbiShareElectron?.openExternalUrl) {
    const res = await window.ahbiShareElectron.openExternalUrl(target);
    if (res.success) return;
  }
  const a = document.createElement('a');
  a.href = target;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function checkForUpdates(currentVersion: string = APP_VERSION): Promise<UpdateCheckResult> {
  const checkedAt = new Date().toISOString();

  // Prefer Electron Main Process HTTPS query (handles Win 7 TLS, custom User-Agent & Atom feed fallback)
  if (window.ahbiShareElectron?.checkGitHubUpdates) {
    try {
      const ipcRes = await window.ahbiShareElectron.checkGitHubUpdates();
      if (ipcRes?.ok) {
        if (!ipcRes.release?.tagName) {
          return {
            hasUpdate: false,
            checkedAt,
            source: 'electron-ipc',
          };
        }
        const hasUpdate = compareSemVer(currentVersion, ipcRes.release.tagName);
        return {
          hasUpdate,
          ...(hasUpdate ? { release: ipcRes.release } : {}),
          checkedAt,
          source: 'electron-ipc',
        };
      }
      if (ipcRes && ipcRes.ok === false) {
        return {
          hasUpdate: false,
          checkedAt,
          source: 'electron-ipc',
          error: ipcRes.error || 'GitHub 릴리즈 조회 실패',
        };
      }
    } catch (err) {
      console.warn('[UpdateChecker] Electron IPC query failed, falling back to fetch:', err);
    }
  }

  try {
    const res = await fetch(GITHUB_REPO_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { hasUpdate: false, checkedAt, source: 'web-fetch', error: `GitHub API HTTP ${res.status}` };
    }
    const data = await res.json();
    const tagName = String(data.tag_name || '').trim();
    if (!tagName) return { hasUpdate: false, checkedAt, source: 'web-fetch' };

    const hasUpdate = compareSemVer(currentVersion, tagName);
    if (hasUpdate) {
      const assets: ReleaseAsset[] = Array.isArray(data.assets)
        ? data.assets
            .filter((a: any) => a && a.name && a.browser_download_url)
            .map((a: any) => ({
              name: String(a.name),
              browserDownloadUrl: String(a.browser_download_url),
              size: Number(a.size) || 0,
            }))
        : [];
      return {
        hasUpdate: true,
        release: {
          tagName,
          name: String(data.name || tagName),
          body: String(data.body || '새로운 업데이트가 출시되었습니다.'),
          htmlUrl: String(data.html_url || GITHUB_RELEASES_URL),
          publishedAt: String(data.published_at || ''),
          assets,
        },
        checkedAt,
        source: 'web-fetch',
      };
    }
    return { hasUpdate: false, checkedAt, source: 'web-fetch' };
  } catch (err) {
    console.warn('[UpdateChecker] Failed to query GitHub releases:', err);
    return {
      hasUpdate: false,
      checkedAt,
      source: 'web-fetch',
      error: err instanceof Error ? err.message : 'GitHub 릴리즈 조회 실패',
    };
  }
}
