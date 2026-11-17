export interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
}

const GITHUB_REPO_API = 'https://api.github.com/repos/ahbiyout-all/AhBiShare-OneClick/releases/latest';

function parseSemVer(verStr: string): [number, number, number] {
  const clean = verStr.replace(/^v/i, '').split('-')[0].trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function compareSemVer(current: string, remote: string): boolean {
  const [curMaj, curMin, curPat] = parseSemVer(current);
  const [remMaj, remMin, remPat] = parseSemVer(remote);

  if (remMaj > curMaj) return true;
  if (remMaj === curMaj && remMin > curMin) return true;
  if (remMaj === curMaj && remMin === curMin && remPat > curPat) return true;
  return false;
}

export async function checkForUpdates(currentVersion: string = '1.0.0'): Promise<{ hasUpdate: boolean; release?: ReleaseInfo }> {
  try {
    const res = await fetch(GITHUB_REPO_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return { hasUpdate: false };
    const data = await res.json();
    const tagName = data.tag_name || '';
    if (!tagName) return { hasUpdate: false };

    const hasUpdate = compareSemVer(currentVersion, tagName);
    if (hasUpdate) {
      return {
        hasUpdate: true,
        release: {
          tagName,
          name: data.name || tagName,
          body: data.body || '새로운 업데이트가 출시되었습니다.',
          htmlUrl: data.html_url || 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases',
          publishedAt: data.published_at || '',
        },
      };
    }
  } catch (err) {
    console.warn('[UpdateChecker] Failed to query GitHub releases:', err);
  }
  return { hasUpdate: false };
}
