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

export const WINDOWS_ERA_SUMMARIES: WindowsEraSummary[] = [
  {
    era: 'win10',
    title: 'Windows 10 (1903 ~ 22H2)',
    buildRange: 'Build 18362 ~ 19045',
    postureBadge: '레거시 호환 우선',
    summary: 'Home/Pro 기본값에서 SMB 서명 비강제 및 비인증 게스트 접근(선택/레거시)이 비교적 유연하게 동작하는 세대입니다.',
    keyRules: [
      'SMBv1 선택적 기능 유지 (초기 1709 이후 클라이언트 기본 비활성화)',
      'SMB 보안 서명(Signing)은 도메인 컨트롤러 외 일반 워크그룹에서 선택 사항',
      'NetBIOS over TCP/IP 및 Function Discovery 혼용 탐색',
    ],
    rebootTrait: '대부분 레지스트리·SMB 서비스 재시작만으로 즉시 적용 (SMBv1 설치/제거 시에만 재부팅 필요)',
  },
  {
    era: 'win11_21_23',
    title: 'Windows 11 (21H2 ~ 23H2)',
    buildRange: 'Build 22000 ~ 22631',
    postureBadge: '단계적 보안 전환',
    summary: 'SMBv1 기본 탑재가 완전히 중단되고 Pro Workstations·Enterprise 중심으로 게스트 차단이 확대된 과도기 세대입니다.',
    keyRules: [
      'Home/Pro 에디션 간 게스트 로그온 정책 차이 발생',
      '공용(Public) 네트워크 프로필 자동 할당 시 445·139 포트 및 탐색 엄격 차단',
      'SMB 3.1.1 압축 및 AES-128-GCM / AES-256-GCM 협상 표준화',
    ],
    rebootTrait: 'AllowInsecureGuestAuth 및 방화벽·네트워크 프로필 전환은 재부팅 없이 즉시 반영',
  },
  {
    era: 'win11_24h2',
    title: 'Windows 11 24H2 (2024 Update)',
    buildRange: 'Build 26100',
    postureBadge: 'SFI 기본 보안 대격변',
    summary: 'Home 포함 전 에디션에서 SMB 서명 기본 강제 및 비인증 게스트 로그온 완전 차단이 적용되어 기존 공유가 가장 빈번하게 끊기는 변곡점입니다.',
    keyRules: [
      'RequireSecuritySignature=$true 전 에디션 기본 강제 (서명 미지원 NAS/구형 PC 차단)',
      'AllowInsecureGuestAuth=0 기본 차단 (0x80070035 및 조직 보안 정책 오류)',
      'NTLMv1 프로토콜 스택 제거 및 Credential Guard 미사용 환경 NTLM 차단 강화',
    ],
    rebootTrait: 'AllowInsecureGuestAuth + Set-SmbClientConfiguration 적용 후 LanmanWorkstation 서비스 재시작으로 재부팅 없이 즉시 반영 가능',
  },
  {
    era: 'win11_25_26h2',
    title: 'Windows 11 25H2 / 26H2 (차세대 SFI)',
    buildRange: 'Build 26200 ~ 27xxx+',
    postureBadge: '제로 트러스트 · QUIC/NTLM 감축',
    summary: '24H2 기반 플랫폼 위에서 SMB NTLM 아웃바운드 차단 정책, NetBIOS/WINS 단계적 퇴출, SMB over QUIC(UDP 443) 및 암호화 감사가 강화됩니다.',
    keyRules: [
      'SMB 클라이언트 원격 아웃바운드 NTLM 폴백 차단 옵션 및 메시지 서명 검증 강화',
      'NetBIOS/LLMNR 이름 해석 의존도 축소 (직접 TCP 445 + DNS + WS-Discovery 필수화)',
      'NTLM 폐지 로드맵에 따른 전용 로컬 계정(cmdkey) 또는 Kerberos/암호 보호 공유 필수',
    ],
    rebootTrait: '일반 SMB/NTLM 레지스트리는 서비스 재시작으로 즉시 반영되나, Winsock/TCP-IP 스택 초기화 또는 NetBIOS 바인딩 변경 시 재부팅 권장/필요',
  },
];

