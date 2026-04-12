import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { addIcons } from 'ionicons';
import {
  bluetoothOutline, searchOutline, syncOutline, hardwareChipOutline,
  chevronForwardOutline, wifiOutline, lockClosedOutline, eyeOutline,
  eyeOffOutline, sendOutline, checkmarkCircleOutline, pencilOutline,
  scanOutline, arrowBackOutline, closeOutline, refreshOutline
} from 'ionicons/icons';

const SERVICE_UUID        = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export interface WifiNetwork {
  ssid:     string;
  rssi:     number;
  open:     boolean;
}

@Component({
  selector: 'app-wifi-setup',
  templateUrl: './wifi-setup.page.html',
  styleUrls: ['./wifi-setup.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class WifiSetupPage implements OnInit, OnDestroy {

  // ── Steps ─────────────────────────────────────────────
  // scan      → BLE scan for drone
  // choose    → pick mode: wifi-scan or manual
  // scanning  → waiting for ESP to return wifi list
  // pick      → show wifi network list
  // password  → password prompt for selected network
  // manual    → manual SSID + password entry
  // sending   → sending creds, waiting for ESP response
  // done      → success
  step: 'scan' | 'choose' | 'scanning' | 'pick' | 'password' | 'manual' | 'sending' | 'done' = 'scan';

  // ── BLE scan ──────────────────────────────────────────
  isScanning  = false;
  scanDone    = false;
  foundDevices: ScanResult[] = [];

  // ── BLE connection ────────────────────────────────────
  connectedDeviceId   = '';
  connectedDeviceName = '';

  // ── WiFi networks ─────────────────────────────────────
  wifiNetworks:     WifiNetwork[] = [];
  selectedNetwork:  WifiNetwork | null = null;
  isWifiScanning  = false;

  // ── Form ──────────────────────────────────────────────
  ssid         = '';
  password     = '';
  showPassword = false;
  isSending    = false;

  // ── Send result ───────────────────────────────────────
  sendError = '';

  constructor(
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({
      bluetoothOutline, searchOutline, syncOutline, hardwareChipOutline,
      chevronForwardOutline, wifiOutline, lockClosedOutline, eyeOutline,
      eyeOffOutline, sendOutline, checkmarkCircleOutline, pencilOutline,
      scanOutline, arrowBackOutline, closeOutline, refreshOutline
    });
  }

  async ngOnInit() {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
    } catch (e) {
      console.error('BLE init error', e);
    }
  }

  async ngOnDestroy() {
    if (this.connectedDeviceId) {
      try { await BleClient.disconnect(this.connectedDeviceId); } catch {}
    }
    try { await BleClient.stopLEScan(); } catch {}
  }

  // ── Step 1: BLE Scan ──────────────────────────────────
  async startScan() {
    this.isScanning   = true;
    this.scanDone     = false;
    this.foundDevices = [];

    try {
      await BleClient.requestLEScan(
        { services: [SERVICE_UUID] },
        (result: ScanResult) => {
          const exists = this.foundDevices.find(d => d.device.deviceId === result.device.deviceId);
          if (!exists) this.foundDevices.push(result);
        }
      );

      setTimeout(async () => {
        await BleClient.stopLEScan();
        this.isScanning = false;
        this.scanDone   = true;
      }, 8000);

    } catch (e: any) {
      this.isScanning = false;
      this.scanDone   = true;
      this.showToast('Scan failed: ' + e.message, 'danger');
    }
  }

  // ── Step 1: Connect to drone ──────────────────────────
  async connectToDevice(device: ScanResult) {
    try {
      await BleClient.stopLEScan();
      this.isScanning = false;

      await BleClient.connect(device.device.deviceId);
      this.connectedDeviceId   = device.device.deviceId;
      this.connectedDeviceName = device.localName || device.device.name || 'Drone';
      this.step = 'choose';
      this.showToast('Connected to ' + this.connectedDeviceName, 'success');
    } catch (e: any) {
      this.showToast('Connection failed: ' + e.message, 'danger');
    }
  }

  // ── Step 2: Choose mode ───────────────────────────────
  chooseManual() {
    this.ssid     = '';
    this.password = '';
    this.step     = 'manual';
  }

  async chooseScan() {
    this.step           = 'scanning';
    this.isWifiScanning = true;
    this.wifiNetworks   = [];

    try {
      // Tell ESP32 to scan for WiFi networks
      const cmd     = JSON.stringify({ command: 'scan_wifi' });
      const encoder = new TextEncoder();
      const bytes   = encoder.encode(cmd);
      const data    = new DataView(bytes.buffer);

      // Subscribe to notifications before writing
      await BleClient.startNotifications(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (value: DataView) => {
          const raw = new TextDecoder().decode(value);
          console.log('BLE wifi scan response:', raw);
          this.handleScanResponse(raw);
        }
      );

      await BleClient.write(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        data
      );

      // Timeout if ESP never responds
      setTimeout(() => {
        if (this.isWifiScanning) {
          this.isWifiScanning = false;
          BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
          if (this.wifiNetworks.length === 0) {
            this.showToast('No networks received. Try manual entry.', 'warning');
            this.step = 'manual';
          }
        }
      }, 15000);

    } catch (e: any) {
      this.isWifiScanning = false;
      this.showToast('WiFi scan failed: ' + e.message, 'danger');
      this.step = 'choose';
    }
  }

  private handleScanResponse(raw: string) {
    try {
      if (raw.startsWith('WIFI_LIST:')) {
        const json = raw.substring('WIFI_LIST:'.length);
        const networks: WifiNetwork[] = JSON.parse(json);
        this.wifiNetworks   = networks.sort((a, b) => b.rssi - a.rssi);
        this.isWifiScanning = false;
        this.step           = 'pick';
        BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
      } else if (raw.startsWith('ERROR:')) {
        this.isWifiScanning = false;
        this.showToast('Scan error: ' + raw, 'danger');
        this.step = 'choose';
        BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to parse wifi list', e);
    }
  }

  // ── Step 3a: Re-scan WiFi ─────────────────────────────
  async rescanWifi() {
    await BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
    this.chooseScan();
  }

  // ── Step 3a: Select network from list ────────────────
  selectNetwork(network: WifiNetwork) {
    this.selectedNetwork = network;
    this.ssid            = network.ssid;
    this.password        = '';
    this.showPassword    = false;

    if (network.open) {
      // No password needed — go straight to send
      this.sendCredentials();
    } else {
      this.step = 'password';
    }
  }

  // ── Step 3b / 4: Confirm and send ────────────────────
  async sendCredentials() {
    if (!this.ssid.trim() || !this.connectedDeviceId) return;
    this.isSending  = true;
    this.sendError  = '';
    this.step       = 'sending';

    try {
      const payload = JSON.stringify({
        ssid:     this.ssid.trim(),
        password: this.password
      });

      const encoder = new TextEncoder();
      const bytes   = encoder.encode(payload);
      const data    = new DataView(bytes.buffer);

      // Start listening for the result BEFORE writing
      await BleClient.startNotifications(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (value: DataView) => {
          const response = new TextDecoder().decode(value);
          console.log('BLE send response:', response);
          this.handleSendResponse(response);
        }
      );

      await BleClient.write(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        data
      );

      // Timeout — ESP may have restarted after connecting
      setTimeout(() => {
        if (this.isSending) {
          this.isSending = false;
          BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
          this.showToast('No response — drone may be restarting.', 'warning');
          this.step = 'done';
        }
      }, 20000); // 20s because ESP32 WiFi connect can take a while

    } catch (e: any) {
      this.isSending = false;
      this.step      = this.selectedNetwork ? 'password' : 'manual';
      this.showToast('Failed to send: ' + e.message, 'danger');
    }
  }

  private handleSendResponse(response: string) {
    this.isSending = false;
    BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});

    if (response.startsWith('OK:wifi_connected')) {
      this.step = 'done';
      this.showToast('Drone connected to WiFi!', 'success');
    } else if (response.startsWith('ERROR:wifi_failed')) {
      this.sendError = 'Drone could not connect to "' + this.ssid + '". Check the password and try again.';
      this.step      = this.selectedNetwork ? 'password' : 'manual';
      this.showToast('Wrong password or network unreachable.', 'danger');
    } else if (response.startsWith('ERROR:')) {
      this.sendError = response;
      this.step      = this.selectedNetwork ? 'password' : 'manual';
      this.showToast('Error: ' + response, 'danger');
    }
  }

  // ── Back navigation ───────────────────────────────────
  goBack() {
    BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
    switch (this.step) {
      case 'choose':   this.step = 'scan'; this.disconnect(); break;
      case 'scanning': this.step = 'choose'; this.isWifiScanning = false; break;
      case 'pick':     this.step = 'choose'; break;
      case 'password': this.step = 'pick'; this.selectedNetwork = null; break;
      case 'manual':   this.step = 'choose'; break;
      case 'sending':  break; // can't go back while sending
      default: break;
    }
  }

  // ── Disconnect ────────────────────────────────────────
  async disconnect() {
    try { await BleClient.disconnect(this.connectedDeviceId); } catch {}
    this.connectedDeviceId   = '';
    this.connectedDeviceName = '';
    this.wifiNetworks        = [];
    this.selectedNetwork     = null;
    this.step                = 'scan';
  }

  // ── Signal strength helpers ───────────────────────────
  signalBars(rssi: number): number {
    if (rssi >= -50) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -75) return 2;
    return 1;
  }

  signalLabel(rssi: number): string {
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -65) return 'Good';
    if (rssi >= -75) return 'Fair';
    return 'Weak';
  }

  // ── Toast ─────────────────────────────────────────────
  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'bottom' });
    toast.present();
  }
}