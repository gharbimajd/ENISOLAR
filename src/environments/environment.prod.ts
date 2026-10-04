export const environment = {
  production: true,
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
