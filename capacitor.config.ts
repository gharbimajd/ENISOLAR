import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.enisolar.app',
  appName: 'ENISOLAR',
  webDir: 'www',
  server: {
    cleartext: true,
    allowNavigation: ['192.168.1.5:8100']
  }
};

export default config;