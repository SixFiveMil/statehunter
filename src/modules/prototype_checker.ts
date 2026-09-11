import { PrototypePollutionEvent } from '../types';

export function checkPollutedProperties(): PrototypePollutionEvent[] {
  const events: PrototypePollutionEvent[] = [];
  const commonGadgets = [
    'isAdmin', 'admin', 'role', 'auth', 'src', 'url', 'template',
    'config', 'transport', 'headers', 'debug', 'shell', 'innerHTML'
  ];

  // Inspect Object.prototype directly
  const proto = Object.prototype;
  for (const gadget of commonGadgets) {
    if (Object.prototype.hasOwnProperty(gadget)) {
      events.push({
        id: `pp_${gadget}_${Date.now()}`,
        timestamp: Date.now(),
        property: gadget,
        value: String((proto as any)[gadget]),
        stackTrace: 'Discovered during runtime Object.prototype traversal',
        severity: 'HIGH'
      });
    }
  }

  return events;
}

export function setupPrototypeGuard(onPollution: (event: PrototypePollutionEvent) => void): void {
  try {
    const watchedKeys = new Set<string>();

    const checkNewKey = (prop: PropertyKey, val: any) => {
      const propStr = String(prop);
      if (!watchedKeys.has(propStr)) {
        watchedKeys.add(propStr);
        onPollution({
          id: `pp_guard_${propStr}_${Date.now()}`,
          timestamp: Date.now(),
          property: propStr,
          value: typeof val === 'object' ? JSON.stringify(val).slice(0, 100) : String(val),
          stackTrace: new Error().stack || 'Stack trace unavailable',
          severity: 'CRITICAL'
        });
      }
    };

    // Sentinel property interceptor
    const originalDefineProperty = Object.defineProperty;
    (Object as any).defineProperty = function <T>(obj: T, prop: PropertyKey, descriptor: PropertyDescriptor & ThisType<any>): T {
      if (obj === Object.prototype) {
        checkNewKey(prop, descriptor.value || descriptor.get);
      }
      return originalDefineProperty.apply(this, arguments as any) as T;
    };
  } catch (err) {
    console.debug('[StateHunter] Prototype guard setup failed or already protected:', err);
  }
}
