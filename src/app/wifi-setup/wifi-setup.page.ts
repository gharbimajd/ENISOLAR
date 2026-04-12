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
  eyeOffOutline, sendOutline, checkmarkCircleOutline
} from 'ionicons/icons';

const SERVICE_UUID        = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

@Component({
  selector: 'app-wifi-setup',
  templateUrl: './wifi-setup.page.html',
  styleUrls: ['./wifi-setup.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class WifiSetupPage implements OnInit, OnDestroy {
  step: 'scan' | 'configure' | 'done' = 'scan';

  // Scan
  isScanning = false;
  scanDone   = false;
  foundDevices: ScanResult[] = [];

  // Connection
  connectedDeviceId   = '';
  connectedDeviceName = '';

  // Form
  ssid         = '';
  password     = '';
  showPassword = false;
  isSending    = false;

  constructor(
    private router: Router,
    private toastCtrl: ToastController
  ) {
    addIcons({
      bluetoothOutline, searchOutline, syncOutline, hardwareChipOutline,
      chevronForwardOutline, wifiOutline, lockClosedOutline, eyeOutline,
      eyeOffOutline, sendOutline, checkmarkCircleOutline
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

  // ── Scan ──────────────────────────────────────────────
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

  // ── Connect ───────────────────────────────────────────
 async connectToDevice(device: ScanResult) {
  try {
    await BleClient.stopLEScan();
    this.isScanning = false;

    await BleClient.connect(device.device.deviceId);
    this.connectedDeviceId   = device.device.deviceId;
    this.connectedDeviceName = device.localName || device.device.name || 'Drone';
    this.step = 'configure';
    this.showToast('Connected to ' + this.connectedDeviceName, 'success');
  } catch (e: any) {
    this.showToast('Connection failed: ' + e.message, 'danger');
  }
}

  // ── Send credentials ──────────────────────────────────
  async sendCredentials() {
    if (!this.ssid.trim() || !this.connectedDeviceId) return;
    this.isSending = true;

    try {
      const payload = JSON.stringify({
        ssid:     this.ssid.trim(),
        password: this.password
      });

      // Encode string to DataView
      const encoder = new TextEncoder();
      const bytes   = encoder.encode(payload);
      const data    = new DataView(bytes.buffer);

      await BleClient.write(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        data
      );

      // Listen for response
      await BleClient.startNotifications(
        this.connectedDeviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (value: DataView) => {
          const response = new TextDecoder().decode(value);
          console.log('BLE response:', response);

          if (response.startsWith('OK')) {
            this.step = 'done';
            this.showToast('WiFi credentials sent successfully!', 'success');
          } else {
            this.showToast('Drone rejected credentials: ' + response, 'danger');
          }

          this.isSending = false;
          BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => {});
        }
      );

      // Timeout fallback — if no response in 5s
      setTimeout(() => {
        if (this.isSending) {
          this.isSending = false;
          this.showToast('No response from drone. It may have restarted.', 'warning');
          this.step = 'done';
        }
      }, 5000);

    } catch (e: any) {
      this.isSending = false;
      this.showToast('Failed to send: ' + e.message, 'danger');
    }
  }

  // ── Disconnect ────────────────────────────────────────
  async disconnect() {
    try {
      await BleClient.disconnect(this.connectedDeviceId);
    } catch {}
    this.connectedDeviceId   = '';
    this.connectedDeviceName = '';
    this.step = 'scan';
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'bottom' });
    toast.present();
  }
}