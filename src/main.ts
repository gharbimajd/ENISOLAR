import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http'; 
import { importProvidersFrom } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// 1. IMPORT MQTT MODULE
import { MqttModule, IMqttServiceOptions } from 'ngx-mqtt';

// 2. CONFIGURE HIVEMQ CREDENTIALS FROM ENVIRONMENT
export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  hostname: environment.mqtt?.hostname || 'dd4bee3682e2479fbe315b7d4670285f.s1.eu.hivemq.cloud',
  port: environment.mqtt?.port || 8884,
  path: environment.mqtt?.path || '/mqtt',
  protocol: (environment.mqtt?.protocol as 'wss' | 'ws') || 'wss',
  username: environment.mqtt?.username || 'majdgha',
  password: environment.mqtt?.password || '552003Ssl',
  keepalive: environment.mqtt?.keepalive || 60,
  connectOnCreate: environment.mqtt?.connectOnCreate || false,
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