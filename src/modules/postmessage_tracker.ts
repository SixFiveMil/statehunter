import { PostMessageAudit, Severity } from '../types';

export function analyzeListenerOriginCheck(fnSource: string): {
  hasOriginCheck: boolean;
  isWeakCheck: boolean;
  hasDangerousSink: boolean;
  details: string;
} {
  if (!fnSource || typeof fnSource !== 'string') {
    return { hasOriginCheck: false, isWeakCheck: false, hasDangerousSink: false, details: 'Unknown listener function' };
  }

  const cleanSource = fnSource.replace(/\s+/g, ' ');

  // Look for references to origin (e.g. e.origin, event.origin)
  const hasOriginRef = /(?:event|e|\w+)\.origin\b/.test(cleanSource);

  // Look for dangerous sinks
  const dangerousSinkRegex = /\b(?:innerHTML|outerHTML|document\.write|eval\s*\(|location\.href\s*=|location\s*=|window\.location\s*=|new\s+Function\s*\()/;
  const hasDangerousSink = dangerousSinkRegex.test(cleanSource);

  // Look for weak checks like .indexOf(), .includes(), or endsWith without protocol
  const weakCheckRegex = /(?:\.origin\s*\.\s*(?:indexOf|includes|search)\s*\(|\.origin\s*\.\s*endsWith\s*\(['"][a-zA-Z0-9_\-\.]+['"]\))/;
  const isWeakCheck = weakCheckRegex.test(cleanSource);

  let details = 'Standard listener';
  if (!hasOriginRef) {
    details = 'No origin verification found in handler source code.';
    if (hasDangerousSink) {
      details += ' Handler references dangerous DOM sinks (innerHTML, eval, or location redirect).';
    }
  } else if (isWeakCheck) {
    details = 'Weak origin check detected (uses .indexOf, .includes, or loose match vulnerable to origin spoofing).';
  } else {
    details = 'Origin check detected (e.g. equality comparison).';
  }

  return {
    hasOriginCheck: hasOriginRef,
    isWeakCheck,
    hasDangerousSink,
    details
  };
}

export function auditIncomingMessage(
  origin: string,
  data: any,
  listenerSource?: string,
  stackTrace?: string
): PostMessageAudit {
  let risk: Severity = 'INFO';
  let riskReason = 'Message received from origin: ' + origin;
  let hasOriginCheck = false;

  let payloadSnippet = '';
  try {
    payloadSnippet = typeof data === 'object' ? JSON.stringify(data).slice(0, 150) : String(data).slice(0, 150);
  } catch {
    payloadSnippet = '[Non-serializable payload]';
  }

  if (listenerSource) {
    const analysis = analyzeListenerOriginCheck(listenerSource);
    hasOriginCheck = analysis.hasOriginCheck && !analysis.isWeakCheck;

    if (!analysis.hasOriginCheck && analysis.hasDangerousSink) {
      risk = 'CRITICAL';
      riskReason = 'Listener processes untrusted cross-origin message with NO origin validation and sinks data into dangerous DOM API!';
    } else if (!analysis.hasOriginCheck) {
      risk = 'HIGH';
      riskReason = 'Listener does not validate event.origin. Any external site or iframe can trigger this logic.';
    } else if (analysis.isWeakCheck) {
      risk = 'MEDIUM';
      riskReason = 'Listener uses weak/bypassable origin matching (.includes, .indexOf) susceptible to attacker domain prefixing.';
    } else {
      risk = 'LOW';
      riskReason = 'Listener contains origin validation.';
    }
  } else {
    // If no listener source is available (e.g. anonymous or native), flag external origins
    if (typeof window !== 'undefined' && window.location && origin !== window.location.origin && origin !== 'null' && origin !== '') {
      risk = 'MEDIUM';
      riskReason = 'Cross-origin message received from external origin: ' + origin;
    }
  }

  return {
    id: `pm_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    direction: 'incoming',
    origin,
    hasOriginCheck,
    risk,
    riskReason,
    payloadSnippet,
    fullPayload: data,
    stackTrace,
    listenerSource
  };
}

export function auditOutgoingMessage(
  targetOrigin: string,
  data: any,
  stackTrace?: string,
  senderOrigin?: string
): PostMessageAudit {
  let risk: Severity = 'INFO';
  let riskReason = `Message dispatched to target origin: ${targetOrigin}`;

  let payloadSnippet = '';
  try {
    payloadSnippet = typeof data === 'object' ? JSON.stringify(data).slice(0, 150) : String(data).slice(0, 150);
  } catch {
    payloadSnippet = '[Non-serializable payload]';
  }

  const hasSensitiveData = /(?:token|auth|key|secret|password|bearer|jwt)/i.test(payloadSnippet);

  if (targetOrigin === '*') {
    if (hasSensitiveData) {
      risk = 'CRITICAL';
      riskReason = 'Sensitive credentials/tokens dispatched with wildcard targetOrigin "*"! Any embedded iframe or window can intercept.';
    } else {
      risk = 'MEDIUM';
      riskReason = 'postMessage dispatched with wildcard targetOrigin "*". Untrusted frames can read this message.';
    }
  } else {
    risk = 'LOW';
    riskReason = `Message dispatched with strict targetOrigin (${targetOrigin}).`;
  }

  const origin = senderOrigin || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

  return {
    id: `pm_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    direction: 'outgoing',
    origin,
    targetOrigin,
    hasOriginCheck: targetOrigin !== '*',
    risk,
    riskReason,
    payloadSnippet,
    fullPayload: data,
    stackTrace
  };
}
