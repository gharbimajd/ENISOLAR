import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MqttService } from '../services/Mqtt.service';
import { addIcons } from 'ionicons';
import {
  radioOutline, navigateOutline, batteryHalfOutline,
  speedometerOutline, compassOutline, locationOutline,
  stopCircleOutline, rocketOutline, arrowUpOutline,
  arrowDownOutline, homeOutline, pauseOutline,
  checkmarkCircleOutline, closeCircleOutline,
  paperPlaneOutline, searchOutline, mapOutline,
  wifiOutline, hardwareChipOutline, powerOutline,chevronDownOutline,
} from 'ionicons/icons';
import { environment } from '../../environments/environment';
import { CapacitorHttp } from '@capacitor/core';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-cockpit',
  templateUrl: './cockpit.page.html',
  styleUrls: ['./cockpit.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CockpitPage implements OnInit, OnDestroy {
  drone: any = null;
  private base = environment.apiUrl;

  // ── Connection ────────────────────────────────────────
  isConnected = false;
  droneOnline = false;
  lastSeen: string | null = null;

  // ── Telemetry ─────────────────────────────────────────
  telemetry = {
    lat: null as number | null,
    lng: null as number | null,
    altitude: 0,
    speed: 0,
    heading: 0,
    battery: 0,
    signal_strength: 0
  };

  // ── Flight state ──────────────────────────────────────
  flightState = 'IDLE'; // IDLE / ARMED / FLYING / RETURNING / LANDING / LANDED

  // ── Missions ──────────────────────────────────────────
  missions: any[] = [];
  filteredMissions: any[] = [];
  searchQuery = '';
  isLoadingMissions = false;
  showMissionPanel = false;
  selectedMission: any = null;
  isSendingMission = false;
  ackReceived = false;

  // ── Subscriptions ─────────────────────────────────────
  private subs: Subscription[] = [];
  private droneOnlineTimer: any;

  constructor(
    private router: Router,
    private mqttService: MqttService,
    private toastCtrl: ToastController,
    private zone: NgZone
  ) {
    addIcons({
      radioOutline, navigateOutline, batteryHalfOutline,
      speedometerOutline, compassOutline, locationOutline,
      stopCircleOutline, rocketOutline, arrowUpOutline,
      arrowDownOutline, homeOutline, pauseOutline,
      checkmarkCircleOutline, closeCircleOutline,
      paperPlaneOutline, searchOutline, mapOutline,
      wifiOutline, hardwareChipOutline, powerOutline,chevronDownOutline,
    });
    
    const nav = this.router.currentNavigation();
    this.drone = nav?.extras?.state?.['drone'];

    // 🛑 FOR TESTING: Uncomment this if you are testing directly without clicking a drone!
    // if (!this.drone) { this.drone = { id: 99, name: 'Test Drone' }; }
  }

  ngOnInit() {
    if (!this.drone) { this.router.navigateByUrl('/drone-manager'); return; }
    this.connectMqtt();
    this.loadMissions();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.droneOnlineTimer);
    this.mqttService.disconnect();
  }

  // ── MQTT ──────────────────────────────────────────────
  connectMqtt() {
    this.mqttService.connect();

    // Connection state
    this.subs.push(
      this.mqttService.isConnected$.subscribe(connected => {
        this.zone.run(() => {
          this.isConnected = connected;
          if (connected) this.subscribeToTopics();
        });
      })
    );
  }

  subscribeToTopics() {
    const id = this.drone.id;

    // Telemetry - BUTTERY SMOOTH UPDATES
    this.subs.push(
      this.mqttService.subscribeTo(this.mqttService.telemetryTopic(id)).subscribe((data: any) => {
        this.zone.run(() => {
          // Object.assign directly updates the numbers without destroying the object! No flickering!
          Object.assign(this.telemetry, data);
          
          this.droneOnline = true;
          this.lastSeen = new Date().toLocaleTimeString();
          
          clearTimeout(this.droneOnlineTimer);
          
          // Mark offline if no telemetry for 10 seconds
          this.droneOnlineTimer = setTimeout(() => { 
            this.zone.run(() => { this.droneOnline = false; });
          }, 10000);
        });
      })
    );

    // Flight status
    this.subs.push(
      this.mqttService.subscribeTo(this.mqttService.statusTopic(id)).subscribe((data: any) => {
        this.zone.run(() => {
          if (data.state) this.flightState = data.state;
        });
      })
    );

    // Acknowledgment
    this.subs.push(
      this.mqttService.subscribeTo(this.mqttService.ackTopic(id)).subscribe((data: any) => {
        this.zone.run(() => {
          this.ackReceived = true;
          this.isSendingMission = false;
          
          this.showToast(data.message || 'Drone acknowledged', 'success');
          
          setTimeout(() => { 
            this.zone.run(() => { this.ackReceived = false; });
          }, 3000);
        });
      })
    );
  }

  // ── Commands ──────────────────────────────────────────
  sendCommand(command: string) {
    if (!this.isConnected) { this.showToast('Not connected to broker', 'warning'); return; }
    this.mqttService.sendCommand(this.drone.id, command);
    this.showToast(`Command sent: ${command}`, 'primary');
  }

  emergencyStop() {
    if (!this.isConnected) { this.showToast('Not connected', 'danger'); return; }
    this.mqttService.sendCommand(this.drone.id, 'ABORT');
    this.showToast('Emergency STOP sent!', 'danger');
  }

  // ── Missions ──────────────────────────────────────────
  loadMissions() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    this.isLoadingMissions = true;

    from(CapacitorHttp.get({
      url: `${this.base}/get_missions.php?user_id=${userId}`
    })).pipe(map((res: any) => res.data)).subscribe({
      next: (missions: any[]) => {
        this.zone.run(() => {
          this.missions = missions;
          this.filteredMissions = missions;
          this.isLoadingMissions = false;
        });
      },
      error: () => { 
        this.zone.run(() => { this.isLoadingMissions = false; });
      }
    });
  }

  filterMissions() {
    const q = this.searchQuery.toLowerCase();
    this.filteredMissions = this.missions.filter(m => m.name.toLowerCase().includes(q));
  }

  selectMission(mission: any) {
    this.selectedMission = mission;
  }

  sendMission() {
    if (!this.selectedMission || !this.isConnected) return;
    this.isSendingMission = true;
    this.ackReceived = false;
    this.mqttService.sendMission(this.drone.id, this.selectedMission.id, this.selectedMission.flightPath);
    
    // Timeout if no ack after 10s
    setTimeout(() => {
      this.zone.run(() => {
        if (this.isSendingMission) {
          this.isSendingMission = false;
          this.showToast('No acknowledgment from drone', 'warning');
        }
      });
    }, 10000);
  }

  // ── Helpers ───────────────────────────────────────────
  get batteryColor(): string {
    if (this.telemetry.battery > 50) return 'success';
    if (this.telemetry.battery > 20) return 'warning';
    return 'danger';
  }

  get headingLabel(): string {
    const h = this.telemetry.heading;
    if (h >= 337.5 || h < 22.5)  return 'N';
    if (h < 67.5)  return 'NE';
    if (h < 112.5) return 'E';
    if (h < 157.5) return 'SE';
    if (h < 202.5) return 'S';
    if (h < 247.5) return 'SW';
    if (h < 292.5) return 'W';
    return 'NW';
  }

  get flightStateColor(): string {
    switch (this.flightState) {
      case 'FLYING':    return 'primary';
      case 'ARMED':     return 'warning';
      case 'RETURNING': return 'tertiary';
      case 'LANDING':   return 'warning';
      case 'LANDED':    return 'success';
      default:          return 'medium';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ready':   return 'ready';
      case 'pending': return 'pending';
      case 'draft':   return 'draft';
      case 'done':    return 'done';
      default:        return 'draft';
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    toast.present();
  }
}