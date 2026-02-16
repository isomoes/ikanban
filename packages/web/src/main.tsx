import { createWebAPIs } from './api';
import { registerSW } from 'virtual:pwa-register';

import type { RuntimeAPIs } from '@ikanban/ui/lib/api/types';
import '@ikanban/ui/index.css';
import '@ikanban/ui/styles/fonts';

declare global {
  interface Window {
    __IKANBAN_RUNTIME_APIS__?: RuntimeAPIs;
  }
}

window.__IKANBAN_RUNTIME_APIS__ = createWebAPIs();

registerSW({
  onRegistered(registration: ServiceWorkerRegistration | undefined) {
    if (!registration) {
      return;
    }

    // Periodic update check (best-effort)
    setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  },
  onRegisterError(error: unknown) {
    console.warn('[PWA] service worker registration failed:', error);
  },
});

import('@ikanban/ui/main');
