import {
  HostPolicySnapshot,
  OsNetworkPolicyStatus,
  PolicyDiffItem,
  PolicyPatchMode,
  RebootJudgment,
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
}

export function classifyFailureDiagnostics(errorText?: string): ClientFailureDiagnostic | null {
  const raw = (errorText || '').trim();
  if (!raw) return null;

  if (/\b1272\b|\b384\b|0x80070035|게스트|guest/i.test(raw)) {
    return {
      code: '0x80070035 / 1272',
      title: 'Win 11 24H2~26H2 비인증 게스트·SMB 서명 차단',
      detail: '별도 Windows 업데이트는 필요 없으며, 호스트·클라이언트 양단에서 [안전 호환 패치] 또는 [보안 계정 모드] 전환으로 즉시 해결됩니다.',
      needsOsPatchHint: true,
      actionLabel: '매트릭스 호환 패치로 이동',
    };
  }
  if (/\b1326\b|\b86\b|\b5\b|액세스|거부|로그온|암호/i.test(raw)) {
    return {
      code: 'Error 5 / 1326',
      title: '계정 인증 실패 · UAC 원격 토큰 또는 MSA/PIN 캐시 불일치',
      detail: '호스트가 MS 계정·PIN 로그인 전용이거나 로컬 관리자 원격 접속(오류 5)이 막힌 경우입니다. 전용 보안 계정 사용 또는 UAC 원격 토큰 필터 활성화를 확인하세요.',
      needsOsPatchHint: true,
      actionLabel: '매트릭스 UAC·PIN 진단 열기',
    };
  }
  if (/\b53\b|\b67\b|네트워크 경로|timeout|445/i.test(raw)) {
    return {
      code: 'Error 53 / TCP 445',
      title: '네트워크 경로 차단 또는 구형 SMBv1 장비 미지원',
      detail: '호스트 방화벽·공용(Public) 프로필 차단, 또는 구형 NAS·복합기라면 OS 매트릭스의 [SMBv1 클라이언트 기능 설치]가 필요할 수 있습니다.',
      needsOsPatchHint: true,
      actionLabel: '매트릭스 별도 기능·SMBv1 확인',
    };
  }
  if (/\b1219\b|다중 연결|multiple connections/i.test(raw)) {
    return {
      code: 'Error 1219',
      title: '동일 서버에 다른 사용자 세션이 이미 열려 있음',
      detail: '별도 OS 패치는 불필요합니다. 열려 있는 탐색기 창을 닫거나 [연결 해제 / 보안 원복]으로 기존 SMB 세션을 정리한 뒤 다시 연결하세요.',
      needsOsPatchHint: false,
      actionLabel: 'OS 매트릭스 보기',
    };
  }
  if (/\b85\b|이미 사용|already in use/i.test(raw)) {
    return {
      code: 'Error 85',
      title: '선택한 드라이브 문자가 이미 할당됨',
      detail: '별도 OS 패치는 불필요합니다. 드라이브 문자를 Y:, X: 등 다른 문자로 변경해 다시 연결하세요.',
      needsOsPatchHint: false,
      actionLabel: 'OS 매트릭스 보기',
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
    description: '게스트·서명 완화 + 프린터 RPC Named Pipe 호환이 열린 메인 호스트 기준과 현재 PC를 즉시 비교합니다.',
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
      capturedAt: '',
    },
  },
  {
    id: '__preset_file_only_compat__',
    label: '일반 파일 공유 호스트 기준 (Win 10~11)',
    description: '비서명·무비밀번호 공유가 개방된 일반 호스트 PC 기준과 현재 PC의 SMB/게스트/프로필 불일치를 진단합니다.',
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
      capturedAt: '',
    },
  },
];

export function toHostPolicySnapshot(hostName: string, status: OsNetworkPolicyStatus): HostPolicySnapshot {
  return {
    hostName: hostName.trim() || 'MAIN-HOST-PC',
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
    if (row.status !== 'match' && row.actionTarget === 'local' && row.recommendedPatch) {
      needed.add(row.recommendedPatch);
    }
  }
  return Array.from(needed).sort((a, b) => {
    const ia = PATCH_EXECUTION_ORDER.indexOf(a);
    const ib = PATCH_EXECUTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
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
