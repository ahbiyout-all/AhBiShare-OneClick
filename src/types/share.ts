export type AppLocale = 'ko' | 'en';
export interface AppLocaleInfo {
  osLocale: string;
  detectedLocale: AppLocale;
  currentLocale: AppLocale;
}
export type RoleMode = 'host' | 'client';
export type AppSection = 'workspace' | 'matrix' | 'legacy' | 'logs' | 'rollback';
export type AuthMode = 'guest' | 'account';
export type SharePermission = 'full' | 'read';
export type StepStatus = 'idle' | 'running' | 'success' | 'error';

export type WindowsNetworkEra = 'win10' | 'win11_21_23' | 'win11_24h2' | 'win11_25_26h2';
export type LegacyTargetOs = 'win7' | 'win8_81';
export type LegacyDirection = 'modern_to_legacy' | 'legacy_to_modern' | 'bidirectional';
export type RebootRequirementLevel = 'none' | 'service_restart' | 'reboot_recommended' | 'reboot_required';
export type PolicyPatchMode =
  | 'safe_compat'
  | 'rpc_printer_compat'
  | 'deep_stack_reset'
  | 'strict_26h2_default'
  | 'rpc_printer_default'
  | 'enable_uac_token_filter'
  | 'disable_uac_token_filter'
  | 'enable_smbv1_client'
  | 'legacy_bridge_compat'
  | 'legacy_smb1_enable'
  | 'legacy_bridge_rollback'
  | 'kir_duplicate_sid_compat';

export interface HostConfig {
  folderPath: string;
  shareName: string;
  authMode: AuthMode;
  permission: SharePermission;
  username: string;
  password: string;
  ttlMinutes?: number;
  autoRevokeOnExpiry?: boolean;
}

export interface ActiveShare {
  shareName: string;
  folderPath: string;
  uncPath: string;
  authMode: AuthMode;
  permission: SharePermission;
  username?: string;
  createdAt: string;
  connectionCode: string;
  sourceHostName?: string;
  sourceIp?: string;
  updatedAt?: string;
  ttlMinutes?: number;
  expiresAt?: string;
  autoRevokeOnExpiry?: boolean;
  restoredPassword?: string;
  decryptionFailed?: boolean;
}

export interface DiscoveredPeer {
  hostName: string;
  ipAddress: string;
  latencyMs: number;
  smbPortOpen: boolean;
  availableShares: string[];
  authModeHint?: AuthMode | 'unknown';
  connectionCode?: string;
  shareCodes?: Record<string, string>;
  lastSeen: string;
}

export interface ClientTargetConfig {
  targetHost: string;
  targetHostName?: string;
  shareName: string;
  driveLetter: string;
  authMode: AuthMode;
  username: string;
  password: string;
  persistent: boolean;
}

export interface MountedDrive {
  driveLetter: string;
  uncPath: string;
  targetHost: string;
  shareName: string;
  authMode: AuthMode;
  username?: string;
  mountedAt: string;
  status: 'connected' | 'disconnected';
}

export interface PipelineStep {
  id: string;
  title: string;
  detail: string;
  status: StepStatus;
  durationMs?: number;
  output?: string;
  error?: string;
}

export interface ConnectionTokenPayload {
  v: number;
  hostName: string;
  ip: string;
  shareName: string;
  authMode: AuthMode;
  username?: string;
  password?: string;
  createdAt: string;
}

export interface LocalNetworkInfo {
  hostname: string;
  primaryIp: string;
  adapterName: string;
  subnetPrefix: string;
  isElectron: boolean;
  isAdmin: boolean;
  osProductName?: string;
  osDisplayVersion?: string;
  osBuild?: number;
  osEra?: WindowsNetworkEra;
}

export interface WindowsNetworkChangeItem {
  id: string;
  era: WindowsNetworkEra;
  versionLabel: string;
  buildRange: string;
  category:
    | 'smb_signing'
    | 'guest_auth'
    | 'ntlm'
    | 'name_resolution'
    | 'quic_encryption'
    | 'firewall_lsa'
    | 'rpc_printer'
    | 'os_update_feature';
  categoryLabel: string;
  title: string;
  defaultBehavior: string;
  sharingImpact: string;
  mitigationStrategy: string;
  affectedRegistryOrCmdlet: string;
  rebootLevel: RebootRequirementLevel;
  rebootNote: string;
}

