import { Component, OnInit, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular'; 
import { MissionService } from '../../services/mission';
import { addIcons } from 'ionicons';
import { copyOutline, informationCircleOutline, bluetoothOutline, cloudUploadOutline } from 'ionicons/icons';
import { BleClient } from '@capacitor-community/bluetooth-le';

@Component({
  selector: 'app-mission-status',
  templateUrl: './mission-status.page.html',
  styleUrls: ['./mission-status.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class MissionStatusPage implements OnInit {
  
  readonly DRONE_SERVICE = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  readonly DRONE_CHARACTERISTIC = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  mission = signal<any>(null);
  statusMessage = 'Ready to Scan';
  isConnected = false;
  deviceId = '';

  // --- Computes CSV for Display ---
  csvDisplay = computed(() => {
    const m = this.mission();
    // Check if mission exists and has a flightPath array
    if (!m || !m.flightPath || !Array.isArray(m.flightPath) || m.flightPath.length === 0) {
      return 'No coordinates found.';
    }

    const header = "order,latitude,longitude";
    const rows = m.flightPath.map((pt: any, i: number) => 
      `${i + 1},${pt.lat.toFixed(7)},${pt.lng.toFixed(7)}`
    );
    return [header, ...rows].join('\n');
  });

  constructor(
    private route: ActivatedRoute, 
    private missionService: MissionService,
    private zone: NgZone // Inject NgZone to fix the "infinite fetching" UI bug
  ) {
    addIcons({ copyOutline, informationCircleOutline, bluetoothOutline, cloudUploadOutline });
  }

  async ngOnInit() {
    // 1. Get ID from URL
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Target Mission ID:', id);

    if (id) {
      this.missionService.getMissionById(id).subscribe({
        next: (m) => {
          // Wrap in zone.run to ensure the UI spinner disappears immediately
          this.zone.run(() => {
            if (m) {
              console.log('Mission received from service:', m);
              
              // Parse flightPath if it arrived as a string from the DB
              if (typeof m.flightPath === 'string') {
                try {
                  m.flightPath = JSON.parse(m.flightPath);
                } catch (e) {
                  console.error('JSON Parse Error:', e);
                  m.flightPath = [];
                }
              }
              
              this.mission.set(m);
            } else {
              console.warn('Mission not found for ID:', id);
              this.statusMessage = 'Mission not found in database';
              // Set mission to empty object so spinner stops
              this.mission.set({ name: 'Not Found', flightPath: [] });
            }
          });
        },
        error: (err) => {
          this.zone.run(() => {
            console.error('Failed to fetch mission:', err);
            this.statusMessage = 'Network Error: Check Server';
            this.mission.set({ name: 'Error', flightPath: [] });
          });
        }
      });
    }

    // 2. Initialize BLE
    try {
      await BleClient.initialize();
      console.log('Bluetooth Engine Started');
    } catch (error) {
      console.error('BLE Init failed:', error);
      this.zone.run(() => {
        this.statusMessage = 'Bluetooth Error (Check Permissions)';
      });
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.csvDisplay());
      this.zone.run(() => {
        this.statusMessage = 'Copied to Clipboard!';
      });
    } catch (err) {
      console.error('Could not copy text: ', err);
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
      // Safety check: Create a dummy path if empty to prevent crashes
      const path = m?.flightPath || []; 
      
      if (path.length === 0) {
        alert("Mission path is empty!");
        return;
      }

      // 1. Build the CSV String
      let csvPayload = "index,lat,lng,alt,action\n";
      path.forEach((pt: any, index: number) => {
        csvPayload += `${index + 1},${Number(pt.lat).toFixed(6)},${Number(pt.lng).toFixed(6)},30,0\n`;
      });

      console.log("Sending payload:", csvPayload);

      // 2. Convert to DataView (Required for Capacitor)
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(csvPayload);
      const dataView = new DataView(encodedData.buffer);

      this.zone.run(() => this.statusMessage = 'Uploading...');

      // 3. ATTEMPT WRITE
      // We use 'write' which expects a response. 
      // Ensure your nRF Connect characteristic has 'WRITE' property (not just WRITE_NO_RESPONSE)
      await BleClient.writeWithoutResponse(
        this.deviceId,
        this.DRONE_SERVICE,
        this.DRONE_CHARACTERISTIC,
        dataView
      );

      this.zone.run(() => this.statusMessage = 'Upload Success! ✅');
      alert("Mission Sent Successfully!");

    } catch (error: any) {
      console.error('Upload Failed:', error);
      // Show the exact error on screen so we know why it failed
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