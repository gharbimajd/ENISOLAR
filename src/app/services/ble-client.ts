import { Injectable } from '@angular/core';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';
import { Waypoint } from '../models/mission.model';

@Injectable({
  providedIn: 'root'
})
export class BleClientService {
  private connectedDevice: BleDevice | null = null;
  private readonly SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  private readonly CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  constructor() {
    this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      await BleClient.initialize();
      console.log('BLE Client initialized');
    } catch (error) {
      console.error('Error initializing BLE:', error);
      throw error;
    }
  }

  async scanDevices(timeout: number = 5000): Promise<BleDevice[]> {
    const devices: BleDevice[] = [];

    try {
      await BleClient.requestLEScan(
        {
          services: [this.SERVICE_UUID]
        },
        (result) => {
          if (!devices.find(d => d.deviceId === result.device.deviceId)) {
            devices.push(result.device);
            console.log('Device found:', result.device);
          }
        }
      );

      await new Promise(resolve => setTimeout(resolve, timeout));
      await BleClient.stopLEScan();

      return devices;
    } catch (error) {
      console.error('Error scanning devices:', error);
      throw error;
    }
  }

  async connect(device: BleDevice): Promise<void> {
    try {
      await BleClient.connect(device.deviceId, (deviceId) => {
        console.log(`Device ${deviceId} disconnected`);
        this.connectedDevice = null;
      });

      this.connectedDevice = device;
      console.log('Connected to device:', device);
    } catch (error) {
      console.error('Error connecting to device:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    try {
      await BleClient.disconnect(this.connectedDevice.deviceId);
      this.connectedDevice = null;
      console.log('Disconnected from device');
    } catch (error) {
      console.error('Error disconnecting:', error);
      throw error;
    }
  }

  async sendWaypoints(waypoints: Waypoint[]): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      const chunkSize = 20;
      
      for (let i = 0; i < waypoints.length; i += chunkSize) {
        const chunk = waypoints.slice(i, i + chunkSize);
        const chunkData = this.prepareWaypointsData(chunk);
        
        await BleClient.write(
          this.connectedDevice.deviceId,
          this.SERVICE_UUID,
          this.CHARACTERISTIC_UUID,
          chunkData
        );

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('Waypoints sent successfully');
    } catch (error) {
      console.error('Error sending waypoints:', error);
      throw error;
    }
  }

  private prepareWaypointsData(waypoints: Waypoint[]): DataView {
    const json = JSON.stringify(waypoints);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    return new DataView(bytes.buffer);
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): BleDevice | null {
    return this.connectedDevice;
  }

  async read(): Promise<string> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      const result = await BleClient.read(
        this.connectedDevice.deviceId,
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID
      );

      const decoder = new TextDecoder();
      return decoder.decode(result);
    } catch (error) {
      console.error('Error reading from device:', error);
      throw error;
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      return await BleClient.isEnabled();
    } catch (error) {
      console.error('Error checking Bluetooth status:', error);
      return false;
    }
  }

  async requestEnable(): Promise<void> {
    try {
      await BleClient.requestEnable();
    } catch (error) {
      console.error('Error requesting Bluetooth enable:', error);
      throw error;
    }
  }
}