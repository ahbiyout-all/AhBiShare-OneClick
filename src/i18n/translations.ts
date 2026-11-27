import { AppLocale } from '@/types/share';

export const TRANSLATIONS = {
  // Navigation & TopBar
  'topbar.brand': { ko: 'AhBiShare OneClick', en: 'AhBiShare OneClick' },
  'topbar.nav.host': { ko: '공유 개설', en: 'Host Share' },
  'topbar.nav.client': { ko: '클라이언트 연결', en: 'Client Mount' },
  'topbar.nav.matrix': { ko: 'OS 호환성 매트릭스', en: 'OS Matrix' },
  'topbar.nav.legacy': { ko: '구형 OS 공유', en: 'Legacy OS' },
  'topbar.nav.logs': { ko: '실행 이력', en: 'Activity Logs' },
  'topbar.nav.rollback': { ko: '보안 원복', en: 'Security Rollback' },
  'topbar.btn.update': { ko: '업데이트 {{tag}}', en: 'Update {{tag}}' },
  'topbar.btn.backup': { ko: '백업·복원', en: 'Backup' },
  'topbar.btn.backupTitle': {
    ko: '앱 폴더 하위 backup 폴더 백업·복원 관리',
    en: 'Manage backups and restore snapshots in the backup folder',
  },
  'topbar.btn.diagnostics': { ko: '네트워크 진단', en: 'Diagnostics' },
  'topbar.lang.label': { ko: '언어 전환 (한국어 / English)', en: 'Switch language (Korean / English)' },
  'topbar.lang.ko': { ko: '한국어', en: '한국어' },
  'topbar.lang.en': { ko: 'English', en: 'English' },

  // Document Meta
  'app.docTitle': {
    ko: 'AhBiShare OneClick — 메인·클라이언트 원클릭 공유폴더',
    en: 'AhBiShare OneClick — One-Click Host & Client SMB Folder Sharing',
  },

  // Common Actions & Status
  'common.close': { ko: '닫기', en: 'Close' },
  'common.cancel': { ko: '취소', en: 'Cancel' },
  'common.confirm': { ko: '확인', en: 'Confirm' },
  'common.save': { ko: '저장', en: 'Save' },
  'common.apply': { ko: '적용', en: 'Apply' },
  'common.refresh': { ko: '새로고침', en: 'Refresh' },
  'common.delete': { ko: '삭제', en: 'Delete' },
  'common.copy': { ko: '복사', en: 'Copy' },
  'common.copied': { ko: '복사됨', en: 'Copied' },
  'common.openFolder': { ko: '탐색기에서 열기', en: 'Open in Explorer' },
  'common.loading': { ko: '불러오는 중...', en: 'Loading...' },
  'common.running': { ko: '실행 중...', en: 'Running...' },
  'common.admin': { ko: '관리자 권한', en: 'Administrator' },
  'common.standardUser': { ko: '표준 권한', en: 'Standard User' },
  'common.portableMode': { ko: 'USB 포터블 동기화', en: 'USB Portable Sync' },
  'common.previewMode': { ko: '브라우저 미리보기 모드', en: 'Browser Preview Mode' },
  'common.guestMode': { ko: '누구나(Guest)', en: 'Guest (Anyone)' },
  'common.accountMode': { ko: '보안 계정', en: 'Account Auth' },
  'common.readFull': { ko: '읽기/쓰기(Full)', en: 'Full Control' },
  'common.readOnly': { ko: '읽기 전용(Read)', en: 'Read Only' },

  // Logs Tab
  'logs.title': { ko: '실행 이력', en: 'Activity Logs' },
  'logs.subtitle': {
    ko: '공유 개설, 드라이브 연결, 원복, 호환성 패치 작업 내역 및 파일 로그를 조회합니다.',
    en: 'Inspect share creation, drive mounting, security rollback, policy patches, and USB log files.',
  },
  'logs.clearSession': { ko: '세션 이력 지우기', en: 'Clear Session' },
  'logs.empty': {
    ko: '아직 실행된 공유폴더 개설·연결 작업 이력이 없습니다.',
    en: 'No share creation, drive mount, or policy actions have been recorded yet.',
  },
  'logs.fileSectionTitle': {
    ko: '포터블 로컬 파일 로그 (log\\AhBiShare_YYYY-MM-DD.log)',
    en: 'Portable Local Log Files (log\\AhBiShare_YYYY-MM-DD.log)',
  },
  'logs.openFolder': { ko: '로그 폴더 열기', en: 'Open Log Folder' },

  // Footer
  'footer.copyright': {
    ko: 'Copyright © 2026 AhBiYout. All rights reserved.',
    en: 'Copyright © 2026 AhBiYout. All rights reserved.',
  },
  'footer.checkUpdate': { ko: '업데이트 확인', en: 'Check Updates' },
  'footer.openSource': { ko: '오픈소스', en: 'Open Source' },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;

export function translateKey(
  locale: AppLocale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const entry = TRANSLATIONS[key];
  let template: string = entry ? entry[locale] : key;
  if (vars) {
    for (const [varKey, varVal] of Object.entries(vars)) {
      template = template.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), String(varVal));
    }
  }
  return template;
}