export const WINDOWS_NETWORK_MATRIX: WindowsNetworkChangeItem[] = [
  {
    id: 'smb_signing_24h2',
    era: 'win11_24h2',
    versionLabel: 'Win 11 24H2+',
    buildRange: '26100 이상',
    category: 'smb_signing',
    categoryLabel: 'SMB 보안 서명',
    title: '전 에디션 SMB 서명(Signing) 기본 강제 활성화',
    defaultBehavior: 'Win 10~23H2는 워크그룹에서 선택 사항이었으나, 24H2부터 Home/Pro 포함 모든 연결에 RequireSecuritySignature=$true가 기본 적용됨.',
    sharingImpact: '서명을 꺼 둔 구형 NAS, 프린터, Win 10 혼용 PC 연결 시 네트워크 경로 오류 또는 STATUS_INVALID_SIGNATURE 실패 발생.',
    mitigationStrategy: 'OS 빌드 26100+ 감지 시 안전 호환 모드에서 Server/Client RequireSecuritySignature를 일시 완화하거나, 보안 계정 모드에서 양단 SMB 3.x 서명 협상을 정렬.',
    affectedRegistryOrCmdlet: 'Set-SmbServerConfiguration / Set-SmbClientConfiguration -RequireSecuritySignature',
    rebootLevel: 'service_restart',
    rebootNote: 'LanmanServer·LanmanWorkstation 서비스 재시작으로 즉시 적용 (재부팅 불필요)',
  },
  {
    id: 'guest_auth_block',
    era: 'win11_24h2',
    versionLabel: 'Win 11 24H2+',
    buildRange: '26100 이상 (11 Pro 확대)',
    category: 'guest_auth',
    categoryLabel: '비인증 게스트 차단',
    title: '안전하지 않은 게스트 로그온(AllowInsecureGuestAuth) 전면 차단',
    defaultBehavior: 'Windows 11 Pro 및 24H2+에서 무비밀번호 익명/게스트 SMB 폴백을 커널 단에서 차단함.',
    sharingImpact: '"조직의 보안 정책에서 인증되지 않은 게스트 액세스를 차단하므로 이 공유 폴더에 액세스할 수 없습니다" 오류 및 0x80070035 발생.',
    mitigationStrategy: '안전 호환 모드 실행 시 EnableInsecureGuestLogons=$true 및 AllowInsecureGuestAuth=1을 자동 주입하며, 권장 방식인 전용 보안 계정 + AES-256-GCM USB 자동 채우기도 지원.',
    affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters\\AllowInsecureGuestAuth',
    rebootLevel: 'service_restart',
    rebootNote: '레지스트리 반영 + LanmanWorkstation 재시작으로 즉시 적용 (재부팅 불필요)',
  },
  {
    id: 'ntlmv1_removal_24_26h2',
    era: 'win11_25_26h2',
    versionLabel: 'Win 11 24H2 ~ 26H2',
    buildRange: '26100 ~ 27xxx+',
    category: 'ntlm',
    categoryLabel: 'NTLM 감축 및 인증 강화',
    title: 'NTLMv1 완전 제거 및 NTLMv2(LmCompatibilityLevel) · Outbound 차단 강화',
    defaultBehavior: 'NTLMv1 프로토콜이 제거되고, Credential Guard 비활성화 기기에서도 취약 인증 폴백이 차단되며 25H2/26H2는 아웃바운드 NTLM 제한을 지원.',
    sharingImpact: '워크그룹 환경에서 암호 캐시가 어긋나면 System Error 5/86 ("지정한 네트워크 암호가 올바르지 않습니다") 무한 루프 발생.',
    mitigationStrategy: 'LmCompatibilityLevel=3(NTLMv2 응답 전용) 이상 정렬 + 기존 충돌 세션(`net use /delete`) 정리 + `cmdkey` 서버별 자격 증명 선행 등록.',
    affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\LmCompatibilityLevel & RestrictSendingNTLMTraffic',
    rebootLevel: 'service_restart',
    rebootNote: 'LSA·LanmanWorkstation 반영 즉시 적용 (도메인 그룹 정책 강제 시 재로그온/재부팅 권장)',
  },
  {
    id: 'netbios_wins_phaseout',
    era: 'win11_25_26h2',
    versionLabel: 'Win 11 25H2 / 26H2',
    buildRange: '26200 ~ 27xxx+',
    category: 'name_resolution',
    categoryLabel: '이름 해석 (NetBIOS/WINS)',
    title: 'NetBIOS/WINS · LLMNR 축소 및 직접 TCP 445 · WS-Discovery 전환',
    defaultBehavior: '레거시 브로드캐스트 이름 확인(NetBT/WINS/LLMNR) 의존성이 제거·비활성화 방향으로 전환됨.',
    sharingImpact: '호스트 이름(\\PC-NAME\\폴더) 탐색이 네트워크 목록에 뜨지 않거나 시간 초과로 실패.',
    mitigationStrategy: 'FDResPub · fdPHost · SSDPSrv 서비스를 자동 시작으로 복원하고 IP 기반 직접 UNC(\\\\192.168.x.x\\공유) 연결 및 TCP 445 사전 프로브 우선 사용.',
    affectedRegistryOrCmdlet: 'NetBT\\Parameters\\Interfaces\\*\\NetbiosOptions + FDResPub/fdPHost 서비스',
    rebootLevel: 'reboot_recommended',
    rebootNote: '서비스 기동은 즉시 적용되나 NetbiosOptions 인터페이스 바인딩 변경·Winsock 초기화 시 재부팅 권장',
  },
  {
    id: 'smb_quic_encryption',
    era: 'win11_25_26h2',
    versionLabel: 'Win 11 24H2 ~ 26H2',
    buildRange: '26100 ~ 27xxx+',
    category: 'quic_encryption',
    categoryLabel: 'SMB 암호화 & QUIC',
    title: 'SMB over QUIC(UDP 443) 확대 및 암호화 기본 자세 강화',
    defaultBehavior: '최신 Windows 11에서는 TCP 445 외에 QUIC(TLS 1.3) 전송과 SMB 3.1.1 AES 암호화 감사 정책이 강화됨.',
    sharingImpact: '암호화 필수 정책이 켜진 호스트와 구형 Win 10 클라이언트 간 핸드셰이크 불일치 가능.',
    mitigationStrategy: '호스트 SMB 3.1.1 호환 유지 + 공용(Public) 프로필이 강제된 어댑터를 개인(Private) 프로필로 자동 교정하여 LAN 내 파일 공유 허용.',
    affectedRegistryOrCmdlet: 'Get-SmbServerConfiguration -EncryptData / Set-NetConnectionProfile -NetworkCategory Private',
    rebootLevel: 'none',
    rebootNote: '네트워크 프로필 및 방화벽 규칙은 즉시 적용됨 (재부팅 불필요)',
  },
  {
    id: 'lsa_anonymous_win10_11',
    era: 'win10',
    versionLabel: 'Win 10 ~ Win 11 23H2',
    buildRange: '18362 ~ 22631',
    category: 'firewall_lsa',
    categoryLabel: 'LSA 익명 및 방화벽',
    title: 'LSA 익명 토큰(everyoneincludesanonymous) & 공용 프로필 차단',
    defaultBehavior: 'Windows 10/11 기본값에서 restrictanonymous=1, LimitBlankPasswordUse=1 및 공용 네트워크 445 차단이 적용됨.',
    sharingImpact: '빈 암호 Windows 계정 접속 거부 및 Wi-Fi 재연결 시 공용(Public) 전환으로 공유 먹통.',
    mitigationStrategy: '게스트/보안 계정 모드에 따라 LSA 3종 키와 AhBiShare-SMB-445 인바운드 규칙을 원클릭 정렬하고 작업 종료 후 보안 원복 지원.',
    affectedRegistryOrCmdlet: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa + netsh advfirewall',
    rebootLevel: 'service_restart',
    rebootNote: 'LanmanServer 서비스 새로고침으로 즉시 적용 (재부팅 불필요)',
  },
  {
    id: 'smb1_deprecation_win10_11',
    era: 'win11_21_23',
    versionLabel: 'Win 10 1709 ~ Win 11 26H2',
    buildRange: '16299 ~ 27xxx+',
    category: 'smb_signing',
    categoryLabel: 'SMBv1 폐기',
    title: 'SMBv1 프로토콜 완전 제거 및 SMB 2.0/3.1.1 강제',
    defaultBehavior: 'Windows 11부터 SMBv1 클라이언트/서버 구성요소가 기본 설치에서 제외되며, Win 10도 활성화 시 랜섬웨어 취약 경고 발생.',
    sharingImpact: 'SMBv1 전용 구형 장치 연결 불가. 단, Windows PC 간 공유는 SMB 2/3로 완전 대체 가능.',
    mitigationStrategy: 'SMBv1을 재활성화하지 않고(재부팅·보안 위험 유발 방지) SMB 2/3 + TCP 445 직접 연결 파이프라인으로 호환성 확보.',
    affectedRegistryOrCmdlet: 'Get-SmbServerConfiguration -EnableSMB1Protocol',
    rebootLevel: 'reboot_required',
    rebootNote: '참고: 만약 사용자가 직접 Windows 기능(SMBv1)을 켜거나 끄면 커널 드라이버 교체로 재부팅이 필수이지만 AhBiShare는 SMBv1을 건드리지 않아 재부팅이 필요 없음',
  },
  {
    id: 'rpc_printer_privacy_24_26h2',
    era: 'win11_25_26h2',
    versionLabel: 'Win 11 22H2 ~ 26H2',
    buildRange: '22621 ~ 27xxx+',
    category: 'rpc_printer',
    categoryLabel: 'RPC · 프린터 스풀러',
    title: 'RPC over TCP 기본 전환 및 프린터 RPC 개인정보 서명 강제 (0x0000011b / 0x00000709)',
    defaultBehavior: 'Microsoft PrintNightmare 보안 패치 및 Win 11 24H2~26H2에서 인쇄 스풀러 RPC가 기본 Named Pipes 대신 엄격한 인증 서명(RpcAuthnLevelPrivacyEnabled)과 동적 TCP 포트를 우선 사용함.',
    sharingImpact: '파일 공유는 정상인데 공유 프린터 연결 시 "Windows에서 프린터에 연결할 수 없습니다 (0x0000011b 또는 0x00000709)" 오류 발생.',
    mitigationStrategy: 'RpcAuthnLevelPrivacyEnabled=0 및 Printers\\RPC\\RpcUseNamedPipeProtocol=1, RpcProtocols=7 설정을 호스트·클라이언트 양단에 정렬하고 Spooler 서비스를 즉시 재시작합니다.',
    affectedRegistryOrCmdlet: 'HKLM\\System\\CurrentControlSet\\Control\\Print\\RpcAuthnLevelPrivacyEnabled & Printers\\RPC',
    rebootLevel: 'service_restart',
    rebootNote: 'Print Spooler(Spooler) 서비스 즉시 재시작으로 대부분 재부팅 없이 반영됨 (잠금 시 재부팅 권장)',
  },
  {
    id: 'point_and_print_26h2',
    era: 'win11_24h2',
    versionLabel: 'Win 11 21H2 ~ 26H2',
    buildRange: '22000 ~ 27xxx+',
    category: 'rpc_printer',
    categoryLabel: 'RPC · 프린터 스풀러',
    title: 'Point and Print 공유 프린터 드라이버 자동 설치 관리자 제한',
    defaultBehavior: '비관리자 일반 사용자 계정이 호스트 PC의 공유 프린터 드라이버를 끌어올 때 보안 경고 또는 차단(RestrictDriverInstallationToAdministrators=1)이 기본 동작함.',
    sharingImpact: '클라이언트 PC에서 공유 프린터 추가 시 드라이버 설치 권한 거부 및 연결 중단 발생.',
    mitigationStrategy: '신뢰할 수 있는 내부 LAN 공유 프린터 작업 시 PointAndPrint 정책(NoWarningNoElevationOnInstall=1, UpdatePromptSettings=2)을 호환 정렬합니다.',
    affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint',
    rebootLevel: 'service_restart',
    rebootNote: 'Print Spooler 서비스 재시작 즉시 반영 (재부팅 불필요)',
  },
  {
    id: 'uac_remote_token_filter_matrix',
    era: 'win11_24h2',
    versionLabel: 'Win 10 ~ Win 11 26H2 (워크그룹)',
    buildRange: '전 빌드 공통 (Home/Pro)',
    category: 'os_update_feature',
    categoryLabel: '별도 패치 · 기능',
    title: 'UAC 원격 토큰 필터링 (LocalAccountTokenFilterPolicy) 완화',
    defaultBehavior: '워크그룹 환경의 Windows는 보안상 로컬 관리자 계정으로 네트워크 원격 접속(관리 공유·일부 공유 폴더) 시 관리자 토큰을 제거(Filter)함.',
    sharingImpact: '올바른 Windows 계정/암호를 입력해도 System Error 5(액세스 거부) 또는 관리 공유(C$, D$) 연결 거부가 발생함.',
    mitigationStrategy: 'OS 업데이트 없이 LocalAccountTokenFilterPolicy=1 레지스트리 주입만으로 즉시 해결 가능하며, 작업 종료 후 표준 보안 복원 시 0으로 원복됨.',
    affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\LocalAccountTokenFilterPolicy',
    rebootLevel: 'none',
    rebootNote: '레지스트리 적용 즉시 반영 (재부팅 불필요)',
  },
  {
    id: 'smb1_optional_feature_matrix',
    era: 'win11_21_23',
    versionLabel: 'Win 10 1709 ~ Win 11 26H2',
    buildRange: '구형 NAS · 복합기 연동',
    category: 'os_update_feature',
    categoryLabel: '별도 패치 · 기능',
    title: '구형 NAS · 스캐너 전용 SMB 1.0/CIFS 클라이언트 선택적 기능 설치',
    defaultBehavior: 'Windows 11 및 최신 Windows 10 클린 설치 환경에는 SMB1Protocol-Client 선택적 기능 드라이버(mrxsmb10.sys)가 기본 미설치됨.',
    sharingImpact: '일반 PC 간 공유에는 전혀 필요 없으나, 2015년 이전 구형 NAS·사무용 복합기 연결 시 오류 53 또는 지원되지 않는 프로토콜 실패 발생.',
    mitigationStrategy: '필요한 경우에만 OS 호환 매트릭스에서 [SMBv1 클라이언트 설치]를 명시적으로 실행해 DISM 기능 활성화 후 재부팅합니다.',
    affectedRegistryOrCmdlet: 'Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol-Client -All',
    rebootLevel: 'reboot_required',
    rebootNote: '커널 드라이버(mrxsmb10.sys) 적재를 위해 시스템 재부팅 필수',
  },
  {
    id: 'msa_pin_only_ntlm_matrix',
    era: 'win11_24h2',
    versionLabel: 'Win 11 Home / Pro (개인 PC)',
    buildRange: 'Windows Hello · MSA 환경',
    category: 'os_update_feature',
    categoryLabel: '별도 패치 · 기능',
    title: 'Microsoft 계정(MSA) · Windows Hello PIN 전용 로그인 시 NTLM 해시 누락',
    defaultBehavior: 'Microsoft 계정과 PIN/지문 로그인만 사용하고 로컬 암호를 한 번도 캐시하지 않은 PC는 로컬 SAM NTLM 비밀번호 해시가 생성되지 않음.',
    sharingImpact: '타 PC에서 소유자 MS 계정 이메일로 접속 시 암호가 맞는데도 오류 1326("사용자 이름 또는 암호가 올바르지 않습니다")이 반복됨.',
    mitigationStrategy: '별도 Windows 패치가 아니라 AhBiShare의 [전용 보안 공유 계정(AhBiShare)] 모드로 로컬 공유 계정을 자동 생성해 연결하면 100% 해결됨.',
    affectedRegistryOrCmdlet: 'New-LocalUser -Name AhBiShare + cmdkey /add (로컬 SAM 계정 생성)',
    rebootLevel: 'none',
    rebootNote: '로컬 공유 계정 생성 즉시 적용 (재부팅 불필요)',
  },
  {
    id: 'home_edition_gpedit_matrix',
    era: 'win11_24h2',
    versionLabel: 'Windows 10 / 11 Home',
    buildRange: 'Home 에디션 (gpedit.msc 미포함)',
    category: 'os_update_feature',
    categoryLabel: '별도 패치 · 기능',
    title: 'Windows Home 에디션의 그룹 정책 편집기(gpedit.msc) 미지원 대응',
    defaultBehavior: 'Home 에디션에는 로컬 그룹 정책 편집기(gpedit.msc) UI가 빠져 있어 타사 가이드의 정책 변경을 그대로 따라 할 수 없음.',
    sharingImpact: 'Pro 전용 안내대로 진행 시 "gpedit.msc를 찾을 수 없습니다" 오류로 24H2 게스트/서명 차단을 풀지 못함.',
    mitigationStrategy: 'Home 에디션에 별도 gpedit 애드온을 설치할 필요 없이 AhBiShare가 서비스 레지스트리와 Policies 키를 동시에 직접 주입해 동일 효과를 구현함.',
    affectedRegistryOrCmdlet: 'LanmanWorkstation\\Parameters + Policies\\Microsoft\\Windows\\LanmanWorkstation',
    rebootLevel: 'service_restart',
    rebootNote: '레지스트리 동시 주입 + 서비스 재시작 즉시 적용',
  },
  {
    id: 'win11_24h2_kb_ubr_matrix',
    era: 'win11_24h2',
    versionLabel: 'Win 11 24H2 누적 패치(KB)',
    buildRange: 'Build 26100.1742 ~ 26100.2314+',
    category: 'os_update_feature',
    categoryLabel: '별도 패치 · 기능',
    title: 'Win 11 24H2 초기 릴리스 SMB·네트워크 회귀 및 누적 업데이트(KB) 권고',
    defaultBehavior: '24H2 초기 빌드(UBR 2033 이하)에서 간헐적 NTLM·Kerberos 서명 협상 및 Wi-Fi 네트워크 탐색 지연이 보고되었으며 후속 KB(KB5044284 / KB5046617 등)로 개선됨.',
    sharingImpact: '정책과 방화벽이 정상인데도 초기 24H2 PC에서만 무작위 연결 끊김이나 프린터 RPC 응답 지연이 발생할 수 있음.',
    mitigationStrategy: 'OS 진단에서 24H2 초기 UBR(<2314) 감지 시 Windows Update 설정 창 바로가기를 안내하며, 일반 빌드에서는 별도 업데이트 없이 즉시 공유 가능.',
    affectedRegistryOrCmdlet: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\UBR & Win32_QuickFixEngineering',
    rebootLevel: 'reboot_recommended',
    rebootNote: 'Windows 누적 업데이트 설치 시에만 OS 업데이트 자체 재부팅 필요',
  },
];

