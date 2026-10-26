/**
 * QRing & Vyta One Dual BLE Service
 * Supports:
 * 1. Native iOS & Android via @capacitor-community/bluetooth-le (CoreBluetooth)
 * 2. Web Bluetooth Low Energy (navigator.bluetooth) for desktop & Bluefy iOS
 */

import { Capacitor } from '@capacitor/core';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

// UUIDs extracted from QRing / QCWireless official SDKs
export const QRING_SERVICE_UUID = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
export const QRING_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone to Ring (Write)
export const QRING_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Ring to Phone (Notify)

export const STANDARD_BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
export const STANDARD_BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb';

export const STANDARD_HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const STANDARD_HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

export interface BleRingData {
  batteryPct?: number;
  heartRate?: number;
  deviceName?: string;
  isConnected: boolean;
}

type RingListener = (data: BleRingData) => void;

class QRingBleService {
  // Web BLE state
  private webDevice: any | null = null;
  private webServer: any | null = null;
  private webRxChar: any | null = null;
  private webTxChar: any | null = null;

  // Native BLE state
  private nativeDeviceId: string | null = null;
  private isNativeBleInitialized = false;

  private listeners: Set<RingListener> = new Set();
  private isConnecting = false;

  public isSupported(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public subscribe(listener: RingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(data: BleRingData) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[QRing BLE] Listener error:', e);
      }
    });
  }

  /**
   * Request Bluetooth pairing with the Smart Ring (Native CoreBluetooth or Web BLE)
   */
  public async requestAndConnect(): Promise<{ success: boolean; deviceName: string; battery?: number }> {
    if (!this.isSupported()) {
      console.warn('[QRing BLE] Bluetooth is not supported on this platform/browser.');
      return { success: false, deviceName: 'Vyta One (Simulation)' };
    }

    if (this.isConnecting) return { success: false, deviceName: '' };
    this.isConnecting = true;

    if (Capacitor.isNativePlatform()) {
      return this.connectNative();
    } else {
      return this.connectWeb();
    }
  }

  /* ---------------- Native iOS / Android BleClient ---------------- */
  private async connectNative(): Promise<{ success: boolean; deviceName: string; battery?: number }> {
    try {
      if (!this.isNativeBleInitialized) {
        await BleClient.initialize();
        this.isNativeBleInitialized = true;
      }

      console.log('[QRing BLE Native] Requesting native Bluetooth device dialog...');
      const device = await BleClient.requestDevice({
        services: [QRING_SERVICE_UUID],
        optionalServices: [
          STANDARD_BATTERY_SERVICE_UUID,
          STANDARD_HEART_RATE_SERVICE_UUID,
          '7905fff0-b5ce-4e99-a40f-4b1e122d00d0',
        ],
        namePrefix: 'QRing',
      }).catch(async () => {
        // Fallback without name filter
        return BleClient.requestDevice({
          optionalServices: [
            QRING_SERVICE_UUID,
            STANDARD_BATTERY_SERVICE_UUID,
            STANDARD_HEART_RATE_SERVICE_UUID,
          ],
        });
      });

      this.nativeDeviceId = device.deviceId;
      const deviceName = device.name || 'Vyta One';

      console.log('[QRing BLE Native] Connecting to:', device.deviceId);
      await BleClient.connect(device.deviceId, () => {
        console.warn('[QRing BLE Native] Disconnected from device:', device.deviceId);
        this.nativeDeviceId = null;
        this.notify({ isConnected: false, deviceName });
      });

      let batteryLevel: number | undefined;

      // Try reading battery level characteristic
      try {
        const val = await BleClient.read(device.deviceId, STANDARD_BATTERY_SERVICE_UUID, STANDARD_BATTERY_LEVEL_UUID);
        batteryLevel = val.getUint8(0);
        console.log('[QRing BLE Native] Battery level:', batteryLevel);
      } catch (e) {
        console.log('[QRing BLE Native] Standard battery service not exposed, trying vendor query...');
      }

      // Start notifications on vendor TX characteristic
      try {
        await BleClient.startNotifications(
          device.deviceId,
          QRING_SERVICE_UUID,
          QRING_TX_CHAR_UUID,
          (value) => {
            this.handleVendorNotification(value);
          }
        );
        console.log('[QRing BLE Native] Notifications started on TX characteristic');

        // Send battery request command (QCWireless protocol)
        await this.sendBatteryRequest();
      } catch (e) {
        console.warn('[QRing BLE Native] Could not attach vendor notifications:', e);
      }

      this.notify({
        isConnected: true,
        deviceName,
        batteryPct: batteryLevel,
      });

      this.isConnecting = false;
      return { success: true, deviceName, battery: batteryLevel };
    } catch (err) {
      this.isConnecting = false;
      console.warn('[QRing BLE Native] Native pairing cancelled or failed:', err);
      return { success: false, deviceName: '' };
    }
  }

  /* ---------------- Web Bluetooth (Desktop / Android / Bluefy) ---------------- */
  private async connectWeb(): Promise<{ success: boolean; deviceName: string; battery?: number }> {
    try {
      console.log('[QRing BLE Web] Requesting Web Bluetooth Device...');
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [QRING_SERVICE_UUID] },
          { namePrefix: 'QRing' },
          { namePrefix: 'Vyta' },
          { namePrefix: 'QC' },
          { namePrefix: 'Ring' },
        ],
        optionalServices: [
          QRING_SERVICE_UUID,
          '7905fff0-b5ce-4e99-a40f-4b1e122d00d0',
          STANDARD_BATTERY_SERVICE_UUID,
          STANDARD_HEART_RATE_SERVICE_UUID,
          'battery_service',
          'heart_rate',
        ],
      });

      this.webDevice = device;
      const deviceName = device.name || 'Vyta One';

      device.addEventListener('gattserverdisconnected', () => {
        console.warn('[QRing BLE Web] Device disconnected');
        this.notify({ isConnected: false, deviceName });
      });

      console.log('[QRing BLE Web] Connecting to GATT Server...');
      const server = await device.gatt?.connect();
      this.webServer = server;

      let batteryLevel: number | undefined;

      // Try reading standard battery service first
      try {
        const batteryService = await server.getPrimaryService('battery_service').catch(() => server.getPrimaryService(STANDARD_BATTERY_SERVICE_UUID));
        const batteryChar = await batteryService.getCharacteristic('battery_level').catch(() => batteryService.getCharacteristic(STANDARD_BATTERY_LEVEL_UUID));
        const val = await batteryChar.readValue();
        batteryLevel = val.getUint8(0);
        console.log('[QRing BLE Web] Read Standard Battery:', batteryLevel);
      } catch (e) {
        console.log('[QRing BLE Web] Standard battery service not available, attempting vendor service...');
      }

      // Try vendor service (QRing Nordic UART / QCWireless)
      try {
        const vendorService = await server.getPrimaryService(QRING_SERVICE_UUID);
        this.webRxChar = await vendorService.getCharacteristic(QRING_RX_CHAR_UUID);
        this.webTxChar = await vendorService.getCharacteristic(QRING_TX_CHAR_UUID);

        // Start listening to notifications
        await this.webTxChar.startNotifications();
        this.webTxChar.addEventListener('characteristicvaluechanged', (evt: any) => {
          this.handleVendorNotification(evt.target.value);
        });

        // Request battery command if vendor protocol
        await this.sendBatteryRequest();
      } catch (e) {
        console.log('[QRing BLE Web] Vendor service setup notice:', e);
      }

      this.notify({
        isConnected: true,
        deviceName,
        batteryPct: batteryLevel,
      });

      this.isConnecting = false;
      return { success: true, deviceName, battery: batteryLevel };
    } catch (err) {
      this.isConnecting = false;
      console.warn('[QRing BLE Web] User cancelled or pairing failed:', err);
      return { success: false, deviceName: '' };
    }
  }

  /**
   * Send battery status request packet to the ring
   */
  public async sendBatteryRequest() {
    const cmdArray = [0x03, 0x01, 0x00, 0x04];
    if (Capacitor.isNativePlatform() && this.nativeDeviceId) {
      try {
        await BleClient.write(
          this.nativeDeviceId,
          QRING_SERVICE_UUID,
          QRING_RX_CHAR_UUID,
          numbersToDataView(cmdArray)
        );
      } catch (e) {
        console.error('[QRing BLE Native] Failed to send battery request:', e);
      }
      return;
    }

    if (this.webRxChar) {
      try {
        const cmd = new Uint8Array(cmdArray);
        await this.webRxChar.writeValue(cmd);
      } catch (e) {
        console.error('[QRing BLE Web] Failed to send battery request:', e);
      }
    }
  }

  /**
   * Start real-time heart rate sensor on the ring (PPG green LED continuous sampling)
   * QCWireless / QRing SDK: Opcode 0x01, Sub 0x01 (Start)
   */
  public async startRealTimeHeartRate(): Promise<boolean> {
    const cmdArray = [0x01, 0x01, 0x00, 0x02];
    if (Capacitor.isNativePlatform() && this.nativeDeviceId) {
      try {
        await BleClient.write(
          this.nativeDeviceId,
          QRING_SERVICE_UUID,
          QRING_RX_CHAR_UUID,
          numbersToDataView(cmdArray)
        );
        console.log('[QRing BLE Native] Sent Start Real-Time Heart Rate command');
        return true;
      } catch (e) {
        console.error('[QRing BLE Native] Failed to start real-time heart rate:', e);
        return false;
      }
    }

    if (!this.webRxChar) {
      console.log('[QRing BLE] Ring not connected via BLE - running in simulation mode');
      return false;
    }
    try {
      const cmd = new Uint8Array(cmdArray);
      await this.webRxChar.writeValue(cmd);
      console.log('[QRing BLE Web] Sent Start Real-Time Heart Rate command');
      return true;
    } catch (e) {
      console.error('[QRing BLE Web] Failed to start real-time heart rate:', e);
      return false;
    }
  }

  /**
   * Stop real-time heart rate sensor on the ring to preserve battery
   * QCWireless / QRing SDK: Opcode 0x01, Sub 0x00 (Stop)
   */
  public async stopRealTimeHeartRate(): Promise<boolean> {
    const cmdArray = [0x01, 0x00, 0x00, 0x01];
    if (Capacitor.isNativePlatform() && this.nativeDeviceId) {
      try {
        await BleClient.write(
          this.nativeDeviceId,
          QRING_SERVICE_UUID,
          QRING_RX_CHAR_UUID,
          numbersToDataView(cmdArray)
        );
        console.log('[QRing BLE Native] Sent Stop Real-Time Heart Rate command');
        return true;
      } catch (e) {
        console.error('[QRing BLE Native] Failed to stop real-time heart rate:', e);
        return false;
      }
    }

    if (!this.webRxChar) return false;
    try {
      const cmd = new Uint8Array(cmdArray);
      await this.webRxChar.writeValue(cmd);
      console.log('[QRing BLE Web] Sent Stop Real-Time Heart Rate command');
      return true;
    } catch (e) {
      console.error('[QRing BLE Web] Failed to stop real-time heart rate:', e);
      return false;
    }
  }

  private handleVendorNotification(dataView: DataView) {
    if (!dataView || dataView.byteLength === 0) return;
    const len = dataView.byteLength;
    const header = dataView.getUint8(0);

    // Parsing QCWireless packets
    if (len >= 3) {
      // Battery packet response
      if (header === 0x03 || header === 0x0C) {
        const batteryVal = dataView.getUint8(1);
        if (batteryVal <= 100) {
          this.notify({ batteryPct: batteryVal, isConnected: true });
        }
      }
      // Real-time Heart Rate packet response
      if (header === 0x01 || header === 0x11) {
        const hr = dataView.getUint8(1);
        if (hr > 30 && hr < 240) {
          this.notify({ heartRate: hr, isConnected: true });
        }
      }
    }
  }

  public async disconnect() {
    if (Capacitor.isNativePlatform() && this.nativeDeviceId) {
      try {
        await BleClient.disconnect(this.nativeDeviceId);
      } catch (e) {}
      this.nativeDeviceId = null;
    }

    if (this.webDevice?.gatt?.connected) {
      try {
        this.webDevice.gatt.disconnect();
      } catch (e) {}
    }
    this.webDevice = null;
    this.webServer = null;
    this.webRxChar = null;
    this.webTxChar = null;
  }
}

export const qringBle = new QRingBleService();