export interface OsNetworkPolicyStatus {
  osProductName: string;
  osDisplayVersion: string;
  osBuild: number;
  osEra: WindowsNetworkEra;
  osEditionId?: string;
  osUbr?: number | null;
  recentHotfixIds?: string[];
  localAccountTokenFilterEnabled?: boolean;
  smb1ClientFeatureState?: 'Enabled' | 'Disabled' | 'Unknown';
  msaPinOnlyRisk?: boolean;
  networkProfile: string;
  smb1Enabled: boolean;
  smbServerSigningRequired: boolean;
  smbClientSigningRequired: boolean;
  allowInsecureGuestAuth: boolean;
  enableInsecureGuestLogons: boolean;
  guestNetworkLogonDenied?: boolean;
  limitBlankPasswordUse?: boolean;
  forceGuest?: boolean;
  minimumPasswordLength?: number | null;
  restrictNullSessAccess?: boolean;
  restrictAnonymous?: boolean;
  everyoneIncludesAnonymous?: boolean;
  guestAccountEnabled?: boolean;
  firewall445Allowed?: boolean;
  ahbiFirewallRulePresent?: boolean;
  lmCompatibilityLevel: number | null;
  ntlmRestrictOutbound: number | null;
  smbBlockNtlm?: boolean;
  smbRequireEncryption?: boolean;
  machineSidPrefix?: string;
  duplicateSidEvent6167Detected?: boolean;
  kirOverride1517186191?: number | null;
  netbiosEnabled: boolean;
  smbEncryptData: boolean;
  smbRejectUnencryptedAccess?: boolean;
  smb2Enabled?: boolean;
  smb1ServerEnabled?: boolean;
  lanmanServerRunning: boolean;
  lanmanWorkstationRunning: boolean;
  fdResPubRunning: boolean;
  rpcAuthnLevelPrivacyDisabled: boolean;
  rpcUseNamedPipeProtocol: boolean;
  rpcProtocols: number | null;
  pointAndPrintRelaxed: boolean;
  printSpoolerRunning: boolean;
  pendingRebootFlag: boolean;
  compatibilityScore: number;
  detectedIssues: string[];
  checkedAt: string;
  rawRegistrySnapshot?: RawSecurityRegistrySnapshot;
}

export interface LegacyRollbackSnapshot {
  capturedAt: string;
  hostName: string;
  smbServerSigningRequired: boolean;
  smbClientSigningRequired: boolean;
  allowInsecureGuestAuth: boolean;
  enableInsecureGuestLogons?: boolean;
  guestAccountEnabled?: boolean;
  guestNetworkLogonDenied?: boolean;
  localAccountTokenFilterEnabled?: boolean;
  smbEncryptData: boolean;
  smbRejectUnencryptedAccess: boolean;
  smb1Enabled: boolean;
  lmCompatibilityLevel: number | null;
}

export interface LegacyScriptOptions {
  targetOs: LegacyTargetOs;
  direction: LegacyDirection;
  includeGuestLogon: boolean;
  includeUacTokenFilter: boolean;
  includeDiscoveryServices: boolean;
  includeSmb1Protocol: boolean;
}

export interface LegacyGeneratedFile {
  name: string;
  label: string;
  kind: 'apply' | 'rollback';
  format: 'bat' | 'reg';
  content: string;
}

export interface LegacyScriptBundle {
  targetOs: LegacyTargetOs;
  riskLevel: 'safe_smb2' | 'elevated_smb1';
  folderName: string;
  files: LegacyGeneratedFile[];
}

export interface LegacyComparisonRow {
  id: string;
  category: 'protocol' | 'encryption' | 'auth' | 'discovery' | 'errors';
  categoryLabel: string;
  topic: string;
  win7Behavior: string;
  win8Behavior: string;
  win10_11Behavior: string;
  resolutionSummary: string;
}

