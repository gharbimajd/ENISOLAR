// ENISOLAR Environment Configuration Template
// Copy to environment.ts and environment.prod.ts with your credentials.

export const environment = {
  production: false,
  apiUrl: 'http://your-backend-api.com/',
  mqtt: {
    hostname: 'your-cluster-id.s1.eu.hivemq.cloud',
    port: 8884,
    path: '/mqtt',
    protocol: 'wss' as const,
    username: 'your_username',
    password: 'your_password',
    keepalive: 60,
    connectOnCreate: false
  }
};
