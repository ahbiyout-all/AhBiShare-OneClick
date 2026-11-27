import {
  ExpertRegistryPolicyRow,
  ExpertRegistrySubRow,
  HostDiscrepancyLevel,
  HostPolicyComparison,
  HostPolicySnapshot,
  OsNetworkPolicyStatus,
  PolicyDiffItem,
  PolicyPatchMode,
  RawRegistryEntry,
  RawSecurityRegistrySnapshot,
  RebootJudgment,
  SecurityRollbackAuditItem,
  SecurityRollbackAuditReport,
  WindowsNetworkChangeItem,
  WindowsNetworkEra,
} from '@/types/share';
import { tx } from '@/i18n/localeState';

export interface WindowsEraSummary {
  era: WindowsNetworkEra;
  title: string;
  buildRange: string;
  postureBadge: string;
  summary: string;
  keyRules: string[];
  rebootTrait: string;
}

export function classifyOsEra(build: number, displayVersion?: string): WindowsNetworkEra {
  const disp = (displayVersion || '').toUpperCase().trim();
  if (build >= 26200 || disp.includes('25H2') || disp.includes('26H1') || disp.includes('26H2')) {
    return 'win11_25_26h2';
  }
  if (build >= 26100 || disp.includes('24H2')) {
    return 'win11_24h2';
  }
  if (build >= 22000 || disp.includes('21H2') || disp.includes('22H2') || disp.includes('23H2')) {
    return 'win11_21_23';
  }
  return 'win10';
}

export function formatEraShortLabel(era?: WindowsNetworkEra, build?: number, displayVersion?: string): string {
  if (!era) return build ? `Windows Build ${build}` : 'Windows';
  const ver = displayVersion ? ` ${displayVersion}` : '';
  const b = build ? ` (${build})` : '';
  switch (era) {
    case 'win10':
      if (build && build < 9200) {
        return `Win 7${ver || ' SP1'}${b}`;
      }
      if (build && build < 10240) {
        return `Win 8${build >= 9600 ? '.1' : ''}${b}`;
      }
      return `Win 10${ver}${b}`;
    case 'win11_21_23':
      return `Win 11${ver || ' 21H2~23H2'}${b}`;
    case 'win11_24h2':
      return `Win 11 ${displayVersion || '24H2'}${b}`;
    case 'win11_25_26h2':
      return `Win 11 ${displayVersion || '25H2/26H2'}${b}`;
  }
}

export function getWindowsEraSummaries(): WindowsEraSummary[] {
  return [
    {
      era: 'win10',
      title: 'Windows 10 (1903 ~ 22H2)',
      buildRange: 'Build 18362 ~ 19045',
      postureBadge: tx('레거시 호환 우선', 'Legacy Compatibility First'),
      summary: tx(
        'Home/Pro 기본값에서 SMB 서명 비강제 및 비인증 게스트 접근(선택/레거시)이 비교적 유연하게 동작하는 세대입니다.',
        'Generation where Home/Pro defaults allow flexible SMB sharing without forced signing and permit legacy/optional unauthenticated guest access.'
      ),
      keyRules: [
        tx(
          'SMBv1 선택적 기능 유지 (초기 1709 이후 클라이언트 기본 비활성화)',
          'SMBv1 remains an optional feature (client disabled by default since 1709)'
        ),
        tx(
          'SMB 보안 서명(Signing)은 도메인 컨트롤러 외 일반 워크그룹에서 선택 사항',
          'SMB Security Signing is optional in standard workgroups outside domain controllers'
        ),
        tx(
          'NetBIOS over TCP/IP 및 Function Discovery 혼용 탐색',
          'Mixed discovery via NetBIOS over TCP/IP and Function Discovery'
        ),
      ],
      rebootTrait: tx(
        '대부분 레지스트리·SMB 서비스 재시작만으로 즉시 적용 (SMBv1 설치/제거 시에만 재부팅 필요)',
        'Most changes apply immediately via registry & SMB service restart (reboot only for SMBv1 add/remove)'
      ),
    },
    {
      era: 'win11_21_23',
      title: 'Windows 11 (21H2 ~ 23H2)',
      buildRange: 'Build 22000 ~ 22631',
      postureBadge: tx('단계적 보안 전환', 'Phased Security Transition'),
      summary: tx(
        'SMBv1 기본 탑재가 완전히 중단되고 Pro Workstations·Enterprise 중심으로 게스트 차단이 확대된 과도기 세대입니다.',
        'Transitional generation where SMBv1 pre-install ended and insecure guest blocks expanded across Pro Workstations and Enterprise.'
      ),
      keyRules: [
        tx(
          'Home/Pro 에디션 간 게스트 로그온 정책 차이 발생',
          'Guest logon default policy diverges between Home and Pro editions'
        ),
        tx(
          '공용(Public) 네트워크 프로필 자동 할당 시 445·139 포트 및 탐색 엄격 차단',
          'Strict TCP 445/139 and discovery blocking when network profile defaults to Public'
        ),
        tx(
          'SMB 3.1.1 압축 및 AES-128-GCM / AES-256-GCM 협상 표준화',
          'Standardized SMB 3.1.1 compression and AES-128-GCM / AES-256-GCM negotiation'
        ),
      ],
      rebootTrait: tx(
        'AllowInsecureGuestAuth 및 방화벽·네트워크 프로필 전환은 재부팅 없이 즉시 반영',
        'AllowInsecureGuestAuth, firewall, and network profile switches apply immediately without reboot'
      ),
    },
    {
      era: 'win11_24h2',
      title: 'Windows 11 24H2 (2024 Update)',
      buildRange: 'Build 26100',
      postureBadge: tx('SFI 기본 보안 대격변', 'SFI Security Overhaul'),
      summary: tx(
        'Home 포함 전 에디션에서 SMB 서명 기본 강제 및 비인증 게스트 로그온 완전 차단이 적용되어 기존 공유가 가장 빈번하게 끊기는 변곡점입니다.',
        'Inflection point enforcing SMB signing and blocking insecure guest logons across all editions including Home—the #1 cause of broken legacy shares.'
      ),
      keyRules: [
        tx(
          'RequireSecuritySignature=$true 전 에디션 기본 강제 (서명 미지원 NAS/구형 PC 차단)',
          'RequireSecuritySignature=$true enforced across all editions (blocks unsigned NAS / older PCs)'
        ),
        tx(
          'AllowInsecureGuestAuth=0 기본 차단 (0x80070035 및 조직 보안 정책 오류)',
          'AllowInsecureGuestAuth=0 blocked by default (triggers 0x80070035 & org policy errors)'
        ),
        tx(
          'NTLMv1 프로토콜 스택 제거 및 Credential Guard 미사용 환경 NTLM 차단 강화',
          'NTLMv1 stack removed and stricter NTLM enforcement even without Credential Guard'
        ),
      ],
      rebootTrait: tx(
        'AllowInsecureGuestAuth + Set-SmbClientConfiguration 적용 후 LanmanWorkstation 서비스 재시작으로 재부팅 없이 즉시 반영 가능',
        'Applies immediately without reboot by restarting LanmanWorkstation after AllowInsecureGuestAuth & Set-SmbClientConfiguration'
      ),
    },
    {
      era: 'win11_25_26h2',
      title: tx('Windows 11 25H2 / 26H2 (차세대 SFI)', 'Windows 11 25H2 / 26H2 (Next-Gen SFI)'),
      buildRange: 'Build 26200 ~ 27xxx+',
      postureBadge: tx('제로 트러스트 · QUIC/NTLM 감축', 'Zero Trust · QUIC & NTLM Reduction'),
      summary: tx(
        '24H2 기반 플랫폼 위에서 SMB NTLM 아웃바운드 차단 정책, NetBIOS/WINS 단계적 퇴출, SMB over QUIC(UDP 443) 및 암호화 감사가 강화됩니다.',
        'Builds on 24H2 with outbound SMB NTLM blocking options, phased NetBIOS/WINS retirement, SMB over QUIC (UDP 443), and stricter encryption auditing.'
      ),
      keyRules: [
        tx(
          'SMB 클라이언트 원격 아웃바운드 NTLM 폴백 차단 옵션 및 메시지 서명 검증 강화',
          'SMB client outbound NTLM fallback blocking options and tighter message signature verification'
        ),
        tx(
          'NetBIOS/LLMNR 이름 해석 의존도 축소 (직접 TCP 445 + DNS + WS-Discovery 필수화)',
          'Reduced NetBIOS/LLMNR name resolution reliance (direct TCP 445 + DNS + WS-Discovery required)'
        ),
        tx(
          'NTLM 폐지 로드맵에 따른 전용 로컬 계정(cmdkey) 또는 Kerberos/암호 보호 공유 필수',
          'Dedicated local account (cmdkey) or password-protected/Kerberos sharing essential under NTLM deprecation'
        ),
      ],
      rebootTrait: tx(
        '일반 SMB/NTLM 레지스트리는 서비스 재시작으로 즉시 반영되나, Winsock/TCP-IP 스택 초기화 또는 NetBIOS 바인딩 변경 시 재부팅 권장/필요',
        'Standard SMB/NTLM registry applies on service restart; reboot recommended/required for Winsock/TCP-IP reset or NetBIOS binding changes'
      ),
    },
  ];
}

export const WINDOWS_ERA_SUMMARIES: WindowsEraSummary[] = getWindowsEraSummaries();

