export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface RouteProbeResult {
  status?: number;
  statusText?: string;
  probing?: boolean;
  blocked?: boolean;
  blockReason?: string;
  error?: string;
  latencyMs?: number;
}

export interface ScopeCheckResult {
  allowed: boolean;
  inScope: boolean;
  excluded: boolean;
  reason?: string;
  matchedRule?: string;
}

export interface DiscoveredRoute {
  id: string;
  path: string;
  source: 'nextjs_manifest' | 'webpack_chunk' | 'runtime_router' | 'static_script';
  type: 'admin' | 'api' | 'dynamic' | 'standard';
  timestamp: number;
  probeStatus?: RouteProbeResult;
}

export interface PostMessageAudit {
  id: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  origin: string;
  targetOrigin?: string;
  hasOriginCheck: boolean;
  originValidationPattern?: string;
  risk: Severity;
  riskReason: string;
  payloadSnippet: string;
  fullPayload?: any;
  stackTrace?: string;
  listenerSource?: string;
}

export interface PostMessageDispatchPayload {
  targetOrigin: string;
  payload: any;
  targetFrameIndex?: number;
}

export interface SecretFinding {
  id: string;
  type: 'aws_key' | 'jwt' | 'google_api' | 'firebase' | 'stripe' | 'slack_webhook' | 'high_entropy' | 'sensitive_key';
  location: 'localStorage' | 'sessionStorage' | 'window_global' | 'next_data' | 'script';
  keyName: string;
  valueSnippet: string;
  entropy?: number;
  severity: Severity;
  details?: Record<string, any>;
  timestamp: number;
}

export interface DecodedJWT {
  header: Record<string, any>;
  payload: Record<string, any>;
  isExpired: boolean;
  expiresAt?: string;
  sensitiveClaims: string[];
}

export interface PrototypePollutionEvent {
  id: string;
  timestamp: number;
  property: string;
  value: string;
  stackTrace: string;
  severity: Severity;
}

export interface SecurityPolicyInfo {
  contacts: string[];
  policyUrl?: string;
  acknowledgmentsUrl?: string;
  canonical?: string;
  preferredLanguages?: string;
  expires?: string;
  rawText?: string;
}

export interface WellKnownRecon {
  securityTxt?: SecurityPolicyInfo;
  robotsDisallow: string[];
  robotsRaw?: string;
  fetchedAt?: number;
}

export interface TabState {
  tabId: number;
  url: string;
  title: string;
  frameworkDetected?: string;
  routes: DiscoveredRoute[];
  messages: PostMessageAudit[];
  secrets: SecretFinding[];
  prototypeEvents: PrototypePollutionEvent[];
  storage: {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    decodedJwts: Record<string, DecodedJWT>;
  };
  wellKnown?: WellKnownRecon;
  customExclusions?: string[];
  customInScope?: string[];
  lastScanned: number;
}
