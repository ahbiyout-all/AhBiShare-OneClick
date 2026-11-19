/**
 * AhBiShare OneClick - Semantic Versioning (MAJOR.MINOR.PATCH) Manager & Auto Patch-Note Recorder
 * Usage:
 *   node scripts/bump_version.js <major|minor|patch> --summary "요약 제목" --note "변경 내용 1" --note "변경 내용 2"
 *   node scripts/bump_version.js patch --summary "Win7 호환성 수정" --dry-run
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function parseSemVerStrict(ver) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(ver || '').trim());
  if (!m) {
    throw new Error(`Invalid SemVer string: "${ver}" (expected MAJOR.MINOR.PATCH)`);
  }
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
  };
}

function computeNextSemVer(currentVersion, level) {
  const parsed = parseSemVerStrict(currentVersion);
  const normalizedLevel = String(level || '').toLowerCase().trim();
  if (normalizedLevel === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (normalizedLevel === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  if (normalizedLevel === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
  throw new Error(`Unsupported version bump level: "${level}". Must be "major", "minor", or "patch".`);
}

function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatPatchNoteSection({ version, level, dateStr, summary, notes }) {
  const badge = level.toUpperCase();
  const levelLabel =
    badge === 'MAJOR'
      ? '호환 구조 개편 (MAJOR)'
      : badge === 'MINOR'
        ? '하위 호환 신규 기능 추가 (MINOR)'
        : '버그 수정 · 보안 및 호환성 패치 (PATCH)';
  const safeSummary = summary || levelLabel;
  const items =
    Array.isArray(notes) && notes.length > 0
      ? notes.map((n, idx) => `${idx + 1}. ${String(n).trim()}`)
      : [`1. ${safeSummary}`];

  return [
    `## 📅 v${version} (${dateStr}) — [${badge}] ${safeSummary}`,
    `- **변경 구분**: \`${badge}\` (${levelLabel})`,
    `- **개발자 · 저작권**: AhBiYout · (주)청운정보시스템 (cisnet.co.kr)`,
    `- **배포 파일**: \`AhBiShare_OneClick_v${version}.exe\`, \`AhBiShare_OneClick-Lite_v${version}.exe\`, \`AhBiShare_OneClick_Win7_v${version}.exe\`, \`AhBiShare_OneClick-Setup_v${version}.exe\``,
    '',
    '### 주요 변경 및 특이점 기록',
    ...items,
    '',
  ].join('\n');
}

function prependPatchNoteEntry(patchNotesContent, sectionMarkdown) {
  const headerMarker = '# 🛠 AhBiShare OneClick 패치 노트 (Patch Notes)';
  const raw = String(patchNotesContent || '');
  if (raw.includes(headerMarker)) {
    const idx = raw.indexOf(headerMarker) + headerMarker.length;
    const before = raw.slice(0, idx);
    const after = raw.slice(idx).replace(/^\r?\n+/, '');
    return `${before}\n\n${sectionMarkdown}\n${after}`;
  }
  return `${headerMarker}\n\n${sectionMarkdown}\n${raw}`;
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  let level = '';
  let summary = '';
  const notes = [];
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--type' && args[i + 1]) {
      level = args[++i];
    } else if (a === '--summary' && args[i + 1]) {
      summary = args[++i];
    } else if (a === '--note' && args[i + 1]) {
      notes.push(args[++i]);
    } else if (!a.startsWith('-') && !level) {
      level = a;
    }
  }
  return { level, summary, notes, dryRun };
}

function runBump({ level, summary, notes, dryRun = false, targetRoot = rootDir } = {}) {
  const pkgPath = path.join(targetRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const nextVersion = computeNextSemVer(currentVersion, level);
  const dateStr = getTodayIsoDate();
  const normalizedLevel = String(level).toLowerCase().trim();

  const updatedFiles = [];

  // 1. package.json
  pkg.version = nextVersion;
  if (!dryRun) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
  updatedFiles.push('package.json');

  // 2. public/config.json
  const cfgPath = path.join(targetRoot, 'public', 'config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.version = nextVersion;
    if (!dryRun) {
      fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    }
    updatedFiles.push('public/config.json');
  }

  // 3. src/version.ts & main.js fallback
  const versionTsPath = path.join(targetRoot, 'src', 'version.ts');
  if (fs.existsSync(versionTsPath)) {
    if (!dryRun) {
      fs.writeFileSync(versionTsPath, `export const APP_VERSION = '${nextVersion}';\n`, 'utf8');
    }
    updatedFiles.push('src/version.ts');
  }
  const mainJsPath = path.join(targetRoot, 'main.js');
  if (fs.existsSync(mainJsPath)) {
    const mainJsSrc = fs.readFileSync(mainJsPath, 'utf8');
    const curEscMain = currentVersion.replace(/\./g, '\\.');
    const nextMainJs = mainJsSrc.replace(
      new RegExp(`(require\\('\\./package\\.json'\\)\\.version \\|\\| )'${curEscMain}'([\\s\\S]{0,60}?return )'${curEscMain}'`),
      `$1'${nextVersion}'$2'${nextVersion}'`
    );
    if (nextMainJs !== mainJsSrc) {
      if (!dryRun) {
        fs.writeFileSync(mainJsPath, nextMainJs, 'utf8');
      }
      updatedFiles.push('main.js');
    }
  }

  // 4. installer/setup.iss
  const issPath = path.join(targetRoot, 'installer', 'setup.iss');
  if (fs.existsSync(issPath)) {
    const issSrc = fs.readFileSync(issPath, 'utf8');
    const nextIss = issSrc.replace(/#define AppVersion "[^"]+"/g, `#define AppVersion "${nextVersion}"`);
    if (!dryRun) {
      fs.writeFileSync(issPath, nextIss, 'utf8');
    }
    updatedFiles.push('installer/setup.iss');
  }

  // 5. build.bat, build_release.bat, push_github.bat
  for (const batName of ['build.bat', 'build_release.bat', 'push_github.bat']) {
    const batPath = path.join(targetRoot, batName);
    if (fs.existsSync(batPath)) {
      const batSrc = fs.readFileSync(batPath, 'utf8');
      const nextBat = batSrc.replace(/if "%APP_VER%"=="" set "APP_VER=[^"]+"/g, `if "%APP_VER%"=="" set "APP_VER=${nextVersion}"`);
      if (!dryRun) {
        fs.writeFileSync(batPath, nextBat, 'utf8');
      }
      updatedFiles.push(batName);
    }
  }

  // 6. README.md & README.en.md
  for (const readmeRel of ['README.md', 'README.en.md']) {
    const readmePath = path.join(targetRoot, readmeRel);
    if (fs.existsSync(readmePath)) {
      const readmeSrc = fs.readFileSync(readmePath, 'utf8');
      const verRegex = new RegExp(`v${currentVersion.replace(/\./g, '\\.')}`, 'g');
      const nextReadme = readmeSrc.replace(verRegex, `v${nextVersion}`);
      if (!dryRun) {
        fs.writeFileSync(readmePath, nextReadme, 'utf8');
      }
      updatedFiles.push(readmeRel);
    }
  }

  // 7. docs/PATCH_NOTES.md
  const patchPath = path.join(targetRoot, 'docs', 'PATCH_NOTES.md');
  if (fs.existsSync(patchPath)) {
    const patchSrc = fs.readFileSync(patchPath, 'utf8');
    const section = formatPatchNoteSection({
      version: nextVersion,
      level: normalizedLevel,
      dateStr,
      summary,
      notes,
    });
    const nextPatch = prependPatchNoteEntry(patchSrc, section);
    if (!dryRun) {
      fs.writeFileSync(patchPath, nextPatch, 'utf8');
    }
    updatedFiles.push('docs/PATCH_NOTES.md');
  }

  // 8. docs/google_blogger_post.md & docs/github_release_post.md latest version tag sync
  for (const docRel of ['docs/google_blogger_post.md', 'docs/github_release_post.md']) {
    const docPath = path.join(targetRoot, docRel);
    if (fs.existsSync(docPath)) {
      const docSrc = fs.readFileSync(docPath, 'utf8');
      const curEsc = currentVersion.replace(/\./g, '\\.');
      const nextDoc = docSrc
        .replace(new RegExp(`(AhBiShare OneClick )v${curEsc}`, 'g'), `$1v${nextVersion}`)
        .replace(new RegExp(`(AhBiShare_OneClick(?:_Win7|-Lite|-Setup)?_)v${curEsc}`, 'g'), `$1v${nextVersion}`)
        .replace(new RegExp(`(최신 버전</strong>: )v${curEsc}`, 'g'), `$1v${nextVersion}`)
        .replace(new RegExp(`(현재 버전\\*\\*: )v${curEsc}`, 'g'), `$1v${nextVersion}`)
        .replace(new RegExp(`(이번 업데이트 주요 내용 \\()v${curEsc}`, 'g'), `$1v${nextVersion}`);
      if (!dryRun) {
        fs.writeFileSync(docPath, nextDoc, 'utf8');
      }
      updatedFiles.push(docRel);
    }
  }

  return {
    previousVersion: currentVersion,
    nextVersion,
    level: normalizedLevel,
    dateStr,
    dryRun,
    updatedFiles,
  };
}

if (require.main === module) {
  const cli = parseCliArgs(process.argv);
  if (!cli.level) {
    console.error('Usage: node scripts/bump_version.js <major|minor|patch> --summary "..." --note "..." [--dry-run]');
    process.exit(1);
  }
  const result = runBump(cli);
  console.log(`[SemVer] ${result.previousVersion} -> ${result.nextVersion} (${result.level.toUpperCase()})${result.dryRun ? ' [DRY RUN]' : ''}`);
  console.log('[SemVer] Synced files:', result.updatedFiles.join(', '));
}

module.exports = {
  parseSemVerStrict,
  computeNextSemVer,
  formatPatchNoteSection,
  prependPatchNoteEntry,
  runBump,
};
