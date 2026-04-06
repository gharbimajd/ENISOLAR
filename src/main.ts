import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http'; 
import { importProvidersFrom } from '@angular/core'; // <--- Added for MQTT

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// 1. IMPORT MQTT MODULE
import { MqttModule, IMqttServiceOptions } from 'ngx-mqtt';

// 2. CONFIGURE HIVEMQ CREDENTIALS
export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  hostname: '529b5f97aca54d828dbef5ebe85f00cd.s1.eu.hivemq.cloud',
  port: 8884,
  path: '/mqtt',
  protocol: 'wss',
  username: 'majdgha',
  password: '552003Ssl',
  keepalive: 60,
  connectOnCreate: false, // Wait until we open the cockpit to connect
  clientId: 'ionic_' + Math.random().toString(16).slice(2)
};

// 3. BOOTSTRAP APP
bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(), 
    
    // 4. INJECT MQTT GLOBALLY
    importProvidersFrom(MqttModule.forRoot(MQTT_SERVICE_OPTIONS))
  ],
});