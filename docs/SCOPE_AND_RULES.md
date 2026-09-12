# Scope Management, Well-Known Standards & AuditGuard Integration

This guide explains how StateHunter discovers target policies, enforces researcher scope boundaries, and integrates seamlessly with the **AuditGuard** compliance framework.

---

## 1. RFC 9116 Policy & Scope Discovery

StateHunter automatically queries two standardized public web endpoints when you navigate to any target domain:

### A. RFC 9116 `security.txt` (Vulnerability Disclosure Policy)
Published at `https://<target>/.well-known/security.txt` (or `/security.txt`), this file defines the organization's official vulnerability disclosure program (VDP) and Safe Harbor rules.

StateHunter parses the following RFC 9116 directives:
* `Policy:` The official rules of engagement (e.g. HackerOne, Bugcrowd, or direct security guidelines). StateHunter renders this as a direct clickable link in the DevTools UI.
* `Contact:` Authorized communication channels (e.g. `mailto:security@target.com` or web intake forms).
* `Acknowledgments:` Link to the company's security hall-of-fame.
* `Canonical:` The authoritative URL of the policy.

### B. `/robots.txt` (Crawler Restrictions)
Organizations frequently list administrative portals, private APIs, and checkout flows in `/robots.txt` to prevent search engines from indexing them.

* StateHunter parses all active `Disallow:` directives into an interactive explorer.
* Researchers can review these paths and click **"+ Add All to Excluded Paths"** (or individual **"Exclude"** buttons) to designate crawler-restricted paths as out-of-bounds in their AuditGuard configuration.

---

## 2. Configurable Scope & Exclusions Interface

In the **Scope & Rules** tab of StateHunter, researchers can configure both sides of their engagement rules:

### A. Authorized In-Scope Targets (`in_scope`)
Threat hunters frequently discover additional in-scope assets (such as microservice endpoints, authentication brokers, or API gateways) defined in program briefs:
* Add any authorized origin, subdomain, or wildcard (e.g. `https://api.target.com`, `*.target.com`, `auth.target.com`).
* Persistent across browser sessions via `chrome.storage.local`.
* Click **"Reset to Origin"** at any time to revert to the primary tab host.

### B. Baseline Safeguards (Always Protected)
To prevent accidental session disruption or unauthorized execution, StateHunter initializes every target with three baseline exclusions:
* `/logout`: Prevents invalidating the researcher's active session.
* `/delete`: Blocks accidental invocation of destructive user/account deletion handlers.
* `/billing`: Prevents accidental transactions or subscription modifications.

### C. Custom Exclusions Editor
StateHunter supports both literal route boundaries and arbitrary wildcard rules:

* **Literal Paths (Strict Root & Subpath Matching):**
  Entering a literal path like `/billing`, `/logout`, or `/delete` will match:
  - Exact paths: `/billing` or `/billing/`
  - Direct subpaths rooted at that prefix: `/billing/invoices`, `/billing/overview`
  - Query parameters and fragments: `/billing?plan=pro`, `/billing#payment`
  - *Does NOT match nested segments under different prefixes* (e.g. `/api/v1/billing/stripe-webhook` is **not** matched by literal `/billing`). This gives researchers the surgical ability to block specific literal routes without collateral over-blocking.

* **Wildcard Paths (Arbitrary Hierarchy Matching):**
  To block endpoints matching a term across nested microservice routes or arbitrary path prefixes, use explicit wildcards:
  - `*/billing/*`: Blocks any path containing `/billing/` anywhere in the URL hierarchy (e.g. `/api/v1/billing/stripe-webhook`).
  - `*billing*`: Blocks any route containing `billing` in any segment or filename.
  - `*/billing`: Blocks any path ending in `/billing`.
  - `/admin/*`: Blocks everything rooted under `/admin/`.
* Click **"Reset to Defaults"** at any time to restore the standard baseline rules (`/logout`, `/delete`, `/billing`).

---

## 3. Active Testing Scope & Exclusion Enforcement

StateHunter enforces **client-side mathematical boundaries** before executing any active probes or tests:

* **Zero Network Leakage:** When you click **"Probe Live Status"** in the SPA Routes tab, the route prober evaluates each path against your configured `in_scope` targets and `excluded_paths`.
* **Instant Safety Block:** Any path matching an exclusion rule (e.g. `/logout`, `/delete`, `/billing`) or targeting an un-authorized origin is **blocked locally before calling `fetch()`**. No HTTP packet is transmitted over the wire.
* **Visual Audit Badge:** Blocked routes are marked with a prominent `🛡️ BLOCKED (Scope)` badge with a tooltip detailing the exact matching exclusion rule. A dedicated **"Blocked"** filter allows instantaneous auditing.

---

## 4. Integrating with AuditGuard

When you click **"AuditGuard Scope"** in StateHunter's header, the extension generates a ready-to-use YAML configuration that combines your in-scope origins, VDP policy links, and merged exclusions.

### Example Generated YAML:

```yaml
# AuditGuard Scope Definition generated by StateHunter
# Target: https://example.com/
# Generated: 2026-09-11T12:00:00.000Z
#
# --- Vulnerability Disclosure Policy (RFC 9116) ---
# Policy URL: https://hackerone.com/example
# Contact: mailto:security@example.com
# Canonical: https://example.com/.well-known/security.txt

programs:
  example_com:
    name: "Example Corp Production"
    in_scope:
      - "https://example.com"
    excluded_paths:
      - "/logout"
      - "/delete"
      - "/billing"
      - "/admin/staging"          # Added manually by researcher
      - "/private/api"            # Imported from robots.txt Disallow
    discovered_endpoints:
      - "/admin/dashboard"
      - "/api/v1/metrics"
      - "/users/[id]"
    flagged_sensitive_endpoints:
      - "/admin/dashboard"
```

### Feeding Scope into AuditGuard CLI:

1. Copy the generated YAML block into your [AuditGuard](https://github.com/SixFiveMil/auditguard) configuration:
   `config/programs.yaml` (or `config/programs.local.yaml` for private targets)
2. **Offline Scope Check (No Network Traffic):**
   ```bash
   python main.py check https://example.com/api/v1/metrics
   # Output: [PERMITTED] In-scope and safe

   python main.py check https://example.com/delete
   # Output: [BLOCKED] Matches excluded_paths policy
   ```
3. **Authorized Network Probe with Audit Ledger:**
   ```bash
   python main.py probe https://example.com/api/v1/metrics -r "Verifying public API response"
   # Output: Prompts for operator confirmation, appends to audit_log.jsonl with SHA-256 body hashing.
   ```
