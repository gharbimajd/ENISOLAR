import { Component, OnInit, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonBackButton, 
  IonSpinner,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonSearchbar,
  IonFab,
  IonFabButton
} from '@ionic/angular/standalone';

import { MissionService } from '../../services/mission';
import { addIcons } from 'ionicons';
import { copyOutline, informationCircleOutline, bluetoothOutline, cloudUploadOutline, trashOutline, resizeOutline, timeOutline, locationOutline, eyeOutline, searchOutline, add } from 'ionicons/icons';
import { BleClient } from '@capacitor-community/bluetooth-le';

@Component({
  selector: 'app-mission-status',
  templateUrl: './mission-status.page.html',
  styleUrls: ['./mission-status.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonButtons, 
    IonBackButton, 
    IonSpinner,
    IonIcon,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
  ]
})
export class MissionStatusPage implements OnInit {
  
  readonly DRONE_SERVICE = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  readonly DRONE_CHARACTERISTIC = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  mission = signal<any>(null);
  statusMessage = 'Ready to Scan';
  isConnected = false;
  deviceId = '';

  csvDisplay = computed(() => {
    const m = this.mission();
    if (!m || !m.flightPath || !Array.isArray(m.flightPath) || m.flightPath.length === 0) {
      return 'No coordinates found.';
    }

    const hasAltitude = m.flightPath[0].alt !== undefined;

    const header = hasAltitude 
      ? "order,latitude,longitude,altitude" 
      : "order,latitude,longitude";

    const rows = m.flightPath.map((pt: any, i: number) => {
      const baseRow = `${i + 1},${Number(pt.lat).toFixed(7)},${Number(pt.lng).toFixed(7)}`;
      return hasAltitude 
        ? `${baseRow},${Number(pt.alt).toFixed(2)}`
        : baseRow;
    });

    return [header, ...rows].join('\n');
  });

  constructor(
    private route: ActivatedRoute, 
    private missionService: MissionService,
    private zone: NgZone
  ) {
    addIcons({ 
      copyOutline, 
      informationCircleOutline, 
      bluetoothOutline, 
      cloudUploadOutline,
      trashOutline,
      resizeOutline,
      timeOutline,
      locationOutline,
      eyeOutline,
      searchOutline,
      add
    });
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Target Mission ID:', id);

    if (id) {
      this.missionService.getMissionById(id).subscribe({
        next: (m) => {
          this.zone.run(() => {
            if (m) {
              if (typeof m.flightPath === 'string') {
                try {
                  m.flightPath = JSON.parse(m.flightPath);
                } catch (e) {
                  m.flightPath = [];
                }
              }
              this.mission.set(m);
            } else {
              this.statusMessage = 'Mission not found';
              this.mission.set({ name: 'Not Found', flightPath: [] });
            }
          });
        },
        error: (err) => {
          this.zone.run(() => {
            console.error('Failed to fetch:', err);
            this.statusMessage = 'Network Error';
            this.mission.set({ name: 'Error', flightPath: [] });
          });
        }
      });
    }

    try {
      await BleClient.initialize();
      console.log('Bluetooth Engine Started');
    } catch (error) {
      console.error('BLE Init failed:', error);
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.csvDisplay());
      this.zone.run(() => this.statusMessage = 'Copied to Clipboard!');
    } catch (err) {
      console.error('Could not copy:', err);
    }
  }

  async scanAndConnect() {
    this.zone.run(() => this.statusMessage = 'Scanning for Drone...');
    try {
      const device = await BleClient.requestDevice({
        services: [this.DRONE_SERVICE]
      });

      this.zone.run(() => this.statusMessage = 'Connecting...');
      
      await BleClient.connect(device.deviceId, (id) => this.onDisconnect(id));
      
      this.zone.run(() => {
        this.deviceId = device.deviceId;
        this.isConnected = true;
        this.statusMessage = `Connected to ${device.name || 'Drone'}`;
      });
    } catch (error) {
      console.error('Connection failed', error);
      this.zone.run(() => {
        this.statusMessage = 'Connection Failed';
        this.isConnected = false;
      });
    }
  }

  async uploadMission() {
    if (!this.isConnected) {
      alert("Not connected to Drone!");
      return;
    }

    try {
      this.zone.run(() => this.statusMessage = 'Preparing Data...');
      
      const m = this.mission();
      const path = m?.flightPath || []; 
      
      if (path.length === 0) {
        alert("Mission path is empty!");
        return;
      }

      let csvPayload = "index,lat,lng,alt,action\n";
      path.forEach((pt: any, index: number) => {
        csvPayload += `${index + 1},${Number(pt.lat).toFixed(6)},${Number(pt.lng).toFixed(6)},30,0\n`;
      });

      // --- NEW: Add EOF Marker so ESP32 knows when to stop ---
      csvPayload += "EOF\n";

      // --- FIXED: Reliable Chunked BLE sending ---
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(csvPayload);

      const CHUNK_SIZE = 180;
      const totalChunks = Math.ceil(encodedData.length / CHUNK_SIZE);

      this.zone.run(() => this.statusMessage = 'Uploading...');

      for (let i = 0; i < encodedData.length; i += CHUNK_SIZE) {
        const chunk = encodedData.slice(i, i + CHUNK_SIZE);
        
        // SAFE DATAVIEW: Uses offset and length to avoid full-buffer bleed
        const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

        await BleClient.writeWithoutResponse(
          this.deviceId,
          this.DRONE_SERVICE,
          this.DRONE_CHARACTERISTIC,
          dataView
        );

        const currentChunk = Math.floor(i / CHUNK_SIZE) + 1;
        this.zone.run(() => this.statusMessage = `Uploading... ${currentChunk}/${totalChunks}`);

        // --- NEW: Give the ESP32 buffer time to process the chunk (50ms) ---
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      // --- END FIX ---

      this.zone.run(() => this.statusMessage = 'Upload Success! ✅');
      alert("Mission Sent Successfully!");

    } catch (error: any) {
      console.error('Upload Failed:', error);
      alert("Upload Failed: " + (error.message || error));
      this.zone.run(() => this.statusMessage = 'Error Sending Data');
    }
  }

  onDisconnect(deviceId: string) {
    this.zone.run(() => {
      console.log(`Device ${deviceId} disconnected`);
      this.isConnected = false;
      this.statusMessage = 'Drone Disconnected';
    });
  }
}