export interface HostPolicySnapshot {
  hostName: string;
  sourceIp?: string;
  osProductName: string;
  osDisplayVersion: string;
  osBuild: number;
  osEra: WindowsNetworkEra;
  networkProfile: string;
  smbServerSigningRequired: boolean;
  allowInsecureGuestAuth: boolean;
  rpcAuthnLevelPrivacyDisabled: boolean;
  rpcUseNamedPipeProtocol: boolean;
  pointAndPrintRelaxed: boolean;
  lmCompatibilityLevel?: number | null;
  localAccountTokenFilterEnabled?: boolean;
  guestNetworkLogonDenied?: boolean;
  limitBlankPasswordUse?: boolean;
  forceGuest?: boolean;
  minimumPasswordLength?: number | null;
  restrictNullSessAccess?: boolean;
  restrictAnonymous?: boolean;
  guestAccountEnabled?: boolean;
  firewall445Allowed?: boolean;
  machineSidPrefix?: string;
  kirOverride1517186191?: number | null;
  capturedAt: string;
  rawRegistrySnapshot?: RawSecurityRegistrySnapshot;
}

export interface PendingHostPolicyTask {
  taskId: string;
  targetHostName: string;
  targetIp?: string;
  requestedByHostName: string;
  requestedByIp?: string;
  modes: PolicyPatchMode[];
  includeGuestUnlock: boolean;
  conflictLabels: string[];
  note?: string;
  createdAt: string;
}

export interface PolicyDiffItem {
  id: string;
  label: string;
  hostValue: string;
  clientValue: string;
  status: 'match' | 'warning' | 'conflict';
  impact: string;
  actionTarget?: 'local' | 'host' | 'both' | 'none';
  recommendedPatch?: PolicyPatchMode;
  recommendedPatchLabel?: string;
}

export interface RebootJudgment {
  level: RebootRequirementLevel;
  title: string;
  reason: string;
  serviceRestarted: boolean;
  restartedServices: string[];
  rebootRecommended: boolean;
  canRebootNow: boolean;
}

export interface PolicyApplyResult {
  success: boolean;
  mode: PolicyPatchMode;
  summary: string;
  appliedActions: string[];
  rebootJudgment: RebootJudgment;
  updatedPolicy: OsNetworkPolicyStatus;
}

