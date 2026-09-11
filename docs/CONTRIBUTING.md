# Contributing to StateHunter

Thank you for your interest in improving StateHunter! This document provides instructions for setting up your local environment, adding new detectors, and contributing code.

---

## 1. Development Setup

### Prerequisites
* **Node.js**: v18.0.0 or later (v20+ recommended)
* **npm**: v9+ or later
* **Google Chrome** or **Brave** browser

### Initializing the Project
```bash
# Clone the repository
git clone https://github.com/SixFiveMil/statehunter.git
cd statehunter

# Install dependencies
npm install

# Build in watch mode for development
npm run dev

# Or build once for production
npm run build

# Run automated test suite
npm test
```

---

## 2. Loading the Extension in Chrome for Development

1. Open Chrome/Brave and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `dist` folder inside your cloned repository.
4. When making changes to content scripts or UI:
   - Run `npm run build` (or keep `npm run dev` running).
   - Click the **Reload** (🔄) icon on the StateHunter card in `chrome://extensions/`.
   - Close and re-open Chrome DevTools on your test tab.

---

## 3. Adding New Security Detectors

### Adding a New Credential / Secret Pattern
Open [`src/modules/secret_scanner.ts`](../src/modules/secret_scanner.ts) and append a new rule to `SECRET_PATTERNS`:

```typescript
{
  name: 'Custom Provider API Key',
  type: 'sensitive_key',
  regex: /\b(cp_live_[0-9a-zA-Z]{32})\b/,
  severity: 'CRITICAL',
  description: 'Custom provider live secret access token'
}
```

Add a corresponding test case in [`tests/secret_scanner.test.ts`](../tests/secret_scanner.test.ts):
```typescript
it('detects Custom Provider API Key', () => {
  const text = 'API_KEY=cp_live_1234567890abcdef1234567890abcdef';
  const findings = scanStringForSecrets(text, 'KEY', 'localStorage');
  expect(findings.some(f => f.severity === 'CRITICAL')).toBe(true);
});
```

---

### Adding a New Framework Route Parser
Open [`src/modules/route_extractor.ts`](../src/modules/route_extractor.ts) to add support for a new client-side framework (e.g. SvelteKit or Nuxt 3):

1. Define the manifest parsing logic:
   ```typescript
   export function extractSvelteKitRoutes(manifest: any): DiscoveredRoute[] {
     // Extract routes from window.__sveltekit object
   }
   ```
2. Hook it in [`src/content/main_probe.ts`](../src/content/main_probe.ts) under `runRuntimeScan()`:
   ```typescript
   if ((window as any).__sveltekit) {
     detectedFramework = 'SvelteKit';
     routes.push(...extractSvelteKitRoutes((window as any).__sveltekit));
   }
   ```
3. Add unit tests in [`tests/route_extractor.test.ts`](../tests/route_extractor.test.ts).

---

## 4. Pull Request Checklist

Before submitting a Pull Request, ensure:
* [ ] All automated unit tests pass: `npm test`
* [ ] TypeScript compiles cleanly with zero errors: `npx tsc --noEmit`
* [ ] The production bundle builds without errors: `npm run build`
* [ ] New features include unit tests in `tests/`
* [ ] Any new UI features work cleanly in Chrome DevTools dark mode
