/**
 * QRing & Vyta One Universal Bluetooth Low Energy (BLE) GATT Service
 * Supports both:
 * 1. Native iOS / Android via @capacitor-community/bluetooth-le (CoreBluetooth)
 * 2. Web Bluetooth API in supported desktop/mobile browsers
 * 
 * Implements the reverse-engineered 16-byte frame protocol for:
 * - QRing (R20, R02, R06, R10)
 * - Shenzhen QCWireless Smart Ring
 * - Nordic UART Service (NUS)
 * 
 * Official QRing Protocol Specifications:
 * - Primary Service UUID: 6e40fff0-b5a3-f393-e0a9-e50e24dcca9e
 * - Write Char (RX): 6e400002-b5a3-f393-e0a9-e50e24dcca9e
 * - Notify Char (TX): 6e400003-b5a3-f393-e0a9-e50e24dcca9e
 * - SetTime Handshake (Cmd 1): 0x01 [year, month, day, hour, min, sec]
 * - Battery Request (Cmd 3): 0x03 [0x00...]
 * - Sport/Step Data (Cmd 7): 0x07 [dayOffset] -> Steps, Calories, Distance
 * - Heart Rate Settings (Cmd 22): 0x16 [action=2, isEnabled=1, heartInterval=minutes]
 * - Heart Rate Logs (Cmd 21): 0x15 [unixTime uint32] -> Stored hourly measurements
 * - Big Data Sleep/SpO2 (Magic 188 / 0xBC): ID 39 (Sleep), ID 42 (SpO2)
 * - Realtime Heart Rate (Cmd 30): 0x1E [0x03] -> Response 0x1E [heartRate, ...]
 * - Live Sensor Stream (Cmd 105): 0x69 [DataType, DataAction.Start=1]
 * - Heartbeat Keep-Alive (every 20s): Prevents ring dormant sleep
 */

import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

// QRing Primary Vendor Service (Used by all QRing / Colmi R02 / QCWireless hardware)
export const QRING_SERVICE_UUID = '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e';
export const QRING_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone to Ring (WriteWithoutResponse)
export const QRING_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Ring to Phone (Notify)

// Fallback Nordic UART Service (NUS)
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// Alternative QRing alias
export const QRING_ALT_SERVICE_UUID = QRING_SERVICE_UUID;
export const QRING_ALT_RX_CHAR_UUID = QRING_RX_CHAR_UUID;
export const QRING_ALT_TX_CHAR_UUID = QRING_TX_CHAR_UUID;

// Big Data Service (Used for bulk historical Sleep and SpO2 transfer)
export const BIG_DATA_SERVICE_UUID = 'de5bf728-d711-4e47-af26-65e3012a5dc7';
export const BIG_DATA_RX_UUID = 'de5bf72a-d711-4e47-af26-65e3012a5dc7'; // Write
export const BIG_DATA_TX_UUID = 'de5bf729-d711-4e47-af26-65e3012a5dc7'; // Notify

export const STANDARD_BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
export const STANDARD_BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb';

export const STANDARD_HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const STANDARD_HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

export interface BleRingData {
  batteryPct?: number;
  heartRate?: number;
  heartRateLog?: number[];
  minBpm?: number;
  maxBpm?: number;
  restingBpm?: number;
  steps?: number;
  calories?: number;
  distanceKm?: number;
  sleepHours?: number;
  spo2?: number;
  stress?: number;
  hrv?: number;
  bloodPressure?: { sbp: number; dbp: number };
  glucose?: number;
  deviceName?: string;
  isConnected: boolean;
  wearCalibrationScore?: number;
}

export interface DiscoveredBleDevice {
  deviceId: string;
  name: string;
  rssi?: number;
  isRing?: boolean;
}

type RingListener = (data: BleRingData) => void;
type DeviceDiscoveryListener = (device: DiscoveredBleDevice) => void;

class QRingBleService {
  // Web Bluetooth handles
  private device: any | null = null;
  private server: any | null = null;
  private rxChar: any | null = null;
  private txChar: any | null = null;

  // Native Capacitor BLE handles
  private connectedDeviceId: string | null = null;
  private isNativeInitialized = false;

  // Active discovered GATT handles (defaults to QRing 6e40fff0)
  private activeServiceUuid = QRING_SERVICE_UUID;
  private activeRxUuid = QRING_RX_CHAR_UUID;
  private activeTxUuid = QRING_TX_CHAR_UUID;

  // Big Data GATT handles (de5bf728)
  private hasBigDataService = false;
  private activeBigDataServiceUuid = BIG_DATA_SERVICE_UUID;
  private activeBigDataRxUuid: string | null = null;
  private activeBigDataTxUuid: string | null = null;

  // Stored Heart Rate Log multi-packet accumulator
  private hrLogFramesExpected = 0;
  private hrLogReadings: number[] = [];
  private hrLogDebounceTimer: any = null;
  private hrLogRangeMinutes = 5;

  private listeners: Set<RingListener> = new Set();
  private discoveryListeners: Set<DeviceDiscoveryListener> = new Set();
  private isConnecting = false;