export function computeCompatibilityScoreAndIssues(
  status: Omit<OsNetworkPolicyStatus, 'compatibilityScore' | 'detectedIssues'>
): { compatibilityScore: number; detectedIssues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (status.networkProfile === 'Public') {
    score -= 25;
    issues.push('현재 네트워크 프로필이 공용(Public)으로 설정되어 TCP 445 인바운드 공유와 탐색이 차단될 수 있습니다.');
  }
  if (!status.lanmanServerRunning) {
    score -= 20;
    issues.push('LanmanServer(Server) 서비스가 중지되어 이 PC의 폴더를 공유할 수 없습니다.');
  }
  if (!status.lanmanWorkstationRunning) {
    score -= 20;
    issues.push('LanmanWorkstation 서비스가 중지되어 다른 PC의 공유 폴더에 접속할 수 없습니다.');
  }
  if (!status.fdResPubRunning) {
    score -= 10;
    issues.push('FDResPub(함수 검색 리소스 게시)가 비활성 상태여서 LAN 탐색 목록에 표시되지 않을 수 있습니다.');
  }
  if ((status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && status.smbClientSigningRequired) {
    score -= 15;
    issues.push('Win 11 24H2/26H2 기본 SMB 클라이언트 서명 강제가 켜져 있어 구형 NAS·Win 10 공유 접속이 차단될 수 있습니다.');
  }
  if ((status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && !status.allowInsecureGuestAuth) {
    score -= 10;
    issues.push('비인증 게스트 로그온(AllowInsecureGuestAuth)이 차단되어 간편 무비밀번호 공유 연결 시 0x80070035 오류가 발생할 수 있습니다.');
  }
  if (status.guestNetworkLogonDenied) {
    score -= 10;
    issues.push('로컬 보안 정책(SeDenyNetworkLogonRight)이 Guest 네트워크 로그온을 거부 중이어서 타 PC 무비밀번호 접속 시 시스템 오류 1385가 발생할 수 있습니다.');
  }
  if (status.firewall445Allowed === false) {
    score -= 10;
    issues.push('Windows 방화벽에서 TCP 445 파일 공유 인바운드 규칙이 비활성 상태입니다 (오류 53 원인).');
  }
  if (status.limitBlankPasswordUse && status.allowInsecureGuestAuth) {
    score -= 5;
    issues.push('LSA 빈 암호 네트워크 로그온 제한(LimitBlankPasswordUse=1)이 켜져 있어 무비밀번호 연결 시 오류 86이 발생할 수 있습니다.');
  }
  if (status.lmCompatibilityLevel !== null && status.lmCompatibilityLevel < 3) {
    score -= 10;
    issues.push(`NTLM 호환성 수준(${status.lmCompatibilityLevel})이 낮아 Win 11 24H2+ 인증 협상에서 거부될 수 있습니다.`);
  }
  if (!status.printSpoolerRunning) {
    score -= 8;
    issues.push('Print Spooler(Spooler) 서비스가 중지되어 공유 프린터 연결이 불가능합니다.');
  }
  if ((status.osEra === 'win11_21_23' || status.osEra === 'win11_24h2' || status.osEra === 'win11_25_26h2') && !status.rpcAuthnLevelPrivacyDisabled) {
    score -= 7;
    issues.push('프린터 RPC 개인정보 인증 강제(RpcAuthnLevelPrivacyEnabled)가 유지되어 혼합 OS 프린터 공유 시 0x0000011b 오류가 발생할 수 있습니다.');
  }
  if (status.msaPinOnlyRisk) {
    score -= 5;
    issues.push('Microsoft 계정·Windows Hello PIN 전용 로그인 환경이 감지되었습니다. 호스트 공유 시 일반 계정 대신 [전용 보안 공유 계정] 모드를 사용하세요.');
  }
  if (status.osBuild === 26100 && typeof status.osUbr === 'number' && status.osUbr > 0 && status.osUbr < 2314) {
    score -= 5;
    issues.push(`Windows 11 24H2 초기 리비전(26100.${status.osUbr})입니다. 간헐적 SMB·탐색 오류 시 Windows Update 최신 누적 패치(KB) 적용을 권장합니다.`);
  }
  if (status.pendingRebootFlag) {
    issues.push('Windows에 대기 중인 보류 재부팅(Pending Reboot / 네트워크 스택 변경) 플래그가 감지되었습니다.');
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

  if (mode === 'deep_stack_reset' || mode === 'enable_smbv1_client' || mode === 'legacy_smb1_enable' || smb1Changed) {
    const isSmbv1Rollback = mode === 'legacy_bridge_rollback' && smb1Changed;
    const isSmbv1 = mode === 'enable_smbv1_client' || mode === 'legacy_smb1_enable' || (smb1Changed && !isSmbv1Rollback);
    return {
      level: isSmbv1Rollback ? 'reboot_recommended' : 'reboot_required',
      title: isSmbv1Rollback
        ? 'SMB 1.0 비활성화 원복 완료 · 재부팅 권장'
        : isSmbv1
          ? '컴퓨터 재부팅 필수 (SMB 1.0 커널 드라이버 활성화)'
          : '컴퓨터 재부팅 필요 (네트워크 스택·커널 변경)',
      reason: isSmbv1Rollback
        ? '보안 정책 복원과 함께 SMB 1.0 기능을 비활성화했습니다. 커널에서 레거시 드라이버를 완전히 언로드하려면 재부팅을 권장합니다.'
        : mode === 'deep_stack_reset'
          ? 'Winsock 카탈로그(netsh winsock reset) 및 TCP/IP 프로토콜 스택을 초기화했습니다. 커널 소켓 계층에 새 설정을 적재하려면 Windows 재부팅이 반드시 필요합니다.'
          : '구형 PC·장비 호환용 SMB 1.0/CIFS 프로토콜 기능이 설치되었습니다. 레거시 SMB1 커널 드라이버를 적재하려면 Windows 재부팅이 반드시 필요합니다.',
      serviceRestarted: restartedServices.length > 0,
      restartedServices,
      rebootRecommended: true,
      canRebootNow: true,
    };
  }

  if (priorPendingReboot || netbiosStateChanged || spoolerRestartFailed) {
    return {
      level: 'reboot_recommended',
      title: '컴퓨터 재부팅 권장 (서비스 잠금 / 보류된 변경 감지)',
      reason: spoolerRestartFailed
        ? 'Print Spooler 서비스가 다른 프로세스에 의해 잠겨 즉시 재시작되지 못했습니다. RPC 프린터 공유 정책 반영을 위해 재부팅을 권장합니다.'
        : netbiosStateChanged
          ? 'SMB 서비스는 즉시 새로고침되었으나, 네트워크 어댑터의 NetBIOS over TCP/IP(NetbiosOptions) 설정이 변경되어 완전한 이름 해석 반영을 위해 재부팅을 권장합니다.'
          : '패치 적용 전부터 Windows 시스템에 보류 중인 재부팅 플래그가 감지되었습니다. 공유 연결이 불안정할 경우 재부팅을 권장합니다.',
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
        ? '재부팅 불필요 · Print Spooler 및 RPC 서비스 즉시 새로고침 완료'
        : '재부팅 불필요 · SMB 서비스 즉시 새로고침 완료',
      reason: `정책 변경 후 ${restartedServices.join(', ')} 서비스를 즉시 재시작하여 캐시된 세션을 갱신했습니다. 컴퓨터를 재부팅하지 않고 바로 공유를 사용할 수 있습니다.`,
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
          ? '재부팅 불필요 · UAC 원격 토큰 필터 완화(LocalAccountTokenFilterPolicy=1) 즉시 적용'
          : '재부팅 불필요 · UAC 원격 토큰 기본 보안 복원 완료',
      reason:
        mode === 'enable_uac_token_filter'
          ? '로컬 관리자 계정 원격 접속 토큰 제한이 해제되었습니다. 재부팅 없이 바로 원격 공유 인증이 적용됩니다.'
          : 'UAC 원격 토큰 필터가 Windows 기본 보안(비활성)으로 복원되었습니다.',
      serviceRestarted: false,
      restartedServices: [],
      rebootRecommended: false,
      canRebootNow: false,
    };
  }

  return {
    level: 'none',
    title: '재부팅 불필요 · 즉시 반영 완료',
    reason: '방화벽·네트워크 프로필·정책 변경 사항이 재부팅 없이 런타임에 즉시 적용되었습니다.',
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
      title: '선택한 드라이브 문자가 이미 할당됨',
      detail: '별도 OS 패치는 불필요합니다. 드라이브 문자를 Y:, X: 등 다른 문자로 변경해 다시 연결하세요.',
      needsOsPatchHint: false,
      actionLabel: 'OS 매트릭스 보기',
    };
  }
  if (/(?<![.\d])1219(?![.\d])|다중 연결|multiple connections/i.test(sanitized)) {
    return {
      code: 'Error 1219',
      title: '동일 서버에 다른 사용자 세션이 이미 열려 있음',
      detail: '별도 OS 패치는 불필요합니다. 열려 있는 탐색기 창을 닫거나 [연결 해제 / 보안 원복]으로 기존 SMB 세션을 정리한 뒤 다시 연결하세요.',
      needsOsPatchHint: false,
      actionLabel: 'OS 매트릭스 보기',
    };
  }
  if (/(?<![.\d])1385(?![.\d])|로그온 유형|logon type/i.test(sanitized)) {
    return {
      code: 'Error 1385',
      title: '호스트 PC 게스트 네트워크 로그온 차단 (SeDenyNetworkLogonRight)',
      detail: '호스트의 로컬 보안 정책 "네트워크에서 이 컴퓨터에 액세스 거부"에 Guest/Guests가 남아 있어 무비밀번호 접속이 차단되었습니다. 호스트 PC에서 [무비밀번호 정책 개방]을 실행하거나 클라이언트에서 [보안 계정 모드]로 연결하세요.',
      needsOsPatchHint: true,
      actionLabel: '통합 해결 가이드 & 도구 열기',
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])1223(?![.\d])|사용자 이름 입력|작업을 취소|canceled by the user/i.test(sanitized)) {
    return {
      code: 'Error 1223',
      title: '호스트 자격 증명 요구 또는 익명 게스트 접근 거부',
      detail: '대상 호스트가 익명·게스트 연결을 거부하고 사용자 이름/암호 인증을 요구했습니다. 호스트에서 무비밀번호 정책을 완전 개방하거나, 클라이언트에서 [보안 계정 모드]로 아이디/암호를 입력해 연결하세요.',
      needsOsPatchHint: false,
      actionLabel: '통합 해결 가이드 & 도구 열기',
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])1272(?![.\d])|(?<![.\d])384(?![.\d])|0x80070035|게스트|guest/i.test(sanitized)) {
    return {
      code: '0x80070035 / 1272',
      title: 'Win 11 24H2~26H2 비인증 게스트·SMB 서명 차단',
      detail: '별도 Windows 업데이트는 필요 없으며, 호스트·클라이언트 양단에서 [안전 호환 패치] 또는 [보안 계정 모드] 전환으로 즉시 해결됩니다.',
      needsOsPatchHint: true,
      actionLabel: '매트릭스 호환 패치로 이동',
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])1326(?![.\d])|(?<![.\d])86(?![.\d])|(?<![.\d])5(?![.\d])|액세스|거부|로그온|암호|password is not correct/i.test(sanitized)) {
    return {
      code: 'Error 5 / 86 / 1326',
      title: '계정 인증 실패 · 빈 암호 제한 또는 암호 보호 공유',
      detail: '호스트가 빈 암호 네트워크 로그온을 제한(LimitBlankPasswordUse=1)했거나 Guest 계정에 암호가 남아있는 경우, 또는 암호로 보호된 공유가 켜져 있는 상태입니다. 호스트 PC에서 [무비밀번호 정책 개방]을 실행하거나 [보안 계정 모드]로 연결하세요.',
      needsOsPatchHint: true,
      actionLabel: '통합 해결 가이드 & 도구 열기',
      isHostAuthOrGuestIssue: true,
    };
  }
  if (/(?<![.\d])53(?![.\d])|(?<![.\d])67(?![.\d])|네트워크 경로|연결 시간 초과|timeout|445/i.test(sanitized)) {
    return {
      code: 'Error 53 / TCP 445',
      title: '네트워크 경로 차단 또는 구형 SMBv1 장비 미지원',
      detail: '호스트 방화벽·공용(Public) 프로필 차단, 또는 구형 NAS·복합기라면 OS 매트릭스의 [SMBv1 클라이언트 기능 설치]가 필요할 수 있습니다.',
      needsOsPatchHint: true,
      actionLabel: '매트릭스 별도 기능·SMBv1 확인',
    };
  }
  return {
    code: 'Mount Diagnostic',
    title: '네트워크 연결 예외 진단 권장',
    detail: 'OS 호환성 매트릭스에서 현재 빌드·방화벽·UAC 토큰·별도 기능(SMBv1) 상태를 점검해 보세요.',
    needsOsPatchHint: true,
    actionLabel: 'OS 매트릭스 진단 열기',
  };
}

