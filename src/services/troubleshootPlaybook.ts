import {
  ActiveShare,
  AuthMode,
  DiscoveredPeer,
  HostPolicySnapshot,
  LocalNetworkInfo,
  MountedDrive,
  OsNetworkPolicyStatus,
  PolicyPatchMode,
  PortableHostShareEntry,
  RoleMode,
  TroubleshootMatchResult,
  TroubleshootStepResolvedSource,
  TroubleshootStepStatus,
  TroubleshootSyncSummary,
  TroubleshootTicket,
  TroubleshootTicketStatus,
  TroubleshootWizardStep,
} from '@/types/share';
import { classifyFailureDiagnostics } from '@/services/networkEvolution';
import { buildHostGuestUnlockPsCommand } from '@/services/powershellEngine';

export interface BuildTroubleshootTicketInput {
  originRole: RoleMode;
  netInfo: LocalNetworkInfo;
  errorMessage: string;
  targetHost?: string;
  targetHostNameHint?: string;
  targetIpHint?: string;
  shareName?: string;
  folderPath?: string;
  driveLetter?: string;
  authMode: AuthMode;
  isLegacyOs?: boolean;
  portableShares?: PortableHostShareEntry[];
  hostPolicySnapshots?: Record<string, HostPolicySnapshot>;
  peers?: DiscoveredPeer[];
  activeShares?: ActiveShare[];
  localMachineSidPrefix?: string;
  duplicateSidEvent6167Detected?: boolean;
}

function isIpv4Like(val?: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test((val || '').trim());
}