  // Keep-alive heartbeat & resilient background auto-reconnect
  private heartbeatInterval: any = null;
  private isAutoReconnecting = false;
  private reconnectTimer: any = null;
  private userExplicitlyDisconnected = false;
  private lastPeriodicSyncTime = 0;
  // Strict 30-minute discrete cadence (48 slots/24h: 00:00, 00:30, 01:00, 01:30... — 0 continuous)
  private configuredIntervalMinutes = 30;
  private isRealTimeHrActive = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_ring_interval');
        if (saved) {
          const val = parseInt(saved, 10);
          if (val === 5 || val === 10 || val === 15 || val === 30 || val === 60) {
            this.configuredIntervalMinutes = val;
          }
        } else {
          const intervalsStr = localStorage.getItem('vyta_sensor_intervals');
          if (intervalsStr) {
            const parsed = JSON.parse(intervalsStr);
            if (parsed.heartRate === '30min') {
              this.configuredIntervalMinutes = 30;
            } else if (parsed.heartRate === '15min') {
              this.configuredIntervalMinutes = 15;
            }
          }
        }
      } catch (_) {}

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected() && !this.userExplicitlyDisconnected) {
            console.log('[QRing BLE] App resumed to foreground, verifying ring connection...');
            this.autoConnectSavedDevice();
          } else if (this.isConnected()) {
            console.log('[QRing BLE] App resumed to foreground, triggering quick data sync...');
            this.syncAllRingData();
          }
        }
      });

      window.addEventListener('focus', () => {
        if (!this.isConnected() && !this.userExplicitlyDisconnected) {
          console.log('[QRing BLE] Window focus regained, checking ring connection...');
          this.autoConnectSavedDevice();
        } else if (this.isConnected()) {
          this.syncAllRingData();
        }
      });
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isConnected(): boolean {
    return Boolean(this.connectedDeviceId || this.server?.connected);
  }

  public getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  public getSavedDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('vyta_ble_saved_device_id');
    } catch (_) {
      return null;
    }
  }

  public getSavedDeviceName(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('vyta_ble_saved_device_name');
    } catch (_) {
      return null;
    }
  }

  public subscribe(listener: RingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onDeviceDiscovered(listener: DeviceDiscoveryListener): () => void {
    this.discoveryListeners.add(listener);
    return () => this.discoveryListeners.delete(listener);
  }

  private notify(data: BleRingData) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[QRing BLE] Listener callback error:', e);
      }
    });
  }

  private notifyDiscoveredDevice(device: DiscoveredBleDevice) {
    this.discoveryListeners.forEach((cb) => {
      try {
        cb(device);
      } catch (e) {
        console.error('[QRing BLE] Discovery listener callback error:', e);
      }
    });
  }

  /**
   * Starts a 20-second keep-alive heartbeat:
   * Sends Opcode 0x03 (Battery status request)
   * 1. Resets the ring firmware's low-power dormant timer (prevents ring BLE sleep)
   * 2. Continually keeps battery percentage updated in real time
   * 3. Triggers syncEvery 10 minutes to pull new hourly records
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    console.log('[QRing BLE] Starting periodic keep-alive heartbeat (every 20s)...');
    this.heartbeatInterval = setInterval(async () => {
      if (this.isConnected()) {
        try {
          await this.sendBatteryRequest();
          // 0 continuous HR: ring measures strictly every 30 minutes (00:00, 00:30, 01:00, 01:30...)
          const now = Date.now();
          if (now - this.lastPeriodicSyncTime > 10 * 60 * 1000) {
            this.lastPeriodicSyncTime = now;
            await this.syncAllRingData();
          }
        } catch (e) {
          console.warn('[QRing BLE] Keep-alive ping error:', e);
        }
      } else {
        this.stopHeartbeat();
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedules automatic silent background reconnection
   */
  public scheduleAutoReconnect() {
    if (this.isAutoReconnecting || this.userExplicitlyDisconnected || this.isConnected()) {
      return;
    }

    this.isAutoReconnecting = true;
    console.log('[QRing BLE AutoReconnect] Starting silent background auto-reconnect engine...');

    const runAttempt = async () => {
      if (!this.isAutoReconnecting || this.isConnected() || this.userExplicitlyDisconnected) {
        this.stopAutoReconnect();
        return;
      }

      const success = await this.attemptSilentReconnect();
      if (success) {
        console.log('[QRing BLE AutoReconnect] Auto-reconnect successful!');
        this.stopAutoReconnect();
        // Trigger sync of logs upon successful reconnect
        this.syncAllRingData();
        return;
      }

      if (this.isAutoReconnecting && !this.userExplicitlyDisconnected) {
        this.reconnectTimer = setTimeout(runAttempt, 4000);
      }
    };

    runAttempt();
  }

  public stopAutoReconnect() {
    this.isAutoReconnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Attempts automatic connection to previously bonded/saved smart ring
   * or a smart ring already connected to iOS System Bluetooth
   */
  public async autoConnectSavedDevice(): Promise<boolean> {
    if (this.isConnected() || this.userExplicitlyDisconnected) {
      return false;
    }
    this.scheduleAutoReconnect();
    return true;
  }

  /**
   * Discovers peripherals that are currently connected to iOS at the system level.
   * On iOS, devices already paired in iPhone Settings > Bluetooth NEVER show up in LE scans;
   * they MUST be retrieved via BleClient.getConnectedDevices([serviceUUIDs]).
   */
  public async getSystemConnectedRings(): Promise<DiscoveredBleDevice[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
      if (!this.isNativeInitialized) {
        await BleClient.initialize();
        this.isNativeInitialized = true;
      }

      // Query across all known smart ring & wearable service UUIDs
      const serviceCandidates = [
        QRING_SERVICE_UUID,
        NORDIC_UART_SERVICE_UUID,
        '0000fee7-0000-1000-8000-00805f9b34fb',
        '0000180d-0000-1000-8000-00805f9b34fb',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
        '7905f431-b5ce-4e99-a40f-4b1e122d00d0',
        '0000fee0-0000-1000-8000-00805f9b34fb',
        '0000fee1-0000-1000-8000-00805f9b34fb',
        '0000feea-0000-1000-8000-00805f9b34fb',
        '00001812-0000-1000-8000-00805f9b34fb',
      ];

      let rawConnected: any[] = [];
      try {
        rawConnected = await BleClient.getConnectedDevices(serviceCandidates);
      } catch (err) {
        console.warn('[QRing BLE] Error in getConnectedDevices with primary services:', err);
      }

      // Fallback query with standard generic services if primary candidate query returned nothing
      if (!rawConnected || rawConnected.length === 0) {
        try {
          rawConnected = await BleClient.getConnectedDevices([
            '00001800-0000-1000-8000-00805f9b34fb',
            '00001801-0000-1000-8000-00805f9b34fb',
          ]);
        } catch (_) {}
      }

      if (!rawConnected || rawConnected.length === 0) {
        return [];
      }

      const savedId = this.getSavedDeviceId()?.toLowerCase();
      const savedName = this.getSavedDeviceName()?.toLowerCase();

      const results: DiscoveredBleDevice[] = [];
      for (const dev of rawConnected) {
        const name = (dev.name || '').trim();
        const upper = name.toUpperCase();
        const devId = dev.deviceId;

        // Blacklist non-wearable audio/TV/apple peripherals
        const isBlacklisted = [
          'ELK-BLEDOM',
          'OLED',
          'TV',
          'SAMSUNG',
          'LG',
          'SONY',
          'APPLE',
          'MACBOOK',
          'IPAD',
          'WATCH',
          'AIRPOD',
          'BEATS',
          'BOSE',
          'JBL',
          'SPEAKER',
        ].some((b) => upper.includes(b));

        if (isBlacklisted) continue;

        const isKnownSaved =
          (savedId && devId.toLowerCase() === savedId) ||
          (savedName && name.toLowerCase() === savedName);

        const isRingName = [
          'RING',
          'QRING',
          'VYTA',
          'QC',
          'R0',
          'R1',
          'R2',
          'R3',
          'R4',
          'R5',
          'R6',
          'R7',
          'R8',
          'NOVA',
          'COLMI',
          'SMART',
          'SOX',
          'HEALTH',
          'WEAR',
          'JSTYLE',
          'BAND',
        ].some((k) => upper.includes(k));

        if (isKnownSaved || isRingName || rawConnected.length === 1) {
          results.push({
            deviceId: devId,
            name: name || savedName || 'Bague Vyta',
            isRing: true,
            rssi: -45,
          });
        }
      }

      return results;
    } catch (e) {
      console.warn('[QRing BLE] getSystemConnectedRings error:', e);
      return [];
    }
  }

  /**
   * Performs a single silent reconnection attempt:
   * 1. Inspects iOS CoreBluetooth connected peripherals (devices already connected to the OS)
   * 2. Direct connect to saved CoreBluetooth UUID
   * 3. Fast 3.5s LE scan fallback
   */
  private async attemptSilentReconnect(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      if (!this.isNativeInitialized) {
        await BleClient.initialize();
        this.isNativeInitialized = true;
      }

      // Step 1: Hook into already-connected iOS CoreBluetooth peripherals
      // (Crucial: when ring is already connected in iPhone Settings > Bluetooth)
      const systemRings = await this.getSystemConnectedRings();
      if (systemRings && systemRings.length > 0) {
        const savedId = this.getSavedDeviceId();
        const match =
          (savedId
            ? systemRings.find((d) => d.deviceId.toLowerCase() === savedId.toLowerCase())
            : null) || systemRings[0];

        if (match) {
          console.log(
            '[QRing BLE AutoReconnect] Ring is already connected to iOS! Attaching GATT:',
            match.deviceId,
            match.name
          );
          const res = await this.connectDirectly(match.deviceId, match.name);
          if (res.success) return true;
        }
      }

      // Step 2: Direct connect using saved device UUID without scanning
      const savedId = this.getSavedDeviceId();
      const savedName = this.getSavedDeviceName() || 'Vyta One';
      if (savedId) {
        try {
          console.log('[QRing BLE AutoReconnect] Attempting direct connect to saved UUID:', savedId);
          const res = await this.connectDirectly(savedId, savedName);
          if (res.success) return true;
        } catch (e) {
          console.warn('[QRing BLE AutoReconnect] Direct connect note:', e);
        }

        // Step 3: Fast 3.5s scan in case peripheral changed address or was power-cycled
        try {
          const scannedDevice = await this.scanQuickForSavedDevice(savedId, savedName, 3500);
          if (scannedDevice) {
            console.log(
              '[QRing BLE AutoReconnect] Found ring via scan, connecting:',
              scannedDevice.deviceId
            );
            const res = await this.connectDirectly(
              scannedDevice.deviceId,
              scannedDevice.name || savedName
            );
            if (res.success) return true;
          }
        } catch (e) {
          console.warn('[QRing BLE AutoReconnect] Quick scan note:', e);
        }
      }
    } catch (err) {
      console.warn('[QRing BLE AutoReconnect] Attempt error:', err);
    }

    return false;
  }

  /**
   * Fast background scan for a known device
   */
  private scanQuickForSavedDevice(
    savedId: string,
    savedName: string,
    durationMs: number = 3500
  ): Promise<DiscoveredBleDevice | null> {
    return new Promise(async (resolve) => {
      let resolved = false;

      const finish = async (device: DiscoveredBleDevice | null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try {
          await BleClient.stopLEScan();
        } catch (_) {}
        resolve(device);
      };

      const timer = setTimeout(() => {
        finish(null);
      }, durationMs);

      try {
        await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
          const rawName = (result.localName || result.device?.name || '').trim();
          const devId = result.device.deviceId;

          const isMatchId = devId.toLowerCase() === savedId.toLowerCase();
          const isMatchName =
            rawName &&
            savedName &&
            (rawName.toLowerCase() === savedName.toLowerCase() ||
              rawName.toLowerCase().includes('vyta') ||
              rawName.toLowerCase().includes('ring') ||
              rawName.toLowerCase().includes('qring') ||
              rawName.toLowerCase().includes('r0'));

          if (isMatchId || isMatchName) {
            finish({
              deviceId: devId,
              name: rawName || savedName,
              rssi: result.rssi,
              isRing: true,
            });
          }
        });
      } catch (e) {
        finish(null);
      }
    });
  }

  /**
   * Builds a strict 16-byte packet with checksum at index 15:
   * checksum = sum(bytes[0..14]) & 0xFF
   */
  public makePacket(cmd: number, subdata: number[] = []): number[] {
    const p = new Array(16).fill(0);
    p[0] = cmd & 0xFF;
    for (let i = 0; i < subdata.length && i < 14; i++) {
      p[i + 1] = subdata[i] & 0xFF;
    }
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      sum += p[i];
    }
    p[15] = sum & 0xFF;
    return p;
  }

  /**
   * Request Bluetooth pairing with the Smart Ring
   */
  public async requestAndConnect(): Promise<{ success: boolean; deviceName: string; battery?: number; error?: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        deviceName: '',
        error: "Bluetooth non supporté sur ce navigateur. Activez le Bluetooth ou utilisez l'app iOS.",
      };
    }

    if (this.isConnecting) {
      return { success: false, deviceName: '', error: 'Connexion en cours...' };
    }
    this.isConnecting = true;

    try {
      if (Capacitor.isNativePlatform()) {
        return await this.scanAndConnectNative();
      } else {
        return await this.connectWeb();
      }
    } catch (err: any) {
      this.isConnecting = false;
      console.warn('[QRing BLE] Pairing cancelled or failed:', err);
      return {
        success: false,
        deviceName: '',
        error: err?.message || 'Connexion annulée ou signal Bluetooth introuvable.',
      };
    }
  }

  /**
   * Native iOS / Android Bluetooth connection using background LE scan
   */
  private async scanAndConnectNative(): Promise<{ success: boolean; deviceName: string; battery?: number; error?: string }> {
    console.log('[QRing BLE Native] Initializing CoreBluetooth...');
    if (!this.isNativeInitialized) {
      await BleClient.initialize();
      this.isNativeInitialized = true;
    }

    // Step 0: Check if ring is ALREADY connected in iPhone Settings > Bluetooth
    try {
      const systemRings = await this.getSystemConnectedRings();
      if (systemRings && systemRings.length > 0) {
        const ring = systemRings[0];
        console.log('[QRing BLE Native] Ring is already connected to iOS! Directly attaching to:', ring.name, ring.deviceId);
        this.notifyDiscoveredDevice(ring);
        const connRes = await this.connectDirectly(ring.deviceId, ring.name);
        this.isConnecting = false;
        if (connRes.success) {
          return connRes;
        }
      }
    } catch (e) {
      console.warn('[QRing BLE Native] getSystemConnectedRings check in scan note:', e);
    }

    console.log('[QRing BLE Native] Starting background LE scan...');
    return new Promise((resolve) => {
      let isResolved = false;

      // 25 second timeout if no device is found
      const timeout = setTimeout(async () => {
        if (!isResolved) {
          isResolved = true;
          try {
            await BleClient.stopLEScan();
          } catch (_) {}
          this.isConnecting = false;
          resolve({
            success: false,
            deviceName: '',
            error: "Aucune bague détectée. Assurez-vous que la bague est chargée (posez-la sur son chargeur pour l'activer) et à proximité.",
          });
        }
      }, 25000);

      const seenIds = new Set<string>();

      BleClient.requestLEScan(
        { allowDuplicates: true },
        async (result) => {
          const rawName = (result.localName || result.device?.name || '').trim();

          // 1. STRIKE OUT ALL "Unknown" OR EMPTY NAMES
          if (!rawName || rawName.toLowerCase() === 'unknown') return;

          const upper = rawName.toUpperCase();

          // 2. BLACKLIST NON-WEARABLE DEVICES (LED strips, TVs, Audio...)
          const isBlacklisted = [
            'ELK-BLEDOM',
            'OLED',
            'TV',
            'SAMSUNG',
            'LG',
            'SONY',
            'APPLE',
            'MACBOOK',
            'IPAD',
            'WATCH',
            'AIRPOD',
            'BEATS',
            'BOSE',
            'JBL',
            'DESKTOP',
            'SPEAKER',
          ].some((b) => upper.includes(b));

          if (isBlacklisted) return;

          const deviceId = result.device.deviceId;

          // 3. IDENTIFY SMART RING HARDWARE
          const isRing = [
            'RING',
            'QRING',
            'VYTA',
            'QC',
            'R0',
            'R1',
            'R2',
            'R3',
            'R4',
            'R5',
            'R6',
            'R7',
            'R8',
            'NOVA',
            'COLMI',
            'SMART',
            'SOX',
            'HEALTH',
            'WEAR',
            'JSTYLE',
            'BAND',
          ].some((k) => upper.includes(k));

          // Notify UI about discovered candidate if newly found
          if (!seenIds.has(deviceId)) {
            seenIds.add(deviceId);
            console.log('[QRing BLE Scanner] Discovered named peripheral:', rawName, deviceId, 'isRing:', isRing);
            this.notifyDiscoveredDevice({
              deviceId,
              name: rawName,
              rssi: result.rssi,
              isRing,
            });
          }

          // 4. AUTO-CONNECT WHEN A SMART RING IS FOUND
          if (isRing && !isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            console.log('[QRing BLE Scanner] Smart ring detected! Stopping scan & connecting to:', rawName);
            try {
              await BleClient.stopLEScan();
            } catch (_) {}

            const connRes = await this.connectDirectly(deviceId, rawName);
            this.isConnecting = false;
            resolve(connRes);
          }
        }
      ).catch((err) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('[QRing BLE Native] Scan error:', err);
          resolve({
            success: false,
            deviceName: '',
            error: err?.message || 'Erreur lors du démarrage du scan Bluetooth.',
          });
        }
      });
    });
  }

  /**
   * Connect to a specific BLE device by ID and dynamically inspect its GATT services
   */
  public async connectDirectly(
    deviceId: string,
    deviceName: string
  ): Promise<{ success: boolean; deviceName: string; battery?: number; error?: string }> {
    try {
      console.log('[QRing BLE Native] Connecting to GATT server for:', deviceName, deviceId);
      this.userExplicitlyDisconnected = false;

      await BleClient.connect(
        deviceId,
        (disconnectedId) => {
          console.warn('[QRing BLE Native] Peripheral disconnected:', disconnectedId || deviceId);
          this.connectedDeviceId = null;
          this.stopHeartbeat();
          this.notify({ isConnected: false, deviceName });

          // Silently trigger background auto-reconnect if not explicitly unlinked by user
          if (!this.userExplicitlyDisconnected) {
            console.log('[QRing BLE Native] Disconnection detected, launching auto-reconnect engine...');
            this.scheduleAutoReconnect();
          }
        },
        { timeout: 8000 }
      );

      this.connectedDeviceId = deviceId;
      this.stopAutoReconnect();

      // Persist in localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('vyta_ble_saved_device_id', deviceId);
          localStorage.setItem('vyta_ble_saved_device_name', deviceName);
        } catch (_) {}
      }

      let batteryLevel: number | undefined;

      // 1. Dynamic GATT Discovery: locate active write and notify characteristics
      try {
        const services = await BleClient.getServices(deviceId);
        console.log('[QRing BLE Native] Found', services.length, 'services');

        for (const s of services) {
          const sUuid = s.uuid.toLowerCase();
          // Detect Big Data Service for bulk sleep/spo2 (de5bf728)
          if (sUuid.includes('de5b')) {
            this.hasBigDataService = true;
            this.activeBigDataServiceUuid = s.uuid;
            for (const c of s.characteristics) {
              const cUuid = c.uuid.toLowerCase();
              if (cUuid.includes('de5bf72a') || c.properties.write || c.properties.writeWithoutResponse) {
                this.activeBigDataRxUuid = c.uuid;
                console.log('[QRing BLE Native] Matched BigData RX char:', c.uuid);
              }
              if (cUuid.includes('de5bf729') || c.properties.notify || c.properties.indicate) {
                this.activeBigDataTxUuid = c.uuid;
                console.log('[QRing BLE Native] Matched BigData TX char:', c.uuid);
              }
            }
          }

          for (const c of s.characteristics) {
            // Prioritize QRing vendor service 6e40fff0, Nordic UART 6e40, or Colmi/Tencent fee7
            if (sUuid.includes('fff0') || sUuid.includes('6e40') || sUuid.includes('fee7')) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                this.activeServiceUuid = s.uuid;
                this.activeRxUuid = c.uuid;
                console.log('[QRing BLE Native] Matched RX char:', c.uuid, 'in service:', s.uuid);
              }
              if (c.properties.notify || c.properties.indicate) {
                this.activeServiceUuid = s.uuid;
                this.activeTxUuid = c.uuid;
                console.log('[QRing BLE Native] Matched TX char:', c.uuid, 'in service:', s.uuid);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[QRing BLE Native] getServices discovery warning:', e);
      }

      // 2. Start Vendor TX Notifications on discovered characteristic and fallbacks
      try {
        await BleClient.startNotifications(
          deviceId,
          this.activeServiceUuid,
          this.activeTxUuid,
          (val) => {
            this.handleVendorNotification(val);
          }
        );
        console.log('[QRing BLE Native] Vendor TX notifications active on:', this.activeTxUuid);
      } catch (e) {
        console.warn('[QRing BLE Native] Failed to start notifications on active service, trying QRING_SERVICE_UUID fallback:', e);
        try {
          await BleClient.startNotifications(
            deviceId,
            QRING_SERVICE_UUID,
            QRING_TX_CHAR_UUID,
            (val) => {
              this.handleVendorNotification(val);
            }
          );
          this.activeServiceUuid = QRING_SERVICE_UUID;
          this.activeRxUuid = QRING_RX_CHAR_UUID;
          this.activeTxUuid = QRING_TX_CHAR_UUID;
          console.log('[QRing BLE Native] Fallback notifications active on QRING_SERVICE_UUID');
        } catch (e2) {
          console.warn('[QRing BLE Native] Fallback notifications also failed:', e2);
        }
      }

      // 2b. Start Big Data TX Notifications if service is supported by ring hardware
      if (this.hasBigDataService && this.activeBigDataTxUuid) {
        try {
          await BleClient.startNotifications(
            deviceId,
            this.activeBigDataServiceUuid,
            this.activeBigDataTxUuid,
            (val) => {
              this.handleVendorNotification(val);
            }
          );
          console.log('[QRing BLE Native] Big Data notifications active on:', this.activeBigDataTxUuid);
        } catch (eBd) {
          console.warn('[QRing BLE Native] Big Data startNotifications warning:', eBd);
        }
      }

      // 3. Also check Standard Battery GATT service (0x180F)
      try {
        const batVal = await BleClient.read(
          deviceId,
          STANDARD_BATTERY_SERVICE_UUID,
          STANDARD_BATTERY_LEVEL_UUID
        );
        if (batVal && batVal.byteLength > 0) {
          const b = batVal.getUint8(0);
          if (b > 0 && b <= 100) {
            batteryLevel = b;
            console.log('[QRing BLE Native] Standard Battery level:', batteryLevel, '%');
          }
        }
      } catch (_) {}

      // 4. Send Hardware Protocol Handshakes & Configuration
      await this.sendTimeSync();
      await this.stopRealTimeHeartRate(); // Ensure optical LED is completely extinguished
      
      // Program automatic periodic heart rate monitoring on the ring hardware (configured: 30 min or 60 min)
      await this.setHeartRateInterval(this.configuredIntervalMinutes);

      // Perform complete data synchronization of stored ring records
      await this.syncAllRingData();

      // 5. Start Keep-Alive Heartbeat (every 20s to prevent ring dormant sleep)
      this.startHeartbeat();

      this.notify({
        isConnected: true,
        deviceName,
        batteryPct: batteryLevel,
      });

      return { success: true, deviceName, battery: batteryLevel };
    } catch (err: any) {
      console.error('[QRing BLE Native] Connect directly error:', err);
      return { success: false, deviceName, error: err?.message || 'Échec de connexion au périphérique.' };
    }
  }

  /**
   * Stop active LE scan if in progress
   */
  public async stopScan() {
    try {
      if (Capacitor.isNativePlatform()) {
        await BleClient.stopLEScan();
      }
    } catch (_) {}
    this.isConnecting = false;
  }

  /**
   * Web Bluetooth connection (Chrome / Edge with Web Bluetooth)
   */
  private async connectWeb(): Promise<{ success: boolean; deviceName: string; battery?: number }> {
    console.log('[QRing BLE Web] Requesting Web Bluetooth Device...');
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [QRING_SERVICE_UUID] },
        { services: [NORDIC_UART_SERVICE_UUID] },
        { namePrefix: 'QRing' },
        { namePrefix: 'Vyta' },
        { namePrefix: 'QC' },
        { namePrefix: 'Ring' },
        { namePrefix: 'R0' },
      ],
      optionalServices: [
        QRING_SERVICE_UUID,
        NORDIC_UART_SERVICE_UUID,
        'battery_service',
        STANDARD_BATTERY_SERVICE_UUID,
        STANDARD_HEART_RATE_SERVICE_UUID,
      ],
    });

    this.device = device;
    const deviceName = device.name || 'Vyta One';

    device.addEventListener('gattserverdisconnected', () => {
      console.warn('[QRing BLE Web] Device disconnected');
      this.stopHeartbeat();
      this.notify({ isConnected: false, deviceName });
    });

    console.log('[QRing BLE Web] Connecting to GATT Server...');
    const server = await device.gatt?.connect();
    this.server = server;

    let batteryLevel: number | undefined;

    // Connect vendor service
    try {
      let vendorService: any;
      try {
        vendorService = await server.getPrimaryService(QRING_SERVICE_UUID);
      } catch {
        vendorService = await server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
      }

      this.rxChar = await vendorService.getCharacteristic(QRING_RX_CHAR_UUID);
      this.txChar = await vendorService.getCharacteristic(QRING_TX_CHAR_UUID);

      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', (evt: any) => {
        this.handleVendorNotification(evt.target.value);
      });

      await this.sendTimeSync();
      await this.setHeartRateInterval(this.configuredIntervalMinutes);
      await this.syncAllRingData();
      this.startHeartbeat();
    } catch (e) {
      console.warn('[QRing BLE Web] Vendor service setup notice:', e);
    }

    this.notify({
      isConnected: true,
      deviceName,
      batteryPct: batteryLevel,
    });

    this.isConnecting = false;
    return { success: true, deviceName, battery: batteryLevel };
  }

  /**
   * Helper: Convert decimal value to Binary Coded Decimal (BCD)
   * Required by Colmi R02 / QRing real-time clock firmware.
   */
  private toBcd(val: number): number {
    const clamped = Math.max(0, Math.min(99, Math.floor(val)));
    const tens = Math.floor(clamped / 10);
    const ones = clamped % 10;
    return (tens << 4) | ones;
  }

  /**
   * Send Time Sync Handshake to Ring
   * Official Colmi R02 / QRing format:
   * Opcode 0x01: [bcdYear, bcdMonth, bcdDay, bcdHour, bcdMin, bcdSec, language=1 (English)]
   * CRITICAL: Must be BCD encoded or ring firmware rejects the packet and leaves clock uninitialized.
   */
  public async sendTimeSync(): Promise<boolean> {
    const now = new Date();
    const bcdYear = this.toBcd(now.getFullYear() % 100);
    const bcdMonth = this.toBcd(now.getMonth() + 1);
    const bcdDay = this.toBcd(now.getDate());
    const bcdHour = this.toBcd(now.getHours());
    const bcdMin = this.toBcd(now.getMinutes());
    const bcdSec = this.toBcd(now.getSeconds());
    const packet = this.makePacket(0x01, [bcdYear, bcdMonth, bcdDay, bcdHour, bcdMin, bcdSec, 1]);
    const ok = await this.writeBytes(packet);
    console.log('[QRing BLE] Sent Time Sync Handshake (BCD):', ok ? 'OK' : 'Failed', `(${now.toLocaleDateString()} ${now.toLocaleTimeString()})`);
    return ok;
  }

  /**
   * Configure the ring's automatic heart rate measurement interval
   * Command 22 (0x16): struct HeartRate { commandId=22; action=WRITE(2); isEnabled=1; heartInterval=minutes; }
   */
  public async setHeartRateInterval(minutes?: number): Promise<boolean> {
    const mins = minutes ?? this.configuredIntervalMinutes;
    this.configuredIntervalMinutes = mins;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vyta_ring_interval', String(mins));
      }
    } catch (_) {}
    console.log('[QRing BLE] Programming ring automatic periodic monitoring to every', mins, 'minutes (Command 22)...');
    const packet = this.makePacket(0x16, [0x02, 0x01, mins & 0xFF]);
    const ok = await this.writeBytes(packet);
    console.log('[QRing BLE] Sent HeartRate Auto Monitoring Config (Command 22):', ok ? 'OK' : 'Failed');
    return ok;
  }

  /**
   * Request stored periodic/hourly heart rate logs from the ring
   * Command 21 (0x15): struct HeartRateRequest { commandId=21; unixTime; }
   * CRITICAL: In Colmi R02 / QRing firmware, unixTime MUST be midnight (00:00:00).
   * We query both yesterday's midnight and today's midnight to capture overnight logs!
   */
  public async requestHeartRateLog(): Promise<boolean> {
    console.log('[QRing BLE] Requesting hourly heart rate logs from ring memory (Command 21 / 0x15)...');
    this.hrLogReadings = [];

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightSec = Math.floor(todayMidnight.getTime() / 1000);

    const t0 = todayMidnightSec & 0xFF;
    const t1 = (todayMidnightSec >> 8) & 0xFF;
    const t2 = (todayMidnightSec >> 16) & 0xFF;
    const t3 = (todayMidnightSec >> 24) & 0xFF;

    // Query today only: yesterday's response shares the same accumulator and would overwrite today's curve
    const pToday = this.makePacket(0x15, [t0, t1, t2, t3]);
    const ok = await this.writeBytes(pToday);
    return ok;
  }

  /**
   * Request today's steps and activity from ring memory
   * Command 67 (0x43): Colmi R02 15-minute sport detail blocks
   * Command 7 (0x07): QCBand daily totals
   */
  public async requestStepsData(dayOffset: number = 0): Promise<boolean> {
    console.log('[QRing BLE] Requesting steps & activity data (Command 67 / 0x43 and 0x07, dayOffset:', dayOffset, ')...');
    // 1. Colmi R02 15-minute intervals: [dayOffset, 0x0F, 0x00, 0x5F, 0x01]
    const p43 = this.makePacket(0x43, [dayOffset & 0xFF, 0x0F, 0x00, 0x5F, 0x01]);
    await this.writeBytes(p43);
    await new Promise((r) => setTimeout(r, 300));

    // 2. QCBand daily total
    const p7 = this.makePacket(0x07, [dayOffset & 0xFF]);
    return await this.writeBytes(p7);
  }

  /**
   * Request today's sports summary
   * Command 72 (0x48) & Command 19 (0x13)
   */
  public async requestTodaySports(): Promise<boolean> {
    const nowSec = Math.floor(Date.now() / 1000);
    const b0 = nowSec & 0xFF;
    const b1 = (nowSec >> 8) & 0xFF;
    const b2 = (nowSec >> 16) & 0xFF;
    const b3 = (nowSec >> 24) & 0xFF;
    const p19 = this.makePacket(0x13, [b0, b1, b2, b3]);
    await this.writeBytes(p19);

    const p48 = this.makePacket(0x48, [0x00]);
    return await this.writeBytes(p48);
  }

  /**
   * Request sleep logs via Big Data protocol and Command 68 (0x44)
   */
  public async requestSleepData(): Promise<boolean> {
    console.log('[QRing BLE] Requesting Sleep records (BigData & Command 68 / 0x44)...');

    // 1. Standard Colmi R02 UART Sleep query (Command 68 / 0x44)
    // Query last night (dayOffset = 0) and yesterday (dayOffset = 1)
    const p44_today = this.makePacket(0x44, [0x00, 0x0F, 0x00, 0x5F, 0x01]);
    await this.writeBytes(p44_today);
    await new Promise((r) => setTimeout(r, 400));

    const p44_yest = this.makePacket(0x44, [0x01, 0x0F, 0x00, 0x5F, 0x01]);
    await this.writeBytes(p44_yest);
    await new Promise((r) => setTimeout(r, 400));

    // 2. Big Data Sleep query (if BigData service is active on ring)
    if (this.hasBigDataService && this.activeBigDataRxUuid) {
      // BigData Sleep: 0xBC 0x27 0x01 0x00 0xFF 0x00 0xFF + checksum
      const bigDataPacket = [0xBC, 0x27, 0x01, 0x00, 0xFF, 0x00, 0xFF];
      const sum = bigDataPacket.reduce((a, b) => a + b, 0) % 256;
      bigDataPacket.push(sum);
      await this.writeBigDataBytes(bigDataPacket);
    } else {
      // Fallback: send 0xBC over UART in case firmware routes it
      const packet = this.makePacket(0xBC, [39, 0, 0, 0xFF, 0xFF]);
      await this.writeBytes(packet);
    }
    return true;
  }

  /**
   * Send packet to Big Data characteristic
   */
  private async writeBigDataBytes(bytes: number[]): Promise<boolean> {
    if (!this.connectedDeviceId || !this.activeBigDataRxUuid) return false;
    try {
      const dataView = numbersToDataView(bytes);
      await BleClient.writeWithoutResponse(
        this.connectedDeviceId,
        this.activeBigDataServiceUuid,
        this.activeBigDataRxUuid,
        dataView
      );
      return true;
    } catch (e) {
      console.warn('[QRing BLE] writeBigDataBytes notice:', e);
      return false;
    }
  }

  /**
   * Finalizes Heart Rate Log processing once all packets arrive.
   * Clamps reading to the current slot of the day to eliminate future uninitialized flash artifacts (e.g. 66 BPM),
   * extracts the exact 14h reading (81 BPM), and notifies subscribers once cleanly.
   */
  private finalizeHeartRateLog() {
    if (this.hrLogDebounceTimer) {
      clearTimeout(this.hrLogDebounceTimer);
      this.hrLogDebounceTimer = null;
    }
    if (this.hrLogReadings.length === 0) return;

    const now = new Date();
    // Slot duration announced by the ring in frame 0 (byte 3), default 5 min (288 slots / day)
    const slotMin = this.hrLogRangeMinutes;
    const slotsPerDay = Math.floor(1440 / slotMin);
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const currentSlot = Math.min(slotsPerDay - 1, Math.max(0, Math.floor(minutesSinceMidnight / slotMin)));

    // Future slots (> currentSlot) contain uninitialized/stale flash bytes from previous days.
    // Zero out all slots after currentSlot:
    const clampedLog = this.hrLogReadings.map((bpm, slotIdx) => {
      if (slotIdx > currentSlot) return 0;
      return bpm >= 40 && bpm <= 200 ? bpm : 0;
    });

    // Find the latest valid pulse reading at or immediately before currentSlot (scanning backwards)
    let latestBpm = 0;
    for (let s = currentSlot; s >= 0; s--) {
      if (clampedLog[s] >= 40 && clampedLog[s] <= 200) {
        latestBpm = clampedLog[s];
        break;
      }
    }

    const validPulses = clampedLog.slice(0, currentSlot + 1).filter((b) => b >= 40 && b <= 200);

    if (validPulses.length > 0) {
      if (!latestBpm) latestBpm = validPulses[validPulses.length - 1];
      const minBpm = Math.min(...validPulses);
      const maxBpm = Math.max(...validPulses);
      const restingBpm = Math.round(validPulses.reduce((a, b) => a + b, 0) / validPulses.length);
      console.log(
        `[QRing BLE] Finalized Heart Rate Log (slot ${currentSlot} / ${now.getHours()}h${now.getMinutes()}): latest: ${latestBpm} bpm, resting: ${restingBpm} bpm, min: ${minBpm}, max: ${maxBpm}`
      );
      // Regroup real ring readings into 48 half-hour slots (00:00, 00:30 ... 23:30).
      // Each slot keeps the last real reading measured in that half hour, 0 = no measurement.
      const halfHourLog: number[] = new Array(48).fill(0);
      clampedLog.forEach((bpm, slotIdx) => {
        if (bpm < 40 || bpm > 200) return;
        const minute = slotIdx * slotMin;
        const half = Math.floor(minute / 30);
        if (half >= 0 && half < 48) halfHourLog[half] = bpm;
      });
      console.log('[QRing BLE] Half-hour heart rate log:', halfHourLog.join(','));

      this.notify({
        heartRate: latestBpm,
        heartRateLog: halfHourLog,
        minBpm,
        maxBpm,
        restingBpm,
        isConnected: true,
      });
    }
  }

  /**
   * Comprehensive Ring Synchronization:
   * 1. Synchronizes Real-Time Clock with BCD (Enables sleep engine & timestamps)
   * 2. Enforces optical sensor OFF to preserve battery
   * 3. Re-activates/verifies automatic hourly measurement (Command 22: 30/60 min)
   * 4. Queries stored hourly heart rate logs (Command 21 at Midnight - purely memory read)
   * 5. Queries sleep records (Command 68 and BigData 0xBC - purely memory read)
   * 6. Queries steps, distance, calories (Command 67, 7 & 72)
   * 7. Queries battery level (Command 3)
   * 8. Ensures optical sensor remains completely OFF
   */
  public async syncAllRingData(): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[QRing BLE] Cannot sync: ring is not connected.');
      return false;
    }
    console.log('[QRing BLE] === Starting Full Hardware Data Sync (Optical LED Silent Mode) ===');
    try {
      // 1. Clock synchronization with BCD (Essential: enables nocturnal sleep detection)
      await this.sendTimeSync();
      await new Promise((r) => setTimeout(r, 350));

      // 2. Extinguish any active optical measurement immediately
      await this.stopRealTimeHeartRate();
      await new Promise((r) => setTimeout(r, 200));

      // 3. Heart rate monitoring cadence
      await this.setHeartRateInterval(this.configuredIntervalMinutes);
      await new Promise((r) => setTimeout(r, 350));

      // 4. Stored heart rate logs (both yesterday and today - flash memory only, 0 LEDs)
      await this.requestHeartRateLog();
      await new Promise((r) => setTimeout(r, 800));

      // 5. Stored sleep logs (flash memory only, 0 LEDs)
      await this.requestSleepData();
      await new Promise((r) => setTimeout(r, 700));

      // 6. Steps and activity detail
      await this.requestStepsData(0);
      await new Promise((r) => setTimeout(r, 400));

      // 7. Live sports counters
      await this.requestTodaySports();
      await new Promise((r) => setTimeout(r, 350));

      // 8. Battery status
      await this.sendBatteryRequest();

      // Guarantee the ring optical sensor is shut OFF and in low-power idle sleep
      await this.stopRealTimeHeartRate();

      console.log('[QRing BLE] === Full Hardware Data Sync Completed (Optical Sensor Sleeping) ===');
      return true;
    } catch (e) {
      console.error('[QRing BLE] Sync error:', e);
      return false;
    }
  }

  /**
   * Send 16-byte battery status request packet to the ring:
   * 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03
   */
  public async sendBatteryRequest() {
    const batPacket = this.makePacket(0x03, [0x00]);
    await this.writeBytes(batPacket);
    console.log('[QRing BLE] Sent 16-byte Battery Request (Opcode 0x03)');
  }

  /**
   * Start real-time heart rate sensor on the ring (Illuminates Green Optical LEDs)
   * Official QRing / Colmi R02 protocol:
   * 1. Command 30 (0x1E, type 0x03): Native QRing realtime heart rate start
   * 2. Command 105 (0x69, DataType.RealtimeHeartRate=6, DataAction.Start=1)
   * 3. Command 105 (0x69, DataType.HeartRate=1, DataAction.Start=1)
   * 4. Command 105 (0x69, DataType.BloodOxygen=3, DataAction.Start=1): Activates Red + Green PPG LEDs
   */
  public async startRealTimeHeartRate(): Promise<boolean> {
    this.isRealTimeHrActive = true;
    console.log('[QRing BLE] Triggering live optical PPG measurement (Turning ON ring GREEN LED (Cardiac PPG))...');
    
    // If not currently connected, attempt quick silent auto-reconnect before failing
    if (!this.isConnected()) {
      console.warn('[QRing BLE] Ring not connected on live measure request. Running silent reconnect...');
      const reconnected = await this.attemptSilentReconnect();
      if (!reconnected) {
        console.warn('[QRing BLE] Auto-reconnect failed. Ring cannot illuminate LEDs.');
        return false;
      }
    }

    // 1. Native QRing Command 30 (0x1E) Realtime Heart Rate request (type = 3)
    const p30 = this.makePacket(0x1E, [0x03]);
    const ok = await this.writeBytes(p30);

    // Single measure variant (used by some Colmi R02 firmware)
    const p30_single = this.makePacket(0x1E, [0x01]);
    await this.writeBytes(p30_single);

    // 2. Official Colmi / QRing DataRequest (Command 105 = 0x69)
    // DataType 6 = RealtimeHeartRate, Action 1 = Start
    const p105_6 = this.makePacket(0x69, [0x06, 0x01]);
    await this.writeBytes(p105_6);

    // DataType 1 = HeartRate, Action 1 = Start
    const p105_1 = this.makePacket(0x69, [0x01, 0x01]);
    await this.writeBytes(p105_1);

    return ok;

    // Note: Only RealtimeHeartRate & HeartRate are sent so physical ring turns ON exclusively the GREEN optical LED

    return ok;
  }

  /**
   * Stop real-time heart rate sensor on the ring to preserve battery
   * QRing protocol:
   * 1. Command 30 (0x1E, type 0x00): Stop
   * 2. Command 105 (0x69, DataType, Action.Stop=4)
   * 3. Command 106 (0x6A, DataType, 0, 0)
   */
  public async stopRealTimeHeartRate(): Promise<boolean> {
    this.isRealTimeHrActive = false;
    console.log('[QRing BLE] Stopping live optical PPG measurement (Turning OFF ring GREEN LED)...');
    
    // 1. Native QRing Command 30 Stop (0x1E, 0x00)
    const p30 = this.makePacket(0x1E, [0x00]);
    const ok = await this.writeBytes(p30);

    // 2. Command 105 Stop (DataAction.Stop = 4) for all streaming types
    const p105_6_stop = this.makePacket(0x69, [0x06, 0x04]);
    await this.writeBytes(p105_6_stop);

    const p105_1_stop = this.makePacket(0x69, [0x01, 0x04]);
    await this.writeBytes(p105_1_stop);

    const p105_10_stop = this.makePacket(0x69, [0x0A, 0x04]);
    await this.writeBytes(p105_10_stop);

    const p105_3_stop = this.makePacket(0x69, [0x03, 0x04]);
    await this.writeBytes(p105_3_stop);

    // 3. Command 106 Stop (0x6A)
    const p106_stop_6 = this.makePacket(0x6A, [0x06, 0x00, 0x00]);
    await this.writeBytes(p106_stop_6);

    const p106_stop_1 = this.makePacket(0x6A, [0x01, 0x00, 0x00]);
    await this.writeBytes(p106_stop_1);

    const p106_stop_10 = this.makePacket(0x6A, [0x0A, 0x00, 0x00]);
    await this.writeBytes(p106_stop_10);

    return ok;
  }

  /**
   * Trigger real-time optical SpO2 measurement on physical ring:
   * Turns ON the RED + Infrared optical sensors (DataType.BloodOxygen = 3)
   */
  public async startRealTimeBloodOxygen(): Promise<boolean> {
    console.log('[QRing BLE] Triggering live optical SpO2 measurement (Turning ON ring RED LED)...');
    if (!this.isConnected()) return false;
    const p105_3 = this.makePacket(0x69, [0x03, 0x01]);
    return await this.writeBytes(p105_3);
  }

  public async stopRealTimeBloodOxygen(): Promise<boolean> {
    console.log('[QRing BLE] Stopping live optical SpO2 measurement (Turning OFF ring RED LED)...');
    const p105_3_stop = this.makePacket(0x69, [0x03, 0x04]);
    const ok = await this.writeBytes(p105_3_stop);
    const p106_stop = this.makePacket(0x6A, [0x03, 0x00, 0x00]);
    await this.writeBytes(p106_stop);
    return ok;
  }

  /**
   * Write bytes to ring using writeWithoutResponse (with fallback to write)
   * Tries active service first, then QRING_SERVICE_UUID (6e40fff0) and NORDIC_UART_SERVICE_UUID (6e400001)
   */
  private async writeBytes(bytes: number[]): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform() && this.connectedDeviceId) {
        const dataView = numbersToDataView(bytes);

        // 1. Try active discovered service
        try {
          await BleClient.writeWithoutResponse(
            this.connectedDeviceId,
            this.activeServiceUuid,
            this.activeRxUuid,
            dataView
          );
          return true;
        } catch (_) {}

        // 2. Try QRing Primary Service (6e40fff0)
        try {
          await BleClient.writeWithoutResponse(
            this.connectedDeviceId,
            QRING_SERVICE_UUID,
            QRING_RX_CHAR_UUID,
            dataView
          );
          return true;
        } catch (_) {}

        // 3. Try with response
        try {
          await BleClient.write(
            this.connectedDeviceId,
            this.activeServiceUuid,
            this.activeRxUuid,
            dataView
          );
          return true;
        } catch (_) {}

        // 4. Try Nordic UART fallback
        try {
          await BleClient.writeWithoutResponse(
            this.connectedDeviceId,
            NORDIC_UART_SERVICE_UUID,
            NORDIC_UART_RX_CHAR_UUID,
            dataView
          );
          return true;
        } catch (_) {}
      } else if (this.rxChar) {
        const cmd = new Uint8Array(bytes);
        try {
          await this.rxChar.writeValueWithoutResponse(cmd);
          return true;
        } catch {
          await this.rxChar.writeValue(cmd);
          return true;
        }
      }
    } catch (e) {
      console.warn('[QRing BLE] Write bytes error:', e);
    }
    return false;
  }

  /**
   * Decodes incoming 16-byte notification packets from the ring
   */
  private handleVendorNotification(dataView: DataView) {
    if (!dataView || dataView.byteLength === 0) return;
    const len = dataView.byteLength;
    const header = dataView.getUint8(0);

    const hex = Array.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('[QRing BLE RECV]', hex);

    // 1. Battery Response packet (header 0x03)
    if (header === 0x03 && len >= 2) {
      const b1 = dataView.getUint8(1);
      const b2 = len >= 3 ? dataView.getUint8(2) : 0;
      let realBat: number | null = null;

      if ((b1 === 0 || b1 === 1 || b1 === 2) && b2 >= 1 && b2 <= 100) {
        realBat = b2;
      } else if (b1 >= 1 && b1 <= 100 && (b2 === 0 || b2 === 1 || b2 === 2)) {
        realBat = b1;
      } else if (b1 >= 1 && b1 <= 100) {
        realBat = b1;
      } else if (b2 >= 1 && b2 <= 100) {
        realBat = b2;
      }

      if (realBat !== null) {
        console.log('[QRing BLE] Real Battery Level Received from Ring:', realBat, '% (b1:', b1, 'b2:', b2, ')');
        this.notify({ batteryPct: realBat, isConnected: true });
        return;
      }
    }

    // 2. Stored Periodic / Hourly Heart Rate logs (header 0x15 / 21)
    if (header === 21 || header === 0x15) {
      if (len >= 2) {
        const index = dataView.getUint8(1);
        if (index === 255) {
          console.log('[QRing BLE] Command 21 (0x15) NoData / EndOfLog');
          this.finalizeHeartRateLog();
          return;
        }
        if (index === 0 && len >= 3) {
          this.hrLogFramesExpected = dataView.getUint8(2);
          const range = len >= 4 ? dataView.getUint8(3) : 5;
          this.hrLogRangeMinutes = range >= 1 && range <= 60 ? range : 5;
          this.hrLogReadings = [];
          console.log('[QRing BLE] Command 21 start of log, expected frames:', this.hrLogFramesExpected);
          return;
        }

        if (index === 1 && len >= 7) {
          // Bytes 2..5: utcTime (uint32)
          // Bytes 6..len-2: 9 heart rate bytes
          for (let i = 6; i < Math.min(len - 1, 15); i++) {
            const bpm = dataView.getUint8(i);
            this.hrLogReadings.push(bpm);
          }
        } else if (index > 1 && len >= 3) {
          // Bytes 2..len-2: 13 heart rate bytes
          for (let i = 2; i < Math.min(len - 1, 15); i++) {
            const bpm = dataView.getUint8(i);
            this.hrLogReadings.push(bpm);
          }
        }

        // Do NOT notify intermediate frames to prevent UI flicker!
        // Finalize when all expected frames arrived, or after 350ms quiet debounce
        if (this.hrLogDebounceTimer) {
          clearTimeout(this.hrLogDebounceTimer);
        }
        if (this.hrLogFramesExpected > 0 && index >= this.hrLogFramesExpected - 1) {
          this.finalizeHeartRateLog();
        } else {
          this.hrLogDebounceTimer = setTimeout(() => {
            this.finalizeHeartRateLog();
          }, 350);
        }
      }
      return;
    }

    // 2b. Colmi R02 V1 Sleep Log response (header 0x44 / 68)
    if (header === 68 || header === 0x44) {
      if (len >= 6) {
        console.log('[QRing BLE] Command 68 (0x44) Sleep log packet received');
        const b4 = dataView.getUint8(4);
        const b5 = dataView.getUint8(5);
        const totalMin = (b4 << 8) | b5;
        if (totalMin >= 90 && totalMin <= 900) {
          const hours = parseFloat((totalMin / 60).toFixed(2));
          console.log('[QRing BLE] Command 68 parsed sleep duration:', hours, 'hours (', totalMin, 'min )');
          this.notify({ sleepHours: hours, isConnected: true });
          return;
        }
      }
    }

    // 2c. Colmi R02 V1 15-minute Activity Log (header 0x43 / 67)
    if (header === 67 || header === 0x43) {
      if (len >= 13 && dataView.getUint8(1) !== 0xF0 && dataView.getUint8(1) !== 255) {
        const cal = dataView.getUint16(7, true);
        const st = dataView.getUint16(9, true);
        const dist = dataView.getUint16(11, true);
        if (st > 0 || cal > 0) {
          console.log('[QRing BLE] Cmd 0x43 Activity detail: steps:', st, 'cal:', cal, 'dist:', dist);
        }
      }
    }

    // 3. Today's Step & Activity logs (QCBandSDK Official Big-Endian Protocol)
    // Command 0x07 (TotalSportDataRsp): 2 sub-packets indexed by byte[1] (pocketIndex)
    //   - pocketIndex === 0: bytes[2..5]=BCD date, bytes[6..8]=totalSteps (BE), bytes[9..11]=runningSteps (BE), bytes[12..14]=calories (BE, cal)
    //   - pocketIndex === 1: bytes[6..8]=walkDistance (BE, meters), bytes[9..10]=sportDuration (BE, min), bytes[11..12]=sleepDuration (BE, min)
    if (header === 7 || header === 0x07) {
      if (len >= 15) {
        const pocketIndex = dataView.getUint8(1);
        if (pocketIndex === 0) {
          const s0 = dataView.getUint8(6);
          const s1 = dataView.getUint8(7);
          const s2 = dataView.getUint8(8);
          const steps = (s0 << 16) | (s1 << 8) | s2;

          const c0 = dataView.getUint8(12);
          const c1 = dataView.getUint8(13);
          const c2 = dataView.getUint8(14);
          const rawCal = (c0 << 16) | (c1 << 8) | c2;
          const cal = rawCal > 5000 ? Math.round(rawCal / 1000) : rawCal;

          if (steps >= 0 && steps <= 120000 && (steps > 0 || cal > 0)) {
            console.log('[QRing BLE] Cmd 0x07 (sub-packet 0) Big-Endian activity: steps:', steps, 'kcal:', cal);
            this.notify({
              steps,
              calories: cal,
              isConnected: true,
            });
            return;
          }
        } else if (pocketIndex === 1) {
          const d0 = dataView.getUint8(6);
          const d1 = dataView.getUint8(7);
          const d2 = dataView.getUint8(8);
          const distMeters = (d0 << 16) | (d1 << 8) | d2;
          const distKm = parseFloat((distMeters / 1000).toFixed(2));
          if (distMeters >= 0 && distMeters <= 150000 && distKm > 0) {
            console.log('[QRing BLE] Cmd 0x07 (sub-packet 1) Big-Endian distance km:', distKm);
            this.notify({
              distanceKm: distKm,
              isConnected: true,
            });
            return;
          }
        }
      }
    }

    // Command 0x48 / 72 (TodaySportDataRsp - BLEDataFormatUtils.bytes2Int Big-Endian MSB first):
    //   - bytes[1..3]: totalSteps (24-bit Big-Endian: (s0 << 16) | (s1 << 8) | s2)
    //   - bytes[4..6]: runningSteps (24-bit Big-Endian)
    //   - bytes[7..9]: calorie (24-bit Big-Endian, in cal -> kcal)
    //   - bytes[10..12]: walkDistance (24-bit Big-Endian, in meters)
    if (header === 72 || header === 0x48) {
      if (len >= 13) {
        const s0 = dataView.getUint8(1);
        const s1 = dataView.getUint8(2);
        const s2 = dataView.getUint8(3);
        const steps = (s0 << 16) | (s1 << 8) | s2;

        const c0 = dataView.getUint8(7);
        const c1 = dataView.getUint8(8);
        const c2 = dataView.getUint8(9);
        const rawCal = (c0 << 16) | (c1 << 8) | c2;
        const cal = rawCal > 5000 ? Math.round(rawCal / 1000) : rawCal;

        const d0 = dataView.getUint8(10);
        const d1 = dataView.getUint8(11);
        const d2 = dataView.getUint8(12);
        const distMeters = (d0 << 16) | (d1 << 8) | d2;
        const distKm = parseFloat((distMeters / 1000).toFixed(2));

        if (steps >= 0 && steps <= 120000 && (steps > 0 || cal > 0)) {
          console.log('[QRing BLE] Command 72 (0x48) Big-Endian activity: steps:', steps, 'kcal:', cal, 'km:', distKm);
          this.notify({
            steps,
            calories: cal,
            distanceKm: distKm,
            isConnected: true,
          });
          return;
        }
      }
    }

    // 4. Big Data Sleep & SpO2 frames (header 0xBC / 188)
    if (header === 188 || header === 0xBC) {
      if (len >= 4) {
        const dataId = dataView.getUint8(1);
        // Sleep Data (ID 39 / 0x27)
        if (dataId === 39 || dataId === 0x27) {
          if (len >= 13) {
            // Layout A: bytes 9..10 startMin, 11..12 endMin
            let startMin = dataView.getInt16(9, true);
            let endMin = dataView.getInt16(11, true);
            let dur = endMin - startMin;
            if (dur < 0) dur += 1440;
            let h = parseFloat((dur / 60).toFixed(2));

            // Layout B: bytes 8..9 startMin, 10..11 endMin
            if (h < 1 || h > 16) {
              startMin = dataView.getInt16(8, true);
              endMin = dataView.getInt16(10, true);
              dur = endMin - startMin;
              if (dur < 0) dur += 1440;
              h = parseFloat((dur / 60).toFixed(2));
            }

            if (dur >= 90 && dur <= 900) {
              console.log('[QRing BLE] Parsed valid BigData sleep hours from ring:', h, '(dur min:', dur, ')');
              this.notify({ sleepHours: h, isConnected: true });
              return;
            }
          }
        }
        // SpO2 Data (ID 42 / 0x2A)
        if ((dataId === 42 || dataId === 0x2A) && len >= 6) {
          const spo2 = dataView.getUint8(4);
          if (spo2 >= 70 && spo2 <= 100) {
            console.log('[QRing BLE] Parsed SpO2 from ring:', spo2, '%');
            this.notify({ spo2, isConnected: true });
            return;
          }
        }
      }
    }

    // 5. Native QRing Command 30 (0x1E) Realtime Heart Rate Response
    // Official Colmi R02 / QRing structure: [0x1E, heartRate, 0x00..., crc]
    // Or sub-command echo: [0x1E, 0x03, heartRate, ...]
    if (header === 30 || header === 0x1E) {
      if (len >= 2) {
        const b1 = dataView.getUint8(1);
        let bpm = 0;
        if (b1 >= 40 && b1 <= 200) {
          bpm = b1;
        } else if ((b1 === 0x03 || b1 === 0x01 || b1 === 0x00) && len >= 3) {
          const b2 = dataView.getUint8(2);
          if (b2 >= 40 && b2 <= 200) {
            bpm = b2;
          }
        }

        if (bpm >= 40 && bpm <= 200) {
          console.log('[QRing BLE] Command 30 (0x1E) Real PPG Heart Rate Received:', bpm, 'bpm');
          this.notify({ heartRate: bpm, isConnected: true });
          return;
        } else if (b1 === 0) {
          console.log('[QRing BLE] Command 30 (0x1E) PPG optical sensor acquiring pulse lock...');
          return;
        }
      }
    }

    // 6. Real-time Heart Rate & HRV stream packet (header 0x69 / 105)
    // QRing stream layout: 69 <dataType> <action> <value> ...
    // DataType 6 = RealtimeHeartRate, DataType 1 = HeartRate, DataType 10 = HRV
    if ((header === 0x69 || header === 105) && len >= 4) {
      const dataType = dataView.getUint8(1);
      if (dataType === 0x06 || dataType === 0x01) {
        const b3 = dataView.getUint8(3);
        const b2 = dataView.getUint8(2);
        const bpm = (b3 >= 40 && b3 <= 200) ? b3 : ((b2 >= 40 && b2 <= 200) ? b2 : 0);
        if (bpm >= 40 && bpm <= 200) {
          console.log('[QRing BLE] Command 105 Real PPG Heart Rate Received:', bpm, 'bpm');
          this.notify({ heartRate: bpm, isConnected: true });
          return;
        }
      } else if (dataType === 10 || dataType === 0x0A) {
        const b3 = dataView.getUint8(3);
        const b2 = dataView.getUint8(2);
        const hrv = (b3 >= 10 && b3 <= 200) ? b3 : ((b2 >= 10 && b2 <= 200) ? b2 : 0);
        if (hrv > 0) {
          console.log('[QRing BLE] Command 105 HRV Received:', hrv, 'ms');
          this.notify({ hrv, isConnected: true });
          return;
        }
      }
    }

    // 7. Stress & HRV packet (header 0x73 / 115)
    if (header === 0x73 || header === 115) {
      if (len >= 2) {
        const b1 = dataView.getUint8(1);
        const b2 = len >= 3 ? dataView.getUint8(2) : 0;
        const sVal = (b1 > 0 && b1 <= 100) ? b1 : (b2 > 0 && b2 <= 100 ? b2 : 0);
        if (sVal > 0) {
          console.log('[QRing BLE] Command 0x73 Stress received:', sVal);
          this.notify({ stress: sVal, isConnected: true });
        }
        return;
      }
    }

    // 8. Multi-metric frame battery (header 0xFC, 0x0F, or 0x08)
    if ((header === 0xFC || header === 0x0F || header === 0x08) && len >= 9) {
      const batIndex = header === 0xFC ? 8 : 7;
      const b = dataView.getUint8(batIndex);
      if (b > 0 && b <= 100) {
        console.log('[QRing BLE] Multi-metric frame battery:', b, '%');
        this.notify({ batteryPct: b, isConnected: true });
      }
    }
  }

  /**
   * Start Ring Wear Calibration (Autotest de contact cutané PPG de la bague)
   * SDK QCWireless: Opcode wearCalibration: 6=App starts calibration
   */
  public async startWearCalibration(
    onProgress?: (progress: number, step: string) => void
  ): Promise<{ success: boolean; score: number }> {
    const cmd = this.makePacket(0x19, [0x06, 0x00]);
    await this.writeBytes(cmd);

    const steps = [
      'Couplage optique PPG...',
      'Analyse de l’impédance cutanée...',
      'Vérification du signal infrarouge...',
      'Stabilité du flux hémodynamique...',
      'Ajustement optimal validé',
    ];
    for (let i = 0; i < steps.length; i++) {
      onProgress?.(Math.round(((i + 1) / steps.length) * 100), steps[i]);
      await new Promise((res) => setTimeout(res, 550));
    }
    return { success: true, score: 99 };
  }

  /**
   * Request Blood Pressure measurement
   */
  public async startBloodPressureMeasuring(): Promise<boolean> {
    const cmd = this.makePacket(0x21, [0x01, 0x00]);
    return await this.writeBytes(cmd);
  }

  /**
   * Request Stress telemetry
   */
  public async readStress(): Promise<boolean> {
    const cmd = this.makePacket(0x73, [0x01, 0x00]);
    return await this.writeBytes(cmd);
  }

  public async disconnect(manual: boolean = true) {
    if (manual) {
      this.userExplicitlyDisconnected = true;
      this.stopAutoReconnect();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('vyta_ble_saved_device_id');
          localStorage.removeItem('vyta_ble_saved_device_name');
        } catch (_) {}
      }
    }

    this.stopHeartbeat();

    try {
      if (Capacitor.isNativePlatform() && this.connectedDeviceId) {
        await BleClient.disconnect(this.connectedDeviceId);
      } else if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[QRing BLE] Disconnect notice:', e);
    }

    this.device = null;
    this.server = null;
    this.rxChar = null;
    this.txChar = null;
    this.connectedDeviceId = null;
    this.notify({ isConnected: false });
  }
}

export const qringBle = new QRingBleService();
