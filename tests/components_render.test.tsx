import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from '../src/components/Header';
import { OverviewTab } from '../src/components/OverviewTab';
import { RoutesTab } from '../src/components/RoutesTab';
import { ScopeConfigTab } from '../src/components/ScopeConfigTab';
import { SecretsTab } from '../src/components/SecretsTab';
import { MessagesTab } from '../src/components/MessagesTab';
import { TabState } from '../src/types';

const mockState: TabState = {
  tabId: 1,
  url: 'http://localhost:8080/storage_leak.html',
  title: 'Storage Leak Test',
  routes: [
    { id: '1', path: '/admin/dashboard', source: 'nextjs_manifest', type: 'admin', timestamp: 123 },
    { id: '2', path: '/logout', source: 'nextjs_manifest', type: 'standard', timestamp: 124 },
  ],
  messages: [
    {
      id: 'm1',
      direction: 'incoming',
      origin: 'http://localhost:8080',
      payloadSnippet: '{}',
      risk: 'CRITICAL',
      riskReason: 'No origin check',
      hasOriginCheck: false,
      timestamp: 123
    }
  ],
  secrets: [
    {
      id: 's1',
      type: 'aws_key',
      keyName: 'access_key',
      valueSnippet: 'AKIAIOSFODNN7EXAMPLE',
      location: 'localStorage',
      severity: 'CRITICAL',
      timestamp: 123
    }
  ],
  prototypeEvents: [],
  storage: {
    localStorage: { 'aws_backup_credentials': '{"access_key":"AKIAIOSFODNN7EXAMPLE"}' },
    sessionStorage: {},
    decodedJwts: {}
  },
  lastScanned: Date.now()
};

const emptyState: TabState = {
  tabId: 0,
  url: '',
  title: '',
  routes: [],
  messages: [],
  secrets: [],
  prototypeEvents: [],
  storage: {
    localStorage: {},
    sessionStorage: {},
    decodedJwts: {}
  },
  lastScanned: Date.now()
};

describe('Component Rendering', () => {
  it('renders Header with empty state and populated state', () => {
    expect(() => renderToString(
      <Header state={emptyState} onRescan={() => {}} onClear={() => {}} />
    )).not.toThrow();

    expect(() => renderToString(
      <Header
        state={mockState}
        customExclusions={['/logout', '/delete']}
        customInScope={['http://localhost:8080']}
        onRescan={() => {}}
        onClear={() => {}}
      />
    )).not.toThrow();
  });

  it('renders OverviewTab with empty and mock state', () => {
    expect(() => renderToString(
      <OverviewTab state={emptyState} onNavigateTab={() => {}} />
    )).not.toThrow();

    expect(() => renderToString(
      <OverviewTab state={mockState} onNavigateTab={() => {}} />
    )).not.toThrow();
  });

  it('renders RoutesTab with empty and mock state and custom exclusions', () => {
    expect(() => renderToString(
      <RoutesTab routes={[]} targetUrl="" />
    )).not.toThrow();

    expect(() => renderToString(
      <RoutesTab
        routes={mockState.routes}
        targetUrl={mockState.url}
        customExclusions={['/logout']}
        customInScope={['http://localhost:8080']}
      />
    )).not.toThrow();
  });

  it('renders ScopeConfigTab with empty and mock state', () => {
    expect(() => renderToString(
      <ScopeConfigTab
        state={emptyState}
        customExclusions={['/logout']}
        customInScope={[]}
        onUpdateExclusions={() => {}}
        onUpdateInScope={() => {}}
        onRefreshWellKnown={() => {}}
      />
    )).not.toThrow();

    expect(() => renderToString(
      <ScopeConfigTab
        state={mockState}
        customExclusions={['/logout', '/delete']}
        customInScope={['http://localhost:8080']}
        onUpdateExclusions={() => {}}
        onUpdateInScope={() => {}}
        onRefreshWellKnown={() => {}}
      />
    )).not.toThrow();
  });

  it('renders SecretsTab and MessagesTab', () => {
    expect(() => renderToString(<SecretsTab state={emptyState} />)).not.toThrow();
    expect(() => renderToString(<SecretsTab state={mockState} />)).not.toThrow();

    expect(() => renderToString(<MessagesTab messages={[]} />)).not.toThrow();
    expect(() => renderToString(<MessagesTab messages={mockState.messages} />)).not.toThrow();
  });

  it('safely handles partially undefined TabState without throwing', () => {
    const brokenState: any = {
      tabId: 1,
      url: 'http://localhost:8080',
      title: 'Partial State'
      // secrets, routes, messages, storage, prototypeEvents intentionally omitted
    };

    expect(() => renderToString(<OverviewTab state={brokenState} onNavigateTab={() => {}} />)).not.toThrow();
    expect(() => renderToString(<SecretsTab state={brokenState} />)).not.toThrow();
    expect(() => renderToString(<RoutesTab routes={brokenState.routes} targetUrl={brokenState.url} />)).not.toThrow();
    expect(() => renderToString(
      <ScopeConfigTab
        state={brokenState}
        customExclusions={undefined as any}
        customInScope={undefined as any}
        onUpdateExclusions={() => {}}
        onUpdateInScope={() => {}}
        onRefreshWellKnown={() => {}}
      />
    )).not.toThrow();
  });
});
