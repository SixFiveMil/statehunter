# StateHunter Active Testing Guide

This guide details the operator-initiated **Active Testing Suite** in StateHunter, designed for controlled vulnerability assessment, message replaying, and endpoint reachability probing.

---

## 1. Interactive `postMessage` Dispatcher & Replayer

Modern web applications rely heavily on `window.postMessage` for single sign-on (OAuth/SAML), payment iframes, chat widgets, and cross-subdomain communication. Misconfigurations in event listeners can lead to **Cross-Site Scripting (DOM XSS)**, **token theft**, or **unauthorized state changes**.

### A. How to Replay Captured Messages
1. Open Chrome DevTools $\rightarrow$ **StateHunter** $\rightarrow$ **postMessage** tab.
2. In the message list, find any interesting incoming or outgoing message.
3. Click the **"Replay"** button on the message card.
4. The **Active Dispatcher Console** will open, pre-filled with the exact payload and target origin of that message.
5. Modify the payload or origin as desired, then click **"Dispatch into Page"**.

### B. Crafting Custom Messages with Presets
Click the **"Active Dispatcher Console"** button in the top right of the postMessage tab to open a blank editor:
* **Diagnostic Ping (`STATUS_PING`):**
  ```json
  {
    "type": "STATUS_PING",
    "timestamp": 1726056000000
  }
  ```
  *Use to test whether an embedded iframe or window is actively listening and responsive.*
* **HTML Sink Test:**
  ```json
  {
    "htmlContent": "<strong>Active Probe Verification</strong>"
  }
  ```
  *Use to verify whether a listener blindly assigns untrusted message data to `element.innerHTML` without sanitization.*
* **Auth Callback Mock:**
  ```json
  {
    "action": "OAUTH_CALLBACK",
    "token": "mock-auth-token-12345"
  }
  ```
  *Use to test client-side authentication handlers and session storage routines.*

### C. Target Origin Strategy
* **Wildcard (`*`):** Broadcasts the message to any window/frame currently hosted on the target tab.
* **Strict Origin (`https://app.target.com`):** Restricts delivery strictly to matching schemes and hosts.
* **Sub-Frame Index:** Target a specific `window.frames[index]` if the target site contains embedded third-party iframes.

---

## 2. Risk Evaluation Taxonomy

StateHunter audits every `postMessage` listener and event against the following severity criteria:

| Severity | Condition | Security Implication |
| :---: | :--- | :--- |
| 🔴 **CRITICAL** | Listener has **NO** `event.origin` check AND passes data into a dangerous DOM sink (`innerHTML`, `eval`, `location.href`, `new Function`). | **Direct DOM XSS or Open Redirection.** Any cross-origin website or iframe can execute arbitrary code in the user's session. |
| 🔴 **CRITICAL** | Outgoing message dispatched with wildcard `*` containing sensitive credentials (tokens, secrets, JWTs). | **Credential Theft.** Any embedded malicious iframe or parent window can intercept the token. |
| 🟠 **HIGH** | Listener processes messages with **NO** `event.origin` check. | **Unauthorized Action Execution.** Untrusted windows can trigger internal functions, state mutations, or API calls. |
| 🟡 **MEDIUM** | Listener uses **Weak / Bypassable** origin check (e.g. `e.origin.indexOf('target.com') !== -1` or `.includes()`). | **Origin Spoofing.** An attacker can register `https://target.com.attacker.com` or `https://attacker-target.com` to bypass the check. |
| 🟢 **LOW / INFO** | Listener enforces strict origin check (e.g. `if (e.origin !== 'https://target.com') return;`). | Properly secured cross-document handler. |

---

## 3. Live Route Reachability Prober

Single Page Applications (SPAs) bundle unlinked routes in their build manifests (`_buildManifest.js`). However, not all routes declared in client bundles are deployed or accessible on the active environment.

### A. How the Prober Works
1. Navigate to the target application and open StateHunter's **SPA Routes** tab.
2. Click the **"Probe Live Status"** button.
3. StateHunter queries each discovered route using asynchronous workers with **concurrency limiting** (max 3 concurrent requests) to avoid overwhelming the server.
4. Each request:
   - Issues a lightweight `HEAD` request to read HTTP headers without downloading page bodies.
   - Automatically falls back to `GET` if the server returns `405 Method Not Allowed`.
   - Records latency and exact HTTP response status codes.
5. Click **"Stop Probing"** at any time to abort remaining requests.

### B. Interpreting Status Codes for AppSec Assessments

* 🟢 **`200 OK`**:
  * The route is deployed and publicly accessible.
  * Click the route link to inspect what functionality or administrative UI is exposed.
* 🟣 **`401 Unauthorized` / `403 Forbidden` (High Priority for Security Researchers)**:
  * The endpoint is live on the server, but protected by authentication or role checks.
  * Prime target for testing **Broken Object Level Authorization (BOLA)**, **IDOR**, or **Privilege Escalation** once authenticated.
* ⚪ **`404 Not Found`**:
  * The route was declared in the frontend client build manifest, but is not routed or deployed on this server (e.g. legacy route or local development stub).
