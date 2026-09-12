import { TabState } from '../types';

export function generateMarkdownReport(state: TabState): string {
  const dateStr = new Date(state.lastScanned || Date.now()).toUTCString();
  const secrets = state.secrets || [];
  const messages = state.messages || [];
  const routes = state.routes || [];
  const prototypeEvents = state.prototypeEvents || [];

  const criticalCount = secrets.filter(s => s.severity === 'CRITICAL').length +
                        messages.filter(m => m.risk === 'CRITICAL').length +
                        prototypeEvents.length;
  const highCount = secrets.filter(s => s.severity === 'HIGH').length +
                    messages.filter(m => m.risk === 'HIGH').length;
  const mediumCount = secrets.filter(s => s.severity === 'MEDIUM').length +
                      messages.filter(m => m.risk === 'MEDIUM').length;

  let md = `# StateHunter Security Audit Report\n\n`;
  md += `**Target URL:** \`${state.url || 'Unknown'}\`  \n`;
  md += `**Page Title:** ${state.title || 'N/A'}  \n`;
  md += `**Timestamp:** ${dateStr}  \n`;
  md += `**Client Framework:** ${state.frameworkDetected || 'Generic SPA / SSR'}  \n\n`;

  // Policy & Safe Harbor
  const sec = state.wellKnown?.securityTxt;
  if (sec) {
    md += `> [!NOTE]\n`;
    md += `> **Vulnerability Disclosure Policy (RFC 9116):**  \n`;
    if (sec.policyUrl) md += `> - **Policy:** [${sec.policyUrl}](${sec.policyUrl})  \n`;
    if (sec.contacts && sec.contacts.length > 0) md += `> - **Contact:** ${sec.contacts.join(', ')}  \n`;
    if (sec.canonical) md += `> - **Canonical:** ${sec.canonical}  \n`;
    md += `\n`;
  }

  md += `## 1. Executive Summary\n\n`;
  md += `| Severity | Finding Count |\n`;
  md += `| :--- | :---: |\n`;
  md += `| 🔴 **CRITICAL** | **${criticalCount}** |\n`;
  md += `| 🟠 **HIGH** | **${highCount}** |\n`;
  md += `| 🟡 **MEDIUM** | **${mediumCount}** |\n`;
  md += `| ℹ️ **Discovered Routes** | **${routes.length}** |\n`;
  md += `| 📨 **Observed postMessages** | **${messages.length}** |\n\n`;

  // Scope & Rules of Engagement
  let origin = '';
  try {
    origin = new URL(state.url).origin;
  } catch {}
  const inScope = new Set<string>();
  if (state.customInScope && state.customInScope.length > 0) {
    for (const s of state.customInScope) inScope.add(s);
  } else if (origin) {
    inScope.add(origin);
  }

  const exclusions = new Set<string>(['/logout', '/delete', '/billing']);
  if (state.customExclusions) {
    for (const ce of state.customExclusions) exclusions.add(ce);
  }
  md += `### Rules of Engagement & Scope Boundaries\n`;
  md += `**Authorized In-Scope Targets:**\n`;
  for (const target of Array.from(inScope)) {
    md += `- \`${target}\`\n`;
  }
  md += `\n**Designated Excluded Paths:**\n`;
  for (const exp of Array.from(exclusions)) {
    md += `- \`${exp}\`\n`;
  }
  md += `\n`;

  // Secrets Section
  md += `## 2. In-Memory & Storage Secret Findings\n\n`;
  if (state.secrets.length === 0) {
    md += `*No high-entropy credentials or sensitive tokens identified in client memory/storage.*\n\n`;
  } else {
    md += `| Severity | Type | Location | Key Name | Value Preview |\n`;
    md += `| :---: | :--- | :--- | :--- | :--- |\n`;
    for (const secItem of state.secrets) {
      md += `| ${secItem.severity} | \`${secItem.type}\` | \`${secItem.location}\` | \`${secItem.keyName}\` | \`${secItem.valueSnippet}\` |\n`;
    }
    md += `\n`;
  }

  // postMessage Section
  md += `## 3. Cross-Document Messaging (postMessage) Audit\n\n`;
  const riskyMessages = state.messages.filter(m => m.risk === 'CRITICAL' || m.risk === 'HIGH' || m.risk === 'MEDIUM');
  if (riskyMessages.length === 0) {
    md += `*No unvalidated or risky postMessage handlers observed.*\n\n`;
  } else {
    for (const msg of riskyMessages) {
      md += `### [${msg.risk}] ${msg.direction.toUpperCase()} - Origin: \`${msg.origin}\`\n`;
      md += `- **Risk Description:** ${msg.riskReason}\n`;
      md += `- **Origin Validated:** ${msg.hasOriginCheck ? 'Yes' : '**NO**'}\n`;
      if (msg.targetOrigin) md += `- **Target Origin:** \`${msg.targetOrigin}\`\n`;
      md += `- **Payload Preview:** \`${msg.payloadSnippet}\`\n`;
      if (msg.listenerSource) {
        md += `\n**Listener Source:**\n\`\`\`javascript\n${msg.listenerSource.slice(0, 400)}\n\`\`\`\n`;
      }
      md += `\n---\n\n`;
    }
  }

  // SPA Routes Section
  md += `## 4. De-Obfuscated SPA Route Manifest\n\n`;
  if (state.routes.length === 0) {
    md += `*No framework route manifests extracted.*\n\n`;
  } else {
    const adminRoutes = state.routes.filter(r => r.type === 'admin');
    const apiRoutes = state.routes.filter(r => r.type === 'api');
    const otherRoutes = state.routes.filter(r => r.type !== 'admin' && r.type !== 'api');

    if (adminRoutes.length > 0) {
      md += `### Administrative & Internal Routes\n`;
      for (const r of adminRoutes) md += `- \`${r.path}\` *(Source: ${r.source})*\n`;
      md += `\n`;
    }

    if (apiRoutes.length > 0) {
      md += `### API Endpoints\n`;
      for (const r of apiRoutes) md += `- \`${r.path}\` *(Source: ${r.source})*\n`;
      md += `\n`;
    }

    if (otherRoutes.length > 0) {
      md += `### Client Routes (${otherRoutes.length} total)\n`;
      for (const r of otherRoutes.slice(0, 50)) md += `- \`${r.path}\`\n`;
      if (otherRoutes.length > 50) md += `*...and ${otherRoutes.length - 50} more routes.*  \n`;
      md += `\n`;
    }
  }

  // Robots.txt Disallowed Directives
  if (state.wellKnown?.robotsDisallow && state.wellKnown.robotsDisallow.length > 0) {
    md += `## 5. Discovered robots.txt Directives\n\n`;
    md += `The target publishes ${state.wellKnown.robotsDisallow.length} \`Disallow:\` rules:\n`;
    for (const rob of state.wellKnown.robotsDisallow.slice(0, 30)) {
      md += `- \`${rob}\`\n`;
    }
    if (state.wellKnown.robotsDisallow.length > 30) {
      md += `*...and ${state.wellKnown.robotsDisallow.length - 30} more paths.*\n`;
    }
    md += `\n`;
  }

  // Prototype Pollution Section
  if (state.prototypeEvents.length > 0) {
    md += `## 6. Prototype Pollution Events\n\n`;
    for (const pp of state.prototypeEvents) {
      md += `- **Property:** \`${pp.property}\` (Value: \`${pp.value}\`)\n`;
      md += `  - Stack: \`${pp.stackTrace.slice(0, 150)}\`\n`;
    }
    md += `\n`;
  }

  md += `\n*Generated with StateHunter Chrome Extension for AuditGuard Security Framework.*\n`;
  return md;
}
