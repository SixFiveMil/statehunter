import { describe, it, expect } from 'vitest';
import { analyzeListenerOriginCheck, auditIncomingMessage, auditOutgoingMessage } from '../src/modules/postmessage_tracker';

describe('analyzeListenerOriginCheck', () => {
  it('identifies missing origin check with dangerous sink as CRITICAL', () => {
    const fn = `
      function(e) {
        document.getElementById('content').innerHTML = e.data.html;
      }
    `;
    const result = analyzeListenerOriginCheck(fn);
    expect(result.hasOriginCheck).toBe(false);
    expect(result.hasDangerousSink).toBe(true);
  });

  it('identifies weak origin check (.includes or .indexOf)', () => {
    const fn = `
      function(e) {
        if (e.origin.indexOf('trusted.com') !== -1) {
          handleAction(e.data);
        }
      }
    `;
    const result = analyzeListenerOriginCheck(fn);
    expect(result.hasOriginCheck).toBe(true);
    expect(result.isWeakCheck).toBe(true);
  });

  it('identifies strict origin check', () => {
    const fn = `
      function(e) {
        if (e.origin !== 'https://app.corp.internal') return;
        console.log(e.data);
      }
    `;
    const result = analyzeListenerOriginCheck(fn);
    expect(result.hasOriginCheck).toBe(true);
    expect(result.isWeakCheck).toBe(false);
  });
});

describe('auditIncomingMessage', () => {
  it('flags incoming message without origin check to dangerous sink as CRITICAL', () => {
    const listenerSource = 'function(e) { eval(e.data); }';
    const audit = auditIncomingMessage('https://attacker.com', { command: 'run' }, listenerSource);
    expect(audit.risk).toBe('CRITICAL');
    expect(audit.hasOriginCheck).toBe(false);
  });

  it('flags incoming message without origin check as HIGH', () => {
    const listenerSource = 'function(e) { storeData(e.data); }';
    const audit = auditIncomingMessage('https://attacker.com', { user: 'bob' }, listenerSource);
    expect(audit.risk).toBe('HIGH');
    expect(audit.hasOriginCheck).toBe(false);
  });

  it('marks validated origin message as LOW', () => {
    const listenerSource = 'function(e) { if (e.origin === "https://corp.com") { store(e.data); } }';
    const audit = auditIncomingMessage('https://corp.com', { user: 'bob' }, listenerSource);
    expect(audit.risk).toBe('LOW');
    expect(audit.hasOriginCheck).toBe(true);
  });
});

describe('auditOutgoingMessage', () => {
  it('flags outgoing sensitive token to wildcard targetOrigin "*" as CRITICAL', () => {
    const audit = auditOutgoingMessage('*', { token: 'eyJhbGciOi...', secret: 'supersecret' });
    expect(audit.risk).toBe('CRITICAL');
    expect(audit.hasOriginCheck).toBe(false);
  });

  it('flags non-sensitive message to wildcard targetOrigin "*" as MEDIUM', () => {
    const audit = auditOutgoingMessage('*', { status: 'ready' });
    expect(audit.risk).toBe('MEDIUM');
  });

  it('marks specific targetOrigin as LOW risk', () => {
    const audit = auditOutgoingMessage('https://api.partner.com', { status: 'ready' });
    expect(audit.risk).toBe('LOW');
    expect(audit.hasOriginCheck).toBe(true);
  });
});