export function getWindowsNetworkMatrix(): WindowsNetworkChangeItem[] {
  return [
    {
      id: 'smb_signing_24h2',
      era: 'win11_24h2',
      versionLabel: 'Win 11 24H2+',
      buildRange: tx('26100 이상', '26100+'),
      category: 'smb_signing',
      categoryLabel: tx('SMB 보안 서명', 'SMB Signing'),
      title: tx(
        '전 에디션 SMB 서명(Signing) 기본 강제 활성화',
        'SMB Signing Enforced by Default Across All Editions'
      ),
      defaultBehavior: tx(
        'Win 10~23H2는 워크그룹에서 선택 사항이었으나, 24H2부터 Home/Pro 포함 모든 연결에 RequireSecuritySignature=$true가 기본 적용됨.',
        'Optional in workgroups on Win 10~23H2, but RequireSecuritySignature=$true is enforced by default on Home/Pro starting in 24H2.'
      ),
      sharingImpact: tx(
        '서명을 꺼 둔 구형 NAS, 프린터, Win 10 혼용 PC 연결 시 네트워크 경로 오류 또는 STATUS_INVALID_SIGNATURE 실패 발생.',
        'Connecting to unsigned legacy NAS, printers, or Win 10 peers fails with network path errors or STATUS_INVALID_SIGNATURE.'
      ),
      mitigationStrategy: tx(
        'OS 빌드 26100+ 감지 시 안전 호환 모드에서 Server/Client RequireSecuritySignature를 일시 완화하거나, 보안 계정 모드에서 양단 SMB 3.x 서명 협상을 정렬.',
        'When build 26100+ is detected, temporarily relax Server/Client RequireSecuritySignature in Safe Compat mode, or align SMB 3.x signing in Dedicated Account mode.'
      ),
      affectedRegistryOrCmdlet: 'Set-SmbServerConfiguration / Set-SmbClientConfiguration -RequireSecuritySignature',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        'LanmanServer·LanmanWorkstation 서비스 재시작으로 즉시 적용 (재부팅 불필요)',
        'Applies immediately via LanmanServer & LanmanWorkstation restart (no reboot)'
      ),
    },
    {
      id: 'guest_auth_block',
      era: 'win11_24h2',
      versionLabel: 'Win 11 24H2+',
      buildRange: tx('26100 이상 (11 Pro 확대)', '26100+ (expanded on 11 Pro)'),
      category: 'guest_auth',
      categoryLabel: tx('비인증 게스트 차단', 'Guest Auth Blocked'),
      title: tx(
        '안전하지 않은 게스트 로그온(AllowInsecureGuestAuth) 전면 차단',
        'Insecure Guest Logons (AllowInsecureGuestAuth) Blocked'
      ),
      defaultBehavior: tx(
        'Windows 11 Pro 및 24H2+에서 무비밀번호 익명/게스트 SMB 폴백을 커널 단에서 차단함.',
        'Blocks passwordless anonymous/guest SMB fallback at the kernel level on Windows 11 Pro and 24H2+.'
      ),
      sharingImpact: tx(
        '"조직의 보안 정책에서 인증되지 않은 게스트 액세스를 차단하므로 이 공유 폴더에 액세스할 수 없습니다" 오류 및 0x80070035 발생.',
        'Triggers 0x80070035 and "You can\'t access this shared folder because your organization\'s security policies block unauthenticated guest access."'
      ),
      mitigationStrategy: tx(
        '안전 호환 모드 실행 시 EnableInsecureGuestLogons=$true 및 AllowInsecureGuestAuth=1을 자동 주입하며, 권장 방식인 전용 보안 계정 + AES-256-GCM USB 자동 채우기도 지원.',
        'Safe Compat mode injects EnableInsecureGuestLogons=$true and AllowInsecureGuestAuth=1, or use the recommended Dedicated Account + AES-256-GCM USB autofill.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters\\AllowInsecureGuestAuth',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        '레지스트리 반영 + LanmanWorkstation 재시작으로 즉시 적용 (재부팅 불필요)',
        'Applies immediately via registry update + LanmanWorkstation restart (no reboot)'
      ),
    },
    {
      id: 'ntlmv1_removal_24_26h2',
      era: 'win11_25_26h2',
      versionLabel: 'Win 11 24H2 ~ 26H2',
      buildRange: '26100 ~ 27xxx+',
      category: 'ntlm',
      categoryLabel: tx('NTLM 감축 및 인증 강화', 'NTLM Reduction & Auth'),
      title: tx(
        'NTLMv1 완전 제거 및 NTLMv2(LmCompatibilityLevel) · Outbound 차단 강화',
        'NTLMv1 Removal & NTLMv2 (LmCompatibilityLevel) / Outbound NTLM Restrictions'
      ),
      defaultBehavior: tx(
        'NTLMv1 프로토콜이 제거되고, Credential Guard 비활성화 기기에서도 취약 인증 폴백이 차단되며 25H2/26H2는 아웃바운드 NTLM 제한을 지원.',
        'Removes NTLMv1, blocks weak auth fallback even without Credential Guard, and adds outbound NTLM restrictions in 25H2/26H2.'
      ),
      sharingImpact: tx(
        '워크그룹 환경에서 암호 캐시가 어긋나면 System Error 5/86 ("지정한 네트워크 암호가 올바르지 않습니다") 무한 루프 발생.',
        'Stale or mismatched credential caches cause System Error 5/86 ("The specified network password is not correct") loops in workgroups.'
      ),
      mitigationStrategy: tx(
        'LmCompatibilityLevel=3(NTLMv2 응답 전용) 이상 정렬 + 기존 충돌 세션(`net use /delete`) 정리 + `cmdkey` 서버별 자격 증명 선행 등록.',
        'Align LmCompatibilityLevel=3 (NTLMv2 response only), clear conflicting sessions (`net use /delete`), and pre-register per-host credentials via `cmdkey`.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\LmCompatibilityLevel & RestrictSendingNTLMTraffic',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        'LSA·LanmanWorkstation 반영 즉시 적용 (도메인 그룹 정책 강제 시 재로그온/재부팅 권장)',
        'Applies immediately to LSA/LanmanWorkstation (re-logon/reboot recommended if domain GPO enforced)'
      ),
    },
    {
      id: 'netbios_wins_phaseout',
      era: 'win11_25_26h2',
      versionLabel: 'Win 11 25H2 / 26H2',
      buildRange: '26200 ~ 27xxx+',
      category: 'name_resolution',
      categoryLabel: tx('이름 해석 (NetBIOS/WINS)', 'Name Resolution (NetBIOS/WINS)'),
      title: tx(
        'NetBIOS/WINS · LLMNR 축소 및 직접 TCP 445 · WS-Discovery 전환',
        'NetBIOS/WINS & LLMNR Phase-out; Direct TCP 445 & WS-Discovery Transition'
      ),
      defaultBehavior: tx(
        '레거시 브로드캐스트 이름 확인(NetBT/WINS/LLMNR) 의존성이 제거·비활성화 방향으로 전환됨.',
        'Legacy broadcast name resolution (NetBT/WINS/LLMNR) is progressively deprecated and disabled.'
      ),
      sharingImpact: tx(
        '호스트 이름(\\PC-NAME\\폴더) 탐색이 네트워크 목록에 뜨지 않거나 시간 초과로 실패.',
        'Browsing by hostname (\\\\PC-NAME\\Share) fails to appear in Network Neighborhood or times out.'
      ),
      mitigationStrategy: tx(
        'FDResPub · fdPHost · SSDPSrv 서비스를 자동 시작으로 복원하고 IP 기반 직접 UNC(\\\\192.168.x.x\\공유) 연결 및 TCP 445 사전 프로브 우선 사용.',
        'Restore FDResPub, fdPHost, and SSDPSrv to Automatic start; prioritize direct IP UNC (\\\\192.168.x.x\\Share) with TCP 445 pre-probe.'
      ),
      affectedRegistryOrCmdlet: 'NetBT\\Parameters\\Interfaces\\*\\NetbiosOptions + FDResPub/fdPHost',
      rebootLevel: 'reboot_recommended',
      rebootNote: tx(
        '서비스 기동은 즉시 적용되나 NetbiosOptions 인터페이스 바인딩 변경·Winsock 초기화 시 재부팅 권장',
        'Services start immediately; reboot recommended if NetbiosOptions binding changed or Winsock was reset'
      ),
    },
    {
      id: 'smb_quic_encryption',
      era: 'win11_25_26h2',
      versionLabel: 'Win 11 24H2 ~ 26H2',
      buildRange: '26100 ~ 27xxx+',
      category: 'quic_encryption',
      categoryLabel: tx('SMB 암호화 & QUIC', 'SMB Encryption & QUIC'),
      title: tx(
        'SMB over QUIC(UDP 443) 확대 및 암호화 기본 자세 강화',
        'SMB over QUIC (UDP 443) Expansion & Stricter Default Encryption'
      ),
      defaultBehavior: tx(
        '최신 Windows 11에서는 TCP 445 외에 QUIC(TLS 1.3) 전송과 SMB 3.1.1 AES 암호화 감사 정책이 강화됨.',
        'Modern Windows 11 expands QUIC (TLS 1.3) transport alongside TCP 445 and enforces stricter SMB 3.1.1 AES encryption posture.'
      ),
      sharingImpact: tx(
        '암호화 필수 정책이 켜진 호스트와 구형 Win 10 클라이언트 간 핸드셰이크 불일치 가능.',
        'Possible handshake mismatch between hosts requiring encryption and older Win 10 clients.'
      ),
      mitigationStrategy: tx(
        '호스트 SMB 3.1.1 호환 유지 + 공용(Public) 프로필이 강제된 어댑터를 개인(Private) 프로필로 자동 교정하여 LAN 내 파일 공유 허용.',
        'Preserve SMB 3.1.1 compatibility and automatically switch Public-locked adapters to Private profile for LAN sharing.'
      ),
      affectedRegistryOrCmdlet: 'Get-SmbServerConfiguration -EncryptData / Set-NetConnectionProfile -NetworkCategory Private',
      rebootLevel: 'none',
      rebootNote: tx(
        '네트워크 프로필 및 방화벽 규칙은 즉시 적용됨 (재부팅 불필요)',
        'Network profile and firewall rules apply immediately (no reboot)'
      ),
    },
    {
      id: 'lsa_anonymous_win10_11',
      era: 'win10',
      versionLabel: 'Win 10 ~ Win 11 23H2',
      buildRange: '18362 ~ 22631',
      category: 'firewall_lsa',
      categoryLabel: tx('LSA 익명 및 방화벽', 'LSA Anonymous & Firewall'),
      title: tx(
        'LSA 익명 토큰(everyoneincludesanonymous) & 공용 프로필 차단',
        'LSA Anonymous Token (everyoneincludesanonymous) & Public Profile Blocking'
      ),
      defaultBehavior: tx(
        'Windows 10/11 기본값에서 restrictanonymous=1, LimitBlankPasswordUse=1 및 공용 네트워크 445 차단이 적용됨.',
        'Windows 10/11 defaults enforce restrictanonymous=1, LimitBlankPasswordUse=1, and block TCP 445 on Public profiles.'
      ),
      sharingImpact: tx(
        '빈 암호 Windows 계정 접속 거부 및 Wi-Fi 재연결 시 공용(Public) 전환으로 공유 먹통.',
        'Rejects blank-password logons and silently breaks sharing if Wi-Fi reconnect switches the profile to Public.'
      ),
      mitigationStrategy: tx(
        '게스트/보안 계정 모드에 따라 LSA 3종 키와 AhBiShare-SMB-445 인바운드 규칙을 원클릭 정렬하고 작업 종료 후 보안 원복 지원.',
        'Aligns the 3 LSA keys and AhBiShare-SMB-445 inbound rule in one click by auth mode, with full security rollback after work.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa + netsh advfirewall',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        'LanmanServer 서비스 새로고침으로 즉시 적용 (재부팅 불필요)',
        'Applies immediately via LanmanServer refresh (no reboot)'
      ),
    },
    {
      id: 'smb1_deprecation_win10_11',
      era: 'win11_21_23',
      versionLabel: 'Win 10 1709 ~ Win 11 26H2',
      buildRange: '16299 ~ 27xxx+',
      category: 'smb_signing',
      categoryLabel: tx('SMBv1 폐기', 'SMBv1 Deprecation'),
      title: tx(
        'SMBv1 프로토콜 완전 제거 및 SMB 2.0/3.1.1 강제',
        'SMBv1 Removal & SMB 2.0/3.1.1 Enforcement'
      ),
      defaultBehavior: tx(
        'Windows 11부터 SMBv1 클라이언트/서버 구성요소가 기본 설치에서 제외되며, Win 10도 활성화 시 랜섬웨어 취약 경고 발생.',
        'Windows 11 omits SMBv1 client/server by default; enabling it on Win 10 triggers ransomware vulnerability warnings.'
      ),
      sharingImpact: tx(
        'SMBv1 전용 구형 장치 연결 불가. 단, Windows PC 간 공유는 SMB 2/3로 완전 대체 가능.',
        'Legacy SMBv1-only hardware cannot connect, though PC-to-PC sharing is fully covered by SMB 2/3.'
      ),
      mitigationStrategy: tx(
        'SMBv1을 재활성화하지 않고(재부팅·보안 위험 유발 방지) SMB 2/3 + TCP 445 직접 연결 파이프라인으로 호환성 확보.',
        'Achieves compatibility over SMB 2/3 + direct TCP 445 without re-enabling SMBv1 (avoiding reboots and security risks).'
      ),
      affectedRegistryOrCmdlet: 'Get-SmbServerConfiguration -EnableSMB1Protocol',
      rebootLevel: 'reboot_required',
      rebootNote: tx(
        '참고: 만약 사용자가 직접 Windows 기능(SMBv1)을 켜거나 끄면 커널 드라이버 교체로 재부팅이 필수이지만 AhBiShare는 SMBv1을 건드리지 않아 재부팅이 필요 없음',
        'Note: Toggling SMBv1 Windows Feature manually requires reboot for kernel drivers, but AhBiShare avoids touching SMBv1 by default'
      ),
    },
    {
      id: 'rpc_printer_privacy_24_26h2',
      era: 'win11_25_26h2',
      versionLabel: 'Win 11 22H2 ~ 26H2',
      buildRange: '22621 ~ 27xxx+',
      category: 'rpc_printer',
      categoryLabel: tx('RPC · 프린터 스풀러', 'RPC · Print Spooler'),
      title: tx(
        'RPC over TCP 기본 전환 및 프린터 RPC 개인정보 서명 강제 (0x0000011b / 0x00000709)',
        'RPC over TCP Default & Printer RPC Privacy Level Enforcement (0x0000011b / 0x00000709)'
      ),
      defaultBehavior: tx(
        'Microsoft PrintNightmare 보안 패치 및 Win 11 24H2~26H2에서 인쇄 스풀러 RPC가 기본 Named Pipes 대신 엄격한 인증 서명(RpcAuthnLevelPrivacyEnabled)과 동적 TCP 포트를 우선 사용함.',
        'Post-PrintNightmare patches and Win 11 24H2~26H2 default Print Spooler RPC to privacy-level signing (RpcAuthnLevelPrivacyEnabled) over TCP instead of Named Pipes.'
      ),
      sharingImpact: tx(
        '파일 공유는 정상인데 공유 프린터 연결 시 "Windows에서 프린터에 연결할 수 없습니다 (0x0000011b 또는 0x00000709)" 오류 발생.',
        'File sharing works, yet shared printer connections fail with "Windows cannot connect to the printer (0x0000011b / 0x00000709)".'
      ),
      mitigationStrategy: tx(
        'RpcAuthnLevelPrivacyEnabled=0 및 Printers\\RPC\\RpcUseNamedPipeProtocol=1, RpcProtocols=7 설정을 호스트·클라이언트 양단에 정렬하고 Spooler 서비스를 즉시 재시작합니다.',
        'Set RpcAuthnLevelPrivacyEnabled=0, RpcUseNamedPipeProtocol=1, and RpcProtocols=7 on both host and client, then restart Spooler.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\System\\CurrentControlSet\\Control\\Print\\RpcAuthnLevelPrivacyEnabled & Printers\\RPC',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        'Print Spooler(Spooler) 서비스 즉시 재시작으로 대부분 재부팅 없이 반영됨 (잠금 시 재부팅 권장)',
        'Usually applies immediately via Spooler restart (reboot recommended if Spooler is locked)'
      ),
    },
    {
      id: 'point_and_print_26h2',
      era: 'win11_24h2',
      versionLabel: 'Win 11 21H2 ~ 26H2',
      buildRange: '22000 ~ 27xxx+',
      category: 'rpc_printer',
      categoryLabel: tx('RPC · 프린터 스풀러', 'RPC · Print Spooler'),
      title: tx(
        'Point and Print 공유 프린터 드라이버 자동 설치 관리자 제한',
        'Point and Print Admin Restriction for Shared Printer Driver Installs'
      ),
      defaultBehavior: tx(
        '비관리자 일반 사용자 계정이 호스트 PC의 공유 프린터 드라이버를 끌어올 때 보안 경고 또는 차단(RestrictDriverInstallationToAdministrators=1)이 기본 동작함.',
        'Non-admin users pulling shared printer drivers from a host encounter prompts or blocks (RestrictDriverInstallationToAdministrators=1) by default.'
      ),
      sharingImpact: tx(
        '클라이언트 PC에서 공유 프린터 추가 시 드라이버 설치 권한 거부 및 연결 중단 발생.',
        'Adding a shared printer on client PCs fails with driver elevation denial.'
      ),
      mitigationStrategy: tx(
        '신뢰할 수 있는 내부 LAN 공유 프린터 작업 시 PointAndPrint 정책(NoWarningNoElevationOnInstall=1, UpdatePromptSettings=2)을 호환 정렬합니다.',
        'Configure PointAndPrint policy (NoWarningNoElevationOnInstall=1, UpdatePromptSettings=2) for trusted internal LAN printer sharing.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        'Print Spooler 서비스 재시작 즉시 반영 (재부팅 불필요)',
        'Applies immediately on Print Spooler restart (no reboot)'
      ),
    },
    {
      id: 'uac_remote_token_filter_matrix',
      era: 'win11_24h2',
      versionLabel: tx('Win 10 ~ Win 11 26H2 (워크그룹)', 'Win 10 ~ Win 11 26H2 (Workgroup)'),
      buildRange: tx('전 빌드 공통 (Home/Pro)', 'All Builds (Home/Pro)'),
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        'UAC 원격 토큰 필터링 (LocalAccountTokenFilterPolicy) 완화',
        'UAC Remote Token Filtering Relaxation (LocalAccountTokenFilterPolicy)'
      ),
      defaultBehavior: tx(
        '워크그룹 환경의 Windows는 보안상 로컬 관리자 계정으로 네트워크 원격 접속(관리 공유·일부 공유 폴더) 시 관리자 토큰을 제거(Filter)함.',
        'In workgroups, Windows strips elevated admin tokens on remote network logons with local admin accounts by default.'
      ),
      sharingImpact: tx(
        '올바른 Windows 계정/암호를 입력해도 System Error 5(액세스 거부) 또는 관리 공유(C$, D$) 연결 거부가 발생함.',
        'Triggers System Error 5 (Access Denied) or admin share (C$, D$) rejection even with valid local admin credentials.'
      ),
      mitigationStrategy: tx(
        'OS 업데이트 없이 LocalAccountTokenFilterPolicy=1 레지스트리 주입만으로 즉시 해결 가능하며, 작업 종료 후 표준 보안 복원 시 0으로 원복됨.',
        'Resolved immediately via LocalAccountTokenFilterPolicy=1 registry value (no OS update needed) and restored to 0 on security rollback.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\LocalAccountTokenFilterPolicy',
      rebootLevel: 'none',
      rebootNote: tx(
        '레지스트리 적용 즉시 반영 (재부팅 불필요)',
        'Applies immediately upon registry update (no reboot)'
      ),
    },
    {
      id: 'smb1_optional_feature_matrix',
      era: 'win11_21_23',
      versionLabel: 'Win 10 1709 ~ Win 11 26H2',
      buildRange: tx('구형 NAS · 복합기 연동', 'Legacy NAS · MFP Integration'),
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        '구형 NAS · 스캐너 전용 SMB 1.0/CIFS 클라이언트 선택적 기능 설치',
        'SMB 1.0/CIFS Client Optional Feature for Legacy NAS & Scanners'
      ),
      defaultBehavior: tx(
        'Windows 11 및 최신 Windows 10 클린 설치 환경에는 SMB1Protocol-Client 선택적 기능 드라이버(mrxsmb10.sys)가 기본 미설치됨.',
        'Clean Windows 11 and modern Windows 10 installs omit the optional SMB1Protocol-Client driver (mrxsmb10.sys).'
      ),
      sharingImpact: tx(
        '일반 PC 간 공유에는 전혀 필요 없으나, 2015년 이전 구형 NAS·사무용 복합기 연결 시 오류 53 또는 지원되지 않는 프로토콜 실패 발생.',
        'Unnecessary for Windows-to-Windows sharing, but pre-2015 NAS/MFPs fail with Error 53 or unsupported protocol errors.'
      ),
      mitigationStrategy: tx(
        '필요한 경우에만 OS 호환 매트릭스에서 [SMBv1 클라이언트 설치]를 명시적으로 실행해 DISM 기능 활성화 후 재부팅합니다.',
        'Only when needed, run [Install SMBv1 Client] in the OS Matrix to enable via DISM and reboot.'
      ),
      affectedRegistryOrCmdlet: 'Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol-Client -All',
      rebootLevel: 'reboot_required',
      rebootNote: tx(
        '커널 드라이버(mrxsmb10.sys) 적재를 위해 시스템 재부팅 필수',
        'System reboot required to load kernel driver (mrxsmb10.sys)'
      ),
    },
    {
      id: 'msa_pin_only_ntlm_matrix',
      era: 'win11_24h2',
      versionLabel: tx('Win 11 Home / Pro (개인 PC)', 'Win 11 Home / Pro (Personal PC)'),
      buildRange: tx('Windows Hello · MSA 환경', 'Windows Hello · MSA'),
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        'Microsoft 계정(MSA) · Windows Hello PIN 전용 로그인 시 NTLM 해시 누락',
        'Missing Local NTLM Hash on Microsoft Account (MSA) / Windows Hello PIN-Only Sign-in'
      ),
      defaultBehavior: tx(
        'Microsoft 계정과 PIN/지문 로그인만 사용하고 로컬 암호를 한 번도 캐시하지 않은 PC는 로컬 SAM NTLM 비밀번호 해시가 생성되지 않음.',
        'PCs using only MSA + PIN/biometric login without a cached local password lack an NTLM password hash in the local SAM.'
      ),
      sharingImpact: tx(
        '타 PC에서 소유자 MS 계정 이메일로 접속 시 암호가 맞는데도 오류 1326("사용자 이름 또는 암호가 올바르지 않습니다")이 반복됨.',
        'Remote sign-ins with the owner MSA email fail repeatedly with Error 1326 even when entering the correct account password.'
      ),
      mitigationStrategy: tx(
        '별도 Windows 패치가 아니라 AhBiShare의 [전용 보안 공유 계정(AhBiShare)] 모드로 로컬 공유 계정을 자동 생성해 연결하면 100% 해결됨.',
        'Solved 100% without OS patches by using AhBiShare [Dedicated Secure Account (AhBiShare)] mode to provision a local SAM account.'
      ),
      affectedRegistryOrCmdlet: 'New-LocalUser -Name AhBiShare + cmdkey /add',
      rebootLevel: 'none',
      rebootNote: tx(
        '로컬 공유 계정 생성 즉시 적용 (재부팅 불필요)',
        'Applies immediately upon local account creation (no reboot)'
      ),
    },
    {
      id: 'home_edition_gpedit_matrix',
      era: 'win11_24h2',
      versionLabel: 'Windows 10 / 11 Home',
      buildRange: tx('Home 에디션 (gpedit.msc 미포함)', 'Home Edition (no gpedit.msc)'),
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        'Windows Home 에디션의 그룹 정책 편집기(gpedit.msc) 미지원 대응',
        'Group Policy Editor (gpedit.msc) Absence on Windows Home Edition'
      ),
      defaultBehavior: tx(
        'Home 에디션에는 로컬 그룹 정책 편집기(gpedit.msc) UI가 빠져 있어 타사 가이드의 정책 변경을 그대로 따라 할 수 없음.',
        'Home editions lack the gpedit.msc snap-in, preventing users from applying standard Group Policy guides.'
      ),
      sharingImpact: tx(
        'Pro 전용 안내대로 진행 시 "gpedit.msc를 찾을 수 없습니다" 오류로 24H2 게스트/서명 차단을 풀지 못함.',
        'Following Pro-only guides hits "Windows cannot find gpedit.msc", leaving 24H2 guest/signing blocks unresolved.'
      ),
      mitigationStrategy: tx(
        'Home 에디션에 별도 gpedit 애드온을 설치할 필요 없이 AhBiShare가 서비스 레지스트리와 Policies 키를 동시에 직접 주입해 동일 효과를 구현함.',
        'AhBiShare writes both service parameters and Policies registry keys directly—achieving full parity without third-party gpedit hacks.'
      ),
      affectedRegistryOrCmdlet: 'LanmanWorkstation\\Parameters + Policies\\Microsoft\\Windows\\LanmanWorkstation',
      rebootLevel: 'service_restart',
      rebootNote: tx(
        '레지스트리 동시 주입 + 서비스 재시작 즉시 적용',
        'Applies immediately via dual registry write + service restart'
      ),
    },
    {
      id: 'win11_24h2_kb_ubr_matrix',
      era: 'win11_24h2',
      versionLabel: tx('Win 11 24H2 누적 패치(KB)', 'Win 11 24H2 Cumulative Update (KB)'),
      buildRange: 'Build 26100.1742 ~ 26100.2314+',
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        'Win 11 24H2 초기 릴리스 SMB·네트워크 회귀 및 누적 업데이트(KB) 권고',
        'Early Win 11 24H2 Release SMB/Network Regressions & Cumulative Update (KB) Advisory'
      ),
      defaultBehavior: tx(
        '24H2 초기 빌드(UBR 2033 이하)에서 간헐적 NTLM·Kerberos 서명 협상 및 Wi-Fi 네트워크 탐색 지연이 보고되었으며 후속 KB(KB5044284 / KB5046617 등)로 개선됨.',
        'Early 24H2 builds (UBR <= 2033) showed intermittent NTLM/Kerberos signing negotiation and Wi-Fi discovery delays, fixed in KB5044284 / KB5046617+.'
      ),
      sharingImpact: tx(
        '정책과 방화벽이 정상인데도 초기 24H2 PC에서만 무작위 연결 끊김이나 프린터 RPC 응답 지연이 발생할 수 있음.',
        'Random drops or printer RPC delays can occur on early 24H2 builds even when policies and firewall rules look valid.'
      ),
      mitigationStrategy: tx(
        'OS 진단에서 24H2 초기 UBR(<2314) 감지 시 Windows Update 설정 창 바로가기를 안내하며, 일반 빌드에서는 별도 업데이트 없이 즉시 공유 가능.',
        'When early 24H2 UBR (<2314) is detected, opens Windows Update guidance; newer builds work immediately without extra updates.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\UBR & Win32_QuickFixEngineering',
      rebootLevel: 'reboot_recommended',
      rebootNote: tx(
        'Windows 누적 업데이트 설치 시에만 OS 업데이트 자체 재부팅 필요',
        'Reboot needed only when installing Windows Cumulative Updates'
      ),
    },
    {
      id: 'duplicate_machine_sid_24h2',
      era: 'win11_25_26h2',
      versionLabel: 'Win 11 24H2 / 25H2 (KB5064081+)',
      buildRange: 'Build 26100.4946+ · 26200+',
      category: 'os_update_feature',
      categoryLabel: tx('별도 패치 · 기능', 'Additional Patch / Feature'),
      title: tx(
        'OS 복제(디스크 클론) PC 간 중복 Machine SID SMB 인증 차단 (Event 6167 / 오류 86)',
        'Duplicate Machine SID SMB Auth Block on Cloned PCs (Event 6167 / Error 86)'
      ),
      defaultBehavior: tx(
        'Sysprep 없이 동일 디스크 이미지로 복제된 두 PC는 로컬 Machine Domain SID(S-1-5-21-...) 접두사가 같으며, KB5064081/KB5065426 이후 LSA가 동일 SID Peer의 SMB 인증을 보안상 거부함.',
        'PCs cloned without Sysprep share an identical Machine SID prefix (S-1-5-21-...); since KB5064081/KB5065426, LSA rejects SMB auth from duplicate-SID peers.'
      ),
      sharingImpact: tx(
        '올바른 계정·암호나 Guest 설정을 맞추어도 연결 시 System Error 86 / 1326이 발생하고 System 이벤트 로그에 LsaSrv Event ID 6167이 기록됨.',
        'Even valid credentials or open Guest policies fail with System Error 86 / 1326 and log LsaSrv Event ID 6167 in the System event log.'
      ),
      mitigationStrategy: tx(
        'OS 매트릭스 [중복 SID 차단 해제 KIR(1517186191=0)]을 양단 PC에 적용 후 재부팅하거나 Sysprep 일반화를 수행하면 즉시 해결됨.',
        'Apply [Duplicate SID KIR Override (1517186191=0)] in the OS Matrix on both PCs and reboot, or generalize with Sysprep.'
      ),
      affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Policies\\Microsoft\\FeatureManagement\\Overrides\\1517186191 = 0',
      rebootLevel: 'reboot_required',
      rebootNote: tx(
        'KIR 레지스트리(1517186191=0) 적용 후 커널 LSA 반영을 위해 재부팅 필수',
        'Reboot required after applying KIR Override (1517186191=0) for kernel LSA reload'
      ),
    },
  ];
}

export const WINDOWS_NETWORK_MATRIX: WindowsNetworkChangeItem[] = getWindowsNetworkMatrix();

