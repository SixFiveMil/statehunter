# Privacy Policy for StateHunter

**Last Updated:** September 11, 2026

StateHunter ("we", "our", or "the extension") is a developer tools extension for Google Chrome designed for application security engineers, penetration testers, and bug bounty researchers. We are committed to protecting your privacy and handling all user data transparently in full compliance with the **Google Chrome Web Store Developer Program Policies**.

---

## 1. Single Purpose & Core Functionality

StateHunter serves a single, narrow purpose: **providing in-browser runtime JavaScript state inspection, Single Page Application (SPA) route de-obfuscation, postMessage event auditing, and local storage security analysis within the Chrome Developer Tools panel.**

StateHunter is activated strictly when the user opens Chrome DevTools (`F12`) on an inspected web page. It does not perform passive background monitoring when DevTools is closed.

---

## 2. Information Handled & How It Is Used

When you open StateHunter in Chrome DevTools to audit a web application, the extension inspects the following client-side data within the inspected tab:

1. **Client Storage & In-Memory Objects:**
   * Keys and values stored in `window.localStorage` and `window.sessionStorage`.
   * Public framework hydration objects (such as `window.__NEXT_DATA__`, `window.__BUILD_MANIFEST`).
   * Decoded JSON Web Tokens (JWT) and public client tokens.
   * *Purpose:* To display sensitive data exposures and potential credential leaks to the security tester.

2. **DOM Events & Messages:**
   * `window.postMessage` payloads, origin values, and message listener source code.
   * Prototype properties on `Object.prototype`.
   * *Purpose:* To detect missing origin checks, vulnerable DOM sinks, and client-side prototype pollution vulnerabilities.

3. **SPA Routes & Well-Known Policies:**
   * Unlinked endpoint paths discovered in loaded JavaScript bundles.
   * Public RFC 9116 `security.txt` and `robots.txt` policy directives.
   * *Purpose:* To assist researchers in mapping application attack surfaces and adhering to official Rules of Engagement (RoE).

4. **User Scope Configurations:**
   * Custom target origins (in-scope domains) and excluded paths (e.g. `/logout`, `/delete`) defined by the user.
   * *Purpose:* To enforce safety guardrails and prevent out-of-scope requests during active testing.

---

## 3. Data Storage, Transmission & Zero Telemetry

* **100% Local Execution:** All data inspected or captured by StateHunter is processed **strictly within the local memory of your browser**.
* **Zero External Transmission:** StateHunter **does not transmit, upload, or sync any data to external servers, cloud services, analytics providers, or third parties**.
* **No Tracking or Analytics:** We do not include any tracking pixels, third-party analytics (e.g., Google Analytics), or behavioral logging.
* **Transient Memory:** Discovered routes, secrets, and message logs are stored in temporary in-memory data structures associated with the active `tabId` and are automatically destroyed when the tab or DevTools panel is closed.
* **Persistent Preferences:** User-defined scope rules and exclusions are stored locally on your device via `chrome.storage.local`.

---

## 4. Permissions & Justifications

StateHunter requests the minimum permissions necessary to function as an on-demand security auditing developer tool:

| Permission | Justification |
| :--- | :--- |
| **`storage`** | Used strictly to store user-configured testing scope rules, custom exclusion paths, and safe harbor preferences locally on the user's machine. |
| **`scripting`** | Used strictly to dynamically inject the security auditing probe (`main_probe.js`) and content bridge (`isolated_bridge.js`) into the inspected tab when the operator opens the StateHunter panel in Chrome DevTools. |
| **`host_permissions: ["<all_urls>"]`** | Required to allow security researchers and developers to audit and inspect any authorized web application target they choose to open in Chrome DevTools. |

---

## 5. Third-Party Sharing & Sale of Data

StateHunter does **not**:
* Sell, trade, or rent personal data to any third party.
* Transfer user data for reasons unrelated to the single purpose of the extension.
* Use or transfer user data to serve targeted advertisements.
* Use or transfer user data to determine creditworthiness or for lending purposes.

---

## 6. Security of Your Data

StateHunter incorporates security-by-design principles:
* **Private Communication Channels:** Inter-world communication between the page probe and the extension bridge uses private DOM custom events (`__STATEHUNTER_SECURE_TELEMETRY__`). Secrets and session tokens are **never** broadcast to untrusted scripts using `window.postMessage('*')`.
* **Resource Cache Access:** Script auditing utilizes Chrome's native DevTools resource cache (`chrome.devtools.inspectedWindow.getResources()`) rather than making unauthenticated external network requests.
* **Scope Guardrails:** Active route reachability probing is mathematically gated by client-side scope policies to prevent unintended requests to sensitive paths (`/logout`, `/billing`, `/delete`).

---

## 7. Changes to This Privacy Policy

If we update this Privacy Policy, the revised version will be published in the project repository with an updated revision date.

---

## 8. Contact Information

StateHunter is an open-source security tool developed and maintained by **Joshua A. Wortz, CISSP** at [Code & Cypher](https://codeandcypher.com).

If you have questions or feedback regarding this Privacy Policy or StateHunter's data practices, please open an issue in the official project repository or contact us:
* GitHub Repository: [https://github.com/SixFiveMil/statehunter](https://github.com/SixFiveMil/statehunter)
* Publication & Research: [https://codeandcypher.com](https://codeandcypher.com)