export function sanitizeTroubleshootErrorSummary(rawText?: string, maxLength = 500): string {
  if (!rawText) return '';
  let text = String(rawText).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  text = text
    .replace(/ABSHARE:\/\/[A-Za-z0-9+/=_-]+/gi, 'ABSHARE://[REDACTED]')
    .replace(/(cmdkey(?:\.exe)?\s+\/add:\S+\s+\/user:\S+\s+\/pass:)\S+/gi, '$1[REDACTED]')
    .replace(/(\/pass(?:word)?\s*:\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(\/user(?:name)?\s*:\s*\S+\s+)([^\s/"']+|"[^"]*"|'[^']*')/gi, '$1[REDACTED]')
    .replace(/(ConvertTo-SecureString\s+)(?:-String\s+)?(['"])[^'"]*\2/gi, "$1'[REDACTED]'")
    .replace(/\b(password|passwd|pwd|pw|암호|비밀번호)\s*([:=])\s*(?!\[REDACTED\])(['"]?)[^\s,;'"|)]+\3/gi, '$1$2[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength > 0 && text.length > maxLength) {
    text = `${text.slice(0, maxLength - 3).trimEnd()}...`;
  }
  return text;
}

function classifyHostErrorCode(errorMessage: string): { code: string; title: string } {
  const raw = errorMessage || '';
  if (/관리자|administrator|access is denied|액세스.*거부|권한/i.test(raw)) {
    return {
      code: 'Host Permission Error',
      title: '호스트 관리자 권한 또는 폴더 ACL 접근 권한 부족',
    };
  }
  if (/방화벽|firewall|445/i.test(raw)) {
    return {
      code: 'Host Firewall 445',
      title: '호스트 TCP 445 인바운드 방화벽 규칙 차단',
    };
  }
  if (/lanmanserver|server 서비스|srv|서비스/i.test(raw)) {
    return {
      code: 'Host Service Stopped',
      title: '호스트 SMB Server(LanmanServer) 서비스 중지됨',
    };
  }
  if (/폴더|경로|not found|enoent|directory/i.test(raw)) {
    return {
      code: 'Host Folder Missing',
      title: '공유 대상 로컬 폴더 경로 확인 필요',
    };
  }
  if (/legacy|브릿지|encryptdata|smb1|서명/i.test(raw)) {
    return {
      code: 'Host Legacy Bridge',
      title: '구형 OS 호환 SMB 브릿지 정책 적용 실패',
    };
  }
  return {
    code: 'Host Setup Error',
    title: '호스트 SMB 공유폴더 구성 단계 오류',
  };
}

function resolveTargetIdentity(input: BuildTroubleshootTicketInput): {
  targetHostName: string;
  targetIp: string;
  shareName: string;
} {
  const cleanShare = (input.shareName || 'AhBiShared').trim() || 'AhBiShared';
  if (input.originRole === 'host') {
    return {
      targetHostName: (input.targetHostNameHint || input.netInfo.hostname || 'MAIN-HOST-PC').trim(),
      targetIp: (input.targetIpHint || input.netInfo.primaryIp || '').trim(),
      shareName: cleanShare,
    };
  }

  const rawTarget = (input.targetHost || '').trim();
  let resolvedHostName = (input.targetHostNameHint || '').trim();
  let resolvedIp = (input.targetIpHint || '').trim();

  if (isIpv4Like(rawTarget)) {
    if (!resolvedIp) resolvedIp = rawTarget;
  } else if (rawTarget) {
    if (!resolvedHostName) resolvedHostName = rawTarget;
  }

  const targetLower = rawTarget.toLowerCase();
  const shareLower = cleanShare.toLowerCase();

  // Cross-reference USB portable shares
  for (const ps of input.portableShares || []) {
    const hostMatch =
      (targetLower &&
        ((ps.sourceIp || '').trim().toLowerCase() === targetLower ||
          (ps.sourceHostName || '').trim().toLowerCase() === targetLower)) ||
      (!targetLower && ps.shareName.trim().toLowerCase() === shareLower);
    if (hostMatch) {
      if (!resolvedHostName && ps.sourceHostName) resolvedHostName = ps.sourceHostName.trim();
      if (!resolvedIp && ps.sourceIp) resolvedIp = ps.sourceIp.trim();
      if (ps.shareName.trim().toLowerCase() === shareLower) break;
    }
  }

  // Cross-reference discovered LAN peers
  for (const peer of input.peers || []) {
    const match =
      targetLower &&
      (peer.ipAddress.trim().toLowerCase() === targetLower || peer.hostName.trim().toLowerCase() === targetLower);
    if (match) {
      if (!resolvedHostName && peer.hostName) resolvedHostName = peer.hostName.trim();
      if (!resolvedIp && peer.ipAddress) resolvedIp = peer.ipAddress.trim();
      break;
    }
  }

  // Cross-reference saved HostPolicySnapshot map
  for (const snap of Object.values(input.hostPolicySnapshots || {})) {
    const match =
      targetLower &&
      ((snap.sourceIp || '').trim().toLowerCase() === targetLower ||
        snap.hostName.trim().toLowerCase() === targetLower);
    if (match) {
      if (!resolvedHostName && snap.hostName) resolvedHostName = snap.hostName.trim();
      if (!resolvedIp && snap.sourceIp) resolvedIp = snap.sourceIp.trim();
      break;
    }
  }

  // Fallback cross-reference on activeShares
  for (const sh of input.activeShares || []) {
    const match =
      targetLower &&
      ((sh.sourceIp || '').trim().toLowerCase() === targetLower ||
        (sh.sourceHostName || '').trim().toLowerCase() === targetLower);
    if (match) {
      if (!resolvedHostName && sh.sourceHostName) resolvedHostName = sh.sourceHostName.trim();
      if (!resolvedIp && sh.sourceIp) resolvedIp = sh.sourceIp.trim();
      break;
    }
  }

  return {
    targetHostName: resolvedHostName || (isIpv4Like(rawTarget) ? '' : rawTarget),
    targetIp: resolvedIp || (isIpv4Like(rawTarget) ? rawTarget : ''),
    shareName: cleanShare,
  };
}

function stepRequiresRebootByDefinition(
  executor: TroubleshootWizardStep['executor'],
  patchMode?: PolicyPatchMode
): boolean {
  return (
    executor === 'enable_smbv1_client' ||
    patchMode === 'kir_duplicate_sid_compat' ||
    patchMode === 'enable_smbv1_client' ||
    patchMode === 'legacy_smb1_enable' ||
    patchMode === 'deep_stack_reset'
  );
}

function makeStep(
  side: 'host' | 'client',
  order: number,
  partial: Omit<TroubleshootWizardStep, 'stepId' | 'side' | 'order' | 'status'>
): TroubleshootWizardStep {
  const requiresReboot =
    typeof partial.requiresReboot === 'boolean'
      ? partial.requiresReboot
      : stepRequiresRebootByDefinition(partial.executor, partial.patchMode);
  return {
    stepId: `${side}-${order}-${partial.executor}`,
    side,
    order,
    status: 'pending',
    ...(requiresReboot ? { requiresReboot: true } : {}),
    ...partial,
  };
}

export function buildTroubleshootTicketDraft(input: BuildTroubleshootTicketInput): TroubleshootTicket {
  const nowIso = new Date().toISOString();
  const { targetHostName, targetIp, shareName } = resolveTargetIdentity(input);
  const cleanedSummary = sanitizeTroubleshootErrorSummary(input.errorMessage || '연결 또는 공유 구성 오류 발생');
  const hostUnlockCmd = buildHostGuestUnlockPsCommand(shareName);
  const normalizedTargetForDisplay = targetIp || targetHostName || '대상 호스트';

  let errorCode = 'Mount Diagnostic';
  let errorTitle = '네트워크 공유 연결 오류';
  let recommendedSide: 'host' | 'client' | 'both' = 'both';
  let hostSteps: TroubleshootWizardStep[] = [];
  let clientSteps: TroubleshootWizardStep[] = [];

  if (input.originRole === 'host') {
    const hostDiag = classifyHostErrorCode(cleanedSummary);
    errorCode = hostDiag.code;
    errorTitle = hostDiag.title;
    recommendedSide = 'host';

    if (input.isLegacyOs) {
      hostSteps.push(
        makeStep('host', 1, {
          executor: 'apply_legacy_bridge',
          patchMode: 'legacy_bridge_compat',
          title: '구형 OS SMB 2.1/3.0 호환 브릿지 정책 정렬',
          description: 'EncryptData=0 · 서명 완화 · NTLMv2 고정 및 LanmanServer/방화벽 445 규칙을 정렬합니다.',
        })
      );
    } else {
      hostSteps.push(
        makeStep('host', 1, {
          executor: 'apply_safe_compat',
          patchMode: 'safe_compat',
          title: '호스트 SMB 서비스(LanmanServer) 및 TCP 445 방화벽 개방',
          description: '공유 서비스 가동 상태, 개인 네트워크 프로필 전환 및 TCP 445 인바운드 규칙을 복구합니다.',
        })
      );
    }

    if (input.authMode === 'guest') {
      hostSteps.push(
        makeStep('host', hostSteps.length + 1, {
          executor: 'host_guest_unlock_and_reopen',
          title: '호스트 Guest 무비밀번호 차단 해제 및 ACL 권한 정렬',
          description: 'LimitBlankPasswordUse=0 · SeDenyNetworkLogonRight 정리 · Guest 활성화 및 공유 권한을 재정렬합니다.',
          commandPreview: hostUnlockCmd,
        })
      );
    }

    hostSteps.push(
      makeStep('host', hostSteps.length + 1, {
        executor: 'retry_host_share',
        title: `'${shareName}' SMB 공유폴더 원클릭 재개설 실행`,
        description: `${input.folderPath || 'C:\\AhBiShared'} 폴더 확인 후 공유 및 USB 포터블 동기화를 다시 실행합니다.`,
      })
    );

    clientSteps = [
      makeStep('client', 1, {
        executor: 'verify_port_445',
        title: `클라이언트에서 ${normalizedTargetForDisplay} TCP 445 도달성 점검`,
        description: '호스트 공유 재개설 후 클라이언트 PC가 SMB 포트 445에 정상 도달하는지 확인합니다.',
      }),
    ];
  } else {
    const diag = classifyFailureDiagnostics(input.errorMessage);
    errorCode = diag?.code || 'Mount Diagnostic';
    errorTitle = diag?.title || '네트워크 드라이브 연결 실패';

    if (errorCode === 'Error 1385') {
      recommendedSide = 'host';
      hostSteps = [
        makeStep('host', 1, {
          executor: 'host_guest_unlock_and_reopen',
          title: '호스트 Guest 네트워크 로그온 거부(1385) 정책 해제',
          description:
            '호스트의 SeDenyNetworkLogonRight에서 Guest/Guests를 제거하고 LimitBlankPasswordUse=0 및 445 방화벽을 즉시 개방합니다.',
          commandPreview: hostUnlockCmd,
        }),
        makeStep('host', 2, {
          executor: 'apply_safe_compat',
          patchMode: 'safe_compat',
          title: '호스트 SMB 서명 완화 및 공유 서비스(LanmanServer) 재정렬',
          description: 'Win 11 24H2~26H2 서버 측 SMB 서명 강제를 완화하고 공유 상태를 갱신합니다.',
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'switch_to_account_mode',
          title: '(대안) 보안 계정 모드로 전환하여 즉시 연결 준비',
          description: '호스트에서 Guest 개방을 원치 않는다면 보안 계정(아이디/암호) 모드로 전환해 바로 접속할 수 있습니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 네트워크 드라이브 재연결`,
          description: '호스트 조치(또는 계정 전환) 완료 후 지정한 드라이브 문자로 다시 연결합니다.',
        }),
      ];
    } else if (errorCode === 'Error 1223') {
      recommendedSide = 'both';
      hostSteps = [
        makeStep('host', 1, {
          executor: 'host_guest_unlock_and_reopen',
          title: '호스트 익명/Guest 차단(1223) 해제 및 공유 권한 정렬',
          description: '익명 자격 증명 요구를 일으키는 빈 암호 제한과 Guest 네트워크 로그온 차단을 호스트에서 해제합니다.',
          commandPreview: hostUnlockCmd,
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'switch_to_account_mode',
          title: '클라이언트 보안 계정(cmdkey) 인증 모드로 전환',
          description: '호스트가 자격 증명을 요구하는 경우 보안 계정 모드로 전환해 계정/암호를 입력합니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
          description: '호스트 개방 또는 보안 계정 입력 후 네트워크 드라이브 연결을 다시 시도합니다.',
        }),
      ];
    } else if (errorCode === '0x80070035 / 1272') {
      recommendedSide = 'both';
      hostSteps = [
        makeStep('host', 1, {
          executor: 'apply_safe_compat',
          patchMode: 'safe_compat',
          title: '호스트 SMB 서버 서명 완화 및 게스트 인증 허용',
          description: '호스트 측 RequireSecuritySignature=0 및 LanmanServer 구성을 호환 모드로 정렬합니다.',
        }),
        makeStep('host', 2, {
          executor: 'host_guest_unlock_and_reopen',
          title: '호스트 Guest 무비밀번호 · 빈 암호 허용 일괄 개방',
          description: 'Guest 계정 활성화, LimitBlankPasswordUse=0 및 방화벽 TCP 445 규칙을 적용합니다.',
          commandPreview: hostUnlockCmd,
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'apply_safe_compat',
          patchMode: 'safe_compat',
          title: '클라이언트 Win 11 24H2~26H2 비인증 게스트·서명 완화 적용',
          description: 'AllowInsecureGuestAuth=1, EnableInsecureGuestLogons=1 및 SMB 클라이언트 서명 완화를 적용합니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
          description: '양단 안전 호환 패치 완료 후 네트워크 드라이브를 다시 연결합니다.',
        }),
      ];
    } else if (errorCode === 'Error 5 / 86 / 1326') {
      const targetMatchLower = (targetHostName || targetIp || '').trim().toLowerCase();
      const matchingPortableAccount = (input.portableShares || []).find(
        (ps) =>
          ps.shareName.trim().toLowerCase() === shareName.trim().toLowerCase() &&
          ps.authMode === 'account' &&
          (!targetMatchLower ||
            (ps.sourceHostName || '').trim().toLowerCase() === targetMatchLower ||
            (ps.sourceIp || '').trim().toLowerCase() === targetMatchLower)
      );
      const matchingHostSnap = Object.values(input.hostPolicySnapshots || {}).find(
        (snap) =>
          targetMatchLower &&
          ((snap.sourceIp || '').trim().toLowerCase() === targetMatchLower ||
            snap.hostName.trim().toLowerCase() === targetMatchLower)
      );
      const sameMachineSidPrefix =
        Boolean(input.localMachineSidPrefix && matchingHostSnap?.machineSidPrefix) &&
        input.localMachineSidPrefix === matchingHostSnap?.machineSidPrefix;
      const duplicateSidRisk =
        sameMachineSidPrefix || Boolean(input.duplicateSidEvent6167Detected);
      if (duplicateSidRisk) {
        errorTitle = '인증 실패 (86/1326) 또는 복제 OS 중복 Machine SID 차단 의심';
      }

      if (input.authMode === 'account') {
        recommendedSide = 'both';
        hostSteps = [
          makeStep('host', 1, {
            executor: 'retry_host_share',
            title: `호스트 공유 '${shareName}' 전용 계정·암호 및 Classic(forceguest=0) 재동기화`,
            description: matchingHostSnap?.forceGuest
              ? '호스트에 forceguest=1(Guest 강제)가 감지되었습니다! Classic(forceguest=0) 전환 및 전용 계정 암호·NTFS ACL을 재동기화합니다.'
              : '호스트의 전용 공유 계정 암호, Classic(forceguest=0) 모델, 폴더 NTFS 권한 및 USB 암호화 자격 증명을 최신 상태로 다시 동기화합니다.',
          }),
          makeStep('host', 2, {
            executor: 'apply_safe_compat',
            patchMode: 'safe_compat',
            title: '호스트 NTLMv2 · BlockNTLM=0 · UAC 원격 토큰 및 방화벽 445 정렬',
            description: '로컬 계정 원격 로그온, forceguest=0 및 NTLMv2 인증 협상 정책을 정렬합니다.',
          }),
          ...(duplicateSidRisk
            ? [
                makeStep('host', 3, {
                  executor: 'apply_safe_compat',
                  patchMode: 'kir_duplicate_sid_compat',
                  title: '호스트 중복 Machine SID 차단 해제 KIR(1517186191=0) 적용',
                  description:
                    'OS 복제 PC 간 동일 Machine SID로 인해 Win11 24H2/25H2(KB5065426)가 SMB 인증을 Error 86으로 거부합니다. 적용 후 재부팅하세요.',
                }),
              ]
            : []),
        ];
        clientSteps = [
          makeStep('client', 1, {
            executor: 'clear_conflicting_sessions',
            title: '기존 잘못 저장된 자격 증명(cmdkey) 및 SMB 세션 정리',
            description: '대상 호스트에 캐시된 오래된 계정/암호 세션과 충돌 매핑을 정리합니다.',
          }),
          ...(duplicateSidRisk
            ? [
                makeStep('client', 2, {
                  executor: 'apply_safe_compat',
                  patchMode: 'kir_duplicate_sid_compat',
                  title: '클라이언트 중복 Machine SID 차단 해제 KIR(1517186191=0) 적용',
                  description:
                    '복제 PC 간 중복 SID 차단(Event 6167)을 해제하기 위해 Overrides\\1517186191=0 을 적용합니다 (재부팅 필요).',
                }),
              ]
            : []),
          makeStep('client', duplicateSidRisk ? 3 : 2, {
            executor: 'retry_mount',
            title: `${normalizedTargetForDisplay}\\${shareName} 보안 계정 재연결 실행`,
            description: 'USB 동기화 암호 또는 입력한 계정 비밀번호로 네트워크 드라이브 연결을 다시 실행합니다.',
          }),
        ];
      } else {
        recommendedSide = 'both';
        hostSteps = [
          makeStep('host', 1, {
            executor: 'host_guest_unlock_and_reopen',
            title: '호스트 빈 암호 제한 해제(LimitBlankPasswordUse=0 · minpwlen=0) 및 ACL 정렬',
            description:
              (matchingHostSnap?.minimumPasswordLength ?? 0) > 0
                ? `호스트에 최소 암호 길이(${matchingHostSnap?.minimumPasswordLength})가 설정되어 Guest 빈 암호가 거부되었을 수 있습니다. net accounts /minpwlen:0 및 ACL을 일괄 복구합니다.`
                : 'Guest 빈 암호 거부, Classic(forceguest=0) 및 공유 권한/NTFS ACL 충돌을 호스트에서 일괄 복구합니다.',
            commandPreview: hostUnlockCmd,
          }),
          makeStep('host', 2, {
            executor: 'retry_host_share',
            title: `호스트 공유 '${shareName}' 무비밀번호(Guest) 권한 재적용`,
            description: '공유 폴더의 Everyone/Guest 접근 권한과 로컬 Guest 계정 상태를 갱신합니다.',
          }),
          ...(duplicateSidRisk
            ? [
                makeStep('host', 3, {
                  executor: 'apply_safe_compat',
                  patchMode: 'kir_duplicate_sid_compat',
                  title: '호스트 중복 Machine SID 차단 해제 KIR(1517186191=0) 적용',
                  description:
                    'OS 복제 PC 간 동일 Machine SID로 인한 Win11 24H2/25H2 인증 거부(Event 6167)를 우회합니다 (재부팅 필요).',
                }),
              ]
            : []),
        ];
        clientSteps = [
          makeStep('client', 1, {
            executor: 'clear_conflicting_sessions',
            title: '기존 잘못 저장된 자격 증명(cmdkey) 및 SMB 세션 정리',
            description: '대상 호스트에 캐시된 오래된 계정/암호 세션과 충돌 매핑을 정리합니다.',
          }),
          makeStep('client', 2, {
            executor: 'switch_to_account_mode',
            title: matchingPortableAccount
              ? `호스트 보안 계정('${matchingPortableAccount.username || 'AhBiShare'}') 모드로 전환 준비`
              : '보안 계정 모드로 전환해 정확한 아이디·암호 입력 준비',
            description: matchingPortableAccount
              ? 'USB 포터블 기록상 호스트 공유가 보안 계정 모드로 설정되어 있습니다. 계정 모드로 전환해 바로 연결하세요.'
              : '호스트에 설정된 전용 공유 계정(아이디/암호)으로 인증 모드를 맞춥니다.',
          }),
          ...(duplicateSidRisk
            ? [
                makeStep('client', 3, {
                  executor: 'apply_safe_compat',
                  patchMode: 'kir_duplicate_sid_compat',
                  title: '클라이언트 중복 Machine SID 차단 해제 KIR(1517186191=0) 적용',
                  description:
                    '복제 PC 간 중복 SID 차단(Event 6167)을 해제하기 위해 Overrides\\1517186191=0 을 적용합니다 (재부팅 필요).',
                }),
              ]
            : []),
          makeStep('client', duplicateSidRisk ? 4 : 3, {
            executor: 'retry_mount',
            title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
            description: '세션 정리 및 인증 확인 후 네트워크 드라이브 연결을 다시 실행합니다.',
          }),
        ];
      }
    } else if (errorCode === 'Error 58') {
      recommendedSide = 'both';
      hostSteps = [
        makeStep('host', 1, {
          executor: 'apply_legacy_bridge',
          patchMode: 'legacy_bridge_compat',
          title: '호스트 구형 OS SMB 2.1/3.0 브릿지 호환 적용',
          description: 'SMB 전송 암호화 강제(EncryptData/RejectUnencryptedAccess)를 끄고 NTLMv2 및 서명 완화를 적용합니다.',
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'apply_legacy_bridge',
          patchMode: 'legacy_bridge_compat',
          title: '클라이언트 구형 OS 브릿지(서명 완화·NTLMv2) 정렬',
          description: '클라이언트 측 SMB 서명 요구와 NTLM 호환 수준을 호스트와 일치시킵니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 구형 호환 재연결 실행`,
          description: '양단 SMB 브릿지 정렬 완료 후 네트워크 드라이브를 다시 연결합니다.',
        }),
      ];
    } else if (errorCode === 'Error 53 / TCP 445') {
      recommendedSide = 'host';
      hostSteps = [
        makeStep('host', 1, {
          executor: 'apply_safe_compat',
          patchMode: 'safe_compat',
          title: '호스트 TCP 445 방화벽 개방 · 개인 네트워크 · LanmanServer 가동',
          description: '호스트 방화벽에서 포트 445가 차단되었는지 점검하고 파일 및 프린터 공유 규칙을 개방합니다.',
        }),
        makeStep('host', 2, {
          executor: 'retry_host_share',
          title: `호스트 '${shareName}' 공유 활성화 상태 재확인`,
          description: '대상 공유 폴더가 정상 개설되어 있고 네트워크 탐색이 켜져 있는지 재적용합니다.',
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'verify_port_445',
          title: `${normalizedTargetForDisplay} Ping 및 TCP 445 포트 도달성 재검사`,
          description: '호스트 PC와 같은 대역(LAN)에 연결되어 있고 445 포트가 열려 있는지 실시간 확인합니다.',
        }),
        makeStep('client', 2, {
          executor: 'enable_smbv1_client',
          patchMode: 'enable_smbv1_client',
          title: '(구형 장비/Win7 전용) SMBv1 클라이언트 기능 설치',
          description: '대상 호스트가 SMB 2.0 미지원 구형 장비·NAS·레거시 PC일 경우에만 적용하세요.',
        }),
        makeStep('client', 3, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
          description: '네트워크 경로 및 포트 445 개방 확인 후 드라이브 연결을 재시도합니다.',
        }),
      ];
    } else if (errorCode === 'Error 1219') {
      recommendedSide = 'client';
      hostSteps = [];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'clear_conflicting_sessions',
          title: `${normalizedTargetForDisplay} 기존 SMB 다중 세션 · 자격 증명 정리`,
          description: '동일 서버에 열려 있는 다른 사용자 세션(net use * /delete)과 cmdkey 캐시를 정리합니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
          description: '충돌 세션 제거 후 지정한 인증 방식으로 즉시 재연결합니다.',
        }),
      ];
    } else if (errorCode === 'Error 85') {
      recommendedSide = 'client';
      hostSteps = [];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'reassign_free_drive',
          title: `사용 중인 드라이브(${input.driveLetter || 'Z:'})를 빈 드라이브 문자로 자동 변경`,
          description: '이미 할당된 드라이브 문자 충돌을 피하기 위해 사용 가능한 다음 드라이브 문자로 재배정합니다.',
        }),
        makeStep('client', 2, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 새 드라이브 문자로 재연결`,
          description: '새로 배정된 드라이브 문자로 네트워크 공유를 연결합니다.',
        }),
      ];
    } else {
      recommendedSide = 'both';
      hostSteps = [
        makeStep('host', 1, {
          executor: input.isLegacyOs ? 'apply_legacy_bridge' : 'apply_safe_compat',
          patchMode: input.isLegacyOs ? 'legacy_bridge_compat' : 'safe_compat',
          title: '호스트 SMB 호환 정책 및 방화벽 445 정렬',
          description: '호스트 측 서명 완화, 게스트/공유 권한 및 TCP 445 인바운드 규칙을 점검합니다.',
        }),
        makeStep('host', 2, {
          executor: 'retry_host_share',
          title: `호스트 '${shareName}' 공유 상태 재점검`,
          description: '활성 SMB 공유 존재 여부와 폴더 접근 권한을 재적용합니다.',
        }),
      ];
      clientSteps = [
        makeStep('client', 1, {
          executor: 'verify_port_445',
          title: `${normalizedTargetForDisplay} TCP 445 도달성 점검`,
          description: '클라이언트에서 호스트 IP 및 SMB 445 포트로 도달 가능한지 확인합니다.',
        }),
        makeStep('client', 2, {
          executor: input.isLegacyOs ? 'apply_legacy_bridge' : 'apply_safe_compat',
          patchMode: input.isLegacyOs ? 'legacy_bridge_compat' : 'safe_compat',
          title: '클라이언트 SMB 클라이언트 호환 정책 정렬',
          description: '클라이언트 측 게스트 로그온 및 SMB 서명 완화 설정을 적용합니다.',
        }),
        makeStep('client', 3, {
          executor: 'retry_mount',
          title: `${normalizedTargetForDisplay}\\${shareName} 드라이브 재연결 실행`,
          description: '점검 및 정책 정렬 후 네트워크 드라이브를 다시 연결합니다.',
        }),
      ];
    }
  }

  const prioritized = sortWizardStepsBySuccessProbability(errorCode, hostSteps, clientSteps);
  hostSteps = prioritized.hostSteps;
  clientSteps = prioritized.clientSteps;

  return {
    ticketId: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    schemaVersion: 1,
    originRole: input.originRole,
    originHostName: (input.netInfo.hostname || 'LOCAL-PC').trim(),
    originIp: (input.netInfo.primaryIp || '').trim(),
    targetHostName,
    targetIp,
    shareName,
    ...(input.folderPath ? { folderPath: input.folderPath.trim() } : {}),
    ...(input.driveLetter ? { driveLetter: input.driveLetter.trim() } : {}),
    authMode: input.authMode,
    ...(typeof input.isLegacyOs === 'boolean' ? { isLegacyOs: input.isLegacyOs } : {}),
    errorCode,
    errorTitle,
    rawErrorSummary: cleanedSummary,
    recommendedSide,
    hostSteps,
    clientSteps,
    status: 'open',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * 오류 증상별 자동 우선순위 분류기 (Error Symptom-Based Automatic Priority Classifier)
 * SMB 연결 오류 코드(1223, 86, 1385, 1219, 85 등)를 분석하여
 * 마법사의 step 실행 순서를 가장 성공 확률이 높은 순으로 동적 재정렬합니다.
 */
export function sortWizardStepsBySuccessProbability(
  errorCode: string,
  hostSteps: TroubleshootWizardStep[],
  clientSteps: TroubleshootWizardStep[]
): { hostSteps: TroubleshootWizardStep[]; clientSteps: TroubleshootWizardStep[] } {
  const hostPriorityWeights: Record<string, number> = {
    'host_guest_unlock_and_reopen': 10,
    'apply_safe_compat': 20,
    'apply_legacy_bridge': 20,
    'retry_host_share': 30,
  };

  const clientPriorityWeights: Record<string, number> = {
    'clear_conflicting_sessions': 5,
    'reassign_free_drive': 5,
    'verify_port_445': 10,
    'switch_to_account_mode': 15,
    'apply_safe_compat': 20,
    'apply_legacy_bridge': 20,
    'enable_smbv1_client': 25,
    'retry_mount': 40,
  };

  if (errorCode === 'Error 1219') {
    clientPriorityWeights['clear_conflicting_sessions'] = 1;
  } else if (errorCode === 'Error 85') {
    clientPriorityWeights['reassign_free_drive'] = 1;
  } else if (errorCode === 'Error 1385' || errorCode === 'Error 1223' || errorCode === 'Error 5 / 86 / 1326') {
    hostPriorityWeights['host_guest_unlock_and_reopen'] = 1;
  }

  const sortedHost = [...hostSteps]
    .sort((a, b) => (hostPriorityWeights[a.executor] || 50) - (hostPriorityWeights[b.executor] || 50))
    .map((s, idx) => ({ ...s, order: idx + 1 }));

  const sortedClient = [...clientSteps]
    .sort((a, b) => (clientPriorityWeights[a.executor] || 50) - (clientPriorityWeights[b.executor] || 50))
    .map((s, idx) => ({ ...s, order: idx + 1 }));

  return { hostSteps: sortedHost, clientSteps: sortedClient };
}

function sameNormalizedEndpoint(a: TroubleshootTicket, b: TroubleshootTicket): boolean {
  const hostA = (a.targetHostName || a.targetIp || '').trim().toLowerCase();
  const hostB = (b.targetHostName || b.targetIp || '').trim().toLowerCase();
  const ipA = (a.targetIp || '').trim().toLowerCase();
  const ipB = (b.targetIp || '').trim().toLowerCase();
  const hostMatch = Boolean((hostA && hostA === hostB) || (ipA && ipA === ipB));
  return (
    a.originRole === b.originRole &&
    hostMatch &&
    a.shareName.trim().toLowerCase() === b.shareName.trim().toLowerCase() &&
    a.errorCode === b.errorCode
  );
}

export function upsertTroubleshootTicketList(
  existing: TroubleshootTicket[],
  incoming: TroubleshootTicket
): { list: TroubleshootTicket[]; ticket: TroubleshootTicket } {
  const prevOpenIdx = existing.findIndex(
    (item) => item.status !== 'resolved' && sameNormalizedEndpoint(item, incoming)
  );
  if (prevOpenIdx >= 0) {
    const prev = existing[prevOpenIdx];
    const mergedTicket: TroubleshootTicket = {
      ...incoming,
      ticketId: prev.ticketId,
      createdAt: prev.createdAt,
      targetHostName: incoming.targetHostName || prev.targetHostName,
      targetIp: incoming.targetIp || prev.targetIp,
      folderPath: incoming.folderPath || prev.folderPath,
      driveLetter: incoming.driveLetter || prev.driveLetter,
      updatedAt: incoming.updatedAt,
    };
    const nextList = [mergedTicket, ...existing.filter((_, i) => i !== prevOpenIdx)].slice(0, 30);
    return { list: nextList, ticket: mergedTicket };
  }
  const nextList = [incoming, ...existing].slice(0, 30);
  return { list: nextList, ticket: incoming };
}

export function recomputeTroubleshootTicketStatus(
  ticket: TroubleshootTicket,
  actorHostName: string
): TroubleshootTicket {
  const nowIso = new Date().toISOString();
  const isDone = (s: TroubleshootStepStatus) => s === 'completed' || s === 'skipped';
  const hostHasSteps = ticket.hostSteps.length > 0;
  const clientHasSteps = ticket.clientSteps.length > 0;
  const hostAllDone = !hostHasSteps || ticket.hostSteps.every((s) => isDone(s.status));
  const clientAllDone = !clientHasSteps || ticket.clientSteps.every((s) => isDone(s.status));
  const hostAnyCompleted = ticket.hostSteps.some((s) => s.status === 'completed');
  const clientAnyCompleted = ticket.clientSteps.some((s) => s.status === 'completed');

  let nextStatus: TroubleshootTicketStatus = 'open';
  if (hostAllDone && clientAllDone && (hostAnyCompleted || clientAnyCompleted || ticket.status === 'resolved')) {
    nextStatus = 'resolved';
  } else if (hostHasSteps && hostAllDone && hostAnyCompleted) {
    nextStatus = 'host_fixed';
  } else if (clientHasSteps && clientAllDone && clientAnyCompleted) {
    nextStatus = 'client_fixed';
  }

  return {
    ...ticket,
    status: nextStatus,
    updatedAt: nowIso,
    ...(nextStatus === 'resolved'
      ? {
          resolvedAt: ticket.resolvedAt || nowIso,
          resolvedByHostName: ticket.resolvedByHostName || actorHostName,
        }
      : {
          resolvedAt: undefined,
          resolvedByHostName: undefined,
        }),
  };
}

/**
 * When client retry_mount fails with a newly revealed specific SMB/Auth error code
 * (for example, an initial "Mount Diagnostic" timeout ticket later fails with Error 86 / 1385 / 1223),
 * upgrade the ticket's errorCode and rebuild/append actionable remediation steps instead of staying stuck in host_fixed.
 */
export function reclassifyTroubleshootTicketOnRetryFailure(
  ticket: TroubleshootTicket,
  failureMessage: string,
  input: {
    netInfo: LocalNetworkInfo;
    portableShares?: PortableHostShareEntry[];
    hostPolicySnapshots?: Record<string, HostPolicySnapshot>;
    effectiveAuthMode?: AuthMode;
    localMachineSidPrefix?: string;
    duplicateSidEvent6167Detected?: boolean;
  }
): TroubleshootTicket {
  const diag = classifyFailureDiagnostics(failureMessage);
  if (!diag || diag.code === 'Mount Diagnostic') {
    return ticket;
  }
  const isGenericPrior =
    ticket.errorCode === 'Mount Diagnostic' || ticket.errorCode === 'Error 53 / TCP 445';
  const authChanged = Boolean(input.effectiveAuthMode && input.effectiveAuthMode !== ticket.authMode);
  if (!isGenericPrior && diag.code === ticket.errorCode && !authChanged) {
    return ticket;
  }

  const nextDraft = buildTroubleshootTicketDraft({
    originRole: ticket.originRole,
    netInfo: input.netInfo,
    errorMessage: failureMessage,
    targetHost: ticket.targetIp || ticket.targetHostName,
    targetHostNameHint: ticket.targetHostName,
    targetIpHint: ticket.targetIp,
    shareName: ticket.shareName,
    folderPath: ticket.folderPath,
    driveLetter: ticket.driveLetter,
    authMode: input.effectiveAuthMode || ticket.authMode,
    isLegacyOs: ticket.isLegacyOs,
    portableShares: input.portableShares,
    hostPolicySnapshots: input.hostPolicySnapshots,
    localMachineSidPrefix: input.localMachineSidPrefix,
    duplicateSidEvent6167Detected: input.duplicateSidEvent6167Detected,
  });

  const nowIso = new Date().toISOString();
  const prevByExec = new Map<string, TroubleshootWizardStep>();
  for (const s of [...ticket.hostSteps, ...ticket.clientSteps]) {
    prevByExec.set(`${s.side}:${s.executor}`, s);
  }

  const mergeSteps = (freshSteps: TroubleshootWizardStep[]) =>
    freshSteps.map((s) => {
      if (s.executor === 'retry_mount') {
        return {
          ...s,
          status: 'failed' as const,
          lastAttemptAt: nowIso,
          lastMessage: failureMessage,
        };
      }
      // Always keep verify_port_445 completion, and preserve apply_safe_compat/apply_legacy_bridge unless guest unlock is newly required
      const prev = prevByExec.get(`${s.side}:${s.executor}`);
      if (
        prev &&
        prev.status === 'completed' &&
        (s.executor === 'verify_port_445' ||
          s.executor === 'apply_safe_compat' ||
          s.executor === 'apply_legacy_bridge' ||
          s.executor === 'clear_conflicting_sessions')
      ) {
        return {
          ...s,
          status: prev.status,
          ...(prev.resolvedSource ? { resolvedSource: prev.resolvedSource } : {}),
          ...(prev.requiresReboot ? { requiresReboot: prev.requiresReboot } : {}),
          lastAttemptAt: prev.lastAttemptAt,
          lastMessage: prev.lastMessage,
        };
      }
      return s;
    });

  const upgraded: TroubleshootTicket = {
    ...ticket,
    authMode: input.effectiveAuthMode || ticket.authMode,
    errorCode: nextDraft.errorCode,
    errorTitle: nextDraft.errorTitle,
    rawErrorSummary: nextDraft.rawErrorSummary,
    recommendedSide: nextDraft.recommendedSide,
    hostSteps: mergeSteps(nextDraft.hostSteps),
    clientSteps: mergeSteps(nextDraft.clientSteps),
    updatedAt: nowIso,
    resolvedAt: undefined,
    resolvedByHostName: undefined,
  };

  return recomputeTroubleshootTicketStatus(upgraded, input.netInfo.hostname);
}

export function detectTicketMatchSideForPc(
  ticket: TroubleshootTicket,
  netInfo: LocalNetworkInfo,
  localShares: ActiveShare[] = [],
  _localMounts: MountedDrive[] = [],
  portableShares: PortableHostShareEntry[] = []
): 'host' | 'client' | 'both' | 'none' {
  const localHostLower = (netInfo.hostname || '').trim().toLowerCase();
  const localIp = (netInfo.primaryIp || '').trim();
  const originHostLower = (ticket.originHostName || '').trim().toLowerCase();
  const originIp = (ticket.originIp || '').trim();
  const targetHostLower = (ticket.targetHostName || '').trim().toLowerCase();
  const targetIp = (ticket.targetIp || '').trim();
  const ticketShareLower = (ticket.shareName || '').trim().toLowerCase();

  const localOwnsTargetShare =
    Boolean(ticketShareLower) &&
    (localShares.some((s) => s.shareName.trim().toLowerCase() === ticketShareLower) ||
      portableShares.some(
        (p) =>
          p.shareName.trim().toLowerCase() === ticketShareLower &&
          ((p.sourceHostName || '').trim().toLowerCase() === localHostLower ||
            (Boolean(localIp) && (p.sourceIp || '').trim() === localIp))
      ));

  const matchesHostDirect =
    (Boolean(targetHostLower) && targetHostLower === localHostLower) ||
    (Boolean(targetIp) && Boolean(localIp) && targetIp === localIp) ||
    (ticket.originRole === 'host' &&
      ((Boolean(originHostLower) && originHostLower === localHostLower) ||
        (Boolean(originIp) && Boolean(localIp) && originIp === localIp)));

  // Fallback match: Client connected via stale IP without knowing hostname, but current PC actively owns that shareName & wasn't the client origin
  const isOriginClient =
    ticket.originRole === 'client' &&
    ((Boolean(originHostLower) && originHostLower === localHostLower) ||
      (Boolean(originIp) && Boolean(localIp) && originIp === localIp));

  const matchesHostFallbackByShare =
    !isOriginClient && localOwnsTargetShare && (!targetHostLower || targetHostLower === targetIp.toLowerCase());

  const matchesHost = matchesHostDirect || matchesHostFallbackByShare;
  const matchesClient = isOriginClient;

  if (matchesHost && matchesClient) return 'both';
  if (matchesHost) return 'host';
  if (matchesClient) return 'client';
  return 'none';
}

export function evaluateTroubleshootTicketsForPc(
  tickets: TroubleshootTicket[],
  netInfo: LocalNetworkInfo,
  localShares: ActiveShare[] = [],
  localMounts: MountedDrive[] = [],
  portableShares: PortableHostShareEntry[] = []
): TroubleshootMatchResult {
  const currentPcActionTickets: TroubleshootTicket[] = [];
  const waitingOtherPcTickets: TroubleshootTicket[] = [];
  const resolvedTickets: TroubleshootTicket[] = [];
  const matchedSideMap: Record<string, 'host' | 'client' | 'both' | 'none'> = {};

  for (const ticket of tickets || []) {
    const matchedSide = detectTicketMatchSideForPc(ticket, netInfo, localShares, localMounts, portableShares);
    matchedSideMap[ticket.ticketId] = matchedSide;

    if (ticket.status === 'resolved') {
      resolvedTickets.push(ticket);
      continue;
    }

    const hasPendingHost = ticket.hostSteps.some((s) => s.status === 'pending' || s.status === 'failed');
    const hasPendingClient = ticket.clientSteps.some((s) => s.status === 'pending' || s.status === 'failed');

    const needsActionOnThisHost = (matchedSide === 'host' || matchedSide === 'both') && hasPendingHost;
    const needsActionOnThisClient = (matchedSide === 'client' || matchedSide === 'both') && hasPendingClient;

    if (needsActionOnThisHost || needsActionOnThisClient) {
      currentPcActionTickets.push(ticket);
    } else {
      waitingOtherPcTickets.push(ticket);
    }
  }

  // Prioritize tickets where the opposite PC already fixed its side (handoff ready) or host tickets on a host PC
  currentPcActionTickets.sort((a, b) => {
    const score = (t: TroubleshootTicket) => {
      if (t.status === 'host_fixed' || t.status === 'client_fixed') return 2;
      return 1;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt);
  });

  return {
    currentPcActionTickets,
    waitingOtherPcTickets,
    resolvedTickets,
    primaryTicket: currentPcActionTickets[0] || null,
    matchedSideMap,
  };
}

export function formatStepResolvedSourceLabel(source?: TroubleshootStepResolvedSource): string {
  switch (source) {
    case 'matrix':
      return 'OS 호환성 매트릭스 적용됨';
    case 'host_panel':
      return 'HostPanel 빈 암호 토글 반영';
    case 'live_inspect':
      return '실시간 OS 정책 이미 충족';
    case 'share_retry':
      return '공유폴더 개설 확인됨';
    case 'mount_retry':
      return '드라이브 연결 성공 확인됨';
    case 'rollback':
      return '보안 원복 확인됨';
    case 'wizard':
      return '마법사 직접 실행 완료';
    default:
      return '';
  }
}

export function isPolicyStepSatisfiedOnLocalPc(
  step: TroubleshootWizardStep,
  ticket: TroubleshootTicket,
  policy: OsNetworkPolicyStatus | null
): boolean | null {
  if (!policy) return null;

  if (step.executor === 'host_guest_unlock_and_reopen') {
    return (
      policy.limitBlankPasswordUse === false &&
      policy.guestAccountEnabled !== false &&
      policy.guestNetworkLogonDenied !== true &&
      policy.firewall445Allowed !== false &&
      (policy.minimumPasswordLength == null || policy.minimumPasswordLength === 0) &&
      policy.forceGuest !== true &&
      policy.allowInsecureGuestAuth !== false
    );
  }

  if (step.executor === 'apply_safe_compat') {
    if (step.patchMode === 'kir_duplicate_sid_compat') {
      return policy.kirOverride1517186191 === 0;
    }
    if (step.patchMode === 'enable_uac_token_filter') {
      return policy.localAccountTokenFilterEnabled === true;
    }
    if (step.side === 'host') {
      const baseHostOk =
        policy.networkProfile !== 'Public' &&
        policy.firewall445Allowed !== false &&
        policy.lanmanServerRunning !== false &&
        policy.smbServerSigningRequired !== true &&
        policy.smbBlockNtlm !== true &&
        policy.forceGuest !== true;
      if (!baseHostOk) return false;
      if (ticket.authMode === 'guest') {
        return policy.guestNetworkLogonDenied !== true && policy.limitBlankPasswordUse !== true;
      }
      return true;
    }
    return (
      policy.smbClientSigningRequired !== true &&
      policy.allowInsecureGuestAuth === true &&
      policy.enableInsecureGuestLogons !== false &&
      policy.smbBlockNtlm !== true &&
      policy.smbRequireEncryption !== true
    );
  }

  if (step.executor === 'apply_legacy_bridge') {
    return (
      policy.smbEncryptData !== true &&
      policy.smbRejectUnencryptedAccess !== true &&
      policy.smbServerSigningRequired !== true &&
      policy.smbClientSigningRequired !== true &&
      (policy.lmCompatibilityLevel == null || policy.lmCompatibilityLevel <= 3)
    );
  }

  if (step.executor === 'enable_smbv1_client') {
    return policy.smb1ClientFeatureState === 'Enabled';
  }

  // Action / retry steps (retry_host_share, retry_mount, clear_conflicting_sessions, verify_port_445, switch_to_account_mode, reassign_free_drive)
  // must stay pending so the user can explicitly retry or verify after policy alignment.
  return null;
}

export function getPolicyStepMatchedExplanation(
  step: TroubleshootWizardStep,
  ticket: TroubleshootTicket,
  policy: OsNetworkPolicyStatus | null
): string {
  if (!policy) return '';

  if (step.executor === 'host_guest_unlock_and_reopen') {
    return '현재 OS 정책(LimitBlankPasswordUse=0 · Guest 활성 · SeDenyNetworkLogonRight 해제 · TCP 445 허용 · forceguest=0)이 이미 충족되어 다시 실행할 필요가 없습니다.';
  }

  if (step.executor === 'apply_safe_compat') {
    if (step.patchMode === 'kir_duplicate_sid_compat') {
      return policy.pendingRebootFlag
        ? '중복 SID 우회 레지스트리(1517186191=0)가 이미 반영되어 있습니다. 커널 적용을 위해 재부팅 후 연결하세요.'
        : '중복 SID 우회 정책(1517186191=0) 조건이 현재 OS 정책에서 이미 충족되었습니다.';
    }
    if (step.patchMode === 'enable_uac_token_filter') {
      return 'UAC 원격 토큰 필터 해제(LocalAccountTokenFilterPolicy=1) 조건이 이미 충족되었습니다.';
    }
    if (step.side === 'host') {
      return ticket.authMode === 'guest'
        ? '호스트 프로필 · TCP 445 · LanmanServer · SMB 서명/NTLM 및 Guest 허용 조건이 이미 충족되어 실행할 필요가 없습니다.'
        : '호스트 프로필 · TCP 445 · LanmanServer · SMB 서명/NTLM 호환 조건이 이미 충족되어 실행할 필요가 없습니다.';
    }
    return '클라이언트 SMB 서명 완화 · AllowInsecureGuestAuth=1 · 암호화 강제 해제 조건이 이미 충족되어 실행할 필요가 없습니다.';
  }

  if (step.executor === 'apply_legacy_bridge') {
    return '구형 OS 브릿지 조건(비암호화 SMB 허용 · 서명 완화 · NTLMv2 고정)이 현재 OS 정책에 이미 충족되어 있습니다.';
  }

  if (step.executor === 'enable_smbv1_client') {
    return 'SMB 1.0/CIFS 클라이언트 기능(SMB1Protocol)이 이미 활성화(Enabled) 상태이므로 다시 설치할 필요가 없습니다.';
  }

  return '현재 OS 정책 상태가 이 단계의 요구 조건을 이미 충족했습니다.';
}

export function getSatisfiedPolicyModesFromStatus(policy: OsNetworkPolicyStatus | null): {
  satisfiedModes: PolicyPatchMode[];
  guestUnlockSatisfied: boolean;
} {
  if (!policy) {
    return { satisfiedModes: [], guestUnlockSatisfied: false };
  }

  const guestUnlockSatisfied =
    policy.limitBlankPasswordUse === false &&
    policy.guestAccountEnabled !== false &&
    policy.guestNetworkLogonDenied !== true &&
    policy.firewall445Allowed !== false &&
    (policy.minimumPasswordLength == null || policy.minimumPasswordLength === 0) &&
    policy.forceGuest !== true &&
    policy.allowInsecureGuestAuth !== false;

  const satisfiedModes: PolicyPatchMode[] = [];

  if (
    policy.networkProfile !== 'Public' &&
    policy.firewall445Allowed !== false &&
    policy.lanmanServerRunning !== false &&
    policy.smbServerSigningRequired !== true &&
    policy.smbClientSigningRequired !== true &&
    policy.allowInsecureGuestAuth === true &&
    policy.enableInsecureGuestLogons !== false &&
    policy.guestNetworkLogonDenied !== true &&
    policy.limitBlankPasswordUse !== true &&
    policy.smbBlockNtlm !== true &&
    policy.smbRequireEncryption !== true &&
    policy.forceGuest !== true
  ) {
    satisfiedModes.push('safe_compat');
  }

  if (
    policy.smbEncryptData !== true &&
    policy.smbRejectUnencryptedAccess !== true &&
    policy.smbServerSigningRequired !== true &&
    policy.smbClientSigningRequired !== true &&
    (policy.lmCompatibilityLevel == null || policy.lmCompatibilityLevel <= 3) &&
    policy.allowInsecureGuestAuth === true
  ) {
    satisfiedModes.push('legacy_bridge_compat');
  }

  if (
    policy.rpcAuthnLevelPrivacyDisabled === true &&
    policy.rpcUseNamedPipeProtocol === true &&
    policy.pointAndPrintRelaxed === true
  ) {
    satisfiedModes.push('rpc_printer_compat');
  }

  if (policy.localAccountTokenFilterEnabled === true) {
    satisfiedModes.push('enable_uac_token_filter');
  }

  if (policy.kirOverride1517186191 === 0) {
    satisfiedModes.push('kir_duplicate_sid_compat');
  }

  if (policy.smb1ClientFeatureState === 'Enabled') {
    satisfiedModes.push('enable_smbv1_client');
  }

  return { satisfiedModes, guestUnlockSatisfied };
}

function buildAutoSyncCompletionMessage(
  step: TroubleshootWizardStep,
  source: TroubleshootStepResolvedSource,
  policy: OsNetworkPolicyStatus | null
): string {
  const sourceLabel = formatStepResolvedSourceLabel(source) || 'OS 정책 동기화';
  const needsRebootNote =
    step.requiresReboot ||
    stepRequiresRebootByDefinition(step.executor, step.patchMode) ||
    Boolean(policy?.pendingRebootFlag && (step.patchMode === 'kir_duplicate_sid_compat' || step.executor === 'enable_smbv1_client'));
  if (needsRebootNote) {
    return `${sourceLabel} 확인 — 정책 값은 반영되었으나 커널 적용을 위해 재부팅이 필요합니다.`;
  }
  return `${sourceLabel}로 정책 요건이 이미 충족되어 자동 완료 처리되었습니다.`;
}

export function reconcileTroubleshootTicketsWithLocalState(input: {
  tickets: TroubleshootTicket[];
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  localShares?: ActiveShare[];
  localMounts?: MountedDrive[];
  portableShares?: PortableHostShareEntry[];
  source: TroubleshootStepResolvedSource;
  justCreatedShareNames?: string[];
  justMountedTargets?: Array<{ targetHost: string; shareName: string }>;
}): { tickets: TroubleshootTicket[]; summary: TroubleshootSyncSummary } {
  const tickets = input.tickets || [];
  if (tickets.length === 0) {
    return {
      tickets: [],
      summary: {
        changed: false,
        updatedTicketIds: [],
        autoCompletedSteps: 0,
        reopenedSteps: 0,
        resolvedTicketIds: [],
      },
    };
  }

  const nowIso = new Date().toISOString();
  const createdShareSet = new Set((input.justCreatedShareNames || []).map((s) => s.trim().toLowerCase()).filter(Boolean));
  const mountedTargets = input.justMountedTargets || [];
  const updatedTicketIds: string[] = [];
  const resolvedTicketIds: string[] = [];
  let autoCompletedSteps = 0;
  let reopenedSteps = 0;
  let anyChanged = false;

  const nextTickets = tickets.map((ticket) => {
    if (ticket.status === 'resolved') return ticket;

    const matchedSide = detectTicketMatchSideForPc(
      ticket,
      input.netInfo,
      input.localShares || [],
      input.localMounts || [],
      input.portableShares || []
    );
    if (matchedSide === 'none') return ticket;

    const ticketShareLower = (ticket.shareName || '').trim().toLowerCase();
    const ticketHostTokens = new Set(
      [ticket.targetIp, ticket.targetHostName].map((v) => (v || '').trim().toLowerCase()).filter(Boolean)
    );

    const shareJustCreated =
      (matchedSide === 'host' || matchedSide === 'both') &&
      Boolean(ticketShareLower) &&
      createdShareSet.has(ticketShareLower);

    const mountJustSucceeded =
      (matchedSide === 'client' || matchedSide === 'both') &&
      mountedTargets.some((mt) => {
        const sMatch = mt.shareName.trim().toLowerCase() === ticketShareLower;
        const hLower = mt.targetHost.trim().toLowerCase();
        const hMatch = ticketHostTokens.size === 0 || ticketHostTokens.has(hLower);
        return sMatch && hMatch;
      });

    let ticketChanged = false;

    const syncSteps = (steps: TroubleshootWizardStep[]): TroubleshootWizardStep[] =>
      steps.map((step) => {
        const sideApplies = matchedSide === 'both' || matchedSide === step.side;
        if (!sideApplies) return step;

        const requiresReboot =
          typeof step.requiresReboot === 'boolean'
            ? step.requiresReboot
            : stepRequiresRebootByDefinition(step.executor, step.patchMode);

        // 1. Fresh host share creation retry success
        if (step.executor === 'retry_host_share' && shareJustCreated) {
          if (step.status !== 'completed') {
            ticketChanged = true;
            autoCompletedSteps += 1;
            return {
              ...step,
              status: 'completed' as const,
              resolvedSource: 'share_retry' as const,
              ...(requiresReboot ? { requiresReboot: true } : {}),
              lastAttemptAt: nowIso,
              lastMessage: `'${ticket.shareName}' 공유폴더 개설 성공으로 자동 완료 처리되었습니다.`,
            };
          }
          return step;
        }

        // 2. Fresh client drive mount success
        if (step.executor === 'retry_mount' && mountJustSucceeded) {
          if (step.status !== 'completed') {
            ticketChanged = true;
            autoCompletedSteps += 1;
            return {
              ...step,
              status: 'completed' as const,
              resolvedSource: 'mount_retry' as const,
              ...(requiresReboot ? { requiresReboot: true } : {}),
              lastAttemptAt: nowIso,
              lastMessage: `'${ticket.shareName}' 네트워크 드라이브 연결 성공으로 완료되었습니다.`,
            };
          }
          return step;
        }

        // 3. Policy step bidirectional sync
        const satisfied = isPolicyStepSatisfiedOnLocalPc(step, ticket, input.policyStatus);
        if (satisfied === true) {
          if (step.status === 'pending' || step.status === 'failed') {
            ticketChanged = true;
            autoCompletedSteps += 1;
            return {
              ...step,
              status: 'completed' as const,
              resolvedSource: input.source,
              ...(requiresReboot ? { requiresReboot: true } : {}),
              lastAttemptAt: nowIso,
              lastMessage: buildAutoSyncCompletionMessage(step, input.source, input.policyStatus),
            };
          }
          return step;
        }

        if (satisfied === false && step.status === 'completed') {
          ticketChanged = true;
          reopenedSteps += 1;
          return {
            ...step,
            status: 'pending' as const,
            resolvedSource: undefined,
            ...(requiresReboot ? { requiresReboot: true } : {}),
            lastAttemptAt: nowIso,
            lastMessage: 'OS 호환성 매트릭스 또는 보안 원복으로 정책이 해제되어 다시 적용이 필요합니다.',
          };
        }

        return step;
      });

    let nextHostSteps = syncSteps(ticket.hostSteps);
    let nextClientSteps = syncSteps(ticket.clientSteps);

    if (mountJustSucceeded) {
      const skipPending = (steps: TroubleshootWizardStep[]) =>
        steps.map((s) =>
          s.status === 'pending'
            ? {
                ...s,
                status: 'skipped' as const,
                lastAttemptAt: nowIso,
                lastMessage: '클라이언트 연결 성공으로 남은 단계 건너뜀',
              }
            : s
        );
      nextHostSteps = skipPending(nextHostSteps);
      nextClientSteps = skipPending(nextClientSteps);
      ticketChanged = true;
    } else if (shareJustCreated && ticket.originRole === 'host') {
      nextHostSteps = nextHostSteps.map((s) =>
        s.status === 'pending'
          ? {
              ...s,
              status: 'skipped' as const,
              lastAttemptAt: nowIso,
              lastMessage: '호스트 공유폴더 개설 성공으로 남은 단계 건너뜀',
            }
          : s
      );
      nextClientSteps = nextClientSteps.map((s) =>
        s.status === 'pending'
          ? {
              ...s,
              status: 'skipped' as const,
              lastAttemptAt: nowIso,
              lastMessage: '호스트 공유폴더 정상 개설 확인됨',
            }
          : s
      );
      ticketChanged = true;
    }

    if (!ticketChanged) return ticket;

    anyChanged = true;
    updatedTicketIds.push(ticket.ticketId);
    let recomputed = recomputeTroubleshootTicketStatus(
      {
        ...ticket,
        hostSteps: nextHostSteps,
        clientSteps: nextClientSteps,
      },
      input.netInfo.hostname
    );

    if (mountJustSucceeded || (shareJustCreated && ticket.originRole === 'host')) {
      recomputed = {
        ...recomputed,
        status: 'resolved',
        resolvedAt: recomputed.resolvedAt || nowIso,
        resolvedByHostName: recomputed.resolvedByHostName || input.netInfo.hostname,
        updatedAt: nowIso,
      };
    }

    if (recomputed.status === 'resolved') {
      resolvedTicketIds.push(recomputed.ticketId);
    }

    return recomputed;
  });

  return {
    tickets: nextTickets,
    summary: {
      changed: anyChanged,
      updatedTicketIds,
      autoCompletedSteps,
      reopenedSteps,
      resolvedTicketIds,
    },
  };
}