export function computeCompatibilityScoreAndIssues(
  status: Omit<OsNetworkPolicyStatus, 'compatibilityScore' | 'detectedIssues'>
): { compatibilityScore: number; detectedIssues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (status.networkProfile === 'Public') {
    score -= 25;
    issues.push(
      tx(
        '현재 네트워크 프로필이 공용(Public)으로 설정되어 TCP 445 인바운드 공유와 탐색이 차단될 수 있습니다.',
        'Current network profile is Public; inbound TCP 445 sharing and network discovery may be blocked.'
      )
    );
  }
  if (!status.lanmanServerRunning) {
    score -= 20;
    issues.push(
      tx(
        'LanmanServer(Server) 서비스가 중지되어 이 PC의 폴더를 공유할 수 없습니다.',
        'LanmanServer (Server) service is stopped; folders on this PC cannot be shared.'
      )
    );
  }
  if (!status.lanmanWorkstationRunning) {
    score -= 20;
    issues.push(
      tx(
        'LanmanWorkstation 서비스가 중지되어 다른 PC의 공유 폴더에 접속할 수 없습니다.',
        'LanmanWorkstation service is stopped; cannot connect to shared folders on other PCs.'
      )
    );
  }
  if (!status.fdResPubRunning) {
    score -= 10;
    issues.push(
      tx(
        'FDResPub(함수 검색 리소스 게시)가 비활성 상태여서 LAN 탐색 목록에 표시되지 않을 수 있습니다.',
        'FDResPub (Function Discovery Resource Publication) is inactive; this PC may not appear in LAN discovery.'
      )
    );
  }
  if ((status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && status.smbClientSigningRequired) {
    score -= 15;
    issues.push(
      tx(
        'Win 11 24H2/26H2 기본 SMB 클라이언트 서명 강제가 켜져 있어 구형 NAS·Win 10 공유 접속이 차단될 수 있습니다.',
        'Win 11 24H2/26H2 default SMB client signing enforcement is active; legacy NAS or Win 10 unsigned shares may be blocked.'
      )
    );
  }
  if ((status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && !status.allowInsecureGuestAuth) {
    score -= 10;
    issues.push(
      tx(
        '비인증 게스트 로그온(AllowInsecureGuestAuth)이 차단되어 간편 무비밀번호 공유 연결 시 0x80070035 오류가 발생할 수 있습니다.',
        'Insecure guest logons (AllowInsecureGuestAuth) are blocked; passwordless Guest mounts may fail with 0x80070035.'
      )
    );
  }
  if (status.guestNetworkLogonDenied) {
    score -= 10;
    issues.push(
      tx(
        '로컬 보안 정책(SeDenyNetworkLogonRight)이 Guest 네트워크 로그온을 거부 중이어서 타 PC 무비밀번호 접속 시 시스템 오류 1385가 발생할 수 있습니다.',
        'Local Security Policy (SeDenyNetworkLogonRight) denies Guest network logon; passwordless incoming access may fail with Error 1385.'
      )
    );
  }
  if (status.firewall445Allowed === false) {
    score -= 10;
    issues.push(
      tx(
        'Windows 방화벽에서 TCP 445 파일 공유 인바운드 규칙이 비활성 상태입니다 (오류 53 원인).',
        'Windows Firewall TCP 445 File Sharing inbound rule is disabled (causes Error 53).'
      )
    );
  }
  if (status.limitBlankPasswordUse && status.allowInsecureGuestAuth) {
    score -= 5;
    issues.push(
      tx(
        'LSA 빈 암호 네트워크 로그온 제한(LimitBlankPasswordUse=1)이 켜져 있어 무비밀번호 연결 시 오류 86이 발생할 수 있습니다.',
        'LSA blank password network restriction (LimitBlankPasswordUse=1) is enabled; passwordless connections may fail with Error 86.'
      )
    );
  }
  if (status.lmCompatibilityLevel !== null && status.lmCompatibilityLevel < 3) {
    score -= 10;
    issues.push(
      tx(
        `NTLM 호환성 수준(${status.lmCompatibilityLevel})이 낮아 Win 11 24H2+ 인증 협상에서 거부될 수 있습니다.`,
        `NTLM compatibility level (${status.lmCompatibilityLevel}) is below 3 and may be rejected by Win 11 24H2+ auth negotiation.`
      )
    );
  }
  if (!status.printSpoolerRunning) {
    score -= 8;
    issues.push(
      tx(
        'Print Spooler(Spooler) 서비스가 중지되어 공유 프린터 연결이 불가능합니다.',
        'Print Spooler (Spooler) service is stopped; shared printer connections cannot work.'
      )
    );
  }
  if ((status.osEra === 'win11_21_23' || status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && !status.rpcAuthnLevelPrivacyDisabled) {
    score -= 7;
    issues.push(
      tx(
        '프린터 RPC 개인정보 인증 강제(RpcAuthnLevelPrivacyEnabled)가 유지되어 혼합 OS 프린터 공유 시 0x0000011b 오류가 발생할 수 있습니다.',
        'Printer RPC privacy enforcement (RpcAuthnLevelPrivacyEnabled) is active; mixed-OS printer sharing may fail with 0x0000011b.'
      )
    );
  }
  if (status.forceGuest) {
    score -= 10;
    issues.push(
      tx(
        'LSA forceguest=1(Guest 전용 강제)이 켜져 있어 일반 보안 계정 인증까지 Guest로 강제 매핑될 수 있습니다(오류 86 원인). Classic(forceguest=0) 전환이 권장됩니다.',
        'LSA forceguest=1 (Guest-only) is enabled and may force account logons into Guest (causes Error 86). Switching to Classic (forceguest=0) is recommended.'
      )
    );
  }
  if (typeof status.minimumPasswordLength === 'number' && status.minimumPasswordLength > 0 && status.allowInsecureGuestAuth) {
    score -= 5;
    issues.push(
      tx(
        `로컬 최소 암호 길이(MinimumPasswordLength=${status.minimumPasswordLength})로 인해 Guest 빈 암호 초기화(코드 2245)가 실패할 수 있습니다.`,
        `Minimum password length policy (MinimumPasswordLength=${status.minimumPasswordLength}) may block clearing the Guest password (code 2245).`
      )
    );
  }
  if (status.smbBlockNtlm) {
    score -= 10;
    issues.push(
      tx(
        'SMB 클라이언트 BlockNTLM 정책이 활성화되어 워크그룹 NTLMv2 공유 인증이 차단될 수 있습니다.',
        'SMB client BlockNTLM policy is enabled; workgroup NTLMv2 share authentication may be blocked.'
      )
    );
  }
  if (status.smbRequireEncryption) {
    score -= 5;
    issues.push(
      tx(
        'SMB 클라이언트 RequireEncryption 정책이 활성화되어 비암호화 LAN 공유 연결이 실패할 수 있습니다.',
        'SMB client RequireEncryption policy is enabled; unencrypted LAN share mounts may fail.'
      )
    );
  }
  if (status.duplicateSidEvent6167Detected && status.kirOverride1517186191 !== 0) {
    score -= 15;
    issues.push(
      tx(
        '시스템 로그에서 OS 복제 중복 Machine SID 차단(LsaSrv Event 6167 · KB5065426)이 감지되었습니다. [중복 SID KIR 우회] 적용 후 재부팅이 필요합니다.',
        'Duplicate cloned Machine SID block detected in System log (LsaSrv Event 6167 · KB5065426). Apply [Duplicate SID KIR Override] and reboot.'
      )
    );
  }
  if (status.msaPinOnlyRisk) {
    score -= 5;
    issues.push(
      tx(
        'Microsoft 계정·Windows Hello PIN 전용 로그인 환경이 감지되었습니다. 호스트 공유 시 일반 계정 대신 [전용 보안 공유 계정] 모드를 사용하세요.',
        'Microsoft Account / Windows Hello PIN-only sign-in detected. Use [Dedicated Secure Account] mode instead of your personal sign-in.'
      )
    );
  }
  if (status.osBuild === 26100 && typeof status.osUbr === 'number' && status.osUbr > 0 && status.osUbr < 2314) {
    score -= 5;
    issues.push(
      tx(
        `Windows 11 24H2 초기 리비전(26100.${status.osUbr})입니다. 간헐적 SMB·탐색 오류 시 Windows Update 최신 누적 패치(KB) 적용을 권장합니다.`,
        `Early Windows 11 24H2 revision (26100.${status.osUbr}). Installing the latest Windows Update cumulative KB is recommended if intermittent SMB errors occur.`
      )
    );
  }
  if (status.pendingRebootFlag) {
    issues.push(
      tx(
        'Windows에 대기 중인 보류 재부팅(Pending Reboot / 네트워크 스택 변경) 플래그가 감지되었습니다.',
        'A Pending Reboot flag (Windows Update / network stack change) is present on this PC.'
      )
    );
  }

  return {
    compatibilityScore: Math.max(15, Math.min(100, score)),
    detectedIssues: issues,
  };
}

export function evaluateRebootJudgment(params: {
  mode: PolicyPatchMode;
  netbiosStateChanged?: boolean;
  smb1Changed?: boolean;
  priorPendingReboot?: boolean;
  spoolerRestartFailed?: boolean;
  restartedServices: string[];
}): RebootJudgment {
  const { mode, netbiosStateChanged, smb1Changed, priorPendingReboot, spoolerRestartFailed, restartedServices } = params;

  if (mode === 'kir_duplicate_sid_compat') {
    return {
      level: 'reboot_required',
      title: tx(
        '컴퓨터 재부팅 필수 (Win 11 24H2~25H2 중복 SID KIR 우회 반영)',
        'Reboot Required (Win 11 24H2~25H2 Duplicate SID KIR Override Applied)'
      ),
      reason: tx(
        'FeatureManagement\\Overrides\\1517186191=0(중복 Machine SID 차단 우회 KIR)을 적용했습니다. LSA 커널이 새 정책을 적재하려면 호스트·클라이언트 모두 Windows 재부팅이 반드시 필요합니다.',
        'Applied FeatureManagement\\Overrides\\1517186191=0 (duplicate Machine SID KIR override). Both host and client PCs must reboot so the LSA kernel loads this policy.'
      ),
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
      rebootRecommended: true,
      canRebootNow: true,
    };
  }

  if (mode === 'deep_stack_reset' || mode === 'enable_smbv1_client' || mode === 'legacy_smb1_enable' || smb1Changed) {
    const isSmbv1Rollback = mode === 'legacy_bridge_rollback' && smb1Changed;
    const isSmbv1 = mode === 'enable_smbv1_client' || mode === 'legacy_smb1_enable' || (smb1Changed && !isSmbv1Rollback);
    return {
      level: isSmbv1Rollback ? 'reboot_recommended' : 'reboot_required',
      title: isSmbv1Rollback
        ? tx('SMB 1.0 비활성화 원복 완료 · 재부팅 권장', 'SMB 1.0 Disabled & Rolled Back · Reboot Recommended')
        : isSmbv1
          ? tx('컴퓨터 재부팅 필수 (SMB 1.0 커널 드라이버 활성화)', 'Reboot Required (SMB 1.0 Kernel Driver Enabled)')
          : tx('컴퓨터 재부팅 필요 (네트워크 스택·커널 변경)', 'Reboot Required (Network Stack / Kernel Reset)'),
      reason: isSmbv1Rollback
        ? tx(
            '보안 정책 복원과 함께 SMB 1.0 기능을 비활성화했습니다. 커널에서 레거시 드라이버를 완전히 언로드하려면 재부팅을 권장합니다.',
            'Security policies were restored and SMB 1.0 disabled. A reboot is recommended to unload legacy kernel drivers completely.'
          )
        : mode === 'deep_stack_reset'
          ? tx(
              'Winsock 카탈로그(netsh winsock reset) 및 TCP/IP 프로토콜 스택을 초기화했습니다. 커널 소켓 계층에 새 설정을 적재하려면 Windows 재부팅이 반드시 필요합니다.',
              'Reset the Winsock catalog (netsh winsock reset) and TCP/IP stack. A Windows reboot is required to reload the kernel socket layer.'
            )
          : tx(
              '구형 PC·장비 호환용 SMB 1.0/CIFS 프로토콜 기능이 설치되었습니다. 레거시 SMB1 커널 드라이버를 적재하려면 Windows 재부팅이 반드시 필요합니다.',
              'SMB 1.0/CIFS protocol feature was enabled for legacy compatibility. A Windows reboot is required to load the SMB1 kernel driver.'
            ),
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
      rebootRecommended: true,
      canRebootNow: true,
    };
  }

  if (priorPendingReboot || netbiosStateChanged || spoolerRestartFailed) {
    return {
      level: 'reboot_recommended',
      title: tx(
        '컴퓨터 재부팅 권장 (서비스 잠금 / 보류된 변경 감지)',
        'Reboot Recommended (Locked Service / Pending System Reboot Detected)'
      ),
      reason: spoolerRestartFailed
        ? tx(
            'Print Spooler 서비스가 다른 프로세스에 의해 잠겨 즉시 재시작되지 못했습니다. RPC 프린터 공유 정책 반영을 위해 재부팅을 권장합니다.',
            'Print Spooler was locked by another process and could not restart immediately. A reboot is recommended to apply printer RPC changes.'
          )
        : netbiosStateChanged
          ? tx(
              'SMB 서비스는 즉시 새로고침되었으나, 네트워크 어댑터의 NetBIOS over TCP/IP(NetbiosOptions) 설정이 변경되어 완전한 이름 해석 반영을 위해 재부팅을 권장합니다.',
              'SMB services refreshed immediately, but NetbiosOptions changed on network adapters; a reboot is recommended for full name resolution.'
            )
          : tx(
              '패치 적용 전부터 Windows 시스템에 보류 중인 재부팅 플래그가 감지되었습니다. 공유 연결이 불안정할 경우 재부팅을 권장합니다.',
              'A pre-existing Windows Pending Reboot flag was detected. Reboot if share connections remain unstable.'
            ),
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
      rebootRecommended: true,
      canRebootNow: true,
    };
  }

  if (restartedServices.length > 0) {
    const isRpc = mode === 'rpc_printer_compat' || mode === 'rpc_printer_default';
    return {
      level: 'service_restart',
      title: isRpc
        ? tx('재부팅 불필요 · Print Spooler 및 RPC 서비스 즉시 새로고침 완료', 'No Reboot Needed · Print Spooler & RPC Services Refreshed')
        : tx('재부팅 불필요 · SMB 서비스 즉시 새로고침 완료', 'No Reboot Needed · SMB Services Refreshed Immediately'),
      reason: tx(
        `정책 변경 후 ${restartedServices.join(', ')} 서비스를 즉시 재시작하여 캐시된 세션을 갱신했습니다. 컴퓨터를 재부팅하지 않고 바로 공유를 사용할 수 있습니다.`,
        `Restarted ${restartedServices.join(', ')} immediately after policy updates to clear cached sessions. Ready to share without rebooting.`
      ),
      serviceRestarted: true,
      restartedServices,
      rebootRecommended: false,
      canRebootNow: false,
    };
  }

  if (mode === 'enable_uac_token_filter' || mode === 'disable_uac_token_filter') {
    return {
      level: 'none',
      title:
        mode === 'enable_uac_token_filter'
          ? tx('재부팅 불필요 · UAC 원격 토큰 필터 완화(LocalAccountTokenFilterPolicy=1) 즉시 적용', 'No Reboot Needed · UAC Remote Token Filter Relaxed (1) Immediately')
          : tx('재부팅 불필요 · UAC 원격 토큰 기본 보안 복원 완료', 'No Reboot Needed · UAC Remote Token Default Protection Restored'),
      reason:
        mode === 'enable_uac_token_filter'
          ? tx(
              '로컬 관리자 계정 원격 접속 토큰 제한이 해제되었습니다. 재부팅 없이 바로 원격 공유 인증이 적용됩니다.',
              'Remote admin token filtering has been lifted. Remote credential checks apply immediately without rebooting.'
            )
          : tx(
              'UAC 원격 토큰 필터가 Windows 기본 보안(비활성)으로 복원되었습니다.',
              'UAC remote token filtering has been restored to Windows default protection.'
            ),
      serviceRestarted: false,
      restartedServices: [],
      rebootRecommended: false,
      canRebootNow: false,
    };
  }

  return {
    level: 'none',
    title: tx('재부팅 불필요 · 즉시 반영 완료', 'No Reboot Needed · Applied Immediately'),
    reason: tx(
      '방화벽·네트워크 프로필·정책 변경 사항이 재부팅 없이 런타임에 즉시 적용되었습니다.',
      'Firewall, network profile, and policy updates took effect immediately at runtime without rebooting.'
    ),
    serviceRestarted: false,
    restartedServices: [],
    rebootRecommended: false,
    canRebootNow: false,
  };
}

export interface ClientFailureDiagnostic {
  code: string;
  title: string;
  detail: string;
  needsOsPatchHint: boolean;
  actionLabel: string;
  isHostAuthOrGuestIssue?: boolean;
}

export function classifyFailureDiagnostics(errorText?: string): ClientFailureDiagnostic | null {
  const raw = (errorText || '').trim();
  if (!raw) return null;

  // Strip dotted IPv4 addresses (e.g., 192.168.0.5) and internal c_mount attempt labels
  // (e.g., WNet-Guest:, HostGuest:, Guest:) so octets like .5/.86/.53 or attempt prefixes
  // never hijack specific Win32/SMB error codes.
  const sanitized = raw
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, ' ')
    .replace(/(?:^|\|\s*)(?:WNet-Guest|HostGuestNet|HostGuest|WNet-Null|WNetBare|WNet|Guest|Anonymous|Default|New-SmbMapping):/gi, ' ');

  if (/(?<![.\d])85(?![.\d])|이미 사용|already in use|already assigned/i.test(sanitized)) {
    return {
      code: 'Error 85',
      title: tx('선택한 드라이브 문자가 이미 할당됨', 'Selected Drive Letter Already In Use'),
      detail: tx(
        '별도 OS 패치는 불필요합니다. 드라이브 문자를 Y:, X: 등 다른 문자로 변경해 다시 연결하세요.',
        'No OS patch needed. Pick another free drive letter (such as Y: or X:) and reconnect.'
      ),
      needsOsPatchHint: false,
      actionLabel: tx('OS 매트릭스 보기', 'View OS Matrix'),
    };
  }
  if (/(?<![.\d])1219(?![.\d])|다중 연결|multiple connections/i.test(sanitized)) {
    return {
      code: 'Error 1219',
      title: tx('동일 서버에 다른 사용자 세션이 이미 열려 있음', 'Existing Session with Different Credentials on Same Host'),
      detail: tx(
        '별도 OS 패치는 불필요합니다. 열려 있는 탐색기 창을 닫거나 [연결 해제 / 보안 원복]으로 기존 SMB 세션을 정리한 뒤 다시 연결하세요.',
        'No OS patch needed. Close open Explorer windows or use [Disconnect / Security Rollback] to clear stale SMB sessions before retrying.'
      ),
      needsOsPatchHint: false,
      actionLabel: tx('OS 매트릭스 보기', 'View OS Matrix'),
    };
  }
  if (/(?<![.\d])1385(?![.\d])|로그온 유형|logon type/i.test(sanitized)) {
    return {
      code: 'Error 1385',
      title: tx('호스트 PC 게스트 네트워크 로그온 차단 (SeDenyNetworkLogonRight)', 'Host Guest Network Logon Blocked (SeDenyNetworkLogonRight)'),
      detail: tx(
        '호스트의 로컬 보안 정책 "네트워크에서 이 컴퓨터에 액세스 거부"에 Guest/Guests가 남아 있어 무비밀번호 접속이 차단되었습니다. 호스트 PC에서 [무비밀번호 정책 개방]을 실행하거나 클라이언트에서 [보안 계정 모드]로 연결하세요.',
        'The host security policy "Deny access to this computer from the network" still lists Guest/Guests. Run [Unlock Guest Policy] on the host or switch to [Dedicated Account] mode.'
      ),
      needsOsPatchHint: true,
      actionLabel: tx('통합 해결 가이드 & 도구 열기', 'Open Unified Fix Guide & Tools'),
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])1326(?![.\d])|(?<![.\d])86(?![.\d])|(?<![.\d])5(?![.\d])|액세스|거부|로그온|암호|password is not correct/i.test(sanitized)) {
    return {
      code: 'Error 5 / 86 / 1326',
      title: tx('계정 인증 실패 · 빈 암호/forceguest 제한 또는 중복 SID 충돌', 'Authentication Failure · Blank Password / forceguest / Duplicate SID'),
      detail: tx(
        '호스트의 forceguest=1(Guest 전용 강제), LimitBlankPasswordUse=1(빈 암호 제한), 최소 암호 길이(MinimumPasswordLength>0) 또는 OS 복제 PC 간 중복 Machine SID(Win11 24H2~25H2 KB5065426 · Event 6167)가 원인일 수 있습니다. 호스트에서 [무비밀번호 정책 개방] · Classic(forceguest=0) 정렬 또는 [중복 SID KIR 우회] 후 재부팅하세요.',
        'May be caused by host forceguest=1, LimitBlankPasswordUse=1, MinimumPasswordLength>0, or cloned Machine SID conflict (KB5065426 · Event 6167). Run [Unlock Guest Policy] / Classic (forceguest=0) or apply [Duplicate SID KIR Override] + reboot.'
      ),
      needsOsPatchHint: true,
      actionLabel: tx('통합 해결 가이드 & 도구 열기', 'Open Unified Fix Guide & Tools'),
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])1272(?![.\d])|(?<![.\d])384(?![.\d])|0x80070035|게스트|guest/i.test(sanitized)) {
    return {
      code: '0x80070035 / 1272',
      title: tx('Win 11 24H2~26H2 비인증 게스트·SMB 서명 차단', 'Win 11 24H2~26H2 Insecure Guest / SMB Signing Block'),
      detail: tx(
        '별도 Windows 업데이트는 필요 없으며, 호스트·클라이언트 양단에서 [안전 호환 패치] 또는 [보안 계정 모드] 전환으로 즉시 해결됩니다.',
        'No Windows update needed. Apply [Safe Compat Patch] on both sides or switch to [Dedicated Account] mode for an immediate fix.'
      ),
      needsOsPatchHint: true,
      actionLabel: tx('매트릭스 호환 패치로 이동', 'Go to Matrix Compat Patch'),
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])58(?![.\d])|지정한 서버가 요청한 작업|cannot perform the requested operation/i.test(sanitized)) {
    return {
      code: 'Error 58',
      title: tx('SMB 전송 암호화·서명 또는 프로토콜 버전 불일치 (Win 7·8)', 'SMB Encryption / Signing or Dialect Mismatch (Win 7 / 8)'),
      detail: tx(
        '대상 서버가 SMB 전송 암호화(EncryptData)를 강제하거나 SMB 보안 서명·프로토콜 방언 협상에 실패했습니다. [구형 OS 호환] 탭에서 브릿지 호환 패치를 양단에 적용하세요.',
        'The target host enforces SMB EncryptData or failed SMB signing/dialect negotiation. Apply the bridge compatibility patch under the [Legacy OS] tab.'
      ),
      needsOsPatchHint: true,
      actionLabel: tx('구형 OS 호환 브릿지 정렬', 'Align Legacy OS Bridge'),
    };
  }
  if (/(?<![.\d])53(?![.\d])|(?<![.\d])67(?![.\d])|네트워크 경로|연결 시간 초과|시간\s*초과|timeout|timed\s*out|445/i.test(sanitized)) {
    return {
      code: 'Error 53 / TCP 445',
      title: tx('네트워크 경로 차단 또는 구형 SMBv1 장비 미지원', 'Network Path Unreachable or Legacy SMBv1 Required'),
      detail: tx(
        '호스트 방화벽·공용(Public) 프로필 차단, 또는 구형 NAS·복합기라면 OS 매트릭스의 [SMBv1 클라이언트 기능 설치]가 필요할 수 있습니다.',
        'Check host firewall and Public profile blocking, or enable [Install SMBv1 Client Feature] in OS Matrix for legacy NAS/MFP hardware.'
      ),
      needsOsPatchHint: true,
      actionLabel: tx('매트릭스 별도 기능·SMBv1 확인', 'Check Matrix Extra Features / SMBv1'),
    };
  }
  if (/(?<![.\d])1223(?![.\d])|사용자 이름 입력|작업을 취소|canceled by the user/i.test(sanitized)) {
    return {
      code: 'Error 1223',
      title: tx('호스트 자격 증명 요구 또는 익명 게스트 접근 거부', 'Host Requested Credentials or Rejected Anonymous Access'),
      detail: tx(
        '대상 호스트가 익명·게스트 연결을 거부하고 사용자 이름/암호 인증을 요구했습니다. 호스트에서 무비밀번호 정책을 완전 개방하거나, 클라이언트에서 [보안 계정 모드]로 아이디/암호를 입력해 연결하세요.',
        'Target host refused anonymous/guest access and prompted for credentials. Unlock guest policy on the host or connect with [Dedicated Account] mode.'
      ),
      needsOsPatchHint: false,
      actionLabel: tx('통합 해결 가이드 & 도구 열기', 'Open Unified Fix Guide & Tools'),
      isHostAuthOrGuestIssue: true,
    };
  }
  return {
    code: 'Mount Diagnostic',
    title: tx('네트워크 연결 예외 진단 권장', 'Network Connection Diagnostic Recommended'),
    detail: tx(
      'OS 호환성 매트릭스에서 현재 빌드·방화벽·UAC 토큰·별도 기능(SMBv1) 상태를 점검해 보세요.',
      'Inspect current OS build, firewall, UAC token, and optional SMBv1 feature states in the OS Compatibility Matrix.'
    ),
    needsOsPatchHint: true,
    actionLabel: tx('OS 매트릭스 진단 열기', 'Open OS Matrix Diagnostics'),
  };
}

export function getPolicyPatchLabel(mode: PolicyPatchMode): string {
  switch (mode) {
    case 'safe_compat':
      return tx('안전 호환 패치', 'Safe Compat Patch');
    case 'rpc_printer_compat':
      return tx('프린터 RPC·스풀러 호환 패치', 'Printer RPC & Spooler Compat Patch');
    case 'deep_stack_reset':
      return tx('심층 TCP/IP · Winsock 초기화', 'Deep TCP/IP & Winsock Reset');
    case 'strict_26h2_default':
      return tx('26H2 표준 보안 복원', 'Restore 26H2 Security Defaults');
    case 'rpc_printer_default':
      return tx('프린터 RPC 기본 보안 복원', 'Restore Printer RPC Defaults');
    case 'enable_uac_token_filter':
      return tx('UAC 원격 토큰 필터 허용', 'Allow UAC Remote Token Filter');
    case 'disable_uac_token_filter':
      return tx('UAC 원격 토큰 기본 보안 복원', 'Restore UAC Remote Token Protection');
    case 'enable_smbv1_client':
      return tx('SMBv1 클라이언트 기능 설치', 'Install SMBv1 Client Feature');
    case 'kir_duplicate_sid_compat':
      return tx('Win11 중복 SID 차단 해제 (KIR 1517186191=0)', 'Win11 Duplicate SID KIR Override (1517186191=0)');
    case 'legacy_bridge_compat':
      return tx('Win 7·8.1 호환 SMB 2.1/3.0 브릿지 적용', 'Apply Win 7/8.1 SMB 2.1/3.0 Compat Bridge');
    case 'legacy_smb1_enable':
      return tx('레거시 SMB 1.0 프로토콜 활성화', 'Enable Legacy SMB 1.0 Protocol');
    case 'legacy_bridge_rollback':
      return tx('구형 OS 호환 설정 보안 원복', 'Rollback Legacy OS Bridge Settings');
    default:
      return mode;
  }
}

