# Chrome Web Store (CWS) Submission & Policy Guide

This document contains the exact disclosures, single-purpose descriptions, and permission justifications needed when submitting **StateHunter** to the **Google Chrome Web Store Developer Dashboard**.

---

## 1. Store Listing Details

### Extension Name
```text
StateHunter: SPA State & DOM Security Recon
```

### Summary (Max 132 characters)
```text
In-browser client-side runtime JS analysis, postMessage security auditing, SPA route de-obfuscation, and secret hunting in DevTools.
```

### Category
```text
Developer Tools
```

### Detailed Description
```markdown
StateHunter is a high-performance Chrome DevTools extension designed for application security engineers, penetration testers, and bug bounty researchers.

StateHunter activates strictly when DevTools is opened to perform real-time, client-side runtime JavaScript analysis, identify sensitive credential exposures in client storage, audit and replay postMessage event flows, de-obfuscate hidden Single Page Application (SPA) routes, and enforce strict client-side scope boundaries during security assessments.

KEY FEATURES:
• SPA Route De-Obfuscator & Live Reachability Prober: Uncovers hidden internal/admin routes from Next.js, Nuxt, Remix, and Webpack chunk manifests with built-in scope guardrails to block sensitive endpoints (/logout, /delete, /billing).
• postMessage Security Auditor: Hooks native message listeners to detect missing origin checks, flag cross-origin messages reaching dangerous DOM sinks (innerHTML, eval), and test handlers with an interactive replay console.
• In-Memory Secrets & Storage Auditor: Detects leaked credentials, AWS/Stripe API keys, Slack webhooks, and decoded JWT tokens with sensitive claims in localStorage, sessionStorage, and window globals.
• Prototype Pollution Detector: Traverses Object.prototype to detect runtime gadget pollution in client-side libraries.
• Well-Known Recon & Safe Harbor: Auto-extracts RFC 9116 security.txt policies and parses robots.txt directives into testing exclusions.
• Triage-Ready Reports: One-click export to formatted Markdown bug bounty reports and AuditGuard YAML.

PRIVACY & SAFETY FIRST:
• DevTools-Activated: Zero background code injection or monitoring when DevTools is closed.
• 100% Local Execution: Zero telemetry or phone-home servers. All data stays inside your browser's local memory and is never transmitted or sold.
• Zero Broadcast Leaks: Uses private DOM custom events to ensure inspected secrets are never broadcast to page scripts or iframes.
```

---

## 2. Privacy Practices Tab (CWS Dashboard)

### A. Single Purpose Field
> Enter the single, narrow purpose of your extension:

```text
StateHunter serves the single purpose of providing in-browser runtime JavaScript state inspection, Single Page Application (SPA) route de-obfuscation, postMessage event auditing, and local storage security analysis within the Chrome Developer Tools panel.
```

---

### B. Permission Justifications

Google requires developers to justify every permission declared in `manifest.json`. Use the exact justification copy below:

#### 1. Justification for `host_permissions` (`<all_urls>`)
```text
StateHunter is an application security auditing developer tool that operates inside Chrome DevTools. It requires host access to all URLs so that security engineers, penetration testers, and web developers can inspect and audit runtime JavaScript state, postMessage flows, and client-side storage on any web application or authorized testing target they open in Chrome DevTools. No network requests or code injections occur on any URL when Chrome DevTools is closed.
```

#### 2. Justification for `scripting`
```text
The 'scripting' permission is used strictly to dynamically inject the security auditing probe (main_probe.js) and content bridge (isolated_bridge.js) into the inspected tab via chrome.scripting.executeScript() when the developer opens the StateHunter panel in Chrome DevTools. This ensures that no scripts are permanently or passively running in the background while DevTools is closed.
```

#### 3. Justification for `storage`
```text
The 'storage' permission (chrome.storage.local) is used strictly to save the user's custom testing scope rules, in-scope target domains, and excluded URL paths (e.g. /logout, /delete) locally on their machine so these safety guardrails persist across testing sessions.
```

---

### C. Data Usage Declarations

In the **Data usage** questionnaire on the CWS dashboard:

1. **Do you collect personal or sensitive user data?**
   * Select: **Yes** (because the tool inspects web page memory which may contain session tokens or authentication data in the inspected tab).
2. **Select data categories:**
   * Check **Authentication information** (passwords, credentials, security tokens)
   * Check **Web history** (addresses of web pages visited, only while inspecting)
3. **Data Collection Disclosures:**
   * Declare for each category:
     > *"This data is processed 100% transiently in local browser memory solely for display in the Chrome DevTools panel during security audits. It is never transmitted to any external server, remote service, analytics platform, or third party."*
4. **Developer Certifications (Check all boxes):**
   * [x] *I certify that user data is not sold or transferred to third parties.*
   * [x] *I certify that user data is not used or transferred for purposes unrelated to the item's core functionality.*
   * [x] *I certify that user data is not used or transferred to determine creditworthiness or for lending purposes.*

---

### D. Privacy Policy URL
Enter the hosted URL of your [`PRIVACY_POLICY.md`](../PRIVACY_POLICY.md), for example:
```text
https://github.com/SixFiveMil/statehunter/blob/main/PRIVACY_POLICY.md
```
*(Or the `codeandcypher.com` website equivalent).*

---

## 3. Reviewer Instructions & Notes (CWS Dashboard)

When submitting for review, provide these instructions in the **Notes for Reviewer** text area:

```text
StateHunter is a Chrome DevTools extension for web application security auditing.

HOW TO TEST:
1. Open Chrome DevTools (F12 or Right-Click -> Inspect).
2. Look for the "StateHunter" panel tab in the top DevTools tab bar.
3. Click on the StateHunter tab.
4. Navigate to any website or open a test page (e.g. https://example.com or any SPA like https://nextjs.org).
5. Reload the page (F5) with DevTools open:
   - The "Overview" tab will display detected client frameworks and security statistics.
   - The "SPA Routes" tab will display discovered client-side endpoints.
   - The "postMessage" tab will display monitored cross-origin message events.
   - The "Secrets & Storage" tab will display inspected localStorage/sessionStorage items.
6. Note: StateHunter operates exclusively on-demand when DevTools is open. No background scripts or network requests run when DevTools is closed. All data is processed strictly in local browser memory without any external telemetry or remote server connections.
```