export interface AutoAlignBatchResult {
  success: boolean;
  appliedModes: PolicyPatchMode[];
  failedModes: PolicyPatchMode[];
  summary: string;
  appliedActions: string[];
  rebootJudgment: RebootJudgment;
  updatedPolicy: OsNetworkPolicyStatus;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface PingHostResult {
  target: string;
  resolvedIp?: string;
  reachable: boolean;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  packetLossPct: number;
  smbPortOpen: boolean;
  detail: string;
  checkedAt: string;
}

export interface PortableEncryptedCredentials {
  encVersion: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface PortableHostShareEntry {
  sourceHostName: string;
  sourceIp: string;
  shareName: string;
  folderPath: string;
  uncPath: string;
  authMode: AuthMode;
  permission: SharePermission;
  username?: string;
  password?: string;
  encryptedCredentials?: PortableEncryptedCredentials;
  createdAt: string;
  updatedAt: string;
  ttlMinutes?: number;
  expiresAt?: string;
  autoRevokeOnExpiry?: boolean;
  connectionCode: string;
  decryptionFailed?: boolean;
}

export interface PortableLastClientTarget {
  targetHost: string;
  shareName: string;
  driveLetter: string;
  authMode: AuthMode;
  updatedAt: string;
}

export interface PortableShareDocument {
  schemaVersion: 1;
  updatedAt: string;
  shares: PortableHostShareEntry[];
  hostPolicies?: Record<string, HostPolicySnapshot>;
  pendingHostActions?: Record<string, PendingHostPolicyTask>;
  troubleshootTickets?: TroubleshootTicket[];
  lastClientTarget?: PortableLastClientTarget;
}

export interface PortableStorageStatus {
  supported: boolean;
  mode: 'portable-exe' | 'packaged-exe' | 'dev-fs' | 'web-preview';
  directory: string;
  fileName: string;
  filePath: string;
  writable: boolean;
  writeProtected?: boolean;
  hasExistingFile?: boolean;
  writeError?: string;
  corruptedRecovered?: boolean;
  corruptedBackupPath?: string;
  lastSyncedAt?: string;
}

export interface PortableLoadResult {
  success: boolean;
  document: PortableShareDocument;
  status: PortableStorageStatus;
}

export interface PortableSaveResult {
  success: boolean;
  document: PortableShareDocument;
  status: PortableStorageStatus;
}

export interface AppLogFileSummary {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface AppLogStatusInfo {
  success: boolean;
  supported: boolean;
  directory: string;
  currentFileName: string;
  currentFilePath: string;
  writable: boolean;
  writeProtected?: boolean;
  files: AppLogFileSummary[];
  recentLines: string[];
}

export interface LocationClientTargetEntry {
  targetHost: string;
  shareName: string;
  driveLetter: string;
  authMode: AuthMode;
  username?: string;
  password?: string;
  encryptedCredentials?: PortableEncryptedCredentials;
  persistent: boolean;
}

export interface LocationHostPreset {
  folderPath: string;
  shareName: string;
  authMode: AuthMode;
  permission: SharePermission;
  username: string;
  password: string;
  encryptedCredentials?: PortableEncryptedCredentials;
  ttlMinutes?: number;
  autoRevokeOnExpiry?: boolean;
}

export interface LocationNetworkHint {
  subnetPrefix: string;
  primaryIp: string;
  hostname: string;
  adapterName?: string;
}

export interface LocationProfileFile {
  schemaVersion: 1;
  profileId: string;
  locationName: string;
  description: string;
  networkHint: LocationNetworkHint;
  createdAt: string;
  updatedAt: string;
  hostPreset?: LocationHostPreset;
  savedShares: PortableHostShareEntry[];
  clientTargets: LocationClientTargetEntry[];
  preferredPatchMode?: PolicyPatchMode;
}

export interface LocationProfileSummary {
  profileId: string;
  locationName: string;
  description: string;
  networkHint: LocationNetworkHint;
  shareCount: number;
  clientTargetCount: number;
  preferredPatchMode?: PolicyPatchMode;
  createdAt: string;
  updatedAt: string;
  fileName: string;
}

export interface LocationBatchApplyItemResult {
  kind: 'share' | 'mount';
  label: string;
  success: boolean;
  message: string;
}

export interface LocationBatchApplyResult {
  success: boolean;
  appliedShares: number;
  failedShares: number;
  appliedMounts: number;
  failedMounts: number;
  summary: string;
  details: LocationBatchApplyItemResult[];
}

export type SecurityRollbackCheckStatus = 'restored' | 'partial' | 'relaxed' | 'unknown';
export type HostDiscrepancyLevel = 'aligned' | 'warning' | 'conflict' | 'unmeasured';

export interface HostPolicyComparison {
  status: HostDiscrepancyLevel;
  badgeLabel: string;
  expectedHostValue: string;
  discrepancyDetail: string;
}

export interface SecurityRollbackAuditItem {
  id: string;
  index: number;
  category: string;
  label: string;
  registryOrPolicy: string;
  currentValue: string;
  expectedDefault: string;
  status: SecurityRollbackCheckStatus;
  detail: string;
  remediationMode?: PolicyPatchMode;
  hostComparison?: HostPolicyComparison;
}

export interface SecurityRollbackAuditReport {
  verdict: 'fully_restored' | 'mostly_restored' | 'incomplete';
  headline: string;
  summary: string;
  passedCount: number;
  partialCount: number;
  failedCount: number;
  totalCount: number;
  activeShareCount: number;
  activeMountCount: number;
  recommendedModes: PolicyPatchMode[];
  hasResidualSharesOrMounts: boolean;
  hasAhbiFirewallRule: boolean;
  targetHostName?: string;
  targetDiscrepancyCount?: number;
  targetConflictCount?: number;
  evaluatedAt: string;
  items: SecurityRollbackAuditItem[];
}

export type RawRegistryValueKind = 'REG_DWORD' | 'REG_SZ' | 'SECEDIT' | 'SAM' | 'FIREWALL';

export type RawRegistrySourceType =
  | 'local_live'
  | 'remote_live_rpc'
  | 'usb_live_capture'
  | 'snapshot_derived'
  | 'preset_reference';

export interface RawRegistryEntry {
  policyId: string;
  registryPath: string;
  valueName: string;
  valueType: RawRegistryValueKind;
  rawValue: string | number | boolean | null;
  displayValue: string;
  expectedDefaultDisplay: string;
}

export interface RawSecurityRegistrySnapshot {
  hostName: string;
  targetIp?: string;
  sourceType: RawRegistrySourceType;
  sourceLabel: string;
  fetchedAt: string;
  remoteRpcNote?: string;
  entries: Record<string, RawRegistryEntry[]>;
}

export interface ExpertRegistrySubRow {
  id: string;
  registryPath: string;
  valueName: string;
  valueType: RawRegistryValueKind;
  localDisplayValue: string;
  hostDisplayValue: string;
  expectedDefaultDisplay: string;
  status: HostDiscrepancyLevel;
}

export interface ExpertRegistryPolicyRow {
  index: number;
  policyId: string;
  category: string;
  label: string;
  overallStatus: HostDiscrepancyLevel;
  statusBadgeLabel: string;
  note: string;
  subRows: ExpertRegistrySubRow[];
}

export interface ExpertRegistryFetchResult {
  localSnapshot: RawSecurityRegistrySnapshot;
  hostSnapshot: RawSecurityRegistrySnapshot;
  remoteRpcAttempted: boolean;
  remoteRpcSucceeded: boolean;
  remoteRpcNote?: string;
  fetchedAt: string;
}

export type LocationPreflightItemStatus = 'pass' | 'warning' | 'fail';

export interface LocationPreflightSubCheck {
  key: string;
  label: string;
  status: LocationPreflightItemStatus;
  detail: string;
}

export interface LocationPreflightItemResult {
  kind: 'environment' | 'share' | 'mount';
  index: number;
  label: string;
  targetDesc: string;
  status: LocationPreflightItemStatus;
  summary: string;
  canAutoProvisionFolder?: boolean;
  checks: LocationPreflightSubCheck[];
}

export interface LocationPreflightReport {
  profileId: string;
  locationName: string;
  checkedAt: string;
  overallStatus: LocationPreflightItemStatus;
  isAdmin: boolean;
  totalItems: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  hasBlockingErrors: boolean;
  items: LocationPreflightItemResult[];
}

export type ShareAuthProbeVerdict =
  | 'guest_allowed'
  | 'account_required'
  | 'client_guest_blocked'
  | 'host_guest_denied'
  | 'share_not_found'
  | 'existing_session_conflict'
  | 'smb_protocol_mismatch'
  | 'unreachable'
  | 'unknown';

export interface ShareAuthProbeResult {
  targetHost: string;
  shareName: string;
  targetUnc: string;
  verdict: ShareAuthProbeVerdict;
  recommendedAuthMode: AuthMode | null;
  win32Code: number | null;
  summary: string;
  detail: string;
  existingSessionMode?: AuthMode | null;
  probeMethod?: string;
  checkedAt: string;
}

export type SmartAuthAction = 'auto_switch' | 'recommend' | 'keep' | 'none';
export type SmartAuthConfidence = 'confirmed' | 'hint' | 'none';

export interface SmartAuthTargetInput {
  targetHost?: string;
  shareName?: string;
  uncPath?: string;
  currentAuthMode: AuthMode;
  hasTypedPassword?: boolean;
  autoSwitchEnabled?: boolean;
  suppressed?: boolean;
  hasValidAbshareToken?: boolean;
  forceProbe?: boolean;
  peers?: DiscoveredPeer[];
  savedLocationTargets?: LocationClientTargetEntry[];
  locationSavedShares?: PortableHostShareEntry[];
  locationHostPreset?: LocationHostPreset | null;
  portableShares?: PortableHostShareEntry[];
  activeShares?: ActiveShare[];
}

export interface SmartAuthDetectionResult {
  probe: ShareAuthProbeResult;
  recommendedAuthMode: AuthMode | null;
  action: SmartAuthAction;
  switchToMode: AuthMode | null;
  switchedFromMode: AuthMode | null;
  confidence: SmartAuthConfidence;
  reason: string;
  suggestedUsername?: string;
  suggestedPassword?: string;
  credentialSource?: string;
  fromCache?: boolean;
}

export type TroubleshootTicketStatus = 'open' | 'host_fixed' | 'client_fixed' | 'resolved';
export type TroubleshootStepStatus = 'pending' | 'completed' | 'skipped' | 'failed';
export type TroubleshootStepResolvedSource =
  | 'wizard'
  | 'matrix'
  | 'host_panel'
  | 'live_inspect'
  | 'share_retry'
  | 'mount_retry'
  | 'rollback';
export type TroubleshootExecutorId =
  | 'host_guest_unlock_and_reopen'
  | 'apply_safe_compat'
  | 'apply_legacy_bridge'
  | 'switch_to_account_mode'
  | 'clear_conflicting_sessions'
  | 'verify_port_445'
  | 'reassign_free_drive'
  | 'enable_smbv1_client'
  | 'retry_mount'
  | 'retry_host_share'
  | 'manual_check';

export interface TroubleshootWizardStep {
  stepId: string;
  side: 'host' | 'client';
  order: number;
  title: string;
  description: string;
  commandPreview?: string;
  executor: TroubleshootExecutorId;
  patchMode?: PolicyPatchMode;
  status: TroubleshootStepStatus;
  resolvedSource?: TroubleshootStepResolvedSource;
  requiresReboot?: boolean;
  lastAttemptAt?: string;
  lastMessage?: string;
}

export interface TroubleshootTicket {
  ticketId: string;
  schemaVersion: 1;
  originRole: RoleMode;
  originHostName: string;
  originIp: string;
  targetHostName: string;
  targetIp: string;
  shareName: string;
  folderPath?: string;
  driveLetter?: string;
  authMode: AuthMode;
  isLegacyOs?: boolean;
  errorCode: string;
  errorTitle: string;
  rawErrorSummary: string;
  recommendedSide: 'host' | 'client' | 'both';
  hostSteps: TroubleshootWizardStep[];
  clientSteps: TroubleshootWizardStep[];
  status: TroubleshootTicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedByHostName?: string;
}

export interface TroubleshootMatchResult {
  currentPcActionTickets: TroubleshootTicket[];
  waitingOtherPcTickets: TroubleshootTicket[];
  resolvedTickets: TroubleshootTicket[];
  primaryTicket: TroubleshootTicket | null;
  matchedSideMap: Record<string, 'host' | 'client' | 'both' | 'none'>;
}

export interface TroubleshootSyncSummary {
  changed: boolean;
  updatedTicketIds: string[];
  autoCompletedSteps: number;
  reopenedSteps: number;
  resolvedTicketIds: string[];
}

export type BackupTriggerType =
  | 'manual'
  | 'auto_before_delete'
  | 'auto_before_modify'
  | 'auto_before_reset'
  | 'auto_before_restore';

export interface BackupSnapshotCounts {
  shareCount: number;
  hostPolicyCount: number;
  pendingTaskCount: number;
  ticketCount: number;
  locationCount: number;
}

export interface BackupSnapshotSummary {
  backupId: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  trigger: BackupTriggerType;
  reason: string;
  createdByHostName: string;
  contentHash: string;
  sizeBytes: number;
  counts: BackupSnapshotCounts;
}

export interface BackupStoreStatus {
  success: boolean;
  directory: string;
  writable: boolean;
  writeProtected?: boolean;
  writeError?: string;
  maxSnapshots: number;
  snapshots: BackupSnapshotSummary[];
}

export interface CreateBackupResult {
  success: boolean;
  skippedDuplicate?: boolean;
  skippedEmpty?: boolean;
  directory: string;
  snapshot?: BackupSnapshotSummary;
  prunedCount?: number;
  writeProtected?: boolean;
  error?: string;
}

export interface RestoreBackupResult {
  success: boolean;
  restoredSnapshot?: BackupSnapshotSummary;
  safetyBackup?: BackupSnapshotSummary | null;
  portableDocument?: PortableShareDocument;
  portableStatus?: PortableStorageStatus;
  locationProfiles?: LocationProfileSummary[];
  writeProtected?: boolean;
  error?: string;
}

