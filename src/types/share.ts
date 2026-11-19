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
  | 'legacy_bridge_rollback';

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
  lmCompatibilityLevel: number | null;
  ntlmRestrictOutbound: number | null;
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
}

export interface LegacyRollbackSnapshot {
  capturedAt: string;
  hostName: string;
  smbServerSigningRequired: boolean;
  smbClientSigningRequired: boolean;
  allowInsecureGuestAuth: boolean;
  enableInsecureGuestLogons?: boolean;
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
  capturedAt: string;
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
  lastClientTarget?: PortableLastClientTarget;
}

export interface PortableStorageStatus {
  supported: boolean;
  mode: 'portable-exe' | 'packaged-exe' | 'dev-fs' | 'web-preview';
  directory: string;
  fileName: string;
  filePath: string;
  writable: boolean;
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