export function formatSnapshotTimestamp(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const t = Date.parse(trimmed);
  if (Number.isNaN(t)) {
    return trimmed;
  }
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export interface HostPolicyPreset {
  id: string;
  label: string;
  description: string;
  snapshot: HostPolicySnapshot;
}

export function getHostPolicyReferenceTargets(): HostPolicyPreset[] {
  return [
    {
      id: '__preset_file_printer_compat__',
      label: tx('호환 파일·프린터 공유 호스트 기준 (권장)', 'Compat File & Printer Host Baseline (Recommended)'),
      description: tx(
        '게스트·서명 완화·방화벽 445·프린터 RPC Named Pipe 호환이 열린 메인 호스트 기준과 현재 PC를 즉시 비교합니다.',
        'Compares this PC against a host baseline with guest access, relaxed signing, TCP 445, and Printer RPC Named Pipe open.'
      ),
      snapshot: {
        hostName: tx('호환 공유 호스트 기준', 'Compat Host Baseline'),
        osProductName: 'Windows 11 / Windows 10',
        osDisplayVersion: tx('24H2~26H2 호환', '24H2~26H2 Compat'),
        osBuild: 26100,
        osEra: 'win11_24h2',
        networkProfile: 'Private',
        smbServerSigningRequired: false,
        allowInsecureGuestAuth: true,
        rpcAuthnLevelPrivacyDisabled: true,
        rpcUseNamedPipeProtocol: true,
        pointAndPrintRelaxed: true,
        lmCompatibilityLevel: 3,
        localAccountTokenFilterEnabled: false,
        guestNetworkLogonDenied: false,
        limitBlankPasswordUse: false,
        restrictNullSessAccess: false,
        restrictAnonymous: false,
        guestAccountEnabled: true,
        firewall445Allowed: true,
        capturedAt: '',
      },
    },
    {
      id: '__preset_file_only_compat__',
      label: tx('일반 파일 공유 호스트 기준 (Win 10~11)', 'Standard File Share Host Baseline (Win 10~11)'),
      description: tx(
        '비서명·무비밀번호 공유 및 TCP 445가 개방된 일반 호스트 PC 기준과 현재 PC의 SMB/게스트/프로필 불일치를 진단합니다.',
        'Compares this PC against a standard file-sharing host (unsigned, passwordless, TCP 445 open) to diagnose SMB/guest/profile mismatches.'
      ),
      snapshot: {
        hostName: tx('일반 파일 호스트 기준', 'Standard File Host Baseline'),
        osProductName: 'Windows 10 / 11',
        osDisplayVersion: '22H2~26H2',
        osBuild: 19045,
        osEra: 'win10',
        networkProfile: 'Private',
        smbServerSigningRequired: false,
        allowInsecureGuestAuth: true,
        rpcAuthnLevelPrivacyDisabled: false,
        rpcUseNamedPipeProtocol: false,
        pointAndPrintRelaxed: false,
        lmCompatibilityLevel: 3,
        localAccountTokenFilterEnabled: false,
        guestNetworkLogonDenied: false,
        limitBlankPasswordUse: false,
        restrictNullSessAccess: false,
        restrictAnonymous: false,
        guestAccountEnabled: true,
        firewall445Allowed: true,
        capturedAt: '',
      },
    },
  ];
}

export const HOST_POLICY_REFERENCE_TARGETS: HostPolicyPreset[] = getHostPolicyReferenceTargets();

export function toHostPolicySnapshot(
  hostName: string,
  status: OsNetworkPolicyStatus,
  sourceIp?: string
): HostPolicySnapshot {
  return {
    hostName: hostName.trim() || 'MAIN-HOST-PC',
    ...(sourceIp ? { sourceIp: sourceIp.trim() } : {}),
    osProductName: status.osProductName,
    osDisplayVersion: status.osDisplayVersion,
    osBuild: status.osBuild,
    osEra: status.osEra,
    networkProfile: status.networkProfile,
    smbServerSigningRequired: status.smbServerSigningRequired,
    allowInsecureGuestAuth: status.allowInsecureGuestAuth,
    rpcAuthnLevelPrivacyDisabled: status.rpcAuthnLevelPrivacyDisabled,
    rpcUseNamedPipeProtocol: status.rpcUseNamedPipeProtocol,
    pointAndPrintRelaxed: status.pointAndPrintRelaxed,
    lmCompatibilityLevel: status.lmCompatibilityLevel,
    localAccountTokenFilterEnabled: Boolean(status.localAccountTokenFilterEnabled),
    guestNetworkLogonDenied: Boolean(status.guestNetworkLogonDenied),
    ...(typeof status.limitBlankPasswordUse === 'boolean'
      ? { limitBlankPasswordUse: status.limitBlankPasswordUse }
      : {}),
    ...(typeof status.restrictNullSessAccess === 'boolean'
      ? { restrictNullSessAccess: status.restrictNullSessAccess }
      : {}),
    ...(typeof status.restrictAnonymous === 'boolean'
      ? { restrictAnonymous: status.restrictAnonymous }
      : {}),
    ...(typeof status.guestAccountEnabled === 'boolean'
      ? { guestAccountEnabled: status.guestAccountEnabled }
      : {}),
    ...(typeof status.firewall445Allowed === 'boolean'
      ? { firewall445Allowed: status.firewall445Allowed }
      : {}),
    ...(typeof status.forceGuest === 'boolean' ? { forceGuest: status.forceGuest } : {}),
    ...(typeof status.minimumPasswordLength === 'number'
      ? { minimumPasswordLength: status.minimumPasswordLength }
      : {}),
    ...(status.machineSidPrefix ? { machineSidPrefix: status.machineSidPrefix } : {}),
    ...(typeof status.kirOverride1517186191 === 'number'
      ? { kirOverride1517186191: status.kirOverride1517186191 }
      : {}),
    ...(status.rawRegistrySnapshot ? { rawRegistrySnapshot: status.rawRegistrySnapshot } : {}),
    capturedAt: new Date().toISOString(),
  };
}

export function findHostPolicySnapshot(
  snapshots: Record<string, HostPolicySnapshot> | undefined,
  hostName: string | undefined
): HostPolicySnapshot | null {
  if (!snapshots || !hostName) return null;
  if (snapshots[hostName]) return snapshots[hostName];
  const target = hostName.trim().toLowerCase();
  for (const [k, v] of Object.entries(snapshots)) {
    if (k.trim().toLowerCase() === target || v.hostName.trim().toLowerCase() === target) {
      return v;
    }
  }
  return null;
}

export function computeHostClientPolicyDiff(
  hostSnap: HostPolicySnapshot,
  clientPolicy: OsNetworkPolicyStatus
): PolicyDiffItem[] {
  const diffs: PolicyDiffItem[] = [];

  const sameEra = hostSnap.osEra === clientPolicy.osEra;
  diffs.push({
    id: 'diff_os_era',
    label: tx('Windows OS 세대 · 빌드', 'Windows OS Era · Build'),
    hostValue: formatEraShortLabel(hostSnap.osEra, hostSnap.osBuild, hostSnap.osDisplayVersion),
    clientValue: formatEraShortLabel(clientPolicy.osEra, clientPolicy.osBuild, clientPolicy.osDisplayVersion),
    status: sameEra ? 'match' : 'warning',
    actionTarget: 'none',
    impact: sameEra
      ? tx('양단 PC의 기본 보안 세대가 동일합니다.', 'Both PCs run the same baseline security generation.')
      : tx(
          '서로 다른 Windows 세대 간 연결입니다. 아래 서명·게스트·프린터 RPC 항목의 일치 여부를 확인하세요.',
          'Connecting across different Windows generations. Check signing, guest, and printer RPC alignment below.'
        ),
  });

  const clientPublic = clientPolicy.networkProfile === 'Public';
  const hostPublic = hostSnap.networkProfile === 'Public';
  diffs.push({
    id: 'diff_profile',
    label: tx('네트워크 프로필 (방화벽)', 'Network Profile (Firewall)'),
    hostValue: hostSnap.networkProfile,
    clientValue: clientPolicy.networkProfile,
    status: !clientPublic && !hostPublic ? 'match' : 'conflict',
    actionTarget: clientPublic ? 'local' : hostPublic ? 'host' : 'none',
    impact: clientPublic
      ? tx(
          '현재 PC가 공용(Public) 프로필이므로 LAN 탐색·445 공유가 차단됩니다. 원클릭 자동 정렬로 개인(Private) 전환이 가능합니다.',
          'This PC is on a Public profile, blocking LAN discovery and TCP 445. One-click auto-align can switch it to Private.'
        )
      : hostPublic
        ? tx(
            '호스트 PC가 공용(Public) 프로필입니다. 호스트 PC에서 안전 호환 패치를 실행해 개인(Private)으로 전환하세요.',
            'The host PC is on a Public profile. Run Safe Compat Patch on the host PC to switch it to Private.'
          )
        : tx('양단 모두 사설/도메인 네트워크로 TCP 445 통신이 허용됩니다.', 'Both PCs use Private/Domain profiles allowing TCP 445.'),
    recommendedPatch: clientPublic ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientPublic ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  const clientBlocksUnsignedHost = clientPolicy.smbClientSigningRequired && !hostSnap.smbServerSigningRequired;
  diffs.push({
    id: 'diff_smb_signing',
    label: tx('SMB 보안 서명 정책', 'SMB Security Signing Policy'),
    hostValue: hostSnap.smbServerSigningRequired
      ? tx('서버 서명 강제', 'Server Signing Required')
      : tx('서버 서명 완화', 'Server Signing Relaxed'),
    clientValue: clientPolicy.smbClientSigningRequired
      ? tx('클라이언트 서명 강제', 'Client Signing Required')
      : tx('클라이언트 서명 완화', 'Client Signing Relaxed'),
    status: clientBlocksUnsignedHost ? 'conflict' : 'match',
    actionTarget: clientBlocksUnsignedHost ? 'local' : 'none',
    impact: clientBlocksUnsignedHost
      ? tx(
          '현재 PC의 클라이언트 서명 강제가 비서명 호스트/NAS 연결을 차단합니다. 로컬 안전 호환 패치로 즉시 완화할 수 있습니다.',
          'Local client signing enforcement blocks unsigned hosts/NAS. Apply Safe Compat Patch locally to relax it.'
        )
      : hostSnap.smbServerSigningRequired && !clientPolicy.smbClientSigningRequired
        ? tx(
            '클라이언트 서명 완화 상태에서도 호스트의 서명 요구에 맞춰 SMB 3.x 서명이 정상 협상됩니다.',
            'Even with client signing relaxed, SMB 3.x signing negotiates cleanly when required by the host.'
          )
        : tx('양단 SMB 서명 협상 정책이 호환됩니다.', 'SMB signing negotiation policies are compatible on both ends.'),
    recommendedPatch: clientBlocksUnsignedHost ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientBlocksUnsignedHost ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  const clientBlocksGuest = !clientPolicy.allowInsecureGuestAuth && hostSnap.allowInsecureGuestAuth;
  const hostBlocksGuest = clientPolicy.allowInsecureGuestAuth && !hostSnap.allowInsecureGuestAuth;
  diffs.push({
    id: 'diff_guest_auth',
    label: tx('비인증 게스트 로그온 허용', 'Insecure Guest Logon Allowed'),
    hostValue: hostSnap.allowInsecureGuestAuth ? tx('허용 (호환)', 'Allowed (Compat)') : tx('차단 (기본)', 'Blocked (Default)'),
    clientValue: clientPolicy.allowInsecureGuestAuth ? tx('허용 (호환)', 'Allowed (Compat)') : tx('차단 (기본)', 'Blocked (Default)'),
    status: clientBlocksGuest ? 'conflict' : hostBlocksGuest ? 'warning' : 'match',
    actionTarget: clientBlocksGuest ? 'local' : hostBlocksGuest ? 'host' : 'none',
    impact: clientBlocksGuest
      ? tx(
          '호스트가 무비밀번호 게스트를 열었으나 현재 PC가 차단 중이어서 0x80070035 오류가 발생합니다. 원클릭 자동 정렬로 즉시 해결됩니다.',
          'Host allows passwordless guest shares, but this PC blocks them (0x80070035). One-click auto-align fixes this immediately.'
        )
      : hostBlocksGuest
        ? tx(
            '호스트 PC가 게스트 차단을 유지 중입니다. 무비밀번호 공유 시 호스트에서 안전 호환 패치를 실행하거나 보안 계정 모드를 사용하세요.',
            'Host PC still blocks guest auth. Run Safe Compat Patch on the host or use Dedicated Secure Account mode.'
          )
        : tx('양단 게스트 인증 정책이 동일합니다.', 'Guest logon policies match on both PCs.'),
    recommendedPatch: clientBlocksGuest ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientBlocksGuest ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  if (typeof hostSnap.guestNetworkLogonDenied === 'boolean') {
    const hostDenied = hostSnap.guestNetworkLogonDenied;
    diffs.push({
      id: 'diff_guest_deny',
      label: tx('호스트 Guest 네트워크 로그온 정책', 'Host Guest Network Logon Policy'),
      hostValue: hostDenied
        ? tx('거부됨 (SeDenyNetworkLogonRight · 오류 1385 위험)', 'Denied (SeDenyNetworkLogonRight · Error 1385 Risk)')
        : tx('차단 해제됨 (허용)', 'Unblocked (Allowed)'),
      clientValue: clientPolicy.guestNetworkLogonDenied
        ? tx('로컬도 거부됨', 'Denied Locally')
        : tx('차단 해제됨', 'Unblocked'),
      status: hostDenied ? 'conflict' : 'match',
      actionTarget: hostDenied ? (clientPolicy.guestNetworkLogonDenied ? 'both' : 'host') : 'none',
      impact: hostDenied
        ? tx(
            '호스트 PC의 로컬 보안 정책에 Guest 네트워크 로그온 거부가 설정되어 무비밀번호 접속 시 오류 1385가 발생합니다. USB 호스트 대기 작업 예약 또는 호스트 측 정책 개방이 필요합니다.',
            'Host local security policy denies Guest network logon, causing Error 1385. Queue a USB host task or unlock guest policy on the host.'
          )
        : tx('호스트 PC의 SeDenyNetworkLogonRight에서 Guest 거부가 해제되어 있습니다.', 'Host SeDenyNetworkLogonRight permits Guest logons.'),
      recommendedPatch: hostDenied ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostDenied ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.limitBlankPasswordUse === 'boolean') {
    const hostRestrictsBlank = hostSnap.limitBlankPasswordUse;
    diffs.push({
      id: 'diff_blank_pwd',
      label: tx('LSA 빈 암호 네트워크 로그온 제한 (오류 86)', 'LSA Blank Password Logon Limit (Error 86)'),
      hostValue: hostRestrictsBlank
        ? tx('제한됨 (LimitBlankPasswordUse=1)', 'Restricted (LimitBlankPasswordUse=1)')
        : tx('허용 (LimitBlankPasswordUse=0)', 'Allowed (LimitBlankPasswordUse=0)'),
      clientValue:
        typeof clientPolicy.limitBlankPasswordUse === 'boolean'
          ? clientPolicy.limitBlankPasswordUse
            ? tx('제한됨', 'Restricted')
            : tx('허용됨', 'Allowed')
          : tx('미측정', 'Not Measured'),
      status: hostRestrictsBlank ? 'conflict' : 'match',
      actionTarget: hostRestrictsBlank ? 'host' : 'none',
      impact: hostRestrictsBlank
        ? tx(
            '호스트 PC가 빈 암호 원격 로그온을 차단(LimitBlankPasswordUse=1) 중이므로 무비밀번호 공유 시 Error 86이 발생합니다. 호스트 USB 대기 작업으로 해제할 수 있습니다.',
            'Host blocks blank-password network logons (LimitBlankPasswordUse=1), causing Error 86. Unlock via host USB pending task.'
          )
        : tx('호스트 PC에서 빈 암호 게스트 네트워크 로그온이 허용되어 있습니다.', 'Host permits blank-password guest network logons.'),
      recommendedPatch: hostRestrictsBlank ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostRestrictsBlank ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.guestAccountEnabled === 'boolean') {
    const hostGuestOff = !hostSnap.guestAccountEnabled;
    diffs.push({
      id: 'diff_guest_account',
      label: tx('호스트 Guest 계정 (SID *-501) 활성 여부', 'Host Guest Account (SID *-501) State'),
      hostValue: hostGuestOff
        ? tx('비활성 (Disabled · 오류 86/1326)', 'Disabled (Error 86/1326 Risk)')
        : tx('활성 (무비밀번호 준비)', 'Enabled (Guest Ready)'),
      clientValue:
        typeof clientPolicy.guestAccountEnabled === 'boolean'
          ? clientPolicy.guestAccountEnabled
            ? tx('활성', 'Enabled')
            : tx('비활성', 'Disabled')
          : tx('미측정', 'Not Measured'),
      status: hostGuestOff ? 'conflict' : 'match',
      actionTarget: hostGuestOff ? 'host' : 'none',
      impact: hostGuestOff
        ? tx(
            '호스트 PC의 Guest 계정이 꺼져 있어 간편 무비밀번호 연결이 거부될 수 있습니다. USB 대기 작업의 [Guest 무비밀번호 개방]으로 즉시 활성화할 수 있습니다.',
            'Host built-in Guest account is disabled; passwordless mounts may be rejected. Enable it via USB [Unlock Host Guest Policy].'
          )
        : tx('호스트 PC의 Guest 계정이 활성화되어 있습니다.', 'Host built-in Guest account is active.'),
      recommendedPatch: hostGuestOff ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostGuestOff ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.restrictNullSessAccess === 'boolean' || typeof hostSnap.restrictAnonymous === 'boolean') {
    const hostNullRestricted = Boolean(hostSnap.restrictNullSessAccess || hostSnap.restrictAnonymous);
    diffs.push({
      id: 'diff_lsa_anon',
      label: tx('호스트 LSA 익명·Null 세션 차단 (오류 1223)', 'Host LSA Anonymous / Null Session Block (Error 1223)'),
      hostValue: hostNullRestricted
        ? tx('차단됨 (익명 거부 · 오류 1223 위험)', 'Blocked (Error 1223 Risk)')
        : tx('완화됨 (Null 세션 허용)', 'Relaxed (Null Session Allowed)'),
      clientValue:
        clientPolicy.restrictNullSessAccess || clientPolicy.restrictAnonymous
          ? tx('차단됨', 'Blocked')
          : tx('완화됨', 'Relaxed'),
      status: hostNullRestricted ? 'warning' : 'match',
      actionTarget: hostNullRestricted ? 'host' : 'none',
      impact: hostNullRestricted
        ? tx(
            '호스트 PC의 RestrictNullSessAccess/restrictanonymous가 켜져 있어 자격 증명 창이 뜨거나 Error 1223이 발생할 수 있습니다.',
            'Host RestrictNullSessAccess / restrictanonymous is enabled, which may trigger credential prompts or Error 1223.'
          )
        : tx('호스트 PC가 무비밀번호 Null 세션 핸드셰이크를 허용합니다.', 'Host allows passwordless Null session handshakes.'),
      recommendedPatch: hostNullRestricted ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostNullRestricted ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.firewall445Allowed === 'boolean' || typeof clientPolicy.firewall445Allowed === 'boolean') {
    const hostFwOk = hostSnap.firewall445Allowed !== false;
    const clientFwOk = clientPolicy.firewall445Allowed !== false;
    const anyFwMissing = !hostFwOk || !clientFwOk;
    diffs.push({
      id: 'diff_fw_445',
      label: tx('TCP 445 · 파일 공유 방화벽 개방 (오류 53)', 'TCP 445 · File Sharing Firewall (Error 53)'),
      hostValue: hostFwOk ? tx('개방됨 (Allow)', 'Open (Allow)') : tx('차단 또는 미등록', 'Blocked or Missing'),
      clientValue: clientFwOk ? tx('개방됨 (Allow)', 'Open (Allow)') : tx('차단 또는 미등록', 'Blocked or Missing'),
      status: anyFwMissing ? 'conflict' : 'match',
      actionTarget: !clientFwOk && !hostFwOk ? 'both' : !clientFwOk ? 'local' : !hostFwOk ? 'host' : 'none',
      impact: !clientFwOk
        ? tx(
            '현재 PC 방화벽에 TCP 445 파일 공유 허용 규칙이 없어 LAN 응답이 끊길 수 있습니다. 내 PC 원클릭 정렬로 개방됩니다.',
            'No TCP 445 allow rule on this PC firewall; LAN sharing may time out. One-click local align opens it.'
          )
        : !hostFwOk
          ? tx(
              '호스트 PC 방화벽에 TCP 445 허용 규칙이 확인되지 않습니다. 호스트 USB 대기 작업을 저장해 인바운드 445 포트를 개방하세요.',
              'Host TCP 445 firewall rule not confirmed. Save a host USB pending task to open inbound port 445.'
            )
          : tx('양단 Windows 방화벽의 TCP 445 파일 공유 규칙이 개방되어 있습니다.', 'TCP 445 Windows Firewall rules are open on both ends.'),
      recommendedPatch: anyFwMissing ? 'safe_compat' : undefined,
      recommendedPatchLabel: anyFwMissing ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  const clientLowNtlm = clientPolicy.lmCompatibilityLevel !== null && clientPolicy.lmCompatibilityLevel < 3;
  const hostNtlmLabel =
    typeof hostSnap.lmCompatibilityLevel === 'number'
      ? `NTLMv2 (Lm=${hostSnap.lmCompatibilityLevel})`
      : tx('NTLMv2 (Lm>=3 권장)', 'NTLMv2 (Lm>=3 recommended)');
  const clientNtlmLabel =
    clientPolicy.lmCompatibilityLevel !== null
      ? `Lm=${clientPolicy.lmCompatibilityLevel}`
      : tx('시스템 기본 (자동 협상)', 'System Default (Auto)');
  diffs.push({
    id: 'diff_ntlm',
    label: tx('NTLM 인증 협상 수준', 'NTLM Auth Compatibility Level'),
    hostValue: hostNtlmLabel,
    clientValue: clientNtlmLabel,
    status: clientLowNtlm ? 'conflict' : 'match',
    actionTarget: clientLowNtlm ? 'local' : 'none',
    impact: clientLowNtlm
      ? tx(
          '현재 PC의 NTLM 호환 수준이 3 미만이어서 Win 11 24H2~26H2 호스트 인증 협상(오류 5/86)에서 거부될 수 있습니다.',
          'Local NTLM compatibility level is below 3 and may fail Win 11 24H2~26H2 negotiation (Error 5/86).'
        )
      : tx('양단 NTLMv2 인증 협상 호환이 정상입니다.', 'NTLMv2 authentication negotiation is compatible on both ends.'),
    recommendedPatch: clientLowNtlm ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientLowNtlm ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  const hostRpcRelaxed =
    hostSnap.rpcAuthnLevelPrivacyDisabled &&
    hostSnap.rpcUseNamedPipeProtocol &&
    hostSnap.pointAndPrintRelaxed;
  const hostAnyRpcRelaxed =
    hostSnap.rpcAuthnLevelPrivacyDisabled ||
    hostSnap.rpcUseNamedPipeProtocol ||
    hostSnap.pointAndPrintRelaxed;
  const clientRpcRelaxed =
    clientPolicy.rpcAuthnLevelPrivacyDisabled &&
    clientPolicy.rpcUseNamedPipeProtocol &&
    clientPolicy.pointAndPrintRelaxed;
  const clientNeedsRpcRelax = !clientRpcRelaxed && hostAnyRpcRelaxed;
  const hostNeedsRpcRelax = clientRpcRelaxed && !hostRpcRelaxed;
  const bothWin11StrictRpc =
    !clientRpcRelaxed &&
    !hostAnyRpcRelaxed &&
    (hostSnap.osBuild >= 22000 || clientPolicy.osBuild >= 22000);

  diffs.push({
    id: 'diff_rpc_printer',
    label: tx('프린터 RPC · Named Pipe 호환', 'Printer RPC · Named Pipe Compat'),
    hostValue: hostAnyRpcRelaxed ? tx('호환 완화 (Named Pipe)', 'Compat Relaxed (Named Pipe)') : tx('24H2~26H2 엄격 RPC', '24H2~26H2 Strict RPC'),
    clientValue: clientRpcRelaxed ? tx('호환 완화 (Named Pipe)', 'Compat Relaxed (Named Pipe)') : tx('24H2~26H2 엄격 RPC', '24H2~26H2 Strict RPC'),
    status: clientNeedsRpcRelax ? 'conflict' : hostNeedsRpcRelax || bothWin11StrictRpc ? 'warning' : 'match',
    actionTarget: clientNeedsRpcRelax ? 'local' : hostNeedsRpcRelax ? 'host' : bothWin11StrictRpc ? 'both' : 'none',
    impact: clientNeedsRpcRelax
      ? tx(
          '호스트는 프린터 RPC 호환이 열려 있으나 현재 PC가 엄격 상태입니다. 원클릭 자동 정렬로 0x0000011b·0x00000709를 즉시 해결할 수 있습니다.',
          'Host allows Printer RPC compat, while this PC enforces strict RPC. One-click auto-align prevents 0x0000011b / 0x00000709.'
        )
      : hostNeedsRpcRelax
        ? tx(
            '현재 PC는 완화되었으나 호스트 PC가 엄격 RPC 상태입니다. 공유 프린터 연결 시 호스트에서도 프린터 RPC 호환 패치를 실행하세요.',
            'Local PC is relaxed while host uses strict RPC. Apply Printer RPC Compat Patch on the host when sharing printers.'
          )
        : bothWin11StrictRpc
          ? tx(
              '양단 모두 24H2~26H2 엄격 프린터 RPC 상태입니다. 일반 파일 공유는 정상이며, 공유 프린터 0x0000011b/0x00000709 발생 시 호환 패치를 적용하세요.',
              'Both PCs enforce strict 24H2~26H2 Printer RPC. File sharing works normally; apply Printer RPC patch only if printer errors occur.'
            )
          : tx('양단 프린터 RPC·스풀러 전송 규격이 일치합니다.', 'Printer RPC and spooler settings match on both PCs.'),
    recommendedPatch: clientNeedsRpcRelax ? 'rpc_printer_compat' : undefined,
    recommendedPatchLabel: clientNeedsRpcRelax ? getPolicyPatchLabel('rpc_printer_compat') : undefined,
  });

  const hostUacRelaxed = Boolean(hostSnap.localAccountTokenFilterEnabled);
  const clientUacRelaxed = Boolean(clientPolicy.localAccountTokenFilterEnabled);
  const clientNeedsUacToken = hostUacRelaxed && !clientUacRelaxed;
  diffs.push({
    id: 'diff_uac_token',
    label: tx('UAC 원격 토큰 필터', 'UAC Remote Token Filter'),
    hostValue: hostUacRelaxed ? tx('완화됨 (허용)', 'Relaxed (Allowed)') : tx('기본 보안 (차단)', 'Default Protection (Filtered)'),
    clientValue: clientUacRelaxed ? tx('완화됨 (허용)', 'Relaxed (Allowed)') : tx('기본 보안 (차단)', 'Default Protection (Filtered)'),
    status: clientNeedsUacToken ? 'conflict' : hostUacRelaxed !== clientUacRelaxed ? 'warning' : 'match',
    actionTarget: clientNeedsUacToken ? 'local' : hostUacRelaxed !== clientUacRelaxed ? 'host' : 'none',
    impact: clientNeedsUacToken
      ? tx(
          '호스트가 워크그룹 관리자 원격 토큰 필터를 완화했습니다. 현재 PC도 UAC 원격 토큰 허용을 맞추면 Error 5를 예방할 수 있습니다.',
          'Host relaxed UAC remote admin token filtering. Matching this setting locally helps prevent Error 5.'
        )
      : hostUacRelaxed !== clientUacRelaxed
        ? tx(
            '현재 PC는 UAC 원격 토큰이 허용되어 있고 호스트는 기본 보안 상태입니다.',
            'Local PC allows remote UAC tokens while host maintains default filtering.'
          )
        : tx('양단 UAC 원격 토큰 정책이 동일합니다.', 'UAC remote token filter policies match on both PCs.'),
    recommendedPatch: clientNeedsUacToken ? 'enable_uac_token_filter' : undefined,
    recommendedPatchLabel: clientNeedsUacToken ? getPolicyPatchLabel('enable_uac_token_filter') : undefined,
  });

  if (hostSnap.forceGuest || clientPolicy.forceGuest) {
    diffs.push({
      id: 'diff_force_guest',
      label: tx('LSA forceguest (Classic vs Guest 전용 강제)', 'LSA forceguest (Classic vs Guest-Only)'),
      hostValue: hostSnap.forceGuest ? tx('forceguest=1 (Guest 강제 · 보안 계정 충돌)', 'forceguest=1 (Guest-Only · Account Conflict)') : 'Classic (0)',
      clientValue: clientPolicy.forceGuest ? tx('forceguest=1 (Guest 강제)', 'forceguest=1 (Guest-Only)') : 'Classic (0)',
      status: 'conflict',
      actionTarget: hostSnap.forceGuest && clientPolicy.forceGuest ? 'both' : hostSnap.forceGuest ? 'host' : 'local',
      impact: tx(
        'forceguest=1이 켜져 있으면 전용 보안 계정으로 로그인해도 Windows가 무조건 Guest로 처리해 Error 86이 발생합니다. Classic(forceguest=0)으로 교정하세요.',
        'When forceguest=1 is active, Windows forces all logons into Guest and causes Error 86 for dedicated accounts. Set Classic (forceguest=0).'
      ),
      recommendedPatch: 'safe_compat',
      recommendedPatchLabel: getPolicyPatchLabel('safe_compat'),
    });
  }

  if (clientPolicy.smbBlockNtlm || clientPolicy.smbRequireEncryption) {
    diffs.push({
      id: 'diff_cli_block_ntlm',
      label: tx('SMB 클라이언트 BlockNTLM · 강제 암호화', 'SMB Client BlockNTLM · RequireEncryption'),
      hostValue: tx('NTLMv2 허용 (호환)', 'NTLMv2 Allowed (Compat)'),
      clientValue: [
        clientPolicy.smbBlockNtlm ? tx('BlockNTLM=1(차단)', 'BlockNTLM=1 (Blocked)') : null,
        clientPolicy.smbRequireEncryption ? 'RequireEncryption=1' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      status: 'conflict',
      actionTarget: 'local',
      impact: tx(
        '클라이언트의 BlockNTLM 또는 전송 암호화 강제가 켜져 있어 워크그룹 SMB 인증이 차단됩니다. 안전 호환 패치로 즉시 완화할 수 있습니다.',
        'Client BlockNTLM or RequireEncryption is active, blocking workgroup SMB authentication. Run Safe Compat Patch to resolve.'
      ),
      recommendedPatch: 'safe_compat',
      recommendedPatchLabel: getPolicyPatchLabel('safe_compat'),
    });
  }

  const sameMachineSidPrefix =
    Boolean(hostSnap.machineSidPrefix && clientPolicy.machineSidPrefix) &&
    hostSnap.machineSidPrefix === clientPolicy.machineSidPrefix;
  const dupSidRisk = sameMachineSidPrefix || Boolean(clientPolicy.duplicateSidEvent6167Detected);
  if (dupSidRisk) {
    const bothKirApplied =
      hostSnap.kirOverride1517186191 === 0 && clientPolicy.kirOverride1517186191 === 0;
    diffs.push({
      id: 'diff_duplicate_machine_sid',
      label: tx('복제 OS 중복 Machine SID 충돌 (KB5065426 · Event 6167)', 'Cloned OS Duplicate Machine SID Conflict (KB5065426 · Event 6167)'),
      hostValue: hostSnap.kirOverride1517186191 === 0
        ? tx('KIR 적용(1517186191=0)', 'KIR Applied (1517186191=0)')
        : hostSnap.machineSidPrefix || tx('중복 의심', 'Suspected Duplicate'),
      clientValue:
        clientPolicy.kirOverride1517186191 === 0
          ? tx('KIR 적용(1517186191=0)', 'KIR Applied (1517186191=0)')
          : clientPolicy.machineSidPrefix || tx('Event 6167 감지', 'Event 6167 Detected'),
      status: bothKirApplied ? 'match' : 'conflict',
      actionTarget: bothKirApplied
        ? 'none'
        : hostSnap.kirOverride1517186191 !== 0 && clientPolicy.kirOverride1517186191 !== 0
          ? 'both'
          : clientPolicy.kirOverride1517186191 !== 0
            ? 'local'
            : 'host',
      impact: bothKirApplied
        ? tx(
            '중복 Machine SID가 감지되었으나 양단 모두 KIR 우회(1517186191=0)가 설정되어 있습니다(미반영 시 재부팅 확인).',
            'Duplicate Machine SID detected, and KIR override (1517186191=0) is configured on both PCs (verify reboot if still failing).'
          )
        : tx(
            'Sysprep 없이 동일 OS 이미지를 복제한 PC 간에는 Win11 24H2/25H2 보안 패치 이후 SMB 인증이 Error 86으로 거부됩니다. 양단에 KIR 우회 패치 적용 후 재부팅이 필요합니다.',
            'Cloned PCs without Sysprep reject SMB auth with Error 86 after Win11 24H2/25H2 updates. Apply KIR override on both ends and reboot.'
          ),
      recommendedPatch: !bothKirApplied ? 'kir_duplicate_sid_compat' : undefined,
      recommendedPatchLabel: !bothKirApplied ? getPolicyPatchLabel('kir_duplicate_sid_compat') : undefined,
    });
  }

  return diffs;
}

const PATCH_EXECUTION_ORDER: PolicyPatchMode[] = [
  'safe_compat',
  'legacy_bridge_compat',
  'rpc_printer_compat',
  'enable_uac_token_filter',
  'kir_duplicate_sid_compat',
  'strict_26h2_default',
  'legacy_bridge_rollback',
  'rpc_printer_default',
  'disable_uac_token_filter',
  'enable_smbv1_client',
  'legacy_smb1_enable',
  'deep_stack_reset',
];

export function extractAutoAlignModes(diffs: PolicyDiffItem[]): PolicyPatchMode[] {
  const needed = new Set<PolicyPatchMode>();
  for (const row of diffs) {
    if (
      row.status !== 'match' &&
      (row.actionTarget === 'local' || row.actionTarget === 'both') &&
      row.recommendedPatch
    ) {
      needed.add(row.recommendedPatch);
    }
  }
  return Array.from(needed).sort((a, b) => {
    const ia = PATCH_EXECUTION_ORDER.indexOf(a);
    const ib = PATCH_EXECUTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function extractHostPendingPlan(diffs: PolicyDiffItem[]): {
  modes: PolicyPatchMode[];
  includeGuestUnlock: boolean;
  conflictLabels: string[];
} {
  const needed = new Set<PolicyPatchMode>();
  const labels: string[] = [];
  let includeGuestUnlock = false;

  for (const row of diffs) {
    if (row.status === 'match') continue;
    const isHostTarget = row.actionTarget === 'host' || row.actionTarget === 'both';
    if (!isHostTarget) continue;

    labels.push(row.label);
    if (row.recommendedPatch) {
      needed.add(row.recommendedPatch);
    } else if (row.id === 'diff_profile' || row.id === 'diff_guest_auth' || row.id === 'diff_fw_445') {
      needed.add('safe_compat');
    } else if (row.id === 'diff_rpc_printer') {
      needed.add('rpc_printer_compat');
    } else if (row.id === 'diff_uac_token') {
      needed.add('enable_uac_token_filter');
    }

    if (
      row.id === 'diff_guest_deny' ||
      row.id === 'diff_blank_pwd' ||
      row.id === 'diff_guest_account' ||
      row.id === 'diff_lsa_anon' ||
      row.id === 'diff_guest_auth'
    ) {
      includeGuestUnlock = true;
    }
  }

  const modes = Array.from(needed).sort((a, b) => {
    const ia = PATCH_EXECUTION_ORDER.indexOf(a);
    const ib = PATCH_EXECUTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return {
    modes,
    includeGuestUnlock,
    conflictLabels: labels,
  };
}

export function combineRebootJudgments(judgments: RebootJudgment[]): RebootJudgment {
  if (judgments.length === 0) {
    return evaluateRebootJudgment({ mode: 'safe_compat', restartedServices: [] });
  }
  if (judgments.length === 1) {
    return judgments[0];
  }

  const serviceSet = new Set<string>();
  for (const j of judgments) {
    for (const s of j.restartedServices) serviceSet.add(s);
  }
  const restartedServices = Array.from(serviceSet);

  const req = judgments.find((j) => j.level === 'reboot_required');
  if (req) {
    return {
      ...req,
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
    };
  }

  const rec = judgments.find((j) => j.level === 'reboot_recommended');
  if (rec) {
    return {
      ...rec,
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
    };
  }

  if (restartedServices.length > 0) {
    return {
      level: 'service_restart',
      title: tx(
        '재부팅 불필요 · 일괄 정렬 및 관련 Windows 서비스 즉시 새로고침 완료',
        'No Reboot Needed · Batch Alignment & Instant Windows Service Refresh Complete'
      ),
      reason: tx(
        `선택된 불일치 정책들을 한 번에 정렬하고 ${restartedServices.join(', ')} 서비스를 즉시 재시작했습니다. 재부팅 없이 바로 공유 연결을 진행할 수 있습니다.`,
        `Aligned the selected mismatched policies at once and immediately restarted ${restartedServices.join(', ')}. You can proceed with share connections without rebooting.`
      ),
      serviceRestarted: true,
      restartedServices,
      rebootRecommended: false,
      canRebootNow: false,
    };
  }

  return {
    level: 'none',
    title: tx(
      '재부팅 불필요 · 불일치 정책 일괄 자동 정렬 완료',
      'No Reboot Needed · Batch Auto-Alignment Complete'
    ),
    reason: tx(
      '모든 불일치 항목이 재부팅 없이 즉시 정렬되었습니다.',
      'All mismatched items were aligned immediately without rebooting.'
    ),
    serviceRestarted: false,
    restartedServices: [],
    rebootRecommended: false,
    canRebootNow: false,
  };
}

function buildHostItemComparison(
  itemId: string,
  localStatus: OsNetworkPolicyStatus,
  hostSnap: HostPolicySnapshot
): HostPolicyComparison {
  switch (itemId) {
    case 'audit_smb_server_signing': {
      const hostVal = hostSnap.smbServerSigningRequired;
      const localVal = localStatus.smbServerSigningRequired;
      if (localVal === hostVal) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostVal ? tx('강제됨 (1)', 'Required (1)') : tx('완화됨 (0)', 'Relaxed (0)'),
          discrepancyDetail: tx(
            '대상 호스트와 서버 SMB 서명 정책이 동일합니다.',
            'Server SMB signing policy matches the target host.'
          ),
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostVal
          ? tx('호스트 강제 · 로컬 완화', 'Host Required · Local Relaxed')
          : tx('로컬 강제 · 호스트 완화', 'Local Required · Host Relaxed'),
        expectedHostValue: hostVal ? tx('강제됨 (1)', 'Required (1)') : tx('완화됨 (0)', 'Relaxed (0)'),
        discrepancyDetail: hostVal
          ? tx(
              '대상 호스트는 서버 서명을 강제하고 있으나 현재 PC 서버 서명은 완화되어 있습니다.',
              'Target host enforces server signing, while this PC server signing is relaxed.'
            )
          : tx(
              '대상 호스트는 서버 서명이 완화되어 있으나 현재 PC 서버 서명은 강제 상태입니다.',
              'Target host server signing is relaxed, while this PC enforces server signing.'
            ),
      };
    }

    case 'audit_smb_client_signing': {
      const hostServerStrict = hostSnap.smbServerSigningRequired;
      const localClientStrict = localStatus.smbClientSigningRequired;
      if (localClientStrict && !hostServerStrict) {
        return {
          status: 'conflict',
          badgeLabel: tx('연결 차단 · 서명 불일치', 'Blocked · Signing Mismatch'),
          expectedHostValue: tx('완화 호환 (0)', 'Relaxed Compat (0)'),
          discrepancyDetail: tx(
            '대상 호스트는 서명을 요구하지 않으나 현재 PC 클라이언트가 서명을 강제해 SMB 연결이 차단될 수 있습니다.',
            'Target host does not require signing, but this PC enforces client signing, which may block SMB connections.'
          ),
        };
      }
      if (!localClientStrict && hostServerStrict) {
        return {
          status: 'aligned',
          badgeLabel: tx('서명 협상 호환', 'Signing Negotiated'),
          expectedHostValue: tx('강제됨 (1)', 'Required (1)'),
          discrepancyDetail: tx(
            '클라이언트 서명 완화 상태에서도 호스트의 서명 요구에 맞춰 SMB 3.x 서명이 정상 협상됩니다.',
            'Even with relaxed client signing, SMB 3.x signing negotiates cleanly with the host requirement.'
          ),
        };
      }
      return {
        status: 'aligned',
        badgeLabel: tx('호스트 일치', 'Matches Host'),
        expectedHostValue: hostServerStrict ? tx('강제됨 (1)', 'Required (1)') : tx('완화 호환 (0)', 'Relaxed Compat (0)'),
        discrepancyDetail: tx(
          '대상 호스트의 서명 정책과 현재 PC 클라이언트 서명 설정이 호환됩니다.',
          'Client signing settings on this PC are compatible with the target host signing policy.'
        ),
      };
    }

    case 'audit_insecure_guest_auth': {
      const hostGuestOpen = hostSnap.allowInsecureGuestAuth;
      const localGuestOpen = localStatus.allowInsecureGuestAuth;
      if (!localGuestOpen && hostGuestOpen) {
        return {
          status: 'conflict',
          badgeLabel: tx('0x80070035 차단 충돌', '0x80070035 Block Conflict'),
          expectedHostValue: tx('허용 (1)', 'Allowed (1)'),
          discrepancyDetail: tx(
            '대상 호스트가 무비밀번호 게스트를 개방했으나 현재 PC가 차단 중이어서 접속 시 0x80070035 오류가 발생합니다.',
            'Target host allows passwordless guest access while this PC blocks it, causing error 0x80070035.'
          ),
        };
      }
      if (localGuestOpen && !hostGuestOpen) {
        return {
          status: 'warning',
          badgeLabel: tx('호스트 차단 · 로컬 허용', 'Host Blocked · Local Allowed'),
          expectedHostValue: tx('차단 (0)', 'Blocked (0)'),
          discrepancyDetail: tx(
            '대상 호스트는 게스트 차단을 유지 중이나 현재 PC는 허용되어 있습니다. 보안 계정 모드 또는 호스트 개방을 맞추세요.',
            'Target host keeps guest access blocked while this PC allows it. Match secure-account mode or open host policy.'
          ),
        };
      }
      return {
        status: 'aligned',
        badgeLabel: tx('호스트 일치', 'Matches Host'),
        expectedHostValue: hostGuestOpen ? tx('허용 (1)', 'Allowed (1)') : tx('차단 (0)', 'Blocked (0)'),
        discrepancyDetail: tx(
          '비인증 게스트 로그온 허용 정책이 양단 모두 일치합니다.',
          'Insecure guest logon policy matches on both ends.'
        ),
      };
    }

    case 'audit_guest_account_501': {
      if (typeof hostSnap.guestAccountEnabled !== 'boolean' || typeof localStatus.guestAccountEnabled !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: tx('호스트 미측정', 'Host Unmeasured'),
          expectedHostValue: hostSnap.allowInsecureGuestAuth
            ? tx('활성 추정 (ON)', 'Likely Enabled (ON)')
            : tx('미측정', 'Not Measured'),
          discrepancyDetail: tx(
            '대상 호스트 스냅샷에 Guest 계정(*-501) 활성 여부가 포함되지 않았습니다.',
            'Target host snapshot does not include Guest account (*-501) status.'
          ),
        };
      }
      const hostOn = hostSnap.guestAccountEnabled;
      const localOn = localStatus.guestAccountEnabled;
      if (hostOn === localOn) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostOn ? tx('활성 (ON)', 'Enabled (ON)') : tx('비활성 (OFF)', 'Disabled (OFF)'),
          discrepancyDetail: tx(
            '양단 PC의 내장 Guest(*-501) 계정 상태가 동일합니다.',
            'Built-in Guest (*-501) account state matches on both PCs.'
          ),
        };
      }
      return {
        status: !hostOn && hostSnap.allowInsecureGuestAuth ? 'conflict' : 'warning',
        badgeLabel: hostOn
          ? tx('호스트 활성 · 로컬 OFF', 'Host ON · Local OFF')
          : tx('호스트 OFF · 로컬 활성', 'Host OFF · Local ON'),
        expectedHostValue: hostOn ? tx('활성 (ON)', 'Enabled (ON)') : tx('비활성 (OFF)', 'Disabled (OFF)'),
        discrepancyDetail: hostOn
          ? tx(
              '대상 호스트는 무비밀번호 공유를 위해 Guest 계정이 켜져 있으나 현재 PC는 비활성(OFF)입니다.',
              'Target host has Guest enabled for passwordless sharing while this PC has it disabled.'
            )
          : tx(
              '대상 호스트의 Guest 계정은 꺼져 있으나 현재 PC Guest 계정이 활성화되어 있습니다.',
              'Target host Guest account is disabled while this PC Guest account is active.'
            ),
      };
    }

    case 'audit_se_deny_guest_logon': {
      if (typeof hostSnap.guestNetworkLogonDenied !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: tx('호스트 미측정', 'Host Unmeasured'),
          expectedHostValue: tx('미측정', 'Not Measured'),
          discrepancyDetail: tx(
            '대상 호스트 스냅샷에 SeDenyNetworkLogonRight 측정값이 없습니다.',
            'Target host snapshot does not include SeDenyNetworkLogonRight status.'
          ),
        };
      }
      const hostDenied = hostSnap.guestNetworkLogonDenied;
      const localDenied = Boolean(localStatus.guestNetworkLogonDenied);
      if (hostDenied && hostSnap.allowInsecureGuestAuth) {
        return {
          status: 'conflict',
          badgeLabel: tx('호스트 1385 차단 충돌', 'Host Error 1385 Conflict'),
          expectedHostValue: tx('차단 해제 (허용)', 'Unblocked (Allowed)'),
          discrepancyDetail: tx(
            '대상 호스트가 Guest 로그온을 허용하면서도 SeDenyNetworkLogonRight에 거부가 남아 있어 오류 1385가 발생합니다.',
            'Target host enables Guest logon yet still denies it in SeDenyNetworkLogonRight, triggering Error 1385.'
          ),
        };
      }
      if (hostDenied === localDenied) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostDenied ? tx('거부 적용', 'Denied') : tx('차단 해제 (허용)', 'Unblocked (Allowed)'),
          discrepancyDetail: tx(
            '양단 PC의 SeDenyNetworkLogonRight 정책이 동일합니다.',
            'SeDenyNetworkLogonRight policy matches on both PCs.'
          ),
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostDenied
          ? tx('호스트 거부 · 로컬 허용', 'Host Denied · Local Allowed')
          : tx('호스트 허용 · 로컬 거부', 'Host Allowed · Local Denied'),
        expectedHostValue: hostDenied ? tx('거부 적용', 'Denied') : tx('차단 해제 (허용)', 'Unblocked (Allowed)'),
        discrepancyDetail: hostDenied
          ? tx(
              '대상 호스트는 Guest 네트워크 로그온을 거부 중입니다(무비밀번호 연결 시 Error 1385 주의).',
              'Target host denies Guest network logon (watch for Error 1385 on passwordless connections).'
            )
          : tx(
              '대상 호스트는 Guest 로그온을 허용 중이나 현재 PC는 보안 원복으로 거부 상태입니다.',
              'Target host allows Guest logon while this PC denies it via security rollback.'
            ),
      };
    }

    case 'audit_lsa_blank_password': {
      if (typeof hostSnap.limitBlankPasswordUse !== 'boolean' || typeof localStatus.limitBlankPasswordUse !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: tx('호스트 미측정', 'Host Unmeasured'),
          expectedHostValue: tx('미측정', 'Not Measured'),
          discrepancyDetail: tx(
            '대상 호스트 스냅샷에 LimitBlankPasswordUse 정보가 없습니다.',
            'Target host snapshot lacks LimitBlankPasswordUse data.'
          ),
        };
      }
      const hostLimit = hostSnap.limitBlankPasswordUse;
      const localLimit = localStatus.limitBlankPasswordUse;
      if (hostLimit && hostSnap.allowInsecureGuestAuth) {
        return {
          status: 'conflict',
          badgeLabel: tx('호스트 Error 86 제한', 'Host Error 86 Restriction'),
          expectedHostValue: tx('허용 (0)', 'Allowed (0)'),
          discrepancyDetail: tx(
            '대상 호스트의 빈 암호 제한(LimitBlankPasswordUse=1) 때문에 무비밀번호 공유 연결 시 오류 86이 발생할 수 있습니다.',
            'Target host restricts blank passwords (LimitBlankPasswordUse=1), which can cause Error 86 on passwordless connections.'
          ),
        };
      }
      if (hostLimit === localLimit) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostLimit ? tx('제한됨 (1)', 'Restricted (1)') : tx('허용 (0)', 'Allowed (0)'),
          discrepancyDetail: tx(
            'LSA 빈 암호 네트워크 로그온 제한 정책이 양단 동일합니다.',
            'LSA blank-password network logon policy matches on both PCs.'
          ),
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostLimit
          ? tx('호스트 제한 · 로컬 허용', 'Host Restricted · Local Allowed')
          : tx('호스트 허용 · 로컬 제한', 'Host Allowed · Local Restricted'),
        expectedHostValue: hostLimit ? tx('제한됨 (1)', 'Restricted (1)') : tx('허용 (0)', 'Allowed (0)'),
        discrepancyDetail: hostLimit
          ? tx(
              '대상 호스트는 빈 암호 로그온을 제한 중이며 현재 PC는 허용 상태입니다.',
              'Target host restricts blank-password logon while this PC allows it.'
            )
          : tx(
              '대상 호스트는 빈 암호 로그온을 허용(0) 중이나 현재 PC는 제한(1) 상태입니다.',
              'Target host allows blank-password logon (0) while this PC restricts it (1).'
            ),
      };
    }

    case 'audit_lsa_anonymous_null': {
      if (typeof hostSnap.restrictNullSessAccess !== 'boolean' && typeof hostSnap.restrictAnonymous !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: tx('호스트 미측정', 'Host Unmeasured'),
          expectedHostValue: tx('미측정', 'Not Measured'),
          discrepancyDetail: tx(
            '대상 호스트 스냅샷에 LSA 익명/Null 세션 값이 없습니다.',
            'Target host snapshot lacks LSA anonymous/null session values.'
          ),
        };
      }
      const hostBlocked = Boolean(hostSnap.restrictNullSessAccess || hostSnap.restrictAnonymous);
      const localBlocked = Boolean(
        localStatus.everyoneIncludesAnonymous !== true &&
          (localStatus.restrictNullSessAccess !== false || localStatus.restrictAnonymous)
      );
      if (hostBlocked === localBlocked) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostBlocked ? tx('차단됨', 'Blocked') : tx('완화됨 (Null 허용)', 'Relaxed (Null Allowed)'),
          discrepancyDetail: tx(
            'LSA 익명 및 Null 세션 차단 자세가 양단 호환됩니다.',
            'LSA anonymous and null session posture is compatible on both PCs.'
          ),
        };
      }
      return {
        status: hostBlocked && hostSnap.allowInsecureGuestAuth ? 'conflict' : 'warning',
        badgeLabel: hostBlocked
          ? tx('호스트 1223 차단 · 로컬 완화', 'Host 1223 Blocked · Local Relaxed')
          : tx('호스트 완화 · 로컬 차단', 'Host Relaxed · Local Blocked'),
        expectedHostValue: hostBlocked ? tx('차단됨', 'Blocked') : tx('완화됨 (Null 허용)', 'Relaxed (Null Allowed)'),
        discrepancyDetail: hostBlocked
          ? tx(
              '대상 호스트는 익명/Null 세션을 차단 중입니다(무비밀번호 연결 시 오류 1223 가능).',
              'Target host blocks anonymous/null sessions (Error 1223 possible on passwordless connections).'
            )
          : tx(
              '대상 호스트는 Null 세션을 완화해 두었으나 현재 PC는 보안 원복 차단 상태입니다.',
              'Target host relaxed null sessions while this PC blocks them via security rollback.'
            ),
      };
    }

    case 'audit_ntlm_level': {
      const hostLm = typeof hostSnap.lmCompatibilityLevel === 'number' ? hostSnap.lmCompatibilityLevel : null;
      const localLm = localStatus.lmCompatibilityLevel;
      if (hostLm === null || localLm === null) {
        return {
          status: 'aligned',
          badgeLabel: tx('OS 기본 NTLM 호환', 'OS Default NTLM Compat'),
          expectedHostValue: hostLm !== null ? `Lm=${hostLm}` : tx('OS 기본값', 'OS Default'),
          discrepancyDetail: tx(
            'Windows 기본 NTLMv2 협상 범위 내에서 동작합니다.',
            'Operating within default Windows NTLMv2 negotiation range.'
          ),
        };
      }
      if (hostLm === localLm) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
          discrepancyDetail: tx(
            `양단 PC 모두 LmCompatibilityLevel=${hostLm}으로 일치합니다.`,
            `Both PCs match at LmCompatibilityLevel=${hostLm}.`
          ),
        };
      }
      if (Math.abs(hostLm - localLm) >= 2 || hostLm < 3 || localLm < 3) {
        return {
          status: 'conflict',
          badgeLabel: tx(`NTLM 충돌 (호스트 ${hostLm} ↔ 로컬 ${localLm})`, `NTLM Conflict (Host ${hostLm} ↔ Local ${localLm})`),
          expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
          discrepancyDetail: tx(
            'NTLM 인증 수준 차이가 커서 자격 증명 협상 오류가 발생할 수 있습니다.',
            'Wide NTLM level gap may cause credential negotiation failures.'
          ),
        };
      }
      return {
        status: 'warning',
        badgeLabel: tx(`NTLM 차이 (호스트 ${hostLm} ↔ 로컬 ${localLm})`, `NTLM Difference (Host ${hostLm} ↔ Local ${localLm})`),
        expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
        discrepancyDetail: tx(
          '대상 호스트와 NTLM 호환성 레벨 숫자가 다릅니다(NTLMv2 협상 가능).',
          'NTLM compatibility level differs from target host (NTLMv2 still negotiable).'
        ),
      };
    }

    case 'audit_uac_token_filter': {
      if (typeof hostSnap.localAccountTokenFilterEnabled !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: tx('호스트 미측정', 'Host Unmeasured'),
          expectedHostValue: tx('미측정', 'Not Measured'),
          discrepancyDetail: tx(
            '대상 호스트의 UAC 원격 토큰 필터 정보가 없습니다.',
            'Target host UAC remote token filter data is unavailable.'
          ),
        };
      }
      const hostUac = hostSnap.localAccountTokenFilterEnabled;
      const localUac = Boolean(localStatus.localAccountTokenFilterEnabled);
      if (hostUac === localUac) {
        return {
          status: 'aligned',
          badgeLabel: tx('호스트 일치', 'Matches Host'),
          expectedHostValue: hostUac ? tx('필터 완화 (1)', 'Filter Relaxed (1)') : tx('기본 보호 (0)', 'Default Protected (0)'),
          discrepancyDetail: tx(
            '양단 PC의 UAC 원격 토큰 필터 설정이 동일합니다.',
            'UAC remote token filter setting matches on both PCs.'
          ),
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostUac
          ? tx('호스트 완화(1) · 로컬 보호(0)', 'Host Relaxed(1) · Local Protected(0)')
          : tx('호스트 보호(0) · 로컬 완화(1)', 'Host Protected(0) · Local Relaxed(1)'),
        expectedHostValue: hostUac ? tx('필터 완화 (1)', 'Filter Relaxed (1)') : tx('기본 보호 (0)', 'Default Protected (0)'),
        discrepancyDetail: hostUac
          ? tx(
              '대상 호스트는 UAC 원격 토큰 필터가 완화(1)되어 있으나 현재 PC는 기본 보호(0) 상태입니다.',
              'Target host relaxed UAC remote token filter (1) while this PC stays protected (0).'
            )
          : tx(
              '대상 호스트는 기본 보호(0) 상태이나 현재 PC는 필터 완화(1)가 켜져 있습니다.',
              'Target host uses default protection (0) while this PC has filter relaxed (1).'
            ),
      };
    }

    case 'audit_rpc_fw_smb1':
    default: {
      const hostRpcRelaxed = hostSnap.rpcAuthnLevelPrivacyDisabled;
      const localRpcRelaxed = localStatus.rpcAuthnLevelPrivacyDisabled;
      const hostFwBlocked = hostSnap.firewall445Allowed === false;
      const localFwBlocked = localStatus.firewall445Allowed === false;

      if (hostFwBlocked || localFwBlocked) {
        return {
          status: 'conflict',
          badgeLabel: tx('방화벽 445 차단 충돌', 'Firewall 445 Block Conflict'),
          expectedHostValue: tx('TCP 445 개방', 'TCP 445 Open'),
          discrepancyDetail: hostFwBlocked
            ? tx(
                '대상 호스트의 TCP 445 방화벽 규칙이 닫혀 있어 연결 시 오류 53이 발생합니다.',
                'Target host TCP 445 firewall rule is closed, causing Error 53 on connection.'
              )
            : tx(
                '현재 PC의 TCP 445 방화벽 규칙이 닫혀 있습니다.',
                'TCP 445 firewall rule on this PC is closed.'
              ),
        };
      }
      if (hostRpcRelaxed !== localRpcRelaxed) {
        return {
          status: hostRpcRelaxed && !localRpcRelaxed ? 'conflict' : 'warning',
          badgeLabel: hostRpcRelaxed
            ? tx('프린터 RPC 불일치 (0x11b)', 'Printer RPC Mismatch (0x11b)')
            : tx('RPC 정책 차이', 'RPC Policy Difference'),
          expectedHostValue: hostRpcRelaxed
            ? tx('RPC 완화 · 445 개방', 'RPC Relaxed · 445 Open')
            : tx('엄격 RPC · 445 개방', 'Strict RPC · 445 Open'),
          discrepancyDetail: hostRpcRelaxed
            ? tx(
                '대상 호스트는 프린터 RPC 호환 완화 상태이나 현재 PC는 엄격 RPC 상태입니다(프린터 공유 시 0x0000011b 주의).',
                'Target host relaxed printer RPC while this PC uses strict RPC (watch for 0x0000011b on printer sharing).'
              )
            : tx(
                '대상 호스트는 엄격 RPC 상태이나 현재 PC는 프린터 RPC 완화가 적용되어 있습니다.',
                'Target host uses strict RPC while this PC has printer RPC relaxed.'
              ),
        };
      }
      return {
        status: 'aligned',
        badgeLabel: tx('호스트 일치 (RPC·445)', 'Matches Host (RPC·445)'),
        expectedHostValue: hostRpcRelaxed
          ? tx('RPC 완화 · 445 개방', 'RPC Relaxed · 445 Open')
          : tx('엄격 RPC · 445 개방', 'Strict RPC · 445 Open'),
        discrepancyDetail: tx(
          '프린터 RPC 보안 및 TCP 445 방화벽 기준이 대상 호스트와 일치합니다.',
          'Printer RPC security and TCP 445 firewall posture match the target host.'
        ),
      };
    }
  }
}

export function evaluateSecurityRollbackAudit(
  status: OsNetworkPolicyStatus,
  context?: {
    activeShareCount?: number;
    activeMountCount?: number;
    targetHostSnapshot?: HostPolicySnapshot | null;
  }
): SecurityRollbackAuditReport {
  const activeShareCount = Math.max(0, context?.activeShareCount ?? 0);
  const activeMountCount = Math.max(0, context?.activeMountCount ?? 0);
  const targetHostSnapshot = context?.targetHostSnapshot ?? null;
  const hasAhbiFirewallRule = status.ahbiFirewallRulePresent === true;

  const items: SecurityRollbackAuditItem[] = [];

  // 1. SMB Server Security Signing
  items.push({
    id: 'audit_smb_server_signing',
    index: 1,
    category: tx('SMB 서명', 'SMB Signing'),
    label: tx('SMB 서버 보안 서명 강제', 'Enforce SMB Server Security Signing'),
    registryOrPolicy: 'LanmanServer\\Parameters\\RequireSecuritySignature',
    currentValue: status.smbServerSigningRequired ? tx('강제됨 (1)', 'Required (1)') : tx('완화됨 (0)', 'Relaxed (0)'),
    expectedDefault: tx('강제됨 (1)', 'Required (1)'),
    status: status.smbServerSigningRequired ? 'restored' : 'relaxed',
    detail: status.smbServerSigningRequired
      ? tx(
          '호스트 SMB 서버가 패킷 서명을 강제하여 중간자 변조를 차단합니다.',
          'Host SMB server enforces packet signing to block tampering.'
        )
      : tx(
          '서버 SMB 서명이 완화되어 있습니다. 표준 보안 복원 시 강제됨(1)으로 잠깁니다.',
          'Server SMB signing is relaxed. Standard security restore locks it back to 1.'
        ),
    ...(status.smbServerSigningRequired ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 2. SMB Client Security Signing
  items.push({
    id: 'audit_smb_client_signing',
    index: 2,
    category: tx('SMB 서명', 'SMB Signing'),
    label: tx('SMB 클라이언트 보안 서명 강제', 'Enforce SMB Client Security Signing'),
    registryOrPolicy: 'LanmanWorkstation\\Parameters\\RequireSecuritySignature',
    currentValue: status.smbClientSigningRequired ? tx('강제됨 (1)', 'Required (1)') : tx('완화됨 (0)', 'Relaxed (0)'),
    expectedDefault: tx('강제됨 (1)', 'Required (1)'),
    status: status.smbClientSigningRequired ? 'restored' : 'relaxed',
    detail: status.smbClientSigningRequired
      ? tx(
          '클라이언트가 서명 없는 서버 연결을 거부하는 Win 11 24H2+ 기본 보안 상태입니다.',
          'Default Win 11 24H2+ secure state rejecting unsigned server connections.'
        )
      : tx(
          '클라이언트 SMB 서명 강제가 해제되어 있습니다. 보안 원복 시 강제됨(1)으로 복구됩니다.',
          'Client SMB signing enforcement is relaxed. Restored to 1 on security rollback.'
        ),
    ...(status.smbClientSigningRequired ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 3. Insecure Guest Logon Disabled
  const guestAuthBlocked = !status.allowInsecureGuestAuth && !status.enableInsecureGuestLogons;
  items.push({
    id: 'audit_insecure_guest_auth',
    index: 3,
    category: tx('게스트 제한', 'Guest Restriction'),
    label: tx('비인증 게스트 로그온 차단', 'Block Insecure Guest Logon'),
    registryOrPolicy: 'LanmanWorkstation (Service & Policy AllowInsecureGuestAuth)',
    currentValue: guestAuthBlocked ? tx('차단됨 (0)', 'Blocked (0)') : tx('허용됨 (1)', 'Allowed (1)'),
    expectedDefault: tx('차단됨 (0)', 'Blocked (0)'),
    status: guestAuthBlocked ? 'restored' : 'relaxed',
    detail: guestAuthBlocked
      ? tx(
          '비인증 게스트 로그온(서비스 및 정책 GPO 키)이 모두 차단 상태로 복구되었습니다.',
          'Both service and GPO policy keys for insecure guest logon are restored to blocked.'
        )
      : tx(
          '비인증 게스트 로그온이 허용되어 있습니다. 공유 종료 후 차단(0)으로 원복해야 합니다.',
          'Insecure guest logon is allowed. Revert to blocked (0) after sharing ends.'
        ),
    ...(guestAuthBlocked ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 4. Built-in Guest Account (*-501) Disabled
  const guestAccUnknown = typeof status.guestAccountEnabled !== 'boolean';
  const guestAccOff = status.guestAccountEnabled === false;
  items.push({
    id: 'audit_guest_account_501',
    index: 4,
    category: tx('게스트 제한', 'Guest Restriction'),
    label: tx('내장 Guest 계정 (SID *-501) 비활성', 'Built-in Guest Account (SID *-501) Disabled'),
    registryOrPolicy: 'LocalUser SID *-501 (Disabled)',
    currentValue: guestAccUnknown
      ? tx('미측정', 'Not Measured')
      : guestAccOff
        ? tx('비활성 (OFF)', 'Disabled (OFF)')
        : tx('활성 (ON)', 'Enabled (ON)'),
    expectedDefault: tx('비활성 (OFF)', 'Disabled (OFF)'),
    status: guestAccUnknown ? 'unknown' : guestAccOff ? 'restored' : 'relaxed',
    detail: guestAccUnknown
      ? tx(
          'Guest 계정 상태를 직접 확인하지 못했습니다. 재검사 또는 호스트 보안 원복을 권장합니다.',
          'Could not inspect Guest account status directly. Re-scan or run host security rollback.'
        )
      : guestAccOff
        ? tx(
            'Windows 내장 Guest 계정이 비활성(Disabled)으로 안전하게 잠겨 있습니다.',
            'Built-in Windows Guest account is safely disabled.'
          )
        : tx(
            '무비밀번호 공유용 Guest 계정이 아직 활성화되어 있습니다. 표준 보안 복원으로 비활성화하세요.',
            'Guest account for passwordless sharing is still active. Disable it via standard security restore.'
          ),
    ...(guestAccUnknown || guestAccOff ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 5. SeDenyNetworkLogonRight (Guest Network Logon Denied)
  const guestNetDenied = status.guestNetworkLogonDenied === true;
  items.push({
    id: 'audit_se_deny_guest_logon',
    index: 5,
    category: tx('게스트 제한', 'Guest Restriction'),
    label: tx('로컬 보안 정책 Guest 네트워크 거부', 'Local Policy Deny Guest Network Logon'),
    registryOrPolicy: 'Secedit User Rights (SeDenyNetworkLogonRight)',
    currentValue: guestNetDenied
      ? tx('거부 적용 (1385 방어)', 'Denied (1385 Protected)')
      : tx('거부 해제 (허용)', 'Unblocked (Allowed)'),
    expectedDefault: tx('거부 적용 (Guest/Guests)', 'Denied (Guest/Guests)'),
    status: guestNetDenied ? 'restored' : 'relaxed',
    detail: guestNetDenied
      ? tx(
          'SeDenyNetworkLogonRight에 Guest/Guests 네트워크 로그온 거부가 복구되어 외부 무비밀번호 접근이 차단됩니다.',
          'SeDenyNetworkLogonRight restores Guest/Guests network logon denial, blocking passwordless remote access.'
        )
      : tx(
          '네트워크 로그온 거부 정책에서 Guest/Guests 차단이 풀려 있습니다.',
          'Guest/Guests denial is currently removed from SeDenyNetworkLogonRight.'
        ),
    ...(guestNetDenied ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 6. LSA LimitBlankPasswordUse
  const blankPwdUnknown = typeof status.limitBlankPasswordUse !== 'boolean';
  const blankPwdLimited = status.limitBlankPasswordUse === true;
  items.push({
    id: 'audit_lsa_blank_password',
    index: 6,
    category: tx('LSA 보안', 'LSA Security'),
    label: tx('LSA 빈 암호 네트워크 로그온 제한', 'LSA Limit Blank Password Network Logon'),
    registryOrPolicy: 'Control\\Lsa\\LimitBlankPasswordUse',
    currentValue: blankPwdUnknown
      ? tx('미측정', 'Not Measured')
      : blankPwdLimited
        ? tx('제한됨 (1)', 'Restricted (1)')
        : tx('허용됨 (0)', 'Allowed (0)'),
    expectedDefault: tx('제한됨 (1)', 'Restricted (1)'),
    status: blankPwdUnknown ? 'unknown' : blankPwdLimited ? 'restored' : 'relaxed',
    detail: blankPwdUnknown
      ? tx('LimitBlankPasswordUse 레지스트리 값을 확인하지 못했습니다.', 'Could not verify LimitBlankPasswordUse registry value.')
      : blankPwdLimited
        ? tx('빈 암호 계정의 원격 네트워크 로그온이 차단(1)되어 있습니다.', 'Remote network logon for blank-password accounts is blocked (1).')
        : tx(
            '빈 암호 네트워크 로그온 제한이 해제(0)되어 있습니다. 보안 원복으로 제한(1)을 복원하세요.',
            'Blank-password network logon restriction is disabled (0). Restore restriction (1).'
          ),
    ...(blankPwdUnknown || blankPwdLimited ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 7. LSA Anonymous & Null Session Restriction
  const everyAnonOff = status.everyoneIncludesAnonymous !== true;
  const nullSessRestricted = status.restrictNullSessAccess !== false;
  const anonRestricted = status.restrictAnonymous === true;
  const lsaAnonFullyLocked = everyAnonOff && nullSessRestricted && anonRestricted;
  const lsaAnonPartial = everyAnonOff && nullSessRestricted && !anonRestricted;
  items.push({
    id: 'audit_lsa_anonymous_null',
    index: 7,
    category: tx('LSA 보안', 'LSA Security'),
    label: tx('LSA 익명 · Null 세션 차단', 'Block LSA Anonymous & Null Sessions'),
    registryOrPolicy: 'everyoneincludesanonymous=0 · restrictanonymous=1 · RestrictNullSessAccess=1',
    currentValue: lsaAnonFullyLocked
      ? tx('3종 완전 차단 (0/1/1)', 'All 3 Locked (0/1/1)')
      : lsaAnonPartial
        ? tx(`부분 차단 (Anon=${status.restrictAnonymous ? 1 : 0})`, `Partial Lock (Anon=${status.restrictAnonymous ? 1 : 0})`)
        : tx(
            `완화됨 (Every=${status.everyoneIncludesAnonymous ? 1 : 0}, Null=${status.restrictNullSessAccess === false ? 0 : 1})`,
            `Relaxed (Every=${status.everyoneIncludesAnonymous ? 1 : 0}, Null=${status.restrictNullSessAccess === false ? 0 : 1})`
          ),
    expectedDefault: tx('3종 완전 차단 (0/1/1)', 'All 3 Locked (0/1/1)'),
    status: lsaAnonFullyLocked ? 'restored' : lsaAnonPartial ? 'partial' : 'relaxed',
    detail: lsaAnonFullyLocked
      ? tx(
          'everyoneincludesanonymous=0, restrictanonymous=1, RestrictNullSessAccess=1 모두 보안 원복 기준과 일치합니다.',
          'everyoneincludesanonymous=0, restrictanonymous=1, and RestrictNullSessAccess=1 all match the restored security baseline.'
        )
      : lsaAnonPartial
        ? tx(
            'everyoneincludesanonymous=0 및 Null 세션 차단은 잠겼으나 restrictanonymous=0 상태입니다(표준 원복 실행 시 1로 강화).',
            'everyoneincludesanonymous=0 and null session block are locked, while restrictanonymous=0 (standard restore tightens to 1).'
          )
        : tx(
            'LSA 익명 또는 Null 세션 허용 키가 완화 상태입니다. 표준 보안 복원이 필요합니다.',
            'LSA anonymous or null session restriction keys are relaxed. Standard security restore is recommended.'
          ),
    ...(lsaAnonFullyLocked ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 8. NTLM Compatibility Level
  const lmLevel = status.lmCompatibilityLevel;
  const lmSafe = typeof lmLevel === 'number' && lmLevel >= 3;
  const lmDefaultUnset = lmLevel === null;
  items.push({
    id: 'audit_ntlm_level',
    index: 8,
    category: tx('NTLM 인증', 'NTLM Auth'),
    label: tx('NTLM 인증 협상 수준 (NTLMv2)', 'NTLM Compatibility Level (NTLMv2)'),
    registryOrPolicy: 'Control\\Lsa\\LmCompatibilityLevel',
    currentValue: lmDefaultUnset ? tx('OS 기본값 (NTLMv2)', 'OS Default (NTLMv2)') : `LmCompatibilityLevel=${lmLevel}`,
    expectedDefault: tx('3 이상 (NTLMv2 전용)', '3 or higher (NTLMv2 only)'),
    status: lmSafe ? 'restored' : lmDefaultUnset ? 'partial' : 'relaxed',
    detail: lmSafe
      ? tx(
          `LmCompatibilityLevel=${lmLevel}으로 취약한 LM/NTLMv1 응답을 거부하고 NTLMv2만 협상합니다.`,
          `LmCompatibilityLevel=${lmLevel} rejects weak LM/NTLMv1 and negotiates NTLMv2 only.`
        )
      : lmDefaultUnset
        ? tx(
            '명시적 레지스트리 값 없이 OS 기본(Win 10/11 기본 NTLMv2)으로 동작 중입니다.',
            'No explicit registry key set; running at OS default (Win 10/11 NTLMv2).'
          )
        : tx(
            `LmCompatibilityLevel=${lmLevel}으로 낮아져 있습니다. 보안 원복(3 이상) 정렬을 권장합니다.`,
            `LmCompatibilityLevel=${lmLevel} is lowered. Align to 3+ via security rollback.`
          ),
    ...(lmSafe || lmDefaultUnset ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 9. UAC Remote Token Filter Protection
  const uacProtected = !status.localAccountTokenFilterEnabled;
  items.push({
    id: 'audit_uac_token_filter',
    index: 9,
    category: tx('UAC 원격 보호', 'UAC Remote Protection'),
    label: tx('UAC 원격 토큰 필터 보호', 'UAC Remote Token Filter Protection'),
    registryOrPolicy: 'Policies\\System\\LocalAccountTokenFilterPolicy',
    currentValue: uacProtected ? tx('기본 보호 (0)', 'Default Protected (0)') : tx('필터 완화 (1)', 'Filter Relaxed (1)'),
    expectedDefault: tx('기본 보호 (0)', 'Default Protected (0)'),
    status: uacProtected ? 'restored' : 'relaxed',
    detail: uacProtected
      ? tx(
          '워크그룹 원격 접속 시 로컬 관리자 상승 토큰 필터링이 기본 보안(0)으로 유지됩니다.',
          'Workgroup remote local-admin elevated token filtering remains at default secure (0).'
        )
      : tx(
          'LocalAccountTokenFilterPolicy=1이 활성화되어 원격 관리자 토큰 접근이 열려 있습니다.',
          'LocalAccountTokenFilterPolicy=1 is active, allowing remote elevated admin tokens.'
        ),
    ...(uacProtected ? {} : { remediationMode: 'disable_uac_token_filter' }),
  });

  // 10. Printer RPC Privacy + Temporary Firewall (AhBiShare-SMB-445) + SMBv1 Disabled
  const rpcStrict = !status.rpcAuthnLevelPrivacyDisabled;
  const smb1Off = !status.smb1Enabled && !status.smb1ServerEnabled;
  const fwClean = !hasAhbiFirewallRule;
  const clean10Ok = rpcStrict && smb1Off && fwClean;
  const issues10: string[] = [];
  if (!rpcStrict) issues10.push(tx('프린터 RPC 개인정보 인증 완화됨', 'Printer RPC privacy relaxed'));
  if (!fwClean) issues10.push(tx('임시 방화벽(AhBiShare-SMB-445) 잔존', 'Temporary firewall (AhBiShare-SMB-445) present'));
  if (!smb1Off) issues10.push(tx('레거시 SMB 1.0 활성 상태', 'Legacy SMB 1.0 active'));

  items.push({
    id: 'audit_rpc_fw_smb1',
    index: 10,
    category: tx('RPC · 방화벽 · SMBv1', 'RPC · Firewall · SMBv1'),
    label: tx('프린터 RPC · 임시 방화벽 · SMBv1 정리', 'Printer RPC · Temp Firewall · SMBv1 Cleanup'),
    registryOrPolicy: 'RpcAuthnLevelPrivacyEnabled=1 · AhBiShare-SMB-445 · SMB1',
    currentValue: clean10Ok
      ? tx('엄격 RPC · 임시규칙 삭제 · SMBv1 OFF', 'Strict RPC · Temp Rule Removed · SMBv1 OFF')
      : [
          rpcStrict ? tx('엄격 RPC', 'Strict RPC') : tx('RPC 완화', 'RPC Relaxed'),
          fwClean ? tx('임시규칙 없음', 'No Temp Rule') : tx('445 규칙 잔존', '445 Rule Present'),
          smb1Off ? 'SMBv1 OFF' : 'SMBv1 ON',
        ].join(' · '),
    expectedDefault: tx('엄격 RPC · 임시규칙 삭제 · SMBv1 OFF', 'Strict RPC · Temp Rule Removed · SMBv1 OFF'),
    status: clean10Ok ? 'restored' : !rpcStrict ? 'relaxed' : 'partial',
    detail: clean10Ok
      ? tx(
          '프린터 RPC 엄격 인증(1)이 유지되고, AhBiShare-SMB-445 임시 방화벽 규칙 및 SMBv1이 모두 비활성화되었습니다.',
          'Strict Printer RPC (1) is active, temporary AhBiShare-SMB-445 rule is removed, and SMBv1 is off.'
        )
      : tx(
          `추가 확인 필요: ${issues10.join(', ')}${!fwClean ? ' (호스트 보안 원복으로 임시 규칙 삭제 가능)' : ''}`,
          `Attention needed: ${issues10.join(', ')}${!fwClean ? ' (run host rollback to remove temporary rule)' : ''}`
        ),
    ...(!rpcStrict ? { remediationMode: 'rpc_printer_default' as PolicyPatchMode } : {}),
  });

  if (targetHostSnapshot) {
    for (const item of items) {
      item.hostComparison = buildHostItemComparison(item.id, status, targetHostSnapshot);
    }
  }

  const passedCount = items.filter((i) => i.status === 'restored').length;
  const partialCount = items.filter((i) => i.status === 'partial' || i.status === 'unknown').length;
  const failedCount = items.filter((i) => i.status === 'relaxed').length;

  const targetConflictCount = targetHostSnapshot
    ? items.filter((i) => i.hostComparison?.status === 'conflict').length
    : undefined;
  const targetDiscrepancyCount = targetHostSnapshot
    ? items.filter((i) => i.hostComparison?.status === 'conflict' || i.hostComparison?.status === 'warning').length
    : undefined;

  const modeSet = new Set<PolicyPatchMode>();
  for (const item of items) {
    if (item.status !== 'restored' && item.remediationMode) {
      modeSet.add(item.remediationMode);
    }
  }
  const recommendedModes = Array.from(modeSet).sort((a, b) => {
    const ia = PATCH_EXECUTION_ORDER.indexOf(a);
    const ib = PATCH_EXECUTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const hasResidualSharesOrMounts = activeShareCount > 0 || activeMountCount > 0 || hasAhbiFirewallRule;

  let verdict: SecurityRollbackAuditReport['verdict'] = 'fully_restored';
  let headline = tx(
    `보안 원복 완벽 검증 · ${passedCount} / 10개 핵심 항목 기본값 일치`,
    `Security Rollback Verified · ${passedCount} / 10 Core Policies at Default`
  );
  let summary = hasResidualSharesOrMounts
    ? tx(
        `핵심 OS 정책 ${passedCount}건이 보안 기본값입니다. (참고: 활성 공유 ${activeShareCount}건 · 연결 드라이브 ${activeMountCount}건${hasAhbiFirewallRule ? ' · 임시 방화벽 규칙' : ''} 확인됨)`,
        `${passedCount} core OS policies are at secure defaults. (Note: ${activeShareCount} active share(s) · ${activeMountCount} mounted drive(s)${hasAhbiFirewallRule ? ' · temporary firewall rule' : ''} detected.)`
      )
    : tx(
        'SMB 서명, 게스트·빈 암호 차단, LSA 익명 제한, NTLMv2, UAC 보호 및 프린터 RPC까지 모든 보안 정책이 의도한 기본값으로 복구되었습니다.',
        'All security policies—from SMB signing and guest/blank-password blocks to LSA limits, NTLMv2, UAC protection, and Printer RPC—are restored to defaults.'
      );

  if (failedCount > 0) {
    verdict = 'incomplete';
    headline = tx(
      `일부 정책 완화 상태 감지 · ${passedCount} / 10개 복구 (${failedCount}건 미복구)`,
      `Relaxed Policies Detected · ${passedCount} / 10 Restored (${failedCount} remaining)`
    );
    summary = tx(
      `${failedCount}개 핵심 항목이 아직 공유 호환(완화) 상태에 남아 있습니다. 아래 미복구 항목을 확인한 뒤 표준 보안 복원 또는 전체 보안 원복을 실행하세요.`,
      `${failedCount} core item(s) remain relaxed for sharing compatibility. Review them below and run Standard Security Restore or Full Rollback.`
    );
  } else if (partialCount > 0) {
    verdict = 'mostly_restored';
    headline = tx(
      `보안 기본값 대체로 복구됨 · ${passedCount} / 10개 완전 일치 (${partialCount}건 세부 확인)`,
      `Mostly Restored · ${passedCount} / 10 Fully Locked (${partialCount} review item(s))`
    );
    summary = tx(
      `위험 완화 항목은 없으나 ${partialCount}개 항목이 OS 기본값 또는 부분 잠금 상태입니다. 필요 시 일괄 복원을 실행해 10/10 완전 잠금으로 맞출 수 있습니다.`,
      `No risky relaxations found, though ${partialCount} item(s) are at OS default or partial lock. Run batch restore to lock all 10/10.`
    );
  }

  return {
    verdict,
    headline,
    summary,
    passedCount,
    partialCount,
    failedCount,
    totalCount: items.length,
    activeShareCount,
    activeMountCount,
    recommendedModes,
    hasResidualSharesOrMounts,
    hasAhbiFirewallRule,
    ...(targetHostSnapshot
      ? {
          targetHostName: targetHostSnapshot.hostName,
          targetDiscrepancyCount,
          targetConflictCount,
        }
      : {}),
    evaluatedAt: status.checkedAt || formatSnapshotTimestamp(new Date().toISOString()),
    items,
  };
}

export function formatSecurityRollbackReportText(
  report: SecurityRollbackAuditReport,
  hostname: string,
  osLabel: string
): string {
  const statusLabel = (s: SecurityRollbackAuditItem['status']) =>
    s === 'restored'
      ? tx('복구 완료', 'Restored')
      : s === 'partial'
        ? tx('부분/기본값', 'Partial/Default')
        : s === 'unknown'
          ? tx('미측정', 'Unmeasured')
          : tx('미복구(완화)', 'Relaxed');
  const lines = [
    tx(
      `[AhBiShare OneClick 보안 원복 10개 핵심 항목 검증 보고서]`,
      `[AhBiShare OneClick 10-Point Security Rollback Verification Report]`
    ),
    tx(`대상 PC: ${hostname} · OS: ${osLabel}`, `Target PC: ${hostname} · OS: ${osLabel}`),
    tx(`점검 일시: ${report.evaluatedAt}`, `Evaluated At: ${report.evaluatedAt}`),
    tx(`종합 판정: ${report.headline}`, `Verdict: ${report.headline}`),
    ...(report.targetHostName
      ? [
          tx(
            `호스트 기대 정책 비교: ${report.targetHostName} (불일치/차이 ${report.targetDiscrepancyCount ?? 0}건 · 충돌 ${report.targetConflictCount ?? 0}건)`,
            `Host Policy Baseline Comparison: ${report.targetHostName} (${report.targetDiscrepancyCount ?? 0} difference(s) · ${report.targetConflictCount ?? 0} conflict(s))`
          ),
        ]
      : []),
    tx(
      `활성 공유: ${report.activeShareCount}건 · 연결 드라이브: ${report.activeMountCount}건 · AhBiShare-SMB-445 규칙: ${report.hasAhbiFirewallRule ? '존재' : '삭제됨'}`,
      `Active Shares: ${report.activeShareCount} · Mounted Drives: ${report.activeMountCount} · AhBiShare-SMB-445 Rule: ${report.hasAhbiFirewallRule ? 'Present' : 'Removed'}`
    ),
    '',
    ...report.items.map((item) => {
      const base = tx(
        `${String(item.index).padStart(2, '0')}. [${statusLabel(item.status)}] ${item.label} | 현재: ${item.currentValue} | 보안기본값: ${item.expectedDefault}`,
        `${String(item.index).padStart(2, '0')}. [${statusLabel(item.status)}] ${item.label} | Current: ${item.currentValue} | Default: ${item.expectedDefault}`
      );
      return item.hostComparison
        ? tx(
            `${base} | 대상호스트(${item.hostComparison.badgeLabel}: ${item.hostComparison.expectedHostValue})`,
            `${base} | TargetHost(${item.hostComparison.badgeLabel}: ${item.hostComparison.expectedHostValue})`
          )
        : base;
    }),
  ];
  return lines.join('\n');
}

export interface RawRegistryMapInput {
  srvRequireSig?: number | null;
  srvEnableSig?: number | null;
  cliRequireSig?: number | null;
  cliEnableSig?: number | null;
  cliGuestSvc?: number | null;
  cliGuestPol?: number | null;
  cliBlockNtlm?: number | null;
  cliReqEnc?: number | null;
  guest501Disabled?: number | null;
  seDenyNetworkLogon?: string | null;
  limitBlankPwd?: number | null;
  everyAnon?: number | null;
  restrictAnon?: number | null;
  forceGuest?: number | null;
  restrictNullSess?: number | null;
  lmCompatLevel?: number | null;
  ntlmRestrictOutbound?: number | null;
  uacTokenFilter?: number | null;
  uacLinkedConn?: number | null;
  rpcPrivacy?: number | null;
  rpcNamedPipe?: number | null;
  rpcProtocols?: number | null;
  srvSmb1?: number | null;
  kirSidOverride?: number | null;
  ahbiFw445?: number | null;
}

export function formatRawDword(val: number | null | undefined, unsetHint?: string): string {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    const unsigned = val >>> 0;
    return `0x${unsigned.toString(16).padStart(8, '0').toUpperCase()} (${val})`;
  }
  return unsetHint ? tx(`<미설정 · ${unsetHint}>`, `<Not Set · ${unsetHint}>`) : tx('<미설정>', '<Not Set>');
}

function makeDwordEntry(
  policyId: string,
  registryPath: string,
  valueName: string,
  rawValue: number | null | undefined,
  expectedDefaultDisplay: string,
  unsetHint?: string
): RawRegistryEntry {
  const normalized = typeof rawValue === 'number' && !Number.isNaN(rawValue) ? rawValue : null;
  return {
    policyId,
    registryPath,
    valueName,
    valueType: 'REG_DWORD',
    rawValue: normalized,
    displayValue: formatRawDword(normalized, unsetHint),
    expectedDefaultDisplay,
  };
}

export function rawRegistryRecordToSnapshot(
  hostName: string,
  rawMap: RawRegistryMapInput,
  sourceType: RawSecurityRegistrySnapshot['sourceType'],
  sourceLabel: string,
  fetchedAt?: string,
  options?: { targetIp?: string; remoteRpcNote?: string }
): RawSecurityRegistrySnapshot {
  const ts = fetchedAt || formatSnapshotTimestamp(new Date().toISOString());

  const guestDisabledNum =
    typeof rawMap.guest501Disabled === 'number' && !Number.isNaN(rawMap.guest501Disabled)
      ? rawMap.guest501Disabled
      : null;

  const unmeasuredText = tx('<미측정>', '<Not Measured>');
  const seDenyText =
    typeof rawMap.seDenyNetworkLogon === 'string' && rawMap.seDenyNetworkLogon.trim().length > 0
      ? rawMap.seDenyNetworkLogon.trim()
      : rawMap.seDenyNetworkLogon === ''
        ? tx('<미설정 / 비어 있음>', '<Not Set / Empty>')
        : unmeasuredText;

  const ahbiFwNum =
    typeof rawMap.ahbiFw445 === 'number' && !Number.isNaN(rawMap.ahbiFw445) ? rawMap.ahbiFw445 : null;

  const entries: Record<string, RawRegistryEntry[]> = {
    audit_smb_server_signing: [
      makeDwordEntry(
        'audit_smb_server_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'RequireSecuritySignature',
        rawMap.srvRequireSig,
        '0x00000001 (1)',
        tx('기본 0 또는 1', 'Default 0 or 1')
      ),
      makeDwordEntry(
        'audit_smb_server_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'EnableSecuritySignature',
        rawMap.srvEnableSig,
        '0x00000001 (1)',
        tx('기본 1', 'Default 1')
      ),
    ],
    audit_smb_client_signing: [
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'RequireSecuritySignature',
        rawMap.cliRequireSig,
        '0x00000001 (1)',
        tx('24H2+ 기본 1', '24H2+ Default 1')
      ),
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'EnableSecuritySignature',
        rawMap.cliEnableSig,
        '0x00000001 (1)',
        tx('기본 1', 'Default 1')
      ),
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'BlockNTLM',
        rawMap.cliBlockNtlm,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('기본 0 (NTLM 허용)', 'Default 0 (NTLM Allowed)')
      ),
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'RequireEncryption',
        rawMap.cliReqEnc,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('기본 0', 'Default 0')
      ),
    ],
    audit_insecure_guest_auth: [
      makeDwordEntry(
        'audit_insecure_guest_auth',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'AllowInsecureGuestAuth',
        rawMap.cliGuestSvc,
        '0x00000000 (0)',
        tx('기본 0 (차단)', 'Default 0 (Blocked)')
      ),
      makeDwordEntry(
        'audit_insecure_guest_auth',
        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation',
        'AllowInsecureGuestAuth',
        rawMap.cliGuestPol,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('GPO 미구성', 'GPO Not Configured')
      ),
    ],
    audit_guest_account_501: [
      {
        policyId: 'audit_guest_account_501',
        registryPath: 'HKLM\\SAM\\SAM\\Domains\\Account\\Users\\000001F5 (SID *-501)',
        valueName: 'AccountDisabled (SAM UserFlags)',
        valueType: 'SAM',
        rawValue: guestDisabledNum,
        displayValue:
          guestDisabledNum === 1
            ? tx('0x00000001 (Disabled / 잠금)', '0x00000001 (Disabled / Locked)')
            : guestDisabledNum === 0
              ? tx('0x00000000 (Enabled / 활성)', '0x00000000 (Enabled / Active)')
              : unmeasuredText,
        expectedDefaultDisplay: '0x00000001 (Disabled)',
      },
    ],
    audit_se_deny_guest_logon: [
      {
        policyId: 'audit_se_deny_guest_logon',
        registryPath: 'Secedit [Privilege Rights] (LSA Policy)',
        valueName: 'SeDenyNetworkLogonRight',
        valueType: 'SECEDIT',
        rawValue: typeof rawMap.seDenyNetworkLogon === 'string' ? rawMap.seDenyNetworkLogon : null,
        displayValue: seDenyText,
        expectedDefaultDisplay: tx('*S-1-5-32-546,*S-1-5-7 (Guest 포함)', '*S-1-5-32-546,*S-1-5-7 (Includes Guest)'),
      },
    ],
    audit_lsa_blank_password: [
      makeDwordEntry(
        'audit_lsa_blank_password',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'LimitBlankPasswordUse',
        rawMap.limitBlankPwd,
        '0x00000001 (1)',
        tx('기본 1 (제한)', 'Default 1 (Restricted)')
      ),
      makeDwordEntry(
        'audit_lsa_blank_password',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'forceguest',
        rawMap.forceGuest,
        '0x00000000 (0 · Classic)',
        tx('기본 0 (Classic)', 'Default 0 (Classic)')
      ),
    ],
    audit_lsa_anonymous_null: [
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'everyoneincludesanonymous',
        rawMap.everyAnon,
        '0x00000000 (0)',
        tx('기본 0', 'Default 0')
      ),
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'restrictanonymous',
        rawMap.restrictAnon,
        '0x00000001 (1)',
        tx('기본 0 또는 1', 'Default 0 or 1')
      ),
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'RestrictNullSessAccess',
        rawMap.restrictNullSess,
        '0x00000001 (1)',
        tx('기본 1 (차단)', 'Default 1 (Blocked)')
      ),
    ],
    audit_ntlm_level: [
      makeDwordEntry(
        'audit_ntlm_level',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'LmCompatibilityLevel',
        rawMap.lmCompatLevel,
        tx('0x00000003 (3) 이상', '0x00000003 (3) or higher'),
        tx('OS 기본(NTLMv2)', 'OS Default (NTLMv2)')
      ),
      makeDwordEntry(
        'audit_ntlm_level',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\MSV1_0',
        'RestrictSendingNTLMTraffic',
        rawMap.ntlmRestrictOutbound,
        tx('<미설정> 또는 0x00000000 (0)', '<Not Set> or 0x00000000 (0)'),
        tx('제한 없음', 'Unrestricted')
      ),
      makeDwordEntry(
        'audit_ntlm_level',
        'HKLM\\SYSTEM\\CurrentControlSet\\Policies\\Microsoft\\FeatureManagement\\Overrides',
        '1517186191',
        rawMap.kirSidOverride,
        tx('0x00000000 (중복 SID KIR 우회) 또는 <미설정>', '0x00000000 (Dup SID KIR Override) or <Not Set>'),
        tx('기본 미설정', 'Default Not Set')
      ),
    ],
    audit_uac_token_filter: [
      makeDwordEntry(
        'audit_uac_token_filter',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'LocalAccountTokenFilterPolicy',
        rawMap.uacTokenFilter,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('기본 0 (필터 보호)', 'Default 0 (Protected)')
      ),
      makeDwordEntry(
        'audit_uac_token_filter',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'EnableLinkedConnections',
        rawMap.uacLinkedConn,
        tx('<미설정> 또는 0x00000001 (1)', '<Not Set> or 0x00000001 (1)'),
        tx('기본 미설정', 'Default Not Set')
      ),
    ],
    audit_rpc_fw_smb1: [
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print',
        'RpcAuthnLevelPrivacyEnabled',
        rawMap.rpcPrivacy,
        tx('0x00000001 (1) 또는 <미설정>', '0x00000001 (1) or <Not Set>'),
        tx('기본 1 (엄격 RPC)', 'Default 1 (Strict RPC)')
      ),
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC',
        'RpcUseNamedPipeProtocol',
        rawMap.rpcNamedPipe,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('기본 0 (RPC/TCP)', 'Default 0 (RPC/TCP)')
      ),
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'SMB1',
        rawMap.srvSmb1,
        tx('0x00000000 (0) 또는 <미설정>', '0x00000000 (0) or <Not Set>'),
        tx('기본 미사용', 'Default Unused')
      ),
      {
        policyId: 'audit_rpc_fw_smb1',
        registryPath: 'Windows Defender Firewall (Inbound TCP 445)',
        valueName: 'AhBiShare-SMB-445',
        valueType: 'FIREWALL',
        rawValue: ahbiFwNum,
        displayValue:
          ahbiFwNum === 1
            ? 'Rule Present (Allow TCP 445)'
            : ahbiFwNum === 0
              ? tx('Rule Absent (삭제됨)', 'Rule Absent (Removed)')
              : unmeasuredText,
        expectedDefaultDisplay: tx('Rule Absent (원복 시 삭제)', 'Rule Absent (Removed on Rollback)'),
      },
    ],
  };

  return {
    hostName,
    ...(options?.targetIp ? { targetIp: options.targetIp } : {}),
    sourceType,
    sourceLabel,
    fetchedAt: ts,
    ...(options?.remoteRpcNote ? { remoteRpcNote: options.remoteRpcNote } : {}),
    entries,
  };
}

export function deriveRawRegistrySnapshotFromStatus(
  hostName: string,
  status: OsNetworkPolicyStatus
): RawSecurityRegistrySnapshot {
  if (status.rawRegistrySnapshot) {
    return status.rawRegistrySnapshot;
  }
  return rawRegistryRecordToSnapshot(
    hostName,
    {
      srvRequireSig: status.smbServerSigningRequired ? 1 : 0,
      srvEnableSig: 1,
      cliRequireSig: status.smbClientSigningRequired ? 1 : 0,
      cliEnableSig: 1,
      cliGuestSvc: status.allowInsecureGuestAuth ? 1 : 0,
      cliGuestPol: status.allowInsecureGuestAuth ? 1 : 0,
      cliBlockNtlm: typeof status.smbBlockNtlm === 'boolean' ? (status.smbBlockNtlm ? 1 : 0) : null,
      cliReqEnc: typeof status.smbRequireEncryption === 'boolean' ? (status.smbRequireEncryption ? 1 : 0) : null,
      guest501Disabled:
        typeof status.guestAccountEnabled === 'boolean' ? (status.guestAccountEnabled ? 0 : 1) : null,
      seDenyNetworkLogon:
        typeof status.guestNetworkLogonDenied === 'boolean'
          ? status.guestNetworkLogonDenied
            ? '*S-1-5-32-546,*S-1-5-7'
            : tx('(Guest 제외됨)', '(Guest Excluded)')
          : null,
      limitBlankPwd:
        typeof status.limitBlankPasswordUse === 'boolean' ? (status.limitBlankPasswordUse ? 1 : 0) : null,
      everyAnon:
        typeof status.everyoneIncludesAnonymous === 'boolean'
          ? status.everyoneIncludesAnonymous
            ? 1
            : 0
          : 0,
      restrictAnon:
        typeof status.restrictAnonymous === 'boolean' ? (status.restrictAnonymous ? 1 : 0) : null,
      forceGuest: typeof status.forceGuest === 'boolean' ? (status.forceGuest ? 1 : 0) : null,
      restrictNullSess:
        typeof status.restrictNullSessAccess === 'boolean' ? (status.restrictNullSessAccess ? 1 : 0) : null,
      lmCompatLevel: status.lmCompatibilityLevel,
      ntlmRestrictOutbound: status.ntlmRestrictOutbound,
      uacTokenFilter:
        typeof status.localAccountTokenFilterEnabled === 'boolean'
          ? status.localAccountTokenFilterEnabled
            ? 1
            : 0
          : null,
      uacLinkedConn: null,
      rpcPrivacy: status.rpcAuthnLevelPrivacyDisabled ? 0 : 1,
      rpcNamedPipe: status.rpcUseNamedPipeProtocol ? 1 : 0,
      rpcProtocols: status.rpcProtocols,
      srvSmb1: status.smb1Enabled || status.smb1ServerEnabled ? 1 : 0,
      kirSidOverride: status.kirOverride1517186191 ?? null,
      ahbiFw445:
        typeof status.ahbiFirewallRulePresent === 'boolean'
          ? status.ahbiFirewallRulePresent
            ? 1
            : 0
          : null,
    },
    'snapshot_derived',
    tx('정책 상태 역산 값', 'Derived from Policy Status'),
    status.checkedAt
  );
}

export function deriveRawRegistrySnapshotFromHostSnap(
  snap: HostPolicySnapshot,
  isPreset: boolean
): RawSecurityRegistrySnapshot {
  if (snap.rawRegistrySnapshot && !isPreset) {
    return {
      ...snap.rawRegistrySnapshot,
      ...(snap.sourceIp ? { targetIp: snap.sourceIp } : {}),
      sourceType: 'usb_live_capture',
      sourceLabel: tx('USB 호스트 실측 레지스트리', 'USB Host Live Captured Registry'),
    };
  }
  return rawRegistryRecordToSnapshot(
    snap.hostName,
    {
      srvRequireSig: snap.smbServerSigningRequired ? 1 : 0,
      srvEnableSig: 1,
      cliRequireSig: isPreset ? (snap.smbServerSigningRequired ? 1 : 0) : null,
      cliEnableSig: isPreset ? 1 : null,
      cliGuestSvc: snap.allowInsecureGuestAuth ? 1 : 0,
      cliGuestPol: snap.allowInsecureGuestAuth ? 1 : 0,
      guest501Disabled:
        typeof snap.guestAccountEnabled === 'boolean' ? (snap.guestAccountEnabled ? 0 : 1) : null,
      seDenyNetworkLogon:
        typeof snap.guestNetworkLogonDenied === 'boolean'
          ? snap.guestNetworkLogonDenied
            ? '*S-1-5-32-546,*S-1-5-7'
            : tx('(Guest 제외됨)', '(Guest Excluded)')
          : null,
      limitBlankPwd:
        typeof snap.limitBlankPasswordUse === 'boolean' ? (snap.limitBlankPasswordUse ? 1 : 0) : null,
      everyAnon: isPreset ? (snap.allowInsecureGuestAuth ? 1 : 0) : null,
      restrictAnon:
        typeof snap.restrictAnonymous === 'boolean' ? (snap.restrictAnonymous ? 1 : 0) : null,
      forceGuest: typeof snap.forceGuest === 'boolean' ? (snap.forceGuest ? 1 : 0) : null,
      restrictNullSess:
        typeof snap.restrictNullSessAccess === 'boolean' ? (snap.restrictNullSessAccess ? 1 : 0) : null,
      lmCompatLevel: snap.lmCompatibilityLevel ?? null,
      ntlmRestrictOutbound: null,
      uacTokenFilter:
        typeof snap.localAccountTokenFilterEnabled === 'boolean'
          ? snap.localAccountTokenFilterEnabled
            ? 1
            : 0
          : null,
      uacLinkedConn: null,
      rpcPrivacy: snap.rpcAuthnLevelPrivacyDisabled ? 0 : 1,
      rpcNamedPipe: snap.rpcUseNamedPipeProtocol ? 1 : 0,
      rpcProtocols: null,
      srvSmb1: snap.osBuild > 0 && snap.osBuild < 10240 ? 1 : 0,
      kirSidOverride: snap.kirOverride1517186191 ?? null,
      ahbiFw445: typeof snap.firewall445Allowed === 'boolean' ? (snap.firewall445Allowed ? 1 : 0) : null,
    },
    isPreset ? 'preset_reference' : 'snapshot_derived',
    isPreset
      ? tx('권장 기준 프리셋 기대값', 'Recommended Preset Expected Baseline')
      : tx('USB 스냅샷 역산 추정값', 'Estimated from USB Snapshot'),
    snap.capturedAt ? formatSnapshotTimestamp(snap.capturedAt) : formatSnapshotTimestamp(new Date().toISOString()),
    snap.sourceIp ? { targetIp: snap.sourceIp } : undefined
  );
}

export function getExpertPolicyOrder(): Array<{ id: string; index: number; category: string; label: string }> {
  return [
    { id: 'audit_smb_server_signing', index: 1, category: tx('SMB 서명', 'SMB Signing'), label: tx('SMB 서버 보안 서명 강제', 'Enforce SMB Server Security Signing') },
    { id: 'audit_smb_client_signing', index: 2, category: tx('SMB 서명', 'SMB Signing'), label: tx('SMB 클라이언트 보안 서명 강제', 'Enforce SMB Client Security Signing') },
    { id: 'audit_insecure_guest_auth', index: 3, category: tx('게스트 제한', 'Guest Restriction'), label: tx('비인증 게스트 로그온 차단', 'Block Insecure Guest Logon') },
    { id: 'audit_guest_account_501', index: 4, category: tx('게스트 제한', 'Guest Restriction'), label: tx('내장 Guest 계정 (SID *-501) 비활성', 'Built-in Guest Account (SID *-501) Disabled') },
    { id: 'audit_se_deny_guest_logon', index: 5, category: tx('게스트 제한', 'Guest Restriction'), label: tx('로컬 보안 정책 Guest 네트워크 거부', 'Local Policy Deny Guest Network Logon') },
    { id: 'audit_lsa_blank_password', index: 6, category: tx('LSA 보안', 'LSA Security'), label: tx('LSA 빈 암호 네트워크 로그온 제한', 'LSA Limit Blank Password Network Logon') },
    { id: 'audit_lsa_anonymous_null', index: 7, category: tx('LSA 보안', 'LSA Security'), label: tx('LSA 익명 · Null 세션 차단', 'Block LSA Anonymous & Null Sessions') },
    { id: 'audit_ntlm_level', index: 8, category: tx('NTLM 인증', 'NTLM Auth'), label: tx('NTLM 인증 협상 수준 (NTLMv2)', 'NTLM Compatibility Level (NTLMv2)') },
    { id: 'audit_uac_token_filter', index: 9, category: tx('UAC 원격 보호', 'UAC Remote Protection'), label: tx('UAC 원격 토큰 필터 보호', 'UAC Remote Token Filter Protection') },
    { id: 'audit_rpc_fw_smb1', index: 10, category: tx('RPC · 방화벽 · SMBv1', 'RPC · Firewall · SMBv1'), label: tx('프린터 RPC · 임시 방화벽 · SMBv1 정리', 'Printer RPC · Temp Firewall · SMBv1 Cleanup') },
  ];
}

const isUnmeasuredDisplay = (val?: string) => val === '<미측정>' || val === '<Not Measured>';

function computeRawEntrySubStatus(
  localEntry: RawRegistryEntry | undefined,
  hostEntry: RawRegistryEntry | undefined,
  policyComparison?: HostPolicyComparison
): HostDiscrepancyLevel {
  if (!hostEntry || isUnmeasuredDisplay(hostEntry.displayValue)) {
    return 'unmeasured';
  }
  if (!localEntry || isUnmeasuredDisplay(localEntry.displayValue)) {
    return 'unmeasured';
  }
  const sameRaw =
    localEntry.rawValue === hostEntry.rawValue && localEntry.rawValue !== undefined;
  const sameText = localEntry.displayValue === hostEntry.displayValue;
  if (sameRaw || sameText) {
    return 'aligned';
  }
  if (policyComparison?.status === 'conflict') return 'conflict';
  return 'warning';
}

export function buildExpertRegistryComparisonRows(
  localRaw: RawSecurityRegistrySnapshot,
  hostRaw: RawSecurityRegistrySnapshot,
  auditReport?: SecurityRollbackAuditReport | null
): ExpertRegistryPolicyRow[] {
  const itemById = new Map<string, SecurityRollbackAuditItem>();
  for (const item of auditReport?.items || []) {
    itemById.set(item.id, item);
  }
  const unmeasuredText = tx('<미측정>', '<Not Measured>');

  return getExpertPolicyOrder().map((meta) => {
    const auditItem = itemById.get(meta.id);
    const localEntries = localRaw.entries[meta.id] || [];
    const hostEntries = hostRaw.entries[meta.id] || [];

    const subRows: ExpertRegistrySubRow[] = [];
    const maxLen = Math.max(localEntries.length, hostEntries.length);

    for (let i = 0; i < maxLen; i++) {
      const l = localEntries[i];
      const h =
        (l &&
          hostEntries.find(
            (cand) => cand.registryPath === l.registryPath && cand.valueName === l.valueName
          )) ||
        hostEntries[i];
      const base = l || h;
      if (!base) continue;

      subRows.push({
        id: `${meta.id}::${base.valueName}::${i}`,
        registryPath: base.registryPath,
        valueName: base.valueName,
        valueType: base.valueType,
        localDisplayValue: l ? l.displayValue : unmeasuredText,
        hostDisplayValue: h ? h.displayValue : unmeasuredText,
        expectedDefaultDisplay: base.expectedDefaultDisplay,
        status: computeRawEntrySubStatus(l, h, auditItem?.hostComparison),
      });
    }

    let overallStatus: HostDiscrepancyLevel = auditItem?.hostComparison?.status || 'aligned';
    if (!auditItem?.hostComparison) {
      if (subRows.some((s) => s.status === 'conflict')) overallStatus = 'conflict';
      else if (subRows.some((s) => s.status === 'warning')) overallStatus = 'warning';
      else if (subRows.every((s) => s.status === 'unmeasured')) overallStatus = 'unmeasured';
      else overallStatus = 'aligned';
    }

    const statusBadgeLabel =
      auditItem?.hostComparison?.badgeLabel ||
      (overallStatus === 'conflict'
        ? tx('원시값 충돌', 'Raw Conflict')
        : overallStatus === 'warning'
          ? tx('원시값 차이', 'Raw Difference')
          : overallStatus === 'unmeasured'
            ? tx('호스트 미측정', 'Host Unmeasured')
            : tx('원시값 일치', 'Raw Match'));

    const note =
      auditItem?.hostComparison?.discrepancyDetail ||
      (overallStatus === 'aligned'
        ? tx('로컬 PC와 대상 호스트의 해당 레지스트리 원시값이 일치합니다.', 'Raw registry values match between local PC and target host.')
        : tx('레지스트리 키 원시값 차이가 확인되었습니다.', 'Differences found in raw registry values.'));

    return {
      index: meta.index,
      policyId: meta.id,
      category: meta.category,
      label: meta.label,
      overallStatus,
      statusBadgeLabel,
      note,
      subRows,
    };
  });
}

export function formatExpertRegistryComparisonText(
  rows: ExpertRegistryPolicyRow[],
  localRaw: RawSecurityRegistrySnapshot,
  hostRaw: RawSecurityRegistrySnapshot
): string {
  const lines: string[] = [
    tx(
      `[AhBiShare OneClick 전문가 비교 보기 - 10대 보안 정책 원시 레지스트리 대조]`,
      `[AhBiShare OneClick Expert View - 10-Policy Raw Registry Comparison]`
    ),
    tx(
      `로컬 PC: ${localRaw.hostName} (${localRaw.sourceLabel} · ${localRaw.fetchedAt})`,
      `Local PC: ${localRaw.hostName} (${localRaw.sourceLabel} · ${localRaw.fetchedAt})`
    ),
    tx(
      `대상 호스트: ${hostRaw.hostName}${hostRaw.targetIp ? ` (${hostRaw.targetIp})` : ''} (${hostRaw.sourceLabel} · ${hostRaw.fetchedAt})`,
      `Target Host: ${hostRaw.hostName}${hostRaw.targetIp ? ` (${hostRaw.targetIp})` : ''} (${hostRaw.sourceLabel} · ${hostRaw.fetchedAt})`
    ),
    ...(hostRaw.remoteRpcNote ? [tx(`원격 조회 참고: ${hostRaw.remoteRpcNote}`, `Remote Lookup Note: ${hostRaw.remoteRpcNote}`)] : []),
    '',
  ];

  for (const row of rows) {
    lines.push(`${String(row.index).padStart(2, '0')}. [${row.statusBadgeLabel}] ${row.label}`);
    for (const sub of row.subRows) {
      lines.push(
        tx(
          `   - ${sub.registryPath}\\${sub.valueName} (${sub.valueType}): 로컬=${sub.localDisplayValue} | 호스트=${sub.hostDisplayValue} | 기본=${sub.expectedDefaultDisplay}`,
          `   - ${sub.registryPath}\\${sub.valueName} (${sub.valueType}): Local=${sub.localDisplayValue} | Host=${sub.hostDisplayValue} | Default=${sub.expectedDefaultDisplay}`
        )
      );
    }
  }
  return lines.join('\n');
}


