// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'http://enisolardienicar.atwebpages.com/',
  mqtt: {
    hostname: 'dd4bee3682e2479fbe315b7d4670285f.s1.eu.hivemq.cloud',
    port: 8884,
    path: '/mqtt',
    protocol: 'wss' as const,
    username: 'majdgha',
    password: '552003Ssl',
    keepalive: 60,
    connectOnCreate: false
  }
};
