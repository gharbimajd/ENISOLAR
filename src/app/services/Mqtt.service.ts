import { Injectable } from '@angular/core';
import { IMqttMessage, MqttService as NgxMqttService, IMqttServiceOptions } from 'ngx-mqtt';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';

export const MQTT_CONFIG: IMqttServiceOptions = {
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

@Injectable({ providedIn: 'root' })
export class MqttService {
  private connected$ = new BehaviorSubject<boolean>(false);
  isConnected$ = this.connected$.asObservable();

  constructor(private mqtt: NgxMqttService) {
    this.mqtt.onConnect.subscribe(() => this.connected$.next(true));
    this.mqtt.onClose.subscribe(() => this.connected$.next(false));
    this.mqtt.onError.subscribe(() => this.connected$.next(false));
  }

  connect() {
    this.mqtt.connect(MQTT_CONFIG);
  }

  disconnect() {
    try {
      this.mqtt.disconnect();
    } catch (error) {
      // It was already disconnected or never connected, safely ignore!
    }
    this.connected$.next(false);
  }

  // ── Subscribe to a topic ─────────────────────────────
  subscribeTo(topic: string): Observable<any> {
    return this.mqtt.observe(topic).pipe(
      map((msg: IMqttMessage) => {
        try {
          return JSON.parse(msg.payload.toString());
        } catch {
          return msg.payload.toString();
        }
      })
    );
  }

  // ── Publish to a topic ───────────────────────────────
  publish(topic: string, payload: any) {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.mqtt.unsafePublish(topic, message, { qos: 1, retain: false });
  }

  // ── Drone-specific helpers ───────────────────────────
  telemetryTopic(droneId: string)  { return `drone/${droneId}/telemetry`; }
  commandTopic(droneId: string)    { return `drone/${droneId}/command`; }
  missionTopic(droneId: string)    { return `drone/${droneId}/mission`; }
  statusTopic(droneId: string)     { return `drone/${droneId}/status`; }
  ackTopic(droneId: string)        { return `drone/${droneId}/ack`; }

  sendCommand(droneId: string, command: string, params: any = {}) {
    this.publish(this.commandTopic(droneId), { command, ...params });
  }

  sendMission(droneId: string, missionId: string, flightPath: any) {
    this.publish(this.missionTopic(droneId), { mission_id: missionId, flight_path: flightPath });
  }
}