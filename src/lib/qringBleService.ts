/**
 * QRing & Vyta One Web Bluetooth Low Energy (BLE) GATT Service
 * Handles device discovery, connection, battery reading, and live biometric telemetry.
 */

// UUIDs extracted from QRing / QCWireless official SDKs
export const QRING_SERVICE_UUID = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
export const QRING_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone to Ring (Write)
export const QRING_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Ring to Phone (Notify)

export const STANDARD_BATTERY_SERVICE_UUID = 'battery_service'; // 0x180F
export const STANDARD_BATTERY_LEVEL_UUID = 'battery_level'; // 0x2A19

export const STANDARD_HEART_RATE_SERVICE_UUID = 'heart_rate'; // 0x180D
export const STANDARD_HEART_RATE_MEASUREMENT_UUID = 'heart_rate_measurement'; // 0x2A37

export interface BleRingData {
  batteryPct?: number;
  heartRate?: number;
  deviceName?: string;
  isConnected: boolean;
}

type RingListener = (data: BleRingData) => void;

class QRingBleService {
  private device: any | null = null;
  private server: any | null = null;
  private rxChar: any | null = null;
  private txChar: any | null = null;
  private listeners: Set<RingListener> = new Set();
  private isConnecting = false;

  public isSupported(): boolean {
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
   * Request Bluetooth pairing with the Smart Ring
   */
  public async requestAndConnect(): Promise<{ success: boolean; deviceName: string; battery?: number }> {
    if (!this.isSupported()) {
      console.warn('[QRing BLE] Web Bluetooth is not supported on this platform/browser.');
      return { success: false, deviceName: 'Vyta One (Simulation)' };
    }

    if (this.isConnecting) return { success: false, deviceName: '' };
    this.isConnecting = true;

    try {
      console.log('[QRing BLE] Requesting Bluetooth Device...');
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
        ],
      });

      this.device = device;
      const deviceName = device.name || 'Vyta One';

      device.addEventListener('gattserverdisconnected', () => {
        console.warn('[QRing BLE] Device disconnected');
        this.notify({ isConnected: false, deviceName });
      });

      console.log('[QRing BLE] Connecting to GATT Server...');
      const server = await device.gatt?.connect();
      this.server = server;

      let batteryLevel: number | undefined;

      // Try reading standard battery service first
      try {
        const batteryService = await server.getPrimaryService(STANDARD_BATTERY_SERVICE_UUID);
        const batteryChar = await batteryService.getCharacteristic(STANDARD_BATTERY_LEVEL_UUID);
        const val = await batteryChar.readValue();
        batteryLevel = val.getUint8(0);
        console.log('[QRing BLE] Read Standard Battery:', batteryLevel);
      } catch (e) {
        console.log('[QRing BLE] Standard battery service not available, attempting vendor service...');
      }

      // Try vendor service (QRing Nordic UART / QCWireless)
      try {
        const vendorService = await server.getPrimaryService(QRING_SERVICE_UUID);
        this.rxChar = await vendorService.getCharacteristic(QRING_RX_CHAR_UUID);
        this.txChar = await vendorService.getCharacteristic(QRING_TX_CHAR_UUID);

        // Start listening to notifications
        await this.txChar.startNotifications();
        this.txChar.addEventListener('characteristicvaluechanged', (evt: any) => {
          this.handleVendorNotification(evt.target.value);
        });

        // Request battery command if vendor protocol
        await this.sendBatteryRequest();
      } catch (e) {
        console.log('[QRing BLE] Vendor service setup notice:', e);
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
      console.warn('[QRing BLE] User cancelled or pairing failed:', err);
      return { success: false, deviceName: '' };
    }
  }

  /**
   * Send battery status request packet to the ring
   */
  public async sendBatteryRequest() {
    if (!this.rxChar) return;
    try {
      // Packet format based on QCWireless SDK protocol: Command for reading battery
      const cmd = new Uint8Array([0x03, 0x01, 0x00, 0x04]);
      await this.rxChar.writeValue(cmd);
    } catch (e) {
      console.error('[QRing BLE] Failed to send battery request:', e);
    }
  }

  /**
   * Start real-time heart rate sensor on the ring (PPG green LED continuous sampling)
   * QCWireless / QRing SDK: Opcode 0x01, Sub 0x01 (Start)
   */
  public async startRealTimeHeartRate(): Promise<boolean> {
    if (!this.rxChar) {
      console.log('[QRing BLE] Ring not connected via BLE - running in simulation mode');
      return false;
    }
    try {
      const cmd = new Uint8Array([0x01, 0x01, 0x00, 0x02]);
      await this.rxChar.writeValue(cmd);
      console.log('[QRing BLE] Sent Start Real-Time Heart Rate command (0x01 0x01)');
      return true;
    } catch (e) {
      console.error('[QRing BLE] Failed to start real-time heart rate:', e);
      return false;
    }
  }

  /**
   * Stop real-time heart rate sensor on the ring to preserve battery
   * QCWireless / QRing SDK: Opcode 0x01, Sub 0x00 (Stop)
   */
  public async stopRealTimeHeartRate(): Promise<boolean> {
    if (!this.rxChar) return false;
    try {
      const cmd = new Uint8Array([0x01, 0x00, 0x00, 0x01]);
      await this.rxChar.writeValue(cmd);
      console.log('[QRing BLE] Sent Stop Real-Time Heart Rate command (0x01 0x00)');
      return true;
    } catch (e) {
      console.error('[QRing BLE] Failed to stop real-time heart rate:', e);
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

  public disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.rxChar = null;
    this.txChar = null;
  }
}

export const qringBle = new QRingBleService();