export const POLICY_PATCH_LABELS: Record<PolicyPatchMode, string> = {
  safe_compat: '안전 호환 패치',
  rpc_printer_compat: '프린터 RPC·스풀러 호환 패치',
  deep_stack_reset: '심층 TCP/IP · Winsock 초기화',
  strict_26h2_default: '26H2 표준 보안 복원',
  rpc_printer_default: '프린터 RPC 기본 보안 복원',
  enable_uac_token_filter: 'UAC 원격 토큰 필터 허용',
  disable_uac_token_filter: 'UAC 원격 토큰 기본 보안 복원',
  enable_smbv1_client: 'SMBv1 클라이언트 기능 설치',
  legacy_bridge_compat: 'Win 7·8.1 호환 SMB 2.1/3.0 브릿지 적용',
  legacy_smb1_enable: '레거시 SMB 1.0 프로토콜 활성화',
  legacy_bridge_rollback: '구형 OS 호환 설정 보안 원복',
};

export function getPolicyPatchLabel(mode: PolicyPatchMode): string {
  return POLICY_PATCH_LABELS[mode] || mode;
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

export const HOST_POLICY_REFERENCE_TARGETS: HostPolicyPreset[] = [
  {
    id: '__preset_file_printer_compat__',
    label: '호환 파일·프린터 공유 호스트 기준 (권장)',
    description: '게스트·서명 완화·방화벽 445·프린터 RPC Named Pipe 호환이 열린 메인 호스트 기준과 현재 PC를 즉시 비교합니다.',
    snapshot: {
      hostName: '호환 공유 호스트 기준',
      osProductName: 'Windows 11 / Windows 10',
      osDisplayVersion: '24H2~26H2 호환',
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
    label: '일반 파일 공유 호스트 기준 (Win 10~11)',
    description: '비서명·무비밀번호 공유 및 TCP 445가 개방된 일반 호스트 PC 기준과 현재 PC의 SMB/게스트/프로필 불일치를 진단합니다.',
    snapshot: {
      hostName: '일반 파일 호스트 기준',
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
    label: 'Windows OS 세대 · 빌드',
    hostValue: formatEraShortLabel(hostSnap.osEra, hostSnap.osBuild, hostSnap.osDisplayVersion),
    clientValue: formatEraShortLabel(clientPolicy.osEra, clientPolicy.osBuild, clientPolicy.osDisplayVersion),
    status: sameEra ? 'match' : 'warning',
    actionTarget: 'none',
    impact: sameEra
      ? '양단 PC의 기본 보안 세대가 동일합니다.'
      : '서로 다른 Windows 세대 간 연결입니다. 아래 서명·게스트·프린터 RPC 항목의 일치 여부를 확인하세요.',
  });

  const clientPublic = clientPolicy.networkProfile === 'Public';
  const hostPublic = hostSnap.networkProfile === 'Public';
  diffs.push({
    id: 'diff_profile',
    label: '네트워크 프로필 (방화벽)',
    hostValue: hostSnap.networkProfile,
    clientValue: clientPolicy.networkProfile,
    status: !clientPublic && !hostPublic ? 'match' : 'conflict',
    actionTarget: clientPublic ? 'local' : hostPublic ? 'host' : 'none',
    impact: clientPublic
      ? '현재 PC가 공용(Public) 프로필이므로 LAN 탐색·445 공유가 차단됩니다. 원클릭 자동 정렬로 개인(Private) 전환이 가능합니다.'
      : hostPublic
        ? '호스트 PC가 공용(Public) 프로필입니다. 호스트 PC에서 안전 호환 패치를 실행해 개인(Private)으로 전환하세요.'
        : '양단 모두 사설/도메인 네트워크로 TCP 445 통신이 허용됩니다.',
    recommendedPatch: clientPublic ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientPublic ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  // In SMB 2/3, failure occurs when Client REQUIRES signing while Server does NOT.
  // When Server requires signing and Client has RequireSecuritySignature=false, Windows still negotiates signing cleanly.
  const clientBlocksUnsignedHost = clientPolicy.smbClientSigningRequired && !hostSnap.smbServerSigningRequired;
  diffs.push({
    id: 'diff_smb_signing',
    label: 'SMB 보안 서명 정책',
    hostValue: hostSnap.smbServerSigningRequired ? '서버 서명 강제' : '서버 서명 완화',
    clientValue: clientPolicy.smbClientSigningRequired ? '클라이언트 서명 강제' : '클라이언트 서명 완화',
    status: clientBlocksUnsignedHost ? 'conflict' : 'match',
    actionTarget: clientBlocksUnsignedHost ? 'local' : 'none',
    impact: clientBlocksUnsignedHost
      ? '현재 PC의 클라이언트 서명 강제가 비서명 호스트/NAS 연결을 차단합니다. 로컬 안전 호환 패치로 즉시 완화할 수 있습니다.'
      : hostSnap.smbServerSigningRequired && !clientPolicy.smbClientSigningRequired
        ? '클라이언트 서명 완화 상태에서도 호스트의 서명 요구에 맞춰 SMB 3.x 서명이 정상 협상됩니다.'
        : '양단 SMB 서명 협상 정책이 호환됩니다.',
    recommendedPatch: clientBlocksUnsignedHost ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientBlocksUnsignedHost ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  const clientBlocksGuest = !clientPolicy.allowInsecureGuestAuth && hostSnap.allowInsecureGuestAuth;
  const hostBlocksGuest = clientPolicy.allowInsecureGuestAuth && !hostSnap.allowInsecureGuestAuth;
  diffs.push({
    id: 'diff_guest_auth',
    label: '비인증 게스트 로그온 허용',
    hostValue: hostSnap.allowInsecureGuestAuth ? '허용 (호환)' : '차단 (기본)',
    clientValue: clientPolicy.allowInsecureGuestAuth ? '허용 (호환)' : '차단 (기본)',
    status: clientBlocksGuest ? 'conflict' : hostBlocksGuest ? 'warning' : 'match',
    actionTarget: clientBlocksGuest ? 'local' : hostBlocksGuest ? 'host' : 'none',
    impact: clientBlocksGuest
      ? '호스트가 무비밀번호 게스트를 열었으나 현재 PC가 차단 중이어서 0x80070035 오류가 발생합니다. 원클릭 자동 정렬로 즉시 해결됩니다.'
      : hostBlocksGuest
        ? '호스트 PC가 게스트 차단을 유지 중입니다. 무비밀번호 공유 시 호스트에서 안전 호환 패치를 실행하거나 보안 계정 모드를 사용하세요.'
        : '양단 게스트 인증 정책이 동일합니다.',
    recommendedPatch: clientBlocksGuest ? 'safe_compat' : undefined,
    recommendedPatchLabel: clientBlocksGuest ? getPolicyPatchLabel('safe_compat') : undefined,
  });

  if (typeof hostSnap.guestNetworkLogonDenied === 'boolean') {
    const hostDenied = hostSnap.guestNetworkLogonDenied;
    diffs.push({
      id: 'diff_guest_deny',
      label: '호스트 Guest 네트워크 로그온 정책',
      hostValue: hostDenied ? '거부됨 (SeDenyNetworkLogonRight · 오류 1385 위험)' : '차단 해제됨 (허용)',
      clientValue: clientPolicy.guestNetworkLogonDenied ? '로컬도 거부됨' : '차단 해제됨',
      status: hostDenied ? 'conflict' : 'match',
      actionTarget: hostDenied ? (clientPolicy.guestNetworkLogonDenied ? 'both' : 'host') : 'none',
      impact: hostDenied
        ? '호스트 PC의 로컬 보안 정책에 Guest 네트워크 로그온 거부가 설정되어 무비밀번호 접속 시 오류 1385가 발생합니다. USB 호스트 대기 작업 예약 또는 호스트 측 정책 개방이 필요합니다.'
        : '호스트 PC의 SeDenyNetworkLogonRight에서 Guest 거부가 해제되어 있습니다.',
      recommendedPatch: hostDenied ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostDenied ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.limitBlankPasswordUse === 'boolean') {
    const hostRestrictsBlank = hostSnap.limitBlankPasswordUse;
    diffs.push({
      id: 'diff_blank_pwd',
      label: 'LSA 빈 암호 네트워크 로그온 제한 (오류 86)',
      hostValue: hostRestrictsBlank ? '제한됨 (LimitBlankPasswordUse=1)' : '허용 (LimitBlankPasswordUse=0)',
      clientValue:
        typeof clientPolicy.limitBlankPasswordUse === 'boolean'
          ? clientPolicy.limitBlankPasswordUse
            ? '제한됨'
            : '허용됨'
          : '미측정',
      status: hostRestrictsBlank ? 'conflict' : 'match',
      actionTarget: hostRestrictsBlank ? 'host' : 'none',
      impact: hostRestrictsBlank
        ? '호스트 PC가 빈 암호 원격 로그온을 차단(LimitBlankPasswordUse=1) 중이므로 무비밀번호 공유 시 Error 86이 발생합니다. 호스트 USB 대기 작업으로 해제할 수 있습니다.'
        : '호스트 PC에서 빈 암호 게스트 네트워크 로그온이 허용되어 있습니다.',
      recommendedPatch: hostRestrictsBlank ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostRestrictsBlank ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.guestAccountEnabled === 'boolean') {
    const hostGuestOff = !hostSnap.guestAccountEnabled;
    diffs.push({
      id: 'diff_guest_account',
      label: '호스트 Guest 계정 (SID *-501) 활성 여부',
      hostValue: hostGuestOff ? '비활성 (Disabled · 오류 86/1326)' : '활성 (무비밀번호 준비)',
      clientValue:
        typeof clientPolicy.guestAccountEnabled === 'boolean'
          ? clientPolicy.guestAccountEnabled
            ? '활성'
            : '비활성'
          : '미측정',
      status: hostGuestOff ? 'conflict' : 'match',
      actionTarget: hostGuestOff ? 'host' : 'none',
      impact: hostGuestOff
        ? '호스트 PC의 Guest 계정이 꺼져 있어 간편 무비밀번호 연결이 거부될 수 있습니다. USB 대기 작업의 [Guest 무비밀번호 개방]으로 즉시 활성화할 수 있습니다.'
        : '호스트 PC의 Guest 계정이 활성화되어 있습니다.',
      recommendedPatch: hostGuestOff ? 'safe_compat' : undefined,
      recommendedPatchLabel: hostGuestOff ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  if (typeof hostSnap.restrictNullSessAccess === 'boolean' || typeof hostSnap.restrictAnonymous === 'boolean') {
    const hostNullRestricted = Boolean(hostSnap.restrictNullSessAccess || hostSnap.restrictAnonymous);
    diffs.push({
      id: 'diff_lsa_anon',
      label: '호스트 LSA 익명·Null 세션 차단 (오류 1223)',
      hostValue: hostNullRestricted ? '차단됨 (익명 거부 · 오류 1223 위험)' : '완화됨 (Null 세션 허용)',
      clientValue: clientPolicy.restrictNullSessAccess || clientPolicy.restrictAnonymous ? '차단됨' : '완화됨',
      status: hostNullRestricted ? 'warning' : 'match',
      actionTarget: hostNullRestricted ? 'host' : 'none',
      impact: hostNullRestricted
        ? '호스트 PC의 RestrictNullSessAccess/restrictanonymous가 켜져 있어 자격 증명 창이 뜨거나 Error 1223이 발생할 수 있습니다.'
        : '호스트 PC가 무비밀번호 Null 세션 핸드셰이크를 허용합니다.',
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
      label: 'TCP 445 · 파일 공유 방화벽 개방 (오류 53)',
      hostValue: hostFwOk ? '개방됨 (Allow)' : '차단 또는 미등록',
      clientValue: clientFwOk ? '개방됨 (Allow)' : '차단 또는 미등록',
      status: anyFwMissing ? 'conflict' : 'match',
      actionTarget: !clientFwOk && !hostFwOk ? 'both' : !clientFwOk ? 'local' : !hostFwOk ? 'host' : 'none',
      impact: !clientFwOk
        ? '현재 PC 방화벽에 TCP 445 파일 공유 허용 규칙이 없어 LAN 응답이 끊길 수 있습니다. 내 PC 원클릭 정렬로 개방됩니다.'
        : !hostFwOk
          ? '호스트 PC 방화벽에 TCP 445 허용 규칙이 확인되지 않습니다. 호스트 USB 대기 작업을 저장해 인바운드 445 포트를 개방하세요.'
          : '양단 Windows 방화벽의 TCP 445 파일 공유 규칙이 개방되어 있습니다.',
      recommendedPatch: anyFwMissing ? 'safe_compat' : undefined,
      recommendedPatchLabel: anyFwMissing ? getPolicyPatchLabel('safe_compat') : undefined,
    });
  }

  const clientLowNtlm = clientPolicy.lmCompatibilityLevel !== null && clientPolicy.lmCompatibilityLevel < 3;
  const hostNtlmLabel =
    typeof hostSnap.lmCompatibilityLevel === 'number'
      ? `NTLMv2 (Lm=${hostSnap.lmCompatibilityLevel})`
      : 'NTLMv2 (Lm>=3 권장)';
  const clientNtlmLabel =
    clientPolicy.lmCompatibilityLevel !== null
      ? `Lm=${clientPolicy.lmCompatibilityLevel}`
      : '시스템 기본 (자동 협상)';
  diffs.push({
    id: 'diff_ntlm',
    label: 'NTLM 인증 협상 수준',
    hostValue: hostNtlmLabel,
    clientValue: clientNtlmLabel,
    status: clientLowNtlm ? 'conflict' : 'match',
    actionTarget: clientLowNtlm ? 'local' : 'none',
    impact: clientLowNtlm
      ? '현재 PC의 NTLM 호환 수준이 3 미만이어서 Win 11 24H2~26H2 호스트 인증 협상(오류 5/86)에서 거부될 수 있습니다.'
      : '양단 NTLMv2 인증 협상 호환이 정상입니다.',
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
    label: '프린터 RPC · Named Pipe 호환',
    hostValue: hostAnyRpcRelaxed ? '호환 완화 (Named Pipe)' : '24H2~26H2 엄격 RPC',
    clientValue: clientRpcRelaxed ? '호환 완화 (Named Pipe)' : '24H2~26H2 엄격 RPC',
    status: clientNeedsRpcRelax ? 'conflict' : hostNeedsRpcRelax || bothWin11StrictRpc ? 'warning' : 'match',
    actionTarget: clientNeedsRpcRelax ? 'local' : hostNeedsRpcRelax ? 'host' : bothWin11StrictRpc ? 'both' : 'none',
    impact: clientNeedsRpcRelax
      ? '호스트는 프린터 RPC 호환이 열려 있으나 현재 PC가 엄격 상태입니다. 원클릭 자동 정렬로 0x0000011b·0x00000709를 즉시 해결할 수 있습니다.'
      : hostNeedsRpcRelax
        ? '현재 PC는 완화되었으나 호스트 PC가 엄격 RPC 상태입니다. 공유 프린터 연결 시 호스트에서도 프린터 RPC 호환 패치를 실행하세요.'
        : bothWin11StrictRpc
          ? '양단 모두 24H2~26H2 엄격 프린터 RPC 상태입니다. 일반 파일 공유는 정상이며, 공유 프린터 0x0000011b/0x00000709 발생 시 호환 패치를 적용하세요.'
          : '양단 프린터 RPC·스풀러 전송 규격이 일치합니다.',
    recommendedPatch: clientNeedsRpcRelax ? 'rpc_printer_compat' : undefined,
    recommendedPatchLabel: clientNeedsRpcRelax ? getPolicyPatchLabel('rpc_printer_compat') : undefined,
  });

  const hostUacRelaxed = Boolean(hostSnap.localAccountTokenFilterEnabled);
  const clientUacRelaxed = Boolean(clientPolicy.localAccountTokenFilterEnabled);
  const clientNeedsUacToken = hostUacRelaxed && !clientUacRelaxed;
  diffs.push({
    id: 'diff_uac_token',
    label: 'UAC 원격 토큰 필터',
    hostValue: hostUacRelaxed ? '완화됨 (허용)' : '기본 보안 (차단)',
    clientValue: clientUacRelaxed ? '완화됨 (허용)' : '기본 보안 (차단)',
    status: clientNeedsUacToken ? 'conflict' : hostUacRelaxed !== clientUacRelaxed ? 'warning' : 'match',
    actionTarget: clientNeedsUacToken ? 'local' : hostUacRelaxed !== clientUacRelaxed ? 'host' : 'none',
    impact: clientNeedsUacToken
      ? '호스트가 워크그룹 관리자 원격 토큰 필터를 완화했습니다. 현재 PC도 UAC 원격 토큰 허용을 맞추면 Error 5를 예방할 수 있습니다.'
      : hostUacRelaxed !== clientUacRelaxed
        ? '현재 PC는 UAC 원격 토큰이 허용되어 있고 호스트는 기본 보안 상태입니다.'
        : '양단 UAC 원격 토큰 정책이 동일합니다.',
    recommendedPatch: clientNeedsUacToken ? 'enable_uac_token_filter' : undefined,
    recommendedPatchLabel: clientNeedsUacToken ? getPolicyPatchLabel('enable_uac_token_filter') : undefined,
  });

  return diffs;
}

const PATCH_EXECUTION_ORDER: PolicyPatchMode[] = [
  'safe_compat',
  'legacy_bridge_compat',
  'rpc_printer_compat',
  'enable_uac_token_filter',
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
      title: '재부팅 불필요 · 일괄 정렬 및 관련 Windows 서비스 즉시 새로고침 완료',
      reason: `선택된 불일치 정책들을 한 번에 정렬하고 ${restartedServices.join(', ')} 서비스를 즉시 재시작했습니다. 재부팅 없이 바로 공유 연결을 진행할 수 있습니다.`,
      serviceRestarted: true,
      restartedServices,
      rebootRecommended: false,
      canRebootNow: false,
    };
  }

  return {
    level: 'none',
    title: '재부팅 불필요 · 불일치 정책 일괄 자동 정렬 완료',
    reason: '모든 불일치 항목이 재부팅 없이 즉시 정렬되었습니다.',
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
          badgeLabel: '호스트 일치',
          expectedHostValue: hostVal ? '강제됨 (1)' : '완화됨 (0)',
          discrepancyDetail: '대상 호스트와 서버 SMB 서명 정책이 동일합니다.',
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostVal ? '호스트 강제 · 로컬 완화' : '로컬 강제 · 호스트 완화',
        expectedHostValue: hostVal ? '강제됨 (1)' : '완화됨 (0)',
        discrepancyDetail: hostVal
          ? '대상 호스트는 서버 서명을 강제하고 있으나 현재 PC 서버 서명은 완화되어 있습니다.'
          : '대상 호스트는 서버 서명이 완화되어 있으나 현재 PC 서버 서명은 강제 상태입니다.',
      };
    }

    case 'audit_smb_client_signing': {
      const hostServerStrict = hostSnap.smbServerSigningRequired;
      const localClientStrict = localStatus.smbClientSigningRequired;
      if (localClientStrict && !hostServerStrict) {
        return {
          status: 'conflict',
          badgeLabel: '연결 차단 · 서명 불일치',
          expectedHostValue: '완화 호환 (0)',
          discrepancyDetail:
            '대상 호스트는 서명을 요구하지 않으나 현재 PC 클라이언트가 서명을 강제해 SMB 연결이 차단될 수 있습니다.',
        };
      }
      if (!localClientStrict && hostServerStrict) {
        return {
          status: 'aligned',
          badgeLabel: '서명 협상 호환',
          expectedHostValue: '강제됨 (1)',
          discrepancyDetail:
            '클라이언트 서명 완화 상태에서도 호스트의 서명 요구에 맞춰 SMB 3.x 서명이 정상 협상됩니다.',
        };
      }
      return {
        status: 'aligned',
        badgeLabel: '호스트 일치',
        expectedHostValue: hostServerStrict ? '강제됨 (1)' : '완화 호환 (0)',
        discrepancyDetail: '대상 호스트의 서명 정책과 현재 PC 클라이언트 서명 설정이 호환됩니다.',
      };
    }

    case 'audit_insecure_guest_auth': {
      const hostGuestOpen = hostSnap.allowInsecureGuestAuth;
      const localGuestOpen = localStatus.allowInsecureGuestAuth;
      if (!localGuestOpen && hostGuestOpen) {
        return {
          status: 'conflict',
          badgeLabel: '0x80070035 차단 충돌',
          expectedHostValue: '허용 (1)',
          discrepancyDetail:
            '대상 호스트가 무비밀번호 게스트를 개방했으나 현재 PC가 차단 중이어서 접속 시 0x80070035 오류가 발생합니다.',
        };
      }
      if (localGuestOpen && !hostGuestOpen) {
        return {
          status: 'warning',
          badgeLabel: '호스트 차단 · 로컬 허용',
          expectedHostValue: '차단 (0)',
          discrepancyDetail:
            '대상 호스트는 게스트 차단을 유지 중이나 현재 PC는 허용되어 있습니다. 보안 계정 모드 또는 호스트 개방을 맞추세요.',
        };
      }
      return {
        status: 'aligned',
        badgeLabel: '호스트 일치',
        expectedHostValue: hostGuestOpen ? '허용 (1)' : '차단 (0)',
        discrepancyDetail: '비인증 게스트 로그온 허용 정책이 양단 모두 일치합니다.',
      };
    }

    case 'audit_guest_account_501': {
      if (typeof hostSnap.guestAccountEnabled !== 'boolean' || typeof localStatus.guestAccountEnabled !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: '호스트 미측정',
          expectedHostValue: hostSnap.allowInsecureGuestAuth ? '활성 추정 (ON)' : '미측정',
          discrepancyDetail: '대상 호스트 스냅샷에 Guest 계정(*-501) 활성 여부가 포함되지 않았습니다.',
        };
      }
      const hostOn = hostSnap.guestAccountEnabled;
      const localOn = localStatus.guestAccountEnabled;
      if (hostOn === localOn) {
        return {
          status: 'aligned',
          badgeLabel: '호스트 일치',
          expectedHostValue: hostOn ? '활성 (ON)' : '비활성 (OFF)',
          discrepancyDetail: '양단 PC의 내장 Guest(*-501) 계정 상태가 동일합니다.',
        };
      }
      return {
        status: !hostOn && hostSnap.allowInsecureGuestAuth ? 'conflict' : 'warning',
        badgeLabel: hostOn ? '호스트 활성 · 로컬 OFF' : '호스트 OFF · 로컬 활성',
        expectedHostValue: hostOn ? '활성 (ON)' : '비활성 (OFF)',
        discrepancyDetail: hostOn
          ? '대상 호스트는 무비밀번호 공유를 위해 Guest 계정이 켜져 있으나 현재 PC는 비활성(OFF)입니다.'
          : '대상 호스트의 Guest 계정은 꺼져 있으나 현재 PC Guest 계정이 활성화되어 있습니다.',
      };
    }

    case 'audit_se_deny_guest_logon': {
      if (typeof hostSnap.guestNetworkLogonDenied !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: '호스트 미측정',
          expectedHostValue: '미측정',
          discrepancyDetail: '대상 호스트 스냅샷에 SeDenyNetworkLogonRight 측정값이 없습니다.',
        };
      }
      const hostDenied = hostSnap.guestNetworkLogonDenied;
      const localDenied = Boolean(localStatus.guestNetworkLogonDenied);
      if (hostDenied && hostSnap.allowInsecureGuestAuth) {
        return {
          status: 'conflict',
          badgeLabel: '호스트 1385 차단 충돌',
          expectedHostValue: '차단 해제 (허용)',
          discrepancyDetail:
            '대상 호스트가 Guest 로그온을 허용하면서도 SeDenyNetworkLogonRight에 거부가 남아 있어 오류 1385가 발생합니다.',
        };
      }
      if (hostDenied === localDenied) {
        return {
          status: 'aligned',
          badgeLabel: '호스트 일치',
          expectedHostValue: hostDenied ? '거부 적용' : '차단 해제 (허용)',
          discrepancyDetail: '양단 PC의 SeDenyNetworkLogonRight 정책이 동일합니다.',
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostDenied ? '호스트 거부 · 로컬 허용' : '호스트 허용 · 로컬 거부',
        expectedHostValue: hostDenied ? '거부 적용' : '차단 해제 (허용)',
        discrepancyDetail: hostDenied
          ? '대상 호스트는 Guest 네트워크 로그온을 거부 중입니다(무비밀번호 연결 시 Error 1385 주의).'
          : '대상 호스트는 Guest 로그온을 허용 중이나 현재 PC는 보안 원복으로 거부 상태입니다.',
      };
    }

    case 'audit_lsa_blank_password': {
      if (typeof hostSnap.limitBlankPasswordUse !== 'boolean' || typeof localStatus.limitBlankPasswordUse !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: '호스트 미측정',
          expectedHostValue: '미측정',
          discrepancyDetail: '대상 호스트 스냅샷에 LimitBlankPasswordUse 정보가 없습니다.',
        };
      }
      const hostLimit = hostSnap.limitBlankPasswordUse;
      const localLimit = localStatus.limitBlankPasswordUse;
      if (hostLimit && hostSnap.allowInsecureGuestAuth) {
        return {
          status: 'conflict',
          badgeLabel: '호스트 Error 86 제한',
          expectedHostValue: '허용 (0)',
          discrepancyDetail:
            '대상 호스트의 빈 암호 제한(LimitBlankPasswordUse=1) 때문에 무비밀번호 공유 연결 시 오류 86이 발생할 수 있습니다.',
        };
      }
      if (hostLimit === localLimit) {
        return {
          status: 'aligned',
          badgeLabel: '호스트 일치',
          expectedHostValue: hostLimit ? '제한됨 (1)' : '허용 (0)',
          discrepancyDetail: 'LSA 빈 암호 네트워크 로그온 제한 정책이 양단 동일합니다.',
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostLimit ? '호스트 제한 · 로컬 허용' : '호스트 허용 · 로컬 제한',
        expectedHostValue: hostLimit ? '제한됨 (1)' : '허용 (0)',
        discrepancyDetail: hostLimit
          ? '대상 호스트는 빈 암호 로그온을 제한 중이며 현재 PC는 허용 상태입니다.'
          : '대상 호스트는 빈 암호 로그온을 허용(0) 중이나 현재 PC는 제한(1) 상태입니다.',
      };
    }

    case 'audit_lsa_anonymous_null': {
      if (typeof hostSnap.restrictNullSessAccess !== 'boolean' && typeof hostSnap.restrictAnonymous !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: '호스트 미측정',
          expectedHostValue: '미측정',
          discrepancyDetail: '대상 호스트 스냅샷에 LSA 익명/Null 세션 값이 없습니다.',
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
          badgeLabel: '호스트 일치',
          expectedHostValue: hostBlocked ? '차단됨' : '완화됨 (Null 허용)',
          discrepancyDetail: 'LSA 익명 및 Null 세션 차단 자세가 양단 호환됩니다.',
        };
      }
      return {
        status: hostBlocked && hostSnap.allowInsecureGuestAuth ? 'conflict' : 'warning',
        badgeLabel: hostBlocked ? '호스트 1223 차단 · 로컬 완화' : '호스트 완화 · 로컬 차단',
        expectedHostValue: hostBlocked ? '차단됨' : '완화됨 (Null 허용)',
        discrepancyDetail: hostBlocked
          ? '대상 호스트는 익명/Null 세션을 차단 중입니다(무비밀번호 연결 시 오류 1223 가능).'
          : '대상 호스트는 Null 세션을 완화해 두었으나 현재 PC는 보안 원복 차단 상태입니다.',
      };
    }

    case 'audit_ntlm_level': {
      const hostLm = typeof hostSnap.lmCompatibilityLevel === 'number' ? hostSnap.lmCompatibilityLevel : null;
      const localLm = localStatus.lmCompatibilityLevel;
      if (hostLm === null || localLm === null) {
        return {
          status: 'aligned',
          badgeLabel: 'OS 기본 NTLM 호환',
          expectedHostValue: hostLm !== null ? `Lm=${hostLm}` : 'OS 기본값',
          discrepancyDetail: 'Windows 기본 NTLMv2 협상 범위 내에서 동작합니다.',
        };
      }
      if (hostLm === localLm) {
        return {
          status: 'aligned',
          badgeLabel: '호스트 일치',
          expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
          discrepancyDetail: `양단 PC 모두 LmCompatibilityLevel=${hostLm}으로 일치합니다.`,
        };
      }
      if (Math.abs(hostLm - localLm) >= 2 || hostLm < 3 || localLm < 3) {
        return {
          status: 'conflict',
          badgeLabel: `NTLM 충돌 (호스트 ${hostLm} ↔ 로컬 ${localLm})`,
          expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
          discrepancyDetail: 'NTLM 인증 수준 차이가 커서 자격 증명 협상 오류가 발생할 수 있습니다.',
        };
      }
      return {
        status: 'warning',
        badgeLabel: `NTLM 차이 (호스트 ${hostLm} ↔ 로컬 ${localLm})`,
        expectedHostValue: `LmCompatibilityLevel=${hostLm}`,
        discrepancyDetail: '대상 호스트와 NTLM 호환성 레벨 숫자가 다릅니다(NTLMv2 협상 가능).',
      };
    }

    case 'audit_uac_token_filter': {
      if (typeof hostSnap.localAccountTokenFilterEnabled !== 'boolean') {
        return {
          status: 'unmeasured',
          badgeLabel: '호스트 미측정',
          expectedHostValue: '미측정',
          discrepancyDetail: '대상 호스트의 UAC 원격 토큰 필터 정보가 없습니다.',
        };
      }
      const hostUac = hostSnap.localAccountTokenFilterEnabled;
      const localUac = Boolean(localStatus.localAccountTokenFilterEnabled);
      if (hostUac === localUac) {
        return {
          status: 'aligned',
          badgeLabel: '호스트 일치',
          expectedHostValue: hostUac ? '필터 완화 (1)' : '기본 보호 (0)',
          discrepancyDetail: '양단 PC의 UAC 원격 토큰 필터 설정이 동일합니다.',
        };
      }
      return {
        status: 'warning',
        badgeLabel: hostUac ? '호스트 완화(1) · 로컬 보호(0)' : '호스트 보호(0) · 로컬 완화(1)',
        expectedHostValue: hostUac ? '필터 완화 (1)' : '기본 보호 (0)',
        discrepancyDetail: hostUac
          ? '대상 호스트는 UAC 원격 토큰 필터가 완화(1)되어 있으나 현재 PC는 기본 보호(0) 상태입니다.'
          : '대상 호스트는 기본 보호(0) 상태이나 현재 PC는 필터 완화(1)가 켜져 있습니다.',
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
          badgeLabel: '방화벽 445 차단 충돌',
          expectedHostValue: 'TCP 445 개방',
          discrepancyDetail: hostFwBlocked
            ? '대상 호스트의 TCP 445 방화벽 규칙이 닫혀 있어 연결 시 오류 53이 발생합니다.'
            : '현재 PC의 TCP 445 방화벽 규칙이 닫혀 있습니다.',
        };
      }
      if (hostRpcRelaxed !== localRpcRelaxed) {
        return {
          status: hostRpcRelaxed && !localRpcRelaxed ? 'conflict' : 'warning',
          badgeLabel: hostRpcRelaxed ? '프린터 RPC 불일치 (0x11b)' : 'RPC 정책 차이',
          expectedHostValue: hostRpcRelaxed ? 'RPC 완화 · 445 개방' : '엄격 RPC · 445 개방',
          discrepancyDetail: hostRpcRelaxed
            ? '대상 호스트는 프린터 RPC 호환 완화 상태이나 현재 PC는 엄격 RPC 상태입니다(프린터 공유 시 0x0000011b 주의).'
            : '대상 호스트는 엄격 RPC 상태이나 현재 PC는 프린터 RPC 완화가 적용되어 있습니다.',
        };
      }
      return {
        status: 'aligned',
        badgeLabel: '호스트 일치 (RPC·445)',
        expectedHostValue: hostRpcRelaxed ? 'RPC 완화 · 445 개방' : '엄격 RPC · 445 개방',
        discrepancyDetail: '프린터 RPC 보안 및 TCP 445 방화벽 기준이 대상 호스트와 일치합니다.',
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
    category: 'SMB 서명',
    label: 'SMB 서버 보안 서명 강제',
    registryOrPolicy: 'LanmanServer\\Parameters\\RequireSecuritySignature',
    currentValue: status.smbServerSigningRequired ? '강제됨 (1)' : '완화됨 (0)',
    expectedDefault: '강제됨 (1)',
    status: status.smbServerSigningRequired ? 'restored' : 'relaxed',
    detail: status.smbServerSigningRequired
      ? '호스트 SMB 서버가 패킷 서명을 강제하여 중간자 변조를 차단합니다.'
      : '서버 SMB 서명이 완화되어 있습니다. 표준 보안 복원 시 강제됨(1)으로 잠깁니다.',
    ...(status.smbServerSigningRequired ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 2. SMB Client Security Signing
  items.push({
    id: 'audit_smb_client_signing',
    index: 2,
    category: 'SMB 서명',
    label: 'SMB 클라이언트 보안 서명 강제',
    registryOrPolicy: 'LanmanWorkstation\\Parameters\\RequireSecuritySignature',
    currentValue: status.smbClientSigningRequired ? '강제됨 (1)' : '완화됨 (0)',
    expectedDefault: '강제됨 (1)',
    status: status.smbClientSigningRequired ? 'restored' : 'relaxed',
    detail: status.smbClientSigningRequired
      ? '클라이언트가 서명 없는 서버 연결을 거부하는 Win 11 24H2+ 기본 보안 상태입니다.'
      : '클라이언트 SMB 서명 강제가 해제되어 있습니다. 보안 원복 시 강제됨(1)으로 복구됩니다.',
    ...(status.smbClientSigningRequired ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 3. Insecure Guest Logon Disabled
  const guestAuthBlocked = !status.allowInsecureGuestAuth && !status.enableInsecureGuestLogons;
  items.push({
    id: 'audit_insecure_guest_auth',
    index: 3,
    category: '게스트 제한',
    label: '비인증 게스트 로그온 차단',
    registryOrPolicy: 'LanmanWorkstation (서비스 · 정책 AllowInsecureGuestAuth)',
    currentValue: guestAuthBlocked ? '차단됨 (0)' : '허용됨 (1)',
    expectedDefault: '차단됨 (0)',
    status: guestAuthBlocked ? 'restored' : 'relaxed',
    detail: guestAuthBlocked
      ? '비인증 게스트 로그온(서비스 및 정책 GPO 키)이 모두 차단 상태로 복구되었습니다.'
      : '비인증 게스트 로그온이 허용되어 있습니다. 공유 종료 후 차단(0)으로 원복해야 합니다.',
    ...(guestAuthBlocked ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 4. Built-in Guest Account (*-501) Disabled
  const guestAccUnknown = typeof status.guestAccountEnabled !== 'boolean';
  const guestAccOff = status.guestAccountEnabled === false;
  items.push({
    id: 'audit_guest_account_501',
    index: 4,
    category: '게스트 제한',
    label: '내장 Guest 계정 (SID *-501) 비활성',
    registryOrPolicy: 'LocalUser SID *-501 (Disabled)',
    currentValue: guestAccUnknown ? '미측정' : guestAccOff ? '비활성 (OFF)' : '활성 (ON)',
    expectedDefault: '비활성 (OFF)',
    status: guestAccUnknown ? 'unknown' : guestAccOff ? 'restored' : 'relaxed',
    detail: guestAccUnknown
      ? 'Guest 계정 상태를 직접 확인하지 못했습니다. 재검사 또는 호스트 보안 원복을 권장합니다.'
      : guestAccOff
        ? 'Windows 내장 Guest 계정이 비활성(Disabled)으로 안전하게 잠겨 있습니다.'
        : '무비밀번호 공유용 Guest 계정이 아직 활성화되어 있습니다. 표준 보안 복원으로 비활성화하세요.',
    ...(guestAccUnknown || guestAccOff ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 5. SeDenyNetworkLogonRight (Guest Network Logon Denied)
  const guestNetDenied = status.guestNetworkLogonDenied === true;
  items.push({
    id: 'audit_se_deny_guest_logon',
    index: 5,
    category: '게스트 제한',
    label: '로컬 보안 정책 Guest 네트워크 거부',
    registryOrPolicy: 'Secedit User Rights (SeDenyNetworkLogonRight)',
    currentValue: guestNetDenied ? '거부 적용 (1385 방어)' : '거부 해제 (허용)',
    expectedDefault: '거부 적용 (Guest/Guests)',
    status: guestNetDenied ? 'restored' : 'relaxed',
    detail: guestNetDenied
      ? 'SeDenyNetworkLogonRight에 Guest/Guests 네트워크 로그온 거부가 복구되어 외부 무비밀번호 접근이 차단됩니다.'
      : '네트워크 로그온 거부 정책에서 Guest/Guests 차단이 풀려 있습니다.',
    ...(guestNetDenied ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 6. LSA LimitBlankPasswordUse
  const blankPwdUnknown = typeof status.limitBlankPasswordUse !== 'boolean';
  const blankPwdLimited = status.limitBlankPasswordUse === true;
  items.push({
    id: 'audit_lsa_blank_password',
    index: 6,
    category: 'LSA 보안',
    label: 'LSA 빈 암호 네트워크 로그온 제한',
    registryOrPolicy: 'Control\\Lsa\\LimitBlankPasswordUse',
    currentValue: blankPwdUnknown ? '미측정' : blankPwdLimited ? '제한됨 (1)' : '허용됨 (0)',
    expectedDefault: '제한됨 (1)',
    status: blankPwdUnknown ? 'unknown' : blankPwdLimited ? 'restored' : 'relaxed',
    detail: blankPwdUnknown
      ? 'LimitBlankPasswordUse 레지스트리 값을 확인하지 못했습니다.'
      : blankPwdLimited
        ? '빈 암호 계정의 원격 네트워크 로그온이 차단(1)되어 있습니다.'
        : '빈 암호 네트워크 로그온 제한이 해제(0)되어 있습니다. 보안 원복으로 제한(1)을 복원하세요.',
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
    category: 'LSA 보안',
    label: 'LSA 익명 · Null 세션 차단',
    registryOrPolicy: 'everyoneincludesanonymous=0 · restrictanonymous=1 · RestrictNullSessAccess=1',
    currentValue: lsaAnonFullyLocked
      ? '3종 완전 차단 (0/1/1)'
      : lsaAnonPartial
        ? `부분 차단 (Anon=${status.restrictAnonymous ? 1 : 0})`
        : `완화됨 (Every=${status.everyoneIncludesAnonymous ? 1 : 0}, Null=${status.restrictNullSessAccess === false ? 0 : 1})`,
    expectedDefault: '3종 완전 차단 (0/1/1)',
    status: lsaAnonFullyLocked ? 'restored' : lsaAnonPartial ? 'partial' : 'relaxed',
    detail: lsaAnonFullyLocked
      ? 'everyoneincludesanonymous=0, restrictanonymous=1, RestrictNullSessAccess=1 모두 보안 원복 기준과 일치합니다.'
      : lsaAnonPartial
        ? 'everyoneincludesanonymous=0 및 Null 세션 차단은 잠겼으나 restrictanonymous=0 상태입니다(표준 원복 실행 시 1로 강화).'
        : 'LSA 익명 또는 Null 세션 허용 키가 완화 상태입니다. 표준 보안 복원이 필요합니다.',
    ...(lsaAnonFullyLocked ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 8. NTLM Compatibility Level
  const lmLevel = status.lmCompatibilityLevel;
  const lmSafe = typeof lmLevel === 'number' && lmLevel >= 3;
  const lmDefaultUnset = lmLevel === null;
  items.push({
    id: 'audit_ntlm_level',
    index: 8,
    category: 'NTLM 인증',
    label: 'NTLM 인증 협상 수준 (NTLMv2)',
    registryOrPolicy: 'Control\\Lsa\\LmCompatibilityLevel',
    currentValue: lmDefaultUnset ? 'OS 기본값 (NTLMv2)' : `LmCompatibilityLevel=${lmLevel}`,
    expectedDefault: '3 이상 (NTLMv2 전용)',
    status: lmSafe ? 'restored' : lmDefaultUnset ? 'partial' : 'relaxed',
    detail: lmSafe
      ? `LmCompatibilityLevel=${lmLevel}으로 취약한 LM/NTLMv1 응답을 거부하고 NTLMv2만 협상합니다.`
      : lmDefaultUnset
        ? '명시적 레지스트리 값 없이 OS 기본(Win 10/11 기본 NTLMv2)으로 동작 중입니다.'
        : `LmCompatibilityLevel=${lmLevel}으로 낮아져 있습니다. 보안 원복(3 이상) 정렬을 권장합니다.`,
    ...(lmSafe || lmDefaultUnset ? {} : { remediationMode: 'strict_26h2_default' }),
  });

  // 9. UAC Remote Token Filter Protection
  const uacProtected = !status.localAccountTokenFilterEnabled;
  items.push({
    id: 'audit_uac_token_filter',
    index: 9,
    category: 'UAC 원격 보호',
    label: 'UAC 원격 토큰 필터 보호',
    registryOrPolicy: 'Policies\\System\\LocalAccountTokenFilterPolicy',
    currentValue: uacProtected ? '기본 보호 (0)' : '필터 완화 (1)',
    expectedDefault: '기본 보호 (0)',
    status: uacProtected ? 'restored' : 'relaxed',
    detail: uacProtected
      ? '워크그룹 원격 접속 시 로컬 관리자 상승 토큰 필터링이 기본 보안(0)으로 유지됩니다.'
      : 'LocalAccountTokenFilterPolicy=1이 활성화되어 원격 관리자 토큰 접근이 열려 있습니다.',
    ...(uacProtected ? {} : { remediationMode: 'disable_uac_token_filter' }),
  });

  // 10. Printer RPC Privacy + Temporary Firewall (AhBiShare-SMB-445) + SMBv1 Disabled
  const rpcStrict = !status.rpcAuthnLevelPrivacyDisabled;
  const smb1Off = !status.smb1Enabled && !status.smb1ServerEnabled;
  const fwClean = !hasAhbiFirewallRule;
  const clean10Ok = rpcStrict && smb1Off && fwClean;
  const issues10: string[] = [];
  if (!rpcStrict) issues10.push('프린터 RPC 개인정보 인증 완화됨');
  if (!fwClean) issues10.push('임시 방화벽(AhBiShare-SMB-445) 잔존');
  if (!smb1Off) issues10.push('레거시 SMB 1.0 활성 상태');

  items.push({
    id: 'audit_rpc_fw_smb1',
    index: 10,
    category: 'RPC · 방화벽 · SMBv1',
    label: '프린터 RPC · 임시 방화벽 · SMBv1 정리',
    registryOrPolicy: 'RpcAuthnLevelPrivacyEnabled=1 · AhBiShare-SMB-445 · SMB1',
    currentValue: clean10Ok
      ? '엄격 RPC · 임시규칙 삭제 · SMBv1 OFF'
      : [
          rpcStrict ? '엄격 RPC' : 'RPC 완화',
          fwClean ? '임시규칙 없음' : '445 규칙 잔존',
          smb1Off ? 'SMBv1 OFF' : 'SMBv1 ON',
        ].join(' · '),
    expectedDefault: '엄격 RPC · 임시규칙 삭제 · SMBv1 OFF',
    status: clean10Ok ? 'restored' : !rpcStrict ? 'relaxed' : 'partial',
    detail: clean10Ok
      ? '프린터 RPC 엄격 인증(1)이 유지되고, AhBiShare-SMB-445 임시 방화벽 규칙 및 SMBv1이 모두 비활성화되었습니다.'
      : `추가 확인 필요: ${issues10.join(', ')}${!fwClean ? ' (호스트 보안 원복으로 임시 규칙 삭제 가능)' : ''}`,
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
  let headline = `보안 원복 완벽 검증 · ${passedCount} / 10개 핵심 항목 기본값 일치`;
  let summary = hasResidualSharesOrMounts
    ? `핵심 OS 정책 ${passedCount}건이 보안 기본값입니다. (참고: 활성 공유 ${activeShareCount}건 · 연결 드라이브 ${activeMountCount}건${hasAhbiFirewallRule ? ' · 임시 방화벽 규칙' : ''} 확인됨)`
    : 'SMB 서명, 게스트·빈 암호 차단, LSA 익명 제한, NTLMv2, UAC 보호 및 프린터 RPC까지 모든 보안 정책이 의도한 기본값으로 복구되었습니다.';

  if (failedCount > 0) {
    verdict = 'incomplete';
    headline = `일부 정책 완화 상태 감지 · ${passedCount} / 10개 복구 (${failedCount}건 미복구)`;
    summary = `${failedCount}개 핵심 항목이 아직 공유 호환(완화) 상태에 남아 있습니다. 아래 미복구 항목을 확인한 뒤 표준 보안 복원 또는 전체 보안 원복을 실행하세요.`;
  } else if (partialCount > 0) {
    verdict = 'mostly_restored';
    headline = `보안 기본값 대체로 복구됨 · ${passedCount} / 10개 완전 일치 (${partialCount}건 세부 확인)`;
    summary = `위험 완화 항목은 없으나 ${partialCount}개 항목이 OS 기본값 또는 부분 잠금 상태입니다. 필요 시 일괄 복원을 실행해 10/10 완전 잠금으로 맞출 수 있습니다.`;
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
  const statusKor = (s: SecurityRollbackAuditItem['status']) =>
    s === 'restored' ? '복구 완료' : s === 'partial' ? '부분/기본값' : s === 'unknown' ? '미측정' : '미복구(완화)';
  const lines = [
    `[AhBiShare OneClick 보안 원복 10개 핵심 항목 검증 보고서]`,
    `대상 PC: ${hostname} · OS: ${osLabel}`,
    `점검 일시: ${report.evaluatedAt}`,
    `종합 판정: ${report.headline}`,
    ...(report.targetHostName
      ? [
          `호스트 기대 정책 비교: ${report.targetHostName} (불일치/차이 ${report.targetDiscrepancyCount ?? 0}건 · 충돌 ${report.targetConflictCount ?? 0}건)`,
        ]
      : []),
    `활성 공유: ${report.activeShareCount}건 · 연결 드라이브: ${report.activeMountCount}건 · AhBiShare-SMB-445 규칙: ${report.hasAhbiFirewallRule ? '존재' : '삭제됨'}`,
    '',
    ...report.items.map((item) => {
      const base = `${String(item.index).padStart(2, '0')}. [${statusKor(item.status)}] ${item.label} | 현재: ${item.currentValue} | 보안기본값: ${item.expectedDefault}`;
      return item.hostComparison
        ? `${base} | 대상호스트(${item.hostComparison.badgeLabel}: ${item.hostComparison.expectedHostValue})`
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
  guest501Disabled?: number | null;
  seDenyNetworkLogon?: string | null;
  limitBlankPwd?: number | null;
  everyAnon?: number | null;
  restrictAnon?: number | null;
  restrictNullSess?: number | null;
  lmCompatLevel?: number | null;
  ntlmRestrictOutbound?: number | null;
  uacTokenFilter?: number | null;
  uacLinkedConn?: number | null;
  rpcPrivacy?: number | null;
  rpcNamedPipe?: number | null;
  rpcProtocols?: number | null;
  srvSmb1?: number | null;
  ahbiFw445?: number | null;
}

export function formatRawDword(val: number | null | undefined, unsetHint?: string): string {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    const unsigned = val >>> 0;
    return `0x${unsigned.toString(16).padStart(8, '0').toUpperCase()} (${val})`;
  }
  return unsetHint ? `<미설정 · ${unsetHint}>` : '<미설정>';
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

  const seDenyText =
    typeof rawMap.seDenyNetworkLogon === 'string' && rawMap.seDenyNetworkLogon.trim().length > 0
      ? rawMap.seDenyNetworkLogon.trim()
      : rawMap.seDenyNetworkLogon === ''
        ? '<미설정 / 비어 있음>'
        : '<미측정>';

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
        '기본 0 또는 1'
      ),
      makeDwordEntry(
        'audit_smb_server_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'EnableSecuritySignature',
        rawMap.srvEnableSig,
        '0x00000001 (1)',
        '기본 1'
      ),
    ],
    audit_smb_client_signing: [
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'RequireSecuritySignature',
        rawMap.cliRequireSig,
        '0x00000001 (1)',
        '24H2+ 기본 1'
      ),
      makeDwordEntry(
        'audit_smb_client_signing',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'EnableSecuritySignature',
        rawMap.cliEnableSig,
        '0x00000001 (1)',
        '기본 1'
      ),
    ],
    audit_insecure_guest_auth: [
      makeDwordEntry(
        'audit_insecure_guest_auth',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        'AllowInsecureGuestAuth',
        rawMap.cliGuestSvc,
        '0x00000000 (0)',
        '기본 0 (차단)'
      ),
      makeDwordEntry(
        'audit_insecure_guest_auth',
        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation',
        'AllowInsecureGuestAuth',
        rawMap.cliGuestPol,
        '0x00000000 (0) 또는 <미설정>',
        'GPO 미구성'
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
            ? '0x00000001 (Disabled / 잠금)'
            : guestDisabledNum === 0
              ? '0x00000000 (Enabled / 활성)'
              : '<미측정>',
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
        expectedDefaultDisplay: '*S-1-5-32-546,*S-1-5-7 (Guest 포함)',
      },
    ],
    audit_lsa_blank_password: [
      makeDwordEntry(
        'audit_lsa_blank_password',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'LimitBlankPasswordUse',
        rawMap.limitBlankPwd,
        '0x00000001 (1)',
        '기본 1 (제한)'
      ),
    ],
    audit_lsa_anonymous_null: [
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'everyoneincludesanonymous',
        rawMap.everyAnon,
        '0x00000000 (0)',
        '기본 0'
      ),
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'restrictanonymous',
        rawMap.restrictAnon,
        '0x00000001 (1)',
        '기본 0 또는 1'
      ),
      makeDwordEntry(
        'audit_lsa_anonymous_null',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'RestrictNullSessAccess',
        rawMap.restrictNullSess,
        '0x00000001 (1)',
        '기본 1 (차단)'
      ),
    ],
    audit_ntlm_level: [
      makeDwordEntry(
        'audit_ntlm_level',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
        'LmCompatibilityLevel',
        rawMap.lmCompatLevel,
        '0x00000003 (3) 이상',
        'OS 기본(NTLMv2)'
      ),
      makeDwordEntry(
        'audit_ntlm_level',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\MSV1_0',
        'RestrictSendingNTLMTraffic',
        rawMap.ntlmRestrictOutbound,
        '<미설정> 또는 0x00000000 (0)',
        '제한 없음'
      ),
    ],
    audit_uac_token_filter: [
      makeDwordEntry(
        'audit_uac_token_filter',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'LocalAccountTokenFilterPolicy',
        rawMap.uacTokenFilter,
        '0x00000000 (0) 또는 <미설정>',
        '기본 0 (필터 보호)'
      ),
      makeDwordEntry(
        'audit_uac_token_filter',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'EnableLinkedConnections',
        rawMap.uacLinkedConn,
        '<미설정> 또는 0x00000001 (1)',
        '기본 미설정'
      ),
    ],
    audit_rpc_fw_smb1: [
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print',
        'RpcAuthnLevelPrivacyEnabled',
        rawMap.rpcPrivacy,
        '0x00000001 (1) 또는 <미설정>',
        '기본 1 (엄격 RPC)'
      ),
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC',
        'RpcUseNamedPipeProtocol',
        rawMap.rpcNamedPipe,
        '0x00000000 (0) 또는 <미설정>',
        '기본 0 (RPC/TCP)'
      ),
      makeDwordEntry(
        'audit_rpc_fw_smb1',
        'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        'SMB1',
        rawMap.srvSmb1,
        '0x00000000 (0) 또는 <미설정>',
        '기본 미사용'
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
              ? 'Rule Absent (삭제됨)'
              : '<미측정>',
        expectedDefaultDisplay: 'Rule Absent (원복 시 삭제)',
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
      guest501Disabled:
        typeof status.guestAccountEnabled === 'boolean' ? (status.guestAccountEnabled ? 0 : 1) : null,
      seDenyNetworkLogon:
        typeof status.guestNetworkLogonDenied === 'boolean'
          ? status.guestNetworkLogonDenied
            ? '*S-1-5-32-546,*S-1-5-7'
            : '(Guest 제외됨)'
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
      ahbiFw445:
        typeof status.ahbiFirewallRulePresent === 'boolean'
          ? status.ahbiFirewallRulePresent
            ? 1
            : 0
          : null,
    },
    'snapshot_derived',
    '정책 상태 역산 값',
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
      sourceLabel: 'USB 호스트 실측 레지스트리',
    };
  }
  return rawRegistryRecordToSnapshot(
    snap.hostName,
    {
      srvRequireSig: snap.smbServerSigningRequired ? 1 : 0,
      srvEnableSig: 1,
      cliRequireSig: snap.smbServerSigningRequired ? 1 : 0,
      cliEnableSig: 1,
      cliGuestSvc: snap.allowInsecureGuestAuth ? 1 : 0,
      cliGuestPol: snap.allowInsecureGuestAuth ? 1 : 0,
      guest501Disabled:
        typeof snap.guestAccountEnabled === 'boolean' ? (snap.guestAccountEnabled ? 0 : 1) : null,
      seDenyNetworkLogon:
        typeof snap.guestNetworkLogonDenied === 'boolean'
          ? snap.guestNetworkLogonDenied
            ? '*S-1-5-32-546,*S-1-5-7'
            : '(Guest 제외됨)'
          : null,
      limitBlankPwd:
        typeof snap.limitBlankPasswordUse === 'boolean' ? (snap.limitBlankPasswordUse ? 1 : 0) : null,
      everyAnon: snap.allowInsecureGuestAuth ? 1 : 0,
      restrictAnon:
        typeof snap.restrictAnonymous === 'boolean' ? (snap.restrictAnonymous ? 1 : 0) : null,
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
      srvSmb1: snap.osBuild < 10240 ? 1 : 0,
      ahbiFw445: typeof snap.firewall445Allowed === 'boolean' ? (snap.firewall445Allowed ? 1 : 0) : null,
    },
    isPreset ? 'preset_reference' : 'snapshot_derived',
    isPreset ? '권장 기준 프리셋 기대값' : 'USB 스냅샷 역산 추정값',
    snap.capturedAt ? formatSnapshotTimestamp(snap.capturedAt) : formatSnapshotTimestamp(new Date().toISOString()),
    snap.sourceIp ? { targetIp: snap.sourceIp } : undefined
  );
}

const EXPERT_POLICY_ORDER: Array<{ id: string; index: number; category: string; label: string }> = [
  { id: 'audit_smb_server_signing', index: 1, category: 'SMB 서명', label: 'SMB 서버 보안 서명 강제' },
  { id: 'audit_smb_client_signing', index: 2, category: 'SMB 서명', label: 'SMB 클라이언트 보안 서명 강제' },
  { id: 'audit_insecure_guest_auth', index: 3, category: '게스트 제한', label: '비인증 게스트 로그온 차단' },
  { id: 'audit_guest_account_501', index: 4, category: '게스트 제한', label: '내장 Guest 계정 (SID *-501) 비활성' },
  { id: 'audit_se_deny_guest_logon', index: 5, category: '게스트 제한', label: '로컬 보안 정책 Guest 네트워크 거부' },
  { id: 'audit_lsa_blank_password', index: 6, category: 'LSA 보안', label: 'LSA 빈 암호 네트워크 로그온 제한' },
  { id: 'audit_lsa_anonymous_null', index: 7, category: 'LSA 보안', label: 'LSA 익명 · Null 세션 차단' },
  { id: 'audit_ntlm_level', index: 8, category: 'NTLM 인증', label: 'NTLM 인증 협상 수준 (NTLMv2)' },
  { id: 'audit_uac_token_filter', index: 9, category: 'UAC 원격 보호', label: 'UAC 원격 토큰 필터 보호' },
  { id: 'audit_rpc_fw_smb1', index: 10, category: 'RPC · 방화벽 · SMBv1', label: '프린터 RPC · 임시 방화벽 · SMBv1 정리' },
];

function computeRawEntrySubStatus(
  localEntry: RawRegistryEntry | undefined,
  hostEntry: RawRegistryEntry | undefined,
  policyComparison?: HostPolicyComparison
): HostDiscrepancyLevel {
  if (!hostEntry || hostEntry.displayValue === '<미측정>') {
    return 'unmeasured';
  }
  if (!localEntry || localEntry.displayValue === '<미측정>') {
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

  return EXPERT_POLICY_ORDER.map((meta) => {
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
        localDisplayValue: l ? l.displayValue : '<미측정>',
        hostDisplayValue: h ? h.displayValue : '<미측정>',
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
        ? '원시값 충돌'
        : overallStatus === 'warning'
          ? '원시값 차이'
          : overallStatus === 'unmeasured'
            ? '호스트 미측정'
            : '원시값 일치');

    const note =
      auditItem?.hostComparison?.discrepancyDetail ||
      (overallStatus === 'aligned'
        ? '로컬 PC와 대상 호스트의 해당 레지스트리 원시값이 일치합니다.'
        : '레지스트리 키 원시값 차이가 확인되었습니다.');

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
    `[AhBiShare OneClick 전문가 비교 보기 - 10대 보안 정책 원시 레지스트리 대조]`,
    `로컬 PC: ${localRaw.hostName} (${localRaw.sourceLabel} · ${localRaw.fetchedAt})`,
    `대상 호스트: ${hostRaw.hostName}${hostRaw.targetIp ? ` (${hostRaw.targetIp})` : ''} (${hostRaw.sourceLabel} · ${hostRaw.fetchedAt})`,
    ...(hostRaw.remoteRpcNote ? [`원격 조회 참고: ${hostRaw.remoteRpcNote}`] : []),
    '',
  ];

  for (const row of rows) {
    lines.push(`${String(row.index).padStart(2, '0')}. [${row.statusBadgeLabel}] ${row.label}`);
    for (const sub of row.subRows) {
      lines.push(
        `   - ${sub.registryPath}\\${sub.valueName} (${sub.valueType}): 로컬=${sub.localDisplayValue} | 호스트=${sub.hostDisplayValue} | 기본=${sub.expectedDefaultDisplay}`
      );
    }
  }
  return lines.join('\n');
}


