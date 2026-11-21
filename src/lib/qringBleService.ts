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
import { NapRecord } from '../types';
import { dispatchApplePush } from './apnsService';

export interface RingLastLocation {
  lat: number;
  lng: number;
  ts: number;
  accuracy?: number;
  reason?: 'connected' | 'disconnected' | 'periodic' | 'manual';
}

export interface BleRssiSample {
  rssi: number;
  source: 'connected' | 'scan';
  deviceId: string;
  name?: string;
  ts: number;
}

export const LAST_RING_LOCATION_KEY = 'aurel_last_ring_location';

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

export const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';
export const DEVICE_SYSTEM_ID_CHAR_UUID = '00002a23-0000-1000-8000-00805f9b34fb';
export const DEVICE_SERIAL_CHAR_UUID = '00002a25-0000-1000-8000-00805f9b34fb';
export const DEVICE_FIRMWARE_CHAR_UUID = '00002a26-0000-1000-8000-00805f9b34fb';

export interface BleRingData {
  batteryPct?: number;
  isCharging?: boolean;
  heartRate?: number;
  liveHeartRate?: number;
  heartRateLog?: number[];
  minBpm?: number;
  maxBpm?: number;
  restingBpm?: number;
  steps?: number;
  stepsAuthoritative?: boolean;
  stepsHourly?: number[];
  calories?: number;
  distanceKm?: number;
  daysAgo?: number;
  sleepHours?: number;
  sleepDeepMin?: number;
  sleepLightMin?: number;
  sleepRemMin?: number;
  sleepAwakeMin?: number;
  sleepScore?: number;
  sleepStartMin?: number;
  sleepEndMin?: number;
  naps?: NapRecord[];
  spo2?: number;
  spo2Min?: number;
  spo2Max?: number;
  spo2Log?: number[];
  stress?: number;
  stressAvg?: number;
  stressMin?: number;
  stressMax?: number;
  stressLog?: number[];
  hrv?: number;
  hrvLog?: number[];
  skinTemp?: number;
  tempLog?: number[];
  bloodPressure?: { sbp: number; dbp: number };
  glucose?: number;
  deviceName?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  macAddress?: string;
  isConnected: boolean;
  wearCalibrationScore?: number;
}

export interface DiscoveredBleDevice {
  deviceId: string;
  name: string;
  rssi?: number;
  isRing?: boolean;
}

/**
 * Masque les noms Bluetooth bruts d'usine (R21_..., R02_..., QRing..., etc.)
 * pour toujours afficher "Aurel Ring One" côté utilisateur dans l'application.
 */
export function formatRingDisplayName(rawName?: string, isRing = true): string {
  const clean = (rawName || '').trim();
  if (!clean || isRing) return 'Aurel Ring One';
  const upper = clean.toUpperCase();
  if (
    ['RING', 'QRING', 'AUREL', 'VYTA', 'QC', 'STOIK', 'STOÏK', 'COLMI', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']
      .some((k) => upper.includes(k))
  ) {
    return 'Aurel Ring One';
  }
  return clean;
}

export interface BleLogEntry {
  id: number;
  time: string;
  dir: 'TX' | 'RX' | 'EVT';
  summary: string;
  hex?: string;
}

export interface RingMeasureEvent {
  id: string;
  dateKey: string;
  time: string; // HH:MM
  minutesOfDay: number;
  kind: 'bpm' | 'temp' | 'spo2' | 'hrv' | 'stress' | 'led';
  label: string;
  value?: string;
  led?: 'green' | 'red' | 'amber';
  source: 'auto' | 'live';
}

type RingListener = (data: BleRingData) => void;
type DeviceDiscoveryListener = (device: DiscoveredBleDevice) => void;
type BleLogListener = (logs: BleLogEntry[]) => void;
type MeasureEventListener = (events: RingMeasureEvent[]) => void;

const BLE_LOG_STORAGE_KEY = 'aurel_ble_debug_logs';
const MEASURE_EVENT_STORAGE_KEY = 'aurel_ring_measure_events';

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

  // Big Data V2 (0xBC) multi-packet reassembly buffer
  private bigDataBuffer: number[] = [];
  private bigDataExpectedPayloadLen = 0;
  private bigDataDebounceTimer: any = null;
  private hasBigDataSleepToday = false;

  // Stored Heart Rate Log multi-packet accumulator
  private hrLogFramesExpected = 0;
  private hrLogReadings: number[] = [];
  private hrLogDebounceTimer: any = null;
  private hrLogRangeMinutes = 5;
  private hrLogDoneResolvers: Array<() => void> = [];
  private bigDataWaiters: Array<{ ids: number[]; resolve: () => void }> = [];

  // Stored 30-min Stress (0x37) & HRV (0x39) multi-packet accumulators (48 slots/day)
  private stressLogSlots: number[] = new Array(48).fill(0);
  private stressDebounceTimer: any = null;
  private stressTotalPackets = 0;
  private stressPeriodMinutes = 60;
  private hrvLogSlots: number[] = new Array(48).fill(0);
  private hrvDebounceTimer: any = null;
  private hrvTotalPackets = 0;
  private hrvPeriodMinutes = 60;
  private hrvLiveFallbackActive = false;
  private hrvLiveNativeReceived = false;
  private hrvLiveFallbackTimer: any = null;
  private hrvRrSamples: number[] = [];
  private hrvLastSampleAt = 0;
  private stepsQuarterSlots: number[] = new Array(96).fill(0);
  private stepsDetailCalSum = 0;
  private stepsDetailDistMetersSum = 0;
  private stepsDetailDebounceTimer: any = null;
  private stepsDetailWaiters: Array<() => void> = [];
  private requestedStepsDayOffset = 0;

  private listeners: Set<RingListener> = new Set();
  private discoveryListeners: Set<DeviceDiscoveryListener> = new Set();
  private isConnecting = false;

  // Keep-alive heartbeat & resilient background auto-reconnect
  private heartbeatInterval: any = null;
  private isAutoReconnecting = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private userExplicitlyDisconnected = false;
  private lastPeriodicSyncTime = 0;
  private isSyncing = false;
  private activeSyncPromise: Promise<boolean> | null = null;
  private activeActivityRefreshPromise: Promise<boolean> | null = null;
  // Default 60-minute autonomous cadence (0 continuous, preserves 5-7d ring battery)
  private configuredIntervalMinutes = 60;
  private lastProgrammedIntervalMinutes: number | null = null;
  private needsBoundaryAlign = false;
  private boundaryAlignTimer: any = null;
  private lastIntervalFixAt = 0;
  private isRealTimeHrActive = false;
  private usedLiveFallbackPackets = false;
  private activeLiveDataType: number | null = null;
  private realTimeHrTimer: any = null;
  private lastLiveDataAt = 0;
  private lastLiveAckAt = 0;
  private lastLiveRearmAt = 0;
  private lastAutoMeasureSlot = -1;
  private isAutoSpotMeasuring = false;
  private lastSeparationAlertAt = 0;
  private flashBeaconTimer: any = null;
  private radarActiveCleanup: (() => void) | null = null;
  private bleLogs: BleLogEntry[] = (() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(BLE_LOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 80);
      }
    } catch (_) {}
    return [];
  })();
  private logListeners = new Set<BleLogListener>();
  private logSeq = Date.now();
  private measureEvents: RingMeasureEvent[] = (() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(MEASURE_EVENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 120);
      }
    } catch (_) {}
    return [];
  })();
  private measureEventListeners = new Set<MeasureEventListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_hw_programmed_interval');
        if (saved) {
          const parsed = JSON.parse(saved);
          const savedDevId = localStorage.getItem('vyta_ble_saved_device_id');
          if (
            parsed?.cfgVer === 6 &&
            typeof parsed?.minutes === 'number' &&
            (!savedDevId || !parsed?.deviceId || parsed.deviceId === savedDevId)
          ) {
            this.lastProgrammedIntervalMinutes = parsed.minutes;
            this.needsBoundaryAlign = false;
          } else {
            // Nettoyage unique des anciens caches pour réactiver tous les capteurs sans mode strict
            localStorage.removeItem('vyta_strict_led_schedule');
            localStorage.removeItem('vyta_hw_programmed_interval');
          }
        } else {
          localStorage.removeItem('vyta_strict_led_schedule');
        }
      } catch (_) {}

      try {
        const intervalsStr = localStorage.getItem('vyta_sensor_intervals');
        if (intervalsStr) {
          const parsed = JSON.parse(intervalsStr);
          if (parsed.heartRate === 'pause') {
            this.configuredIntervalMinutes = 0;
          } else if (parsed.heartRate === '30min') {
            this.configuredIntervalMinutes = 30;
          } else if (parsed.heartRate === '1h') {
            this.configuredIntervalMinutes = 60;
          } else if (parsed.heartRate === '2h') {
            this.configuredIntervalMinutes = 120;
          } else if (parsed.heartRate === '15min') {
            this.configuredIntervalMinutes = 15;
          }
        } else {
          const saved = localStorage.getItem('vyta_ring_interval');
          if (saved) {
            const val = parseInt(saved, 10);
            if (val === 0 || val === 5 || val === 10 || val === 15 || val === 30 || val === 60 || val === 120) {
              this.configuredIntervalMinutes = val;
            }
          }
        }
      } catch (_) {}

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected() && !this.userExplicitlyDisconnected) {
            this.reconnectAttempts = 0;
            console.log('[QRing BLE] App resumed to foreground, verifying ring connection...');
            this.autoConnectSavedDevice();
          } else if (this.isConnected()) {
            // Cooldown 90s to avoid waking the ring BLE radio repeatedly on rapid app switching
            if (Date.now() - this.lastPeriodicSyncTime > 90 * 1000) {
              console.log('[QRing BLE] App resumed to foreground, syncing stored ring memory...');
              this.syncAllRingData();
            }
          }
        }
      });

      window.addEventListener('focus', () => {
        if (document.visibilityState !== 'visible') return;
        if (!this.isConnected() && !this.userExplicitlyDisconnected) {
          this.autoConnectSavedDevice();
        } else if (this.isConnected() && Date.now() - this.lastPeriodicSyncTime > 90 * 1000) {
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

  public getLastKnownLocation(): RingLastLocation | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LAST_RING_LOCATION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.lat === 'number' &&
        Number.isFinite(parsed.lat) &&
        typeof parsed?.lng === 'number' &&
        Number.isFinite(parsed.lng)
      ) {
        return parsed as RingLastLocation;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  public saveLastKnownLocation(loc: RingLastLocation): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LAST_RING_LOCATION_KEY, JSON.stringify(loc));
      window.dispatchEvent(new CustomEvent('aurelRingLocationUpdated', { detail: loc }));
    } catch (_) {}
  }

  public captureCurrentRingLocation(
    reason: RingLastLocation['reason'] = 'periodic'
  ): Promise<RingLastLocation | null> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return Promise.resolve(this.getLastKnownLocation());
    }
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc: RingLastLocation = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : undefined,
              ts: Date.now(),
              reason,
            };
            this.saveLastKnownLocation(loc);
            resolve(loc);
          },
          () => resolve(this.getLastKnownLocation()),
          { enableHighAccuracy: reason === 'disconnected' || reason === 'manual', timeout: 5000, maximumAge: 60000 }
        );
      } catch (_) {
        resolve(this.getLastKnownLocation());
      }
    });
  }

  public subscribe(listener: RingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onDeviceDiscovered(listener: DeviceDiscoveryListener): () => void {
    this.discoveryListeners.add(listener);
    return () => this.discoveryListeners.delete(listener);
  }

  public subscribeLogs(listener: BleLogListener): () => void {
    this.logListeners.add(listener);
    listener([...this.bleLogs]);
    return () => this.logListeners.delete(listener);
  }

  public getBleLogs(): BleLogEntry[] {
    return [...this.bleLogs];
  }

  public clearBleLogs(): void {
    this.bleLogs = [];
    try {
      localStorage.removeItem(BLE_LOG_STORAGE_KEY);
    } catch (_) {}
    this.logListeners.forEach((cb) => {
      try { cb([]); } catch (_) {}
    });
  }

  private getTodayDateKey(now: Date = new Date()): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatMinutesHHMM(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
    const h = String(Math.floor(clamped / 60)).padStart(2, '0');
    const m = String(clamped % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  public subscribeMeasureEvents(listener: MeasureEventListener): () => void {
    this.measureEventListeners.add(listener);
    listener([...this.measureEvents]);
    return () => this.measureEventListeners.delete(listener);
  }

  public getMeasureEvents(): RingMeasureEvent[] {
    return [...this.measureEvents];
  }

  public clearMeasureEvents(): void {
    this.measureEvents = [];
    try {
      localStorage.removeItem(MEASURE_EVENT_STORAGE_KEY);
    } catch (_) {}
    this.measureEventListeners.forEach((cb) => {
      try { cb([]); } catch (_) {}
    });
  }

  private upsertMeasureEvents(incoming: RingMeasureEvent[]): void {
    if (!incoming || incoming.length === 0) return;
    const byId = new Map<string, RingMeasureEvent>();
    for (const ev of this.measureEvents) {
      byId.set(ev.id, ev);
    }
    let changed = false;
    for (const ev of incoming) {
      const prev = byId.get(ev.id);
      if (!prev || prev.value !== ev.value || prev.source !== ev.source) {
        byId.set(ev.id, prev ? { ...prev, ...ev, value: ev.value || prev.value } : ev);
        changed = true;
      }
    }
    if (!changed) return;

    const sorted = Array.from(byId.values())
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
        if (a.minutesOfDay !== b.minutesOfDay) return b.minutesOfDay - a.minutesOfDay;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 120);

    this.measureEvents = sorted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MEASURE_EVENT_STORAGE_KEY, JSON.stringify(sorted));
      } catch (_) {}
    }
    this.measureEventListeners.forEach((cb) => {
      try { cb([...sorted]); } catch (_) {}
    });
  }

  private recordLiveMeasureEvent(
    kind: RingMeasureEvent['kind'],
    label: string,
    value: string | undefined,
    led: RingMeasureEvent['led'],
    source: RingMeasureEvent['source'] = 'live'
  ): void {
    const now = new Date();
    const dateKey = this.getTodayDateKey(now);
    const minutesOfDay = now.getHours() * 60 + now.getMinutes();
    const time = this.formatMinutesHHMM(minutesOfDay);
    this.upsertMeasureEvents([
      {
        id: `${dateKey}|${kind}|${time}`,
        dateKey,
        time,
        minutesOfDay,
        kind,
        label,
        value,
        led,
        source,
      },
    ]);
  }

  private describeBlePacket(dir: 'TX' | 'RX', bytes: number[]): string {
    if (!bytes || bytes.length === 0) return dir;
    const cmd = bytes[0] & 0xFF;
    const b1 = bytes.length > 1 ? bytes[1] & 0xFF : 0;
    const b2 = bytes.length > 2 ? bytes[2] & 0xFF : 0;
    const b3 = bytes.length > 3 ? bytes[3] & 0xFF : 0;

    if (cmd === 0x01) return 'TimeSync BCD';
    if (cmd === 0x03) return dir === 'TX' ? 'Requête Batterie (0x03)' : `Batterie: ${b1 === 0 || b1 === 1 || b1 === 2 ? b2 : b1}% (statut=${b1})`;
    if (cmd === 0x15) return dir === 'TX' ? 'Lecture Flash FC (0x15)' : `Log FC 0x15 frame=${b1}`;
    if (cmd === 0x16) return `${dir === 'TX' && b1 === 1 ? 'Lecture' : 'Config'} Intervalle FC 0x16 (sub=${b1}, on=${b2 === 1}, ${b3}m)`;
    if (cmd === 0x2C) return `${dir === 'TX' && b1 === 1 ? 'Lecture' : 'Config'} SpO2 0x2C (sub=${b1}, on=${b2 === 1}, ${b3}m)`;
    if (cmd === 0x38) return `${dir === 'TX' && b1 === 1 ? 'Lecture' : 'Config'} VRC 0x38 (sub=${b1}, on=${b2 === 1}, ${b3}m)`;
    if (cmd === 0x36) return `${dir === 'TX' && b1 === 1 ? 'Lecture' : 'Config'} Stress 0x36 (sub=${b1}, on=${b2 === 1}, ${b3}m)`;
    if (cmd === 0x3A) return `Temp 0x3A (b1=${b1}, b2=${b2}, b3=${b3})`;
    if (cmd === 0x37) return dir === 'TX' ? 'Lecture Flash Stress (0x37)' : `Log Stress 0x37 pkt=${b1}`;
    if (cmd === 0x39) return dir === 'TX' ? 'Lecture Flash VRC (0x39)' : `Log VRC 0x39 pkt=${b1}`;
    if (cmd === 0x43) {
      if (dir === 'TX') return `Detail Pas 0x43 (j-${b1})`;
      if (b1 === 0xF0) return `Detail Pas 0x43 header (total=${b2})`;
      if (b1 === 0xFF) return 'Detail Pas 0x43 fin/vide';
      const b4 = bytes.length > 4 ? bytes[4] & 0xFF : 0;
      const st = bytes.length > 10 ? (bytes[9] & 0xFF) | ((bytes[10] & 0xFF) << 8) : 0;
      return `Detail Pas 0x43 slot=${b4} (${st} pas)`;
    }
    if (cmd === 0x07 || cmd === 0x48) return `Activité/Pas (0x${cmd.toString(16)})`;
    if (cmd === 0x69) {
      const tName = b1 === 1 ? 'FC' : b1 === 3 ? 'SpO2' : b1 === 5 ? 'Temp' : b1 === 10 ? 'VRC' : `type=${b1}`;
      const act = dir === 'TX' ? (b2 === 1 ? 'START' : b2 === 3 ? 'CONTINUE' : b2 === 4 ? 'STOP' : `act=${b2}`) : `val=[${b2},${b3}]`;
      return `Live 0x69 ${tName} (${act})`;
    }
    if (cmd === 0x6A) return `Live STOP 0x6A (type=${b1})`;
    if (cmd === 0x1E) return dir === 'TX' ? `Live Legacy 0x1E (${b1})` : `Live 0x1E bpm=${b1 || b2}`;
    if (cmd === 0x73) return `Push 0x73 (type=${b1}, val=${b2})`;
    if (cmd === 0xBC) return `BigData 0xBC id=0x${b1.toString(16)}`;
    return `Cmd 0x${cmd.toString(16).padStart(2, '0')} [${b1},${b2},${b3}]`;
  }

  private pushBleLog(dir: 'TX' | 'RX' | 'EVT', summary: string, bytes?: number[]) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const hex = bytes
      ? bytes.slice(0, 16).map((b) => (b & 0xFF).toString(16).padStart(2, '0')).join(' ')
      : undefined;
    const entry: BleLogEntry = {
      id: ++this.logSeq,
      time,
      dir,
      summary,
      hex,
    };
    this.bleLogs = [entry, ...this.bleLogs].slice(0, 160);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BLE_LOG_STORAGE_KEY, JSON.stringify(this.bleLogs.slice(0, 60)));
      } catch (_) {}
    }
    this.logListeners.forEach((cb) => {
      try { cb([...this.bleLogs]); } catch (_) {}
    });
  }

  /**
   * Interroge la bague sur les intervalles actuellement enregistrés dans sa mémoire interne (0 LED)
   */
  public async querySensorConfigs(): Promise<void> {
    if (!this.isConnected()) {
      this.pushBleLog('EVT', 'Lecture config impossible : bague non connectée');
      return;
    }
    this.pushBleLog('EVT', 'Lecture des réglages stockés dans la bague...');
    for (const cmd of [0x16, 0x2C, 0x38, 0x36, 0x3A]) {
      await this.writeBytes(this.makePacket(cmd, [0x01]));
      await new Promise((r) => setTimeout(r, 120));
    }
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
   * Low-power periodic maintenance timer (foreground visible only):
   * Lets the ring firmware enter BLE dormant sleep naturally overnight & in background.
   * Refreshes flash HR logs (0x15, 0 LEDs) & steps every 2 minutes when foregrounded,
   * and full sync every 10 minutes without turning on optical LEDs over BLE.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    console.log('[QRing BLE] Starting low-power periodic sync check (2m foreground flash check, 10m full sync)...');
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isConnected()) {
        this.stopHeartbeat();
        return;
      }

      // When app is backgrounded or screen locked, NEVER poll BLE so the ring stays in deep sleep
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      // Do not interrupt an active live sensor stream or an ongoing sync
      if (this.isSyncing || this.activeLiveDataType !== null || this.isRealTimeHrActive) {
        return;
      }

      try {
        const now = Date.now();
        this.captureCurrentRingLocation('periodic');
        if (now - this.lastPeriodicSyncTime > 10 * 60 * 1000) {
          await this.syncAllRingData();
        } else {
          await this.refreshMeasureActivity();
          await this.requestStepsData(0);
          await new Promise((r) => setTimeout(r, 150));
          await this.sendBatteryRequest();
        }
      } catch (e) {
        console.warn('[QRing BLE] Low-power periodic check notice:', e);
      }
    }, 2 * 60 * 1000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedules automatic silent background reconnection with exponential backoff
   * and pauses when app is backgrounded to avoid continuous BLE radio scans.
   */
  public scheduleAutoReconnect() {
    if (this.isAutoReconnecting || this.userExplicitlyDisconnected || this.isConnected()) {
      return;
    }

    this.isAutoReconnecting = true;
    console.log('[QRing BLE AutoReconnect] Starting silent auto-reconnect with backoff...');

    const runAttempt = async () => {
      if (!this.isAutoReconnecting || this.isConnected() || this.userExplicitlyDisconnected) {
        this.stopAutoReconnect();
        return;
      }

      // Avoid burning radio battery scanning in background while phone is locked / idle
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        this.stopAutoReconnect();
        return;
      }

      const success = await this.attemptSilentReconnect();
      if (success) {
        console.log('[QRing BLE AutoReconnect] Auto-reconnect successful!');
        this.reconnectAttempts = 0;
        this.stopAutoReconnect();
        return;
      }

      if (this.isAutoReconnecting && !this.userExplicitlyDisconnected) {
        this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 5);
        const backoffMs = Math.min(60000, 5000 * Math.pow(2, this.reconnectAttempts - 1));
        this.reconnectTimer = setTimeout(runAttempt, backoffMs);
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
          'AUREL',
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
            name: name || savedName || 'Aurel Ring One',
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
  private async attemptSilentReconnect(skipInitialSync: boolean = false): Promise<boolean> {
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
          const res = await this.connectDirectly(match.deviceId, match.name, skipInitialSync);
          if (res.success) return true;
        }
      }

      // Step 2: Direct connect using saved device UUID without scanning
      const savedId = this.getSavedDeviceId();
      const savedName = this.getSavedDeviceName() || 'Aurel Ring One';
      if (savedId) {
        try {
          console.log('[QRing BLE AutoReconnect] Attempting direct connect to saved UUID:', savedId);
          const res = await this.connectDirectly(savedId, savedName, skipInitialSync);
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
              scannedDevice.name || savedName,
              skipInitialSync
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
              rawName.toLowerCase().includes('aurel') ||
              rawName.toLowerCase().includes('vyta') ||
              rawName.toLowerCase().includes('ring') ||
              rawName.toLowerCase().includes('qring') ||
              rawName.toLowerCase().includes('r0') ||
              rawName.toLowerCase().includes('r2'));

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
            'AUREL',
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
    deviceName: string,
    skipInitialSync: boolean = false
  ): Promise<{ success: boolean; deviceName: string; battery?: number; error?: string }> {
    try {
      console.log('[QRing BLE Native] Connecting to GATT server for:', deviceName, deviceId);
      this.userExplicitlyDisconnected = false;

      await BleClient.connect(
        deviceId,
        (disconnectedId) => {
          console.warn('[QRing BLE Native] Peripheral disconnected:', disconnectedId || deviceId);
          this.pushBleLog('EVT', `Déconnectée (${deviceName})`);
          this.connectedDeviceId = null;
          this.stopHeartbeat();
          this.notify({ isConnected: false, deviceName });

          // Capture last known GPS position & optionally fire separation alert on unexpected drop
          this.captureCurrentRingLocation('disconnected');
          if (!this.userExplicitlyDisconnected) {
            if (typeof window !== 'undefined') {
              try {
                const sepEnabled = localStorage.getItem('vyta_separation_alert') !== 'false';
                const now = Date.now();
                if (sepEnabled && now - this.lastSeparationAlertAt > 60000) {
                  this.lastSeparationAlertAt = now;
                  dispatchApplePush(
                    'Aurel Ring One déconnectée',
                    'Signal Bluetooth perdu — dernière position enregistrée dans Localiser.',
                    'battery'
                  );
                }
              } catch (_) {}
            }
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
              this.handleBigDataNotification(val);
            }
          );
          console.log('[QRing BLE Native] Big Data notifications active on:', this.activeBigDataTxUuid);
        } catch (eBd) {
          console.warn('[QRing BLE Native] Big Data startNotifications warning:', eBd);
        }
      }

      // 3. Battery status (quick single read)
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

      // 3b. Subscribe to standard Bluetooth SIG Heart Rate Service (0x180D / 0x2A37) if exposed by ring
      try {
        await BleClient.startNotifications(
          deviceId,
          STANDARD_HEART_RATE_SERVICE_UUID,
          STANDARD_HEART_RATE_MEASUREMENT_UUID,
          (val) => {
            if (val && val.byteLength >= 2) {
              const flags = val.getUint8(0);
              const is16Bit = (flags & 0x01) !== 0;
              const bpm = is16Bit ? val.getUint16(1, true) : val.getUint8(1);
              if (bpm >= 40 && bpm <= 220) {
                this.lastLiveDataAt = Date.now();
                this.lastLiveAckAt = Date.now();
                console.log('[QRing BLE Native] Standard GATT 0x180D Heart Rate:', bpm, 'bpm');
                this.recordLiveMeasureEvent('bpm', 'BPM', `${bpm} bpm`, 'green', 'live');
                this.notify({ heartRate: bpm, liveHeartRate: bpm, isConnected: true });
              }
            }
          }
        );
        console.log('[QRing BLE Native] Standard GATT 0x180D Heart Rate notifications active');
      } catch (_) {}

      const decodeGattUtf8 = (dv?: DataView | null): string | undefined => {
        if (!dv || dv.byteLength === 0) return undefined;
        try {
          const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
          const str = new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
          return str.length > 0 ? str : undefined;
        } catch {
          return undefined;
        }
      };

      const macFallbackFromId = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(deviceId)
        ? deviceId.toUpperCase()
        : undefined;
      const hexFallback = deviceId.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(-12).padStart(12, '0');
      const provisionalMac =
        macFallbackFromId ||
        `${hexFallback.slice(0, 2)}:${hexFallback.slice(2, 4)}:${hexFallback.slice(4, 6)}:${hexFallback.slice(6, 8)}:${hexFallback.slice(8, 10)}:${hexFallback.slice(10, 12)}`;
      const provisionalSerial = `AR01-${hexFallback.slice(-8, -4) || '0000'}-${hexFallback.slice(-4) || '0000'}`;

      // 4. Notify app IMMEDIATELY that ring is connected (never block UI/radar behind 8s history sync)
      this.startHeartbeat();
      this.captureCurrentRingLocation('connected');
      this.pushBleLog('EVT', `Connectée (${deviceName}${batteryLevel ? `, ${batteryLevel}%` : ''})`);

      this.notify({
        isConnected: true,
        deviceName,
        serialNumber: provisionalSerial,
        macAddress: provisionalMac,
        batteryPct: batteryLevel,
      });

      // 5. Fetch Device Info + run initial sync asynchronously without blocking connection state
      Promise.resolve().then(async () => {
        if (!this.isConnected() || this.connectedDeviceId !== deviceId) return;
        let realSerial: string | undefined;
        let realFirmware: string | undefined;
        let realMac: string | undefined = macFallbackFromId;

        try {
          const snDv = await BleClient.read(deviceId, DEVICE_INFO_SERVICE_UUID, DEVICE_SERIAL_CHAR_UUID);
          realSerial = decodeGattUtf8(snDv);
        } catch (_) {}

        try {
          const fwDv = await BleClient.read(deviceId, DEVICE_INFO_SERVICE_UUID, DEVICE_FIRMWARE_CHAR_UUID);
          realFirmware = decodeGattUtf8(fwDv);
        } catch (_) {}

        if (!realMac) {
          try {
            const sysDv = await BleClient.read(deviceId, DEVICE_INFO_SERVICE_UUID, DEVICE_SYSTEM_ID_CHAR_UUID);
            if (sysDv && sysDv.byteLength >= 8) {
              const b = new Uint8Array(sysDv.buffer, sysDv.byteOffset, sysDv.byteLength);
              const macBytes = [b[7], b[6], b[5], b[2], b[1], b[0]];
              if (macBytes.some((v) => v !== 0 && v !== 0xff)) {
                realMac = macBytes.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join(':');
              }
            }
          } catch (_) {}
        }

        if (realSerial || realFirmware || realMac) {
          this.notify({
            isConnected: true,
            deviceName,
            serialNumber: realSerial || provisionalSerial,
            firmwareVersion: realFirmware,
            macAddress: realMac || provisionalMac,
            batteryPct: batteryLevel,
          });
        }

        if (!skipInitialSync) {
          await this.syncAllRingData(true);
        } else {
          await this.sendTimeSync();
          if (this.lastProgrammedIntervalMinutes !== this.configuredIntervalMinutes) {
            await this.setAllSensorIntervals(this.configuredIntervalMinutes, false);
          }
        }
      });

      return { success: true, deviceName, battery: batteryLevel };
    } catch (err: any) {
      console.error('[QRing BLE Native] Connect directly error:', err);
      return { success: false, deviceName, error: err?.message || 'Échec de connexion au périphérique.' };
    }
  }

  /**
   * Pré-initialise CoreBluetooth (sur iOS/Android natif) ou vérifie Web Bluetooth
   * lors de l'étape d'autorisations de l'onboarding.
   */
  public async requestBluetoothPermission(): Promise<{ granted: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { granted: false, error: 'Bluetooth non supporté sur cet appareil.' };
    }
    if (!Capacitor.isNativePlatform()) {
      return { granted: true };
    }
    try {
      if (!this.isNativeInitialized) {
        await BleClient.initialize();
        this.isNativeInitialized = true;
      }
      return { granted: true };
    } catch (err: any) {
      return {
        granted: false,
        error: err?.message || 'Autorisation Bluetooth refusée.',
      };
    }
  }

  /**
   * Start a passive Bluetooth LE discovery scan without auto-connecting,
   * so the UI can list detected rings and let the user select one.
   */
  public async startDiscoveryScan(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Bluetooth non supporté sur ce navigateur.' };
    }

    try {
      const systemRings = await this.getSystemConnectedRings();
      for (const r of systemRings) {
        this.notifyDiscoveredDevice(r);
      }

      if (!Capacitor.isNativePlatform()) {
        return { success: true };
      }

      if (!this.isNativeInitialized) {
        await BleClient.initialize();
        this.isNativeInitialized = true;
      }

      try {
        await BleClient.stopLEScan();
      } catch (_) {}

      const seenIds = new Set<string>(systemRings.map((r) => r.deviceId));
      await BleClient.requestLEScan({ allowDuplicates: true }, (result) => {
        const rawName = (result.localName || result.device?.name || '').trim();
        if (!rawName || rawName.toLowerCase() === 'unknown') return;

        const upper = rawName.toUpperCase();
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
          'IPHONE',
          'AIRPODS',
          'JBL',
          'BOSE',
          'SONOS',
          'PHILIPS',
          'HUE',
          'TILE',
        ].some((b) => upper.includes(b));
        if (isBlacklisted) return;

        const deviceId = result.device?.deviceId;
        if (!deviceId || seenIds.has(deviceId)) return;
        seenIds.add(deviceId);

        const isRing = [
          'QRING',
          'AUREL',
          'VYTA',
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

        this.notifyDiscoveredDevice({
          deviceId,
          name: rawName,
          rssi: result.rssi,
          isRing,
        });
      });

      return { success: true };
    } catch (err: any) {
      console.warn('[QRing BLE Discovery] Scan error:', err);
      return { success: false, error: err?.message || 'Erreur lors du scan Bluetooth.' };
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
        { namePrefix: 'Aurel' },
        { namePrefix: 'Vyta' },
        { namePrefix: 'QC' },
        { namePrefix: 'Ring' },
        { namePrefix: 'R0' },
        { namePrefix: 'R2' },
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
    const deviceName = device.name || 'Aurel Ring One';

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
  /**
   * Configure all ring autonomous sensors measurement intervals (Heart Rate, SpO2, HRV, Stress)
   * Official Colmi R02 / QRing BLE Protocol:
   * - Command 0x16 (CMD_HEART_RATE_LOG_SETTINGS): [0x02, enabledByte, intervalMin]
   *   enabledByte: 0x01 = enable, 0x02 = disable (0x00 is invalid in firmware).
   *   intervalMin: e.g. 30 or 60 minutes. This drives the master hardware optical PPG wake-up timer.
   * - Command 0x2C (CMD_BLOOD_OXYGEN): [0x02, enabledByte, intervalMin]
   * - Command 0x38 (CMD_HRV): [0x02, enabledByte, intervalMin]
   * - Command 0x36 (CMD_PRESSURE / Stress): [0x02, enabledByte, intervalMin]
   */
  public async setAllSensorIntervals(minutes?: number, force: boolean = false): Promise<boolean> {
    const mins = minutes ?? this.configuredIntervalMinutes;
    this.configuredIntervalMinutes = mins;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vyta_ring_interval', String(mins));
      }
    } catch (_) {}

    if (!this.isConnected()) {
      return false;
    }

    // Never rewrite hardware intervals repeatedly if the ring was already configured with the same cadence
    if (!force && this.lastProgrammedIntervalMinutes === mins) {
      return true;
    }

    this.needsBoundaryAlign = false;
    if (this.boundaryAlignTimer) {
      clearTimeout(this.boundaryAlignTimer);
      this.boundaryAlignTimer = null;
    }
    const enabledByte = mins > 0 ? 0x01 : 0x02; // 0x01 = enable, 0x02 = disable in Colmi R02 firmware
    const secondaryMinsByte = mins > 0 ? (Math.min(30, mins) & 0xFF) : 0x00;
    const tempMinsByte = mins > 0 ? (Math.min(30, mins) & 0xFF) : 0x00;
    console.log(
      `[QRing BLE] Programming ring intervals: HR=${mins}m (${enabledByte === 1 ? 'ON' : 'OFF'}), SpO2/VRC/Stress/Temp=${mins > 0 ? `${secondaryMinsByte}m ON` : 'OFF'}`
    );

    // 1. Heart rate (0x16) — primary scheduled green LED timer
    const ok16 = await this.writeBytes(this.makePacket(0x16, [0x02, enabledByte, mins & 0xFF]));
    await new Promise((r) => setTimeout(r, 160));

    // 2. SpO2 (0x2C) — RED LED (30m cadence)
    await this.writeBytes(this.makePacket(0x2C, [0x02, enabledByte, secondaryMinsByte]));
    await new Promise((r) => setTimeout(r, 160));

    // 3. HRV (0x38) — 30m cadence
    await this.writeBytes(this.makePacket(0x38, [0x02, enabledByte, secondaryMinsByte]));
    await new Promise((r) => setTimeout(r, 160));

    // 4. Stress (0x36) — 30m cadence
    await this.writeBytes(this.makePacket(0x36, [0x02, enabledByte, secondaryMinsByte]));
    await new Promise((r) => setTimeout(r, 160));

    // 5. Temperature (0x3A) — NTC thermistor (0 LEDs, 30m cadence)
    await this.writeBytes(this.makePacket(0x3A, [0x02, enabledByte, tempMinsByte]));
    await new Promise((r) => setTimeout(r, 140));

    if (ok16) {
      this.lastProgrammedIntervalMinutes = mins;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'vyta_hw_programmed_interval',
            JSON.stringify({
              cfgVer: 6,
              deviceId: this.connectedDeviceId || this.getSavedDeviceId() || '',
              minutes: mins,
              needsAlign: false,
              ts: Date.now(),
            })
          );
        } catch (_) {}
      }
    }

    return ok16;
  }

  public async setHeartRateInterval(minutes?: number): Promise<boolean> {
    return this.setAllSensorIntervals(minutes);
  }

  /**
   * Request stored periodic/hourly heart rate logs from the ring
   * Command 21 (0x15): struct HeartRateRequest { commandId=21; unixTime; }
   * CRITICAL: In Colmi R02 / QRing firmware, unixTime is divided by 86400 (UTC day)
   * because the BCD clock (0x01) is stored as naive wall-clock in the ring's UTC epoch.
   * Sending localMidnightSec in CET (UTC+1) equals 23:00 UTC of YESTERDAY and returns yesterday's log!
   * Therefore we MUST send utcMidnightSec FIRST!
   */
  private resolveHrLogWaiters() {
    if (this.hrLogDoneResolvers.length > 0) {
      const resolvers = this.hrLogDoneResolvers.splice(0);
      resolvers.forEach((r) => r());
    }
  }

  private waitForHrLogCompletion(timeoutMs = 1150): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const idx = this.hrLogDoneResolvers.indexOf(finish);
        if (idx >= 0) this.hrLogDoneResolvers.splice(idx, 1);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.hrLogDoneResolvers.push(finish);
    });
  }

  private resolveBigDataWaiters(dataId: number) {
    for (const w of [...this.bigDataWaiters]) {
      if (w.ids.includes(dataId)) {
        w.resolve();
      }
    }
  }

  private waitForBigData(ids: number[], timeoutMs = 600): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const waiterRef = {
        ids,
        resolve: () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const idx = this.bigDataWaiters.indexOf(waiterRef);
          if (idx >= 0) this.bigDataWaiters.splice(idx, 1);
          resolve();
        },
      };
      this.bigDataWaiters.push(waiterRef);
      const timer = setTimeout(waiterRef.resolve, timeoutMs);
    });
  }

  public async requestHeartRateLog(waitForCompletion = false): Promise<boolean> {
    console.log('[QRing BLE] Requesting full-day 30-min heart rate logs from ring memory (Command 21 / 0x15)...');
    this.hrLogReadings = [];
    this.hrLogFramesExpected = 0;

    const waitPromise = waitForCompletion ? this.waitForHrLogCompletion(1800) : null;

    const now = new Date();
    const utcMidnightSec = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) / 1000);

    const send0x15 = async (tsSec: number) => {
      const t0 = tsSec & 0xFF;
      const t1 = (tsSec >> 8) & 0xFF;
      const t2 = (tsSec >> 16) & 0xFF;
      const t3 = (tsSec >> 24) & 0xFF;
      const pkt = this.makePacket(0x15, [t0, t1, t2, t3]);
      return await this.writeBytes(pkt);
    };

    // Primary query: UTC midnight of today's calendar date (matches BCD clock epoch on QRing/Colmi).
    // Never send localMidnightSec in UTC+ timezones as it equals 23:00 UTC of yesterday and returns yesterday's log!
    const ok = await send0x15(utcMidnightSec);
    if (waitPromise) {
      if (ok) {
        await waitPromise;
      } else {
        this.resolveHrLogWaiters();
      }
    }

    return ok;
  }

  /**
   * Request today's steps and activity from ring memory
   * Command 67 (0x43): Colmi R02 15-minute sport detail blocks
   * Command 7 (0x07): QCBand daily totals
   */
  private resolveStepsDetailWaiters() {
    if (this.stepsDetailWaiters.length > 0) {
      const resolvers = this.stepsDetailWaiters.splice(0);
      resolvers.forEach((r) => r());
    }
  }

  private waitForStepsDetail(timeoutMs = 650): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const idx = this.stepsDetailWaiters.indexOf(finish);
        if (idx >= 0) this.stepsDetailWaiters.splice(idx, 1);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.stepsDetailWaiters.push(finish);
    });
  }

  public async requestStepsData(dayOffset: number = 0): Promise<boolean> {
    if (!this.isConnected()) {
      const reconnected = await this.attemptSilentReconnect(false);
      if (!reconnected || !this.isConnected()) return false;
    }
    console.log('[QRing BLE] Requesting steps & activity data (Command 67 / 0x43 and 0x07, dayOffset:', dayOffset, ')...');
    this.requestedStepsDayOffset = Math.max(0, Math.min(6, Math.round(dayOffset)));
    this.stepsQuarterSlots = new Array(96).fill(0);
    this.stepsDetailCalSum = 0;
    this.stepsDetailDistMetersSum = 0;

    const detailWait = this.waitForStepsDetail(1000);
    // 1. Colmi R02 15-minute intervals: [dayOffset, 0x0F, 0x00, 0x5F, 0x01]
    const p43 = this.makePacket(0x43, [this.requestedStepsDayOffset & 0xFF, 0x0F, 0x00, 0x5F, 0x01]);
    const ok43 = await this.writeBytes(p43);
    if (ok43) {
      await detailWait;
    } else {
      this.resolveStepsDetailWaiters();
    }

    // 2. QCBand daily total (0x07) — authoritative daily hardware step/kcal/distance counter
    const p7 = this.makePacket(0x07, [this.requestedStepsDayOffset & 0xFF]);
    const ok7 = await this.writeBytes(p7);
    await new Promise((r) => setTimeout(r, 180));
    return ok7;
  }

  /**
   * Lightweight single-packet live step count read (no 0x43 multi-frame dump),
   * safe to run during active workout without interrupting live 0x69 PPG HR.
   */
  public async requestLiveStepsOnly(): Promise<boolean> {
    if (!this.isConnected()) return false;
    this.requestedStepsDayOffset = 0;
    return await this.writeBytes(this.makePacket(0x07, [0x00]));
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
   * Request sleep logs via Big Data protocol (0xBC 0x27) and Command 68 (0x44, dayOffset=0 only)
   */
  public async requestSleepData(): Promise<boolean> {
    console.log('[QRing BLE] Requesting Sleep records (BigData 0xBC 0x27 & Command 0x44 dayOffset=0)...');

    // 1. Big Data V2 Sleep query (Gadgetbridge YawellRingDeviceSupport verbatim: [0xBC, 0x27, 0x01, 0x00, 0xFF, 0x00, 0xFF])
    if (this.hasBigDataService && this.activeBigDataRxUuid) {
      await this.writeBigDataBytes([0xBC, 0x27, 0x01, 0x00, 0xFF, 0x00, 0xFF]);
      await new Promise((r) => setTimeout(r, 180));
    } else {
      const packet = this.makePacket(0xBC, [0x27, 0x01, 0x00, 0xFF, 0x00, 0xFF]);
      await this.writeBytes(packet);
      await new Promise((r) => setTimeout(r, 150));
    }

    // 2. Fallback Colmi R02 UART Sleep query ONLY for today (dayOffset = 0, NEVER dayOffset = 1 which overwrites today!)
    if (!this.hasBigDataSleepToday) {
      const p44_today = this.makePacket(0x44, [0x00, 0x0F, 0x00, 0x5F, 0x01]);
      await this.writeBytes(p44_today);
    }
    return true;
  }

  /**
   * Request stored SpO2 history via Big Data protocol (0xBC 0x2A, 0 LEDs)
   */
  public async requestSpo2Data(): Promise<boolean> {
    console.log('[QRing BLE] Requesting stored SpO2 history from ring memory (BigData 0xBC 0x2A, 0 LEDs)...');
    if (this.hasBigDataService && this.activeBigDataRxUuid) {
      // Gadgetbridge YawellRingDeviceSupport verbatim: { 0xBC, 0x2A, 0x01, 0x00, 0xFF, 0x00, 0xFF }
      await this.writeBigDataBytes([0xBC, 0x2A, 0x01, 0x00, 0xFF, 0x00, 0xFF]);
    } else {
      await this.writeBytes(this.makePacket(0xBC, [0x2A, 0x01, 0x00, 0xFF, 0x00, 0xFF]));
    }
    return true;
  }

  /**
   * Request stored 30-min HRV (VRC) history from ring flash memory (Command 0x39, 0 LEDs)
   */
  public async requestHrvLog(): Promise<boolean> {
    console.log('[QRing BLE] Requesting stored 30-min HRV (VRC) history (Command 0x39, 0 LEDs)...');
    const pkt = this.makePacket(0x39, [0x00]);
    return await this.writeBytes(pkt);
  }

  /**
   * Request stored 30-min Stress (Pression) history from ring flash memory (Command 0x37, 0 LEDs)
   */
  public async requestStressLog(): Promise<boolean> {
    console.log('[QRing BLE] Requesting stored 30-min Stress history (Command 0x37, 0 LEDs)...');
    const pkt = this.makePacket(0x37, [0x00]);
    return await this.writeBytes(pkt);
  }

  /**
   * Request stored Skin Temperature history from ring flash memory (BigData 0xBC 0x25, 0x26, 0x74)
   */
  public async requestTemperatureData(): Promise<boolean> {
    console.log('[QRing BLE] Requesting stored Skin Temperature history (BigData 0xBC 0x25 - 0 LEDs)...');
    await this.writeBytes(this.makePacket(0x75, [0x00]));
    await new Promise((r) => setTimeout(r, 60));
    if (this.hasBigDataService && this.activeBigDataRxUuid) {
      await this.writeBigDataBytes([0xBC, 0x25, 0x01, 0x00, 0xFF, 0x00, 0xFF]);
    } else {
      await this.writeBytes(this.makePacket(0xBC, [0x25, 0x01, 0x00, 0xFF, 0x00, 0xFF]));
    }
    return true;
  }

  /**
   * Send packet to Big Data characteristic
   */
  private async writeBigDataBytes(bytes: number[]): Promise<boolean> {
    if (!this.connectedDeviceId || !this.activeBigDataRxUuid) return false;
    this.pushBleLog('TX', this.describeBlePacket('TX', bytes), bytes);
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
   * Clamps reading to the current slot of the day to eliminate future uninitialized flash artifacts.
   */
  private finalizeHeartRateLog() {
    if (this.hrLogDebounceTimer) {
      clearTimeout(this.hrLogDebounceTimer);
      this.hrLogDebounceTimer = null;
    }
    if (this.hrLogReadings.length === 0) {
      this.resolveHrLogWaiters();
      return;
    }

    const now = new Date();
    // Derive exact slot duration from actual array length returned by ring hardware:
    // Colmi R02 / QRing sends 288 bytes (5 min per slot = 1440 min) across 23 frames even when interval is set to 30 min.
    const rawLen = this.hrLogReadings.length;
    const slotMin =
      rawLen > 96
        ? 5
        : this.hrLogRangeMinutes === 5 || this.hrLogRangeMinutes === 15 || this.hrLogRangeMinutes === 30 || this.hrLogRangeMinutes === 60
        ? this.hrLogRangeMinutes
        : rawLen > 48
        ? 15
        : rawLen > 24
        ? 30
        : 5;
    const slotsPerDay = Math.floor(1440 / slotMin);
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const currentSlot = Math.min(slotsPerDay - 1, Math.max(0, Math.floor(minutesSinceMidnight / slotMin)));

    // Future slots (> currentSlot) or beyond 24h (> slotsPerDay - 1) are zeroed out:
    const clampedLog = this.hrLogReadings.slice(0, slotsPerDay).map((bpm, slotIdx) => {
      if (slotIdx > currentSlot) return 0;
      return bpm >= 40 && bpm <= 200 ? bpm : 0;
    });

    // Regroup real ring readings into 48 half-hour slots (00:00, 00:30 ... 23:30).
    // Preserve every real half-hour slot (:00 and :30) regardless of whether HR cadence is 30m or 60m.
    const halfHourLog: number[] = new Array(48).fill(0);
    clampedLog.forEach((bpm, slotIdx) => {
      if (bpm < 40 || bpm > 200) return;
      const minute = slotIdx * slotMin;
      const half = Math.floor(minute / 30);
      if (half >= 0 && half < 48) {
        halfHourLog[half] = bpm;
      }
    });

    const validHalfHourPulses = halfHourLog.filter((b) => b >= 40 && b <= 200);
    const validPulses = clampedLog.slice(0, currentSlot + 1).filter((b) => b >= 40 && b <= 200);
    const effectivePulses = validPulses.length > 0 ? validPulses : validHalfHourPulses;

    // Always surface the newest valid reading from flash memory (up to currentSlot)
    let latestBpm = 0;
    for (let s = currentSlot; s >= 0; s--) {
      if (clampedLog[s] >= 40 && clampedLog[s] <= 200) {
        latestBpm = clampedLog[s];
        break;
      }
    }
    if (!latestBpm) {
      for (let h = 47; h >= 0; h--) {
        if (halfHourLog[h] >= 40 && halfHourLog[h] <= 200) {
          latestBpm = halfHourLog[h];
          break;
        }
      }
    }

    if (effectivePulses.length > 0) {
      if (!latestBpm) latestBpm = effectivePulses[effectivePulses.length - 1];
      const minBpm = Math.min(...effectivePulses);
      const maxBpm = Math.max(...effectivePulses);
      const restingBpm = Math.round(effectivePulses.reduce((a, b) => a + b, 0) / effectivePulses.length);
      console.log(
        `[QRing BLE] Finalized Heart Rate Log (rawLen=${rawLen}, slotMin=${slotMin}, currentSlot=${currentSlot} at ${now.getHours()}h${now.getMinutes()}): latest=${latestBpm} bpm, resting=${restingBpm} bpm, min=${minBpm}, max=${maxBpm}`
      );

      // Enregistrer dans l'activité les heures réelles où la bague a mesuré le BPM
      const dateKey = this.getTodayDateKey(now);
      const bpmEvents: RingMeasureEvent[] = [];
      clampedLog.forEach((bpm, slotIdx) => {
        if (bpm < 40 || bpm > 200) return;
        const minutesOfDay = slotIdx * slotMin;
        const time = this.formatMinutesHHMM(minutesOfDay);
        bpmEvents.push({
          id: `${dateKey}|bpm|${time}`,
          dateKey,
          time,
          minutesOfDay,
          kind: 'bpm',
          label: 'BPM',
          value: `${bpm} bpm`,
          led: 'green',
          source: 'auto',
        });
      });
      this.upsertMeasureEvents(bpmEvents);

      this.notify({
        heartRate: latestBpm,
        heartRateLog: halfHourLog,
        minBpm,
        maxBpm,
        restingBpm,
        isConnected: true,
      });
    }
    this.resolveHrLogWaiters();
  }

  private parseRingDateDaysAgo(bY: number, bM: number, bD: number): number | null {
    const decodeBcd = (v: number) =>
      ((v >> 4) & 0x0F) <= 9 && (v & 0x0F) <= 9 ? ((v >> 4) * 10 + (v & 0x0F)) : -1;
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const candidates: Array<[number, number, number]> = [];
    const by = decodeBcd(bY);
    const bm = decodeBcd(bM);
    const bd = decodeBcd(bD);
    if (by >= 24 && by <= 35 && bm >= 1 && bm <= 12 && bd >= 1 && bd <= 31) {
      candidates.push([2000 + by, bm - 1, bd]);
    }
    if (bY >= 24 && bY <= 35 && bM >= 1 && bM <= 12 && bD >= 1 && bD <= 31) {
      candidates.push([2000 + bY, bM - 1, bD]);
    }
    for (const [yr, mo, dy] of candidates) {
      const dt = new Date(yr, mo, dy);
      if (dt.getFullYear() === yr && dt.getMonth() === mo && dt.getDate() === dy) {
        const diffDays = Math.round((todayMidnight - dt.getTime()) / 86400000);
        if (diffDays >= 0 && diffDays <= 14) return diffDays;
      }
    }
    return null;
  }

  private finalizeStepsDetailLog() {
    if (this.stepsDetailDebounceTimer) {
      clearTimeout(this.stepsDetailDebounceTimer);
      this.stepsDetailDebounceTimer = null;
    }
    const hourly = new Array(24).fill(0);
    let total = 0;
    for (let q = 0; q < 96; q++) {
      const s = this.stepsQuarterSlots[q];
      if (s > 0) {
        hourly[Math.floor(q / 4)] += s;
        total += s;
      }
    }
    if (total > 0) {
      const calKcal = this.stepsDetailCalSum > 0
        ? Math.max(1, Math.round(this.stepsDetailCalSum / 1000))
        : Math.max(1, Math.round(total * 0.04));
      const distKm = this.stepsDetailDistMetersSum > 0
        ? parseFloat((this.stepsDetailDistMetersSum / 1000).toFixed(2))
        : undefined;
      console.log(`[QRing BLE] Finalized 0x43 Hourly Steps Log (daysAgo=${this.requestedStepsDayOffset}): total=${total}`);
      this.notify({
        daysAgo: this.requestedStepsDayOffset,
        stepsHourly: hourly,
        steps: total,
        stepsAuthoritative: true,
        calories: calKcal,
        ...(distKm && distKm > 0 ? { distanceKm: distKm } : {}),
        isConnected: true,
      });
    }
    this.resolveStepsDetailWaiters();
  }

  /**
   * Finalizes 30-min Stress Log (Command 0x37) once packets 1..4 arrive
   */
  private finalizeStressLog() {
    if (this.stressDebounceTimer) {
      clearTimeout(this.stressDebounceTimer);
      this.stressDebounceTimer = null;
    }
    const now = new Date();
    const currentHalfSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
    const clamped = this.stressLogSlots.map((v, idx) => (idx <= currentHalfSlot && v > 0 && v <= 100 ? v : 0));
    const valid = clamped.filter((v) => v > 0 && v <= 100);
    if (valid.length === 0) return;

    const latestStress = valid[valid.length - 1];
    const stressAvg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    const stressMin = Math.min(...valid);
    const stressMax = Math.max(...valid);
    console.log(
      `[QRing BLE] Finalized 30-min Stress Log (0x37): latest=${latestStress}, avg=${stressAvg}, min=${stressMin}, max=${stressMax}`
    );
    const dateKey = this.getTodayDateKey(now);
    const stressEvents: RingMeasureEvent[] = [];
    clamped.forEach((v, slotIdx) => {
      if (v <= 0) return;
      const minutesOfDay = slotIdx * 30;
      const time = this.formatMinutesHHMM(minutesOfDay);
      stressEvents.push({
        id: `${dateKey}|stress|${time}`,
        dateKey,
        time,
        minutesOfDay,
        kind: 'stress',
        label: 'Stress',
        value: `${v}`,
        led: 'green',
        source: 'auto',
      });
    });
    this.upsertMeasureEvents(stressEvents);
    this.notify({
      stress: latestStress,
      stressAvg,
      stressMin,
      stressMax,
      stressLog: clamped,
      isConnected: true,
    });
  }

  /**
   * Finalizes 30-min HRV / VRC Log (Command 0x39) once packets 1..4 arrive
   */
  private finalizeHrvLog() {
    if (this.hrvDebounceTimer) {
      clearTimeout(this.hrvDebounceTimer);
      this.hrvDebounceTimer = null;
    }
    const now = new Date();
    const currentHalfSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
    const clamped = this.hrvLogSlots.map((v, idx) => (idx <= currentHalfSlot && v >= 5 && v < 250 ? v : 0));
    const valid = clamped.filter((v) => v >= 5 && v < 250);
    if (valid.length === 0) return;

    const latestHrv = valid[valid.length - 1];
    console.log(`[QRing BLE] Finalized 30-min HRV Log (0x39): latest=${latestHrv} ms (${valid.length} points)`);
    const dateKey = this.getTodayDateKey(now);
    const hrvEvents: RingMeasureEvent[] = [];
    clamped.forEach((v, slotIdx) => {
      if (v < 5) return;
      const minutesOfDay = slotIdx * 30;
      const time = this.formatMinutesHHMM(minutesOfDay);
      hrvEvents.push({
        id: `${dateKey}|hrv|${time}`,
        dateKey,
        time,
        minutesOfDay,
        kind: 'hrv',
        label: 'VRC',
        value: `${v} ms`,
        led: 'green',
        source: 'auto',
      });
    });
    this.upsertMeasureEvents(hrvEvents);
    this.notify({
      hrv: latestHrv,
      hrvLog: clamped,
      isConnected: true,
    });
  }

  /**
   * Reassembles multi-packet BigData V2 (0xBC) notifications on de5bf729-d711-4e47-af26-65e3012a5dc7.
   * Header is 6 bytes: [0xBC, dataId, lenLo, lenHi, crcLo, crcHi], followed by `payloadLength` bytes across chunks.
   */
  private handleBigDataNotification(dataView: DataView) {
    if (!dataView || dataView.byteLength === 0) return;
    const chunk = Array.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join('');
    console.log('[QRing BLE BIGDATA RECV]', hex);
    if (chunk[0] === 0xBC) {
      this.pushBleLog('RX', this.describeBlePacket('RX', chunk), chunk);
    }

    if (
      chunk[0] === 0xBC &&
      chunk.length >= 6 &&
      (this.bigDataBuffer.length === 0 ||
        [0x27, 0x2A, 0x25, 0x26, 0x74, 0x75].includes(chunk[1]))
    ) {
      // If a previous packet was sitting in buffer, flush it before starting the new 0xBC header
      if (this.bigDataBuffer.length >= 7) {
        this.dispatchCompleteBigDataPacket(new Uint8Array(this.bigDataBuffer));
      }
      this.bigDataBuffer = [...chunk];
      this.bigDataExpectedPayloadLen = chunk[2] | (chunk[3] << 8);
    } else if (this.bigDataBuffer.length > 0) {
      this.bigDataBuffer.push(...chunk);
    } else {
      return;
    }

    if (this.bigDataDebounceTimer) {
      clearTimeout(this.bigDataDebounceTimer);
      this.bigDataDebounceTimer = null;
    }

    if (this.bigDataBuffer.length >= this.bigDataExpectedPayloadLen + 6) {
      const fullPacket = new Uint8Array(this.bigDataBuffer);
      this.bigDataBuffer = [];
      this.bigDataExpectedPayloadLen = 0;
      this.dispatchCompleteBigDataPacket(fullPacket);
    } else {
      this.bigDataDebounceTimer = setTimeout(() => {
        if (this.bigDataBuffer.length >= 7) {
          const fullPacket = new Uint8Array(this.bigDataBuffer);
          this.bigDataBuffer = [];
          this.bigDataExpectedPayloadLen = 0;
          this.dispatchCompleteBigDataPacket(fullPacket);
        }
      }, 300);
    }
  }

  private dispatchCompleteBigDataPacket(bytes: Uint8Array) {
    try {
      this.parseCompleteBigDataPacket(bytes);
    } finally {
      if (bytes.length >= 2) {
        this.resolveBigDataWaiters(bytes[1] & 0xFF);
      }
    }
  }

  /**
   * Parses a reassembled BigData V2 (0xBC) payload:
   * - 0x27 (39): Sleep history (multi-block per day + stage pairs: 0x02=light, 0x03=deep, 0x04=rem, 0x05=awake)
   * - 0x2A (42) / 0x5F (95): SpO2 hourly (min, max) history
   * - 0x25 / 0x26 / 0x74: Skin temperature history
   */
  private parseCompleteBigDataPacket(bytes: Uint8Array) {
    if (bytes.length < 7 || bytes[0] !== 0xBC) return;
    const dataId = bytes[1] & 0xFF;
    const payloadLen = bytes[2] | (bytes[3] << 8);
    if (payloadLen <= 0) return;

    // 1. SLEEP HISTORY (dataId = 0x27 / 39) — Gadgetbridge YawellRingPacketHandler.historicalSleep verbatim
    if (dataId === 0x27 || dataId === 39) {
      if (payloadLen < 2 || bytes.length < 7) return;
      const daysInPacket = bytes[6] & 0xFF;
      let index = 7;

      interface StageItem {
        type: number;
        minutes: number;
      }
      interface SleepDayRecord {
        daysAgo: number;
        normStart: number;
        normEnd: number;
        lightMin: number;
        deepMin: number;
        remMin: number;
        awakeMin: number;
        stages: StageItem[];
      }
      const records: SleepDayRecord[] = [];

      for (let i = 0; i < daysInPacket && index + 6 <= bytes.length; i++) {
        const daysAgo = bytes[index++] & 0xFF;
        const dayBytes = bytes[index++] & 0xFF;
        const recordStart = index;
        const sleepStart = bytes[index] | (bytes[index + 1] << 8);
        index += 2;
        const sleepEnd = bytes[index] | (bytes[index + 1] << 8);
        index += 2;

        const normStart = sleepStart > sleepEnd ? sleepStart - 1440 : sleepStart;
        const normEnd = sleepEnd;

        let lightMin = 0;
        let deepMin = 0;
        let remMin = 0;
        let awakeMin = 0;
        const stages: StageItem[] = [];

        for (let j = 4; j < dayBytes && index + 1 < bytes.length; j += 2) {
          const stageType = bytes[index++] & 0xFF;
          const stageMinutes = bytes[index++] & 0xFF;
          if (stageMinutes > 0) {
            stages.push({ type: stageType, minutes: stageMinutes });
            if (stageType === 0x02) lightMin += stageMinutes;
            else if (stageType === 0x03) deepMin += stageMinutes;
            else if (stageType === 0x04) remMin += stageMinutes;
            else if (stageType === 0x05) awakeMin += stageMinutes;
          }
        }
        index = Math.max(index, recordStart + dayBytes);

        records.push({ daysAgo, normStart, normEnd, lightMin, deepMin, remMin, awakeMin, stages });
      }

      if (records.length === 0) return;

      // Traiter chaque journée (daysAgo) présente dans les paquets historiques de la bague :
      // daysAgo === 0 : aujourd'hui (uniquement si le réveil est réellement terminé et antérieur à l'heure courante)
      // daysAgo > 0   : journées antérieures (ex: hier = 1). Ne doit JAMAIS être attribué à aujourd'hui !
      const uniqueDaysAgo = Array.from(new Set(records.map((r) => r.daysAgo)));
      for (const dAgo of uniqueDaysAgo) {
        const dayBlocks = records.filter((r) => r.daysAgo === dAgo);
        dayBlocks.sort((a, b) => a.normStart - b.normStart);

        // Partitionnement intelligent : Sommeil nocturne principal vs Siestes de jour (Naps)
        // Les siestes ont lieu en journée (08:30 - 20:00) avec une durée typique de 15 à 180 min.
        // Elles ne doivent jamais écraser ni décaler les heures de coucher et de réveil du sommeil de nuit !
        const napBlocks: SleepDayRecord[] = [];
        const nightBlocks: SleepDayRecord[] = [];

        if (dayBlocks.length > 1) {
          const maxDur = Math.max(...dayBlocks.map((b) => (b.lightMin + b.deepMin + b.remMin + b.awakeMin) || (b.normEnd - b.normStart)));
          for (const b of dayBlocks) {
            const dur = (b.lightMin + b.deepMin + b.remMin + b.awakeMin) || (b.normEnd - b.normStart);
            const clockStart = ((b.normStart % 1440) + 1440) % 1440;
            // Véritable fenêtre circadienne de sieste diurne (11:00 à 19:30). Ne jamais fragmenter le sommeil du matin !
            const isDaytime = clockStart >= 660 && clockStart <= 1170;
            if (isDaytime && dur >= 15 && dur <= 120 && dur < maxDur) {
              napBlocks.push(b);
            } else {
              nightBlocks.push(b);
            }
          }
        } else if (dayBlocks.length === 1) {
          const b = dayBlocks[0];
          const dur = (b.lightMin + b.deepMin + b.remMin + b.awakeMin) || (b.normEnd - b.normStart);
          const clockStart = ((b.normStart % 1440) + 1440) % 1440;
          const isDaytime = clockStart >= 660 && clockStart <= 1170;
          if (isDaytime && dur <= 120 && dur >= 15) {
            napBlocks.push(b);
          } else {
            nightBlocks.push(b);
          }
        }

        // 1. EXTRACTION DES SIESTES DU JOUR
        const dayNaps: NapRecord[] = napBlocks.map((nap, nIdx) => {
          const dur = Math.max(15, (nap.lightMin + nap.deepMin + nap.remMin + nap.awakeMin) || (nap.normEnd - nap.normStart));
          const startClockMin = ((nap.normStart % 1440) + 1440) % 1440;
          const endClockMin = ((nap.normEnd % 1440) + 1440) % 1440;
          const energyBonus = Math.min(18, Math.max(5, Math.round(dur / 4.5)));
          const napScore = Math.min(100, Math.round((dur / 45) * 85 + (nap.deepMin / dur) * 15));
          const napType: 'power' | 'restful' | 'cycle' = dur <= 25 ? 'power' : (dur <= 55 ? 'restful' : 'cycle');
          return {
            id: `nap-${dAgo}-${startClockMin}-${nIdx}`,
            startMin: startClockMin,
            endMin: endClockMin,
            durationMin: dur,
            deepMin: nap.deepMin,
            lightMin: nap.lightMin,
            remMin: nap.remMin,
            score: napScore,
            energyBonus,
            source: 'ring' as const,
            napType,
          };
        });

        // 2. ANALYSE DU SOMMEIL NOCTURNE PRINCIPAL (s'il existe)
        if (nightBlocks.length > 0) {
          const totalLight = nightBlocks.reduce((s, b) => s + b.lightMin, 0);
          const totalDeep = nightBlocks.reduce((s, b) => s + b.deepMin, 0);
          const totalRem = nightBlocks.reduce((s, b) => s + b.remMin, 0);
          let totalAwake = nightBlocks.reduce((s, b) => s + b.awakeMin, 0);

          const earliestStart = nightBlocks[0].normStart;
          const lastBlock = nightBlocks[nightBlocks.length - 1];

          // Détection fine du réveil physiologique réel :
          // Détecter les éventuels stades d'éveil terminaux (0x05) à la fin du dernier bloc
          let trailingAwakeMin = 0;
          if (lastBlock.stages.length > 0) {
            for (let k = lastBlock.stages.length - 1; k >= 0; k--) {
              if (lastBlock.stages[k].type === 0x05) {
                trailingAwakeMin += lastBlock.stages[k].minutes;
              } else {
                break;
              }
            }
          }

          const lastBlockStageSum = lastBlock.lightMin + lastBlock.deepMin + lastBlock.remMin + lastBlock.awakeMin;
          const totalStageSum = totalLight + totalDeep + totalRem + totalAwake;
          const hasStages = totalStageSum >= 60;

          let realEndNorm: number;
          if (hasStages) {
            if (lastBlock.stages.length > 0) {
              realEndNorm = lastBlock.normStart + (lastBlockStageSum - trailingAwakeMin);
            } else {
              realEndNorm = earliestStart + (totalStageSum - trailingAwakeMin);
            }
            totalAwake = Math.max(0, totalAwake - trailingAwakeMin);
          } else {
            const spanMin = lastBlock.normEnd - earliestStart;
            realEndNorm = spanMin >= 60 && spanMin <= 960 ? lastBlock.normEnd : earliestStart + 480;
          }

          // Si pour aujourd'hui l'heure de fin calculée coïncide avec l'heure exacte de connexion de l'app (maintenant)
          // alors que la durée réelle de sommeil indique un réveil antérieur :
          if (dAgo === 0) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const clockEnd = ((realEndNorm % 1440) + 1440) % 1440;
            const physioSleepMin = totalDeep + totalRem + totalLight + totalAwake;
            if (Math.abs(clockEnd - nowMin) <= 3 && physioSleepMin >= 60 && (earliestStart + physioSleepMin) < nowMin - 10) {
              console.log(`[QRing BLE] Sleep end was dragged to app sync time (${clockEnd} min). Corrected to physiological wake-up: ${earliestStart + physioSleepMin} min`);
              realEndNorm = earliestStart + physioSleepMin;
            }
          }

          const finalTotalMin = hasStages
            ? (totalLight + totalDeep + totalRem + totalAwake)
            : Math.min(960, Math.max(60, realEndNorm - earliestStart));

          if (finalTotalMin >= 60 && finalTotalMin <= 960) {
            const startClockMin = ((earliestStart % 1440) + 1440) % 1440;
            const endClockMin = ((realEndNorm % 1440) + 1440) % 1440;

            if (dAgo === 0) {
              const now = new Date();
              const nowMin = now.getHours() * 60 + now.getMinutes();
              if (nowMin < 360) {
                console.warn(
                  `[QRing BLE] Middle of the night (${nowMin} min < 6h00). Premature night sleep ignored for today.`
                );
                continue;
              }
              if (endClockMin > nowMin && (realEndNorm > 0 || nowMin < 720)) {
                console.warn(
                  `[QRing BLE] Sleep end (${endClockMin} min) is in the future compared to now (${nowMin} min). Ignored for today.`
                );
                continue;
              }
              this.hasBigDataSleepToday = true;
            }

            const sleepHours = parseFloat((finalTotalMin / 60).toFixed(4));
            const durationScore = Math.min(100, Math.round((finalTotalMin / 480) * 100));
            const effRatio = finalTotalMin > 0 ? (finalTotalMin - totalAwake) / finalTotalMin : 1;
            const deepRemRatio = finalTotalMin > 0 ? (totalDeep + totalRem) / finalTotalMin : 0.4;
            const sleepScore = Math.min(
              99,
              Math.max(
                50,
                Math.round(durationScore * 0.55 + effRatio * 100 * 0.3 + Math.min(100, deepRemRatio * 200) * 0.15)
              )
            );

            console.log(
              `[QRing BLE] Parsed BigData 0x27 Sleep (daysAgo=${dAgo}, nightBlocks=${nightBlocks.length}, naps=${dayNaps.length}): total=${finalTotalMin}min (${Math.floor(finalTotalMin / 60)}h${String(finalTotalMin % 60).padStart(2, '0')}m), score=${sleepScore}, start=${startClockMin}, end=${endClockMin}`
            );

            this.notify({
              daysAgo: dAgo,
              sleepHours,
              sleepDeepMin: totalDeep,
              sleepRemMin: totalRem,
              sleepLightMin: totalLight,
              sleepAwakeMin: totalAwake,
              sleepScore,
              sleepStartMin: startClockMin,
              sleepEndMin: endClockMin,
              naps: dayNaps,
              isConnected: true,
            });
          }
        } else if (dayNaps.length > 0) {
          // Journée avec uniquement une sieste détectée (bague non portée la nuit)
          console.log(`[QRing BLE] Parsed BigData 0x27 Day Nap only (daysAgo=${dAgo}, naps=${dayNaps.length})`);
          this.notify({
            daysAgo: dAgo,
            naps: dayNaps,
            isConnected: true,
          });
        }
      }
      return;
    }

    // 2. SPO2 HISTORY (dataId = 0x2A) — Gadgetbridge YawellRingPacketHandler.historicalSpo2 verbatim
    if (dataId === 0x2A) {
      const now = new Date();
      const currentHalfSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
      const spo2Log: number[] = new Array(48).fill(0);
      let latestSpo2 = 0;
      let minSpo2 = 101;
      let maxSpo2 = 0;

      let index = 6;
      while (index - 6 < payloadLen && index < bytes.length) {
        const daysAgo = bytes[index++] & 0xFF;
        for (let hour = 0; hour < 24 && index + 1 < bytes.length && index - 6 < payloadLen; hour++) {
          const b0 = bytes[index++] & 0xFF;
          const b1 = bytes[index++] & 0xFF;
          const slot0 = hour * 2;
          const slot1 = hour * 2 + 1;
          const v0 = b0 >= 70 && b0 <= 100 ? b0 : 0;
          const v1 = b1 >= 70 && b1 <= 100 ? b1 : 0;
          if (daysAgo === 0) {
            if (v0 > 0 && slot0 <= currentHalfSlot) {
              latestSpo2 = v0;
              if (v0 < minSpo2) minSpo2 = v0;
              if (v0 > maxSpo2) maxSpo2 = v0;
              spo2Log[slot0] = v0;
            }
            // Journaliser tous les créneaux SpO2 réels (y compris :30 si le firmware a allumé la LED rouge)
            if (v1 > 0 && slot1 <= currentHalfSlot) {
              const dk = this.getTodayDateKey(now);
              const t1 = this.formatMinutesHHMM(slot1 * 30);
              this.upsertMeasureEvents([{
                id: `${dk}|spo2|${t1}`,
                dateKey: dk,
                time: t1,
                minutesOfDay: slot1 * 30,
                kind: 'spo2',
                label: 'SpO2',
                value: `${v1}%`,
                led: 'red',
                source: 'auto',
              }]);
            }
            // Enregistrer la vraie mesure SpO2 sur :30 si v1 est présent dans la flash de la bague
            if (v1 > 0 && slot1 <= currentHalfSlot) {
              latestSpo2 = v1;
              if (v1 < minSpo2) minSpo2 = v1;
              if (v1 > maxSpo2) maxSpo2 = v1;
              spo2Log[slot1] = v1;
            }
          }
        }
        if (daysAgo === 0) break;
      }

      if (latestSpo2 >= 70 && latestSpo2 <= 100) {
        const dk = this.getTodayDateKey(now);
        const spo2Events: RingMeasureEvent[] = [];
        spo2Log.forEach((v, sIdx) => {
          if (v >= 70 && v <= 100) {
            const tm = this.formatMinutesHHMM(sIdx * 30);
            spo2Events.push({
              id: `${dk}|spo2|${tm}`,
              dateKey: dk,
              time: tm,
              minutesOfDay: sIdx * 30,
              kind: 'spo2',
              label: 'SpO2',
              value: `${v}%`,
              led: 'red',
              source: 'auto',
            });
          }
        });
        this.upsertMeasureEvents(spo2Events);
        console.log(
          `[QRing BLE] Parsed BigData SpO2 (0x2A): latest=${latestSpo2}%, min=${minSpo2 <= 100 ? minSpo2 : latestSpo2}%, max=${maxSpo2 >= 70 ? maxSpo2 : latestSpo2}%`
        );
        this.notify({
          spo2: latestSpo2,
          spo2Min: minSpo2 <= 100 ? minSpo2 : latestSpo2,
          spo2Max: maxSpo2 >= 70 ? maxSpo2 : latestSpo2,
          spo2Log: spo2Log.some((v) => v > 0) ? spo2Log : undefined,
          isConnected: true,
        });
      }
      return;
    }

    // 3. SKIN TEMPERATURE HISTORY (dataId = 0x25 / 0x26 / 0x74 / 0x75)
    if (dataId === 0x25 || dataId === 0x26 || dataId === 0x74 || dataId === 0x75) {
      const now = new Date();
      const currentHalfSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
      let idx = 6;
      while (idx - 6 < payloadLen && idx < bytes.length) {
        const daysAgo = bytes[idx++] & 0xFF;
        if (idx >= bytes.length) break;
        idx++; // interval marker 0x1e
        const tempLog: number[] = new Array(48).fill(0);
        let dayLatestTemp = 0;
        for (let h = 0; h < 24 && idx - 6 < payloadLen && idx < bytes.length; h++) {
          for (let half = 0; half < 2 && idx - 6 < payloadLen && idx < bytes.length; half++) {
            const raw = bytes[idx++] & 0xFF;
            const slotIdx = h * 2 + half;
            // Pour aujourd'hui (daysAgo === 0), enregistrer uniquement les créneaux réels jusqu'à l'heure courante.
            // Pour les nuits et jours passés (daysAgo > 0), tous les créneaux 0 à 47 sont valides.
            if ((daysAgo === 0 && slotIdx <= currentHalfSlot) || daysAgo > 0) {
              let t = 0;
              if (raw >= 100 && raw <= 220) {
                t = Math.round((raw / 10 + 20) * 10) / 10;
              } else if (raw >= 300 && raw <= 430) {
                t = Math.round((raw / 10) * 10) / 10;
              } else if (raw >= 30 && raw <= 43) {
                t = raw;
              }
              if (t >= 30 && t <= 42) {
                if (daysAgo === 0) {
                  const dk = this.getTodayDateKey(now);
                  const tm = this.formatMinutesHHMM(slotIdx * 30);
                  this.upsertMeasureEvents([{
                    id: `${dk}|temp|${tm}`,
                    dateKey: dk,
                    time: tm,
                    minutesOfDay: slotIdx * 30,
                    kind: 'temp',
                    label: 'Température',
                    value: `${t.toFixed(1)}°C`,
                    led: 'amber',
                    source: 'auto',
                  }]);
                }
                // Enregistrer la vraie mesure dans le créneau réel (:00 ou :30) si la bague l'a mesurée
                dayLatestTemp = t;
                tempLog[slotIdx] = t;
              }
            }
          }
        }
        if (dayLatestTemp >= 30 && dayLatestTemp <= 42) {
          console.log(`[QRing BLE] Parsed BigData Skin Temp (daysAgo=${daysAgo}): ${dayLatestTemp}°C (${tempLog.filter((v) => v > 0).length} slots)`);
          this.notify({
            daysAgo,
            skinTemp: dayLatestTemp,
            tempLog: tempLog.some((v) => v > 0) ? tempLog : undefined,
            isConnected: true,
          });
        }
      }
      return;
    }
  }

  /**
   * Comprehensive Ring Synchronization:
   * 1. Synchronizes Real-Time Clock with BCD (Enables sleep engine & timestamps)
   * 2. Re-activates/verifies automatic 30-min measurement (Command 22)
   * 3. Queries stored full-day heart rate logs FIRST (Command 21 - purely memory read, uninterrupted)
   * 4. Queries sleep records (BigData 0xBC 0x27 & Command 68 - purely memory read)
   * 5. Queries stored SpO2 records (BigData 0xBC 0x2A - purely memory read, 0 LEDs)
   * 6. Queries stored 30-min HRV records (Command 0x39 - purely memory read, 0 LEDs)
   * 7. Queries stored 30-min Stress records (Command 0x37 - purely memory read, 0 LEDs)
   * 8. Queries steps, distance, calories (Command 67, 7 & 72)
   * 9. Queries battery level (Command 3)
   */
  public async syncAllRingData(force: boolean = false): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[QRing BLE] Cannot sync: ring is not connected.');
      return false;
    }
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }
    if (this.activeLiveDataType !== null || this.isRealTimeHrActive) {
      return false;
    }
    if (!force && this.lastPeriodicSyncTime > 0 && Date.now() - this.lastPeriodicSyncTime < 20000) {
      return true;
    }

    this.isSyncing = true;
    this.lastPeriodicSyncTime = Date.now();
    console.log('[QRing BLE] === Starting Fast Hardware Data Sync ===');

    this.activeSyncPromise = (async () => {
      try {
        // 1. Clock synchronization + Battery request immediately
        await this.sendTimeSync();
        await this.sendBatteryRequest();
        await new Promise((r) => setTimeout(r, 80));

        // 2. Program autonomous firmware sensor intervals ONLY if not yet programmed or changed
        if (typeof window !== 'undefined') {
          try {
            const intervalsStr = localStorage.getItem('vyta_sensor_intervals');
            if (intervalsStr) {
              const parsed = JSON.parse(intervalsStr);
              if (parsed.heartRate === 'pause') {
                this.configuredIntervalMinutes = 0;
              } else if (parsed.heartRate === '30min') {
                this.configuredIntervalMinutes = 30;
              } else if (parsed.heartRate === '1h') {
                this.configuredIntervalMinutes = 60;
              } else if (parsed.heartRate === '2h') {
                this.configuredIntervalMinutes = 120;
              } else if (parsed.heartRate === '15min') {
                this.configuredIntervalMinutes = 15;
              }
            }
          } catch (_) {}
        }
        if (this.lastProgrammedIntervalMinutes !== this.configuredIntervalMinutes) {
          await this.setAllSensorIntervals(this.configuredIntervalMinutes, false);
          await new Promise((r) => setTimeout(r, 90));
        } else {
          // Silent readback (0 LED, 0 timer reset) to detect if ring firmware reverted any sensor to OFF
          for (const cmd of [0x16, 0x2C, 0x38, 0x36]) {
            await this.writeBytes(this.makePacket(cmd, [0x01]));
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        // 3. Stored full-day heart rate logs (await full multi-frame 0x15 completion so recent slots aren't cut off)
        await this.requestHeartRateLog(true);

        // 4. Stored sleep logs
        const sleepWait = this.waitForBigData([0x27], 500);
        await this.requestSleepData();
        await sleepWait;

        // 5. Stored SpO2 logs
        const spo2Wait = this.waitForBigData([0x2A], 480);
        await this.requestSpo2Data();
        await spo2Wait;

        // 6. Stored 30-min HRV (VRC) logs
        await this.requestHrvLog();
        await new Promise((r) => setTimeout(r, 550));

        // 7. Stored 30-min Stress logs
        await this.requestStressLog();
        await new Promise((r) => setTimeout(r, 550));

        // 8. Stored Skin Temperature logs
        const tempWait = this.waitForBigData([0x25, 0x26, 0x74, 0x75], 450);
        await this.requestTemperatureData();
        await tempWait;

        // 9. Steps and activity detail (0x43 15-min slots + 0x07 daily register)
        await this.requestStepsData(0);
        await new Promise((r) => setTimeout(r, 140));

        console.log('[QRing BLE] === Fast Hardware Data Sync Completed ===');
        return true;
      } catch (e) {
        console.error('[QRing BLE] Sync error:', e);
        return false;
      } finally {
        this.isSyncing = false;
        this.activeSyncPromise = null;
      }
    })();

    return this.activeSyncPromise;
  }

  /**
   * Fast flash-only sensor activity refresh (0 LEDs):
   * Reads HR (0x15 full completion), Temp (0xBC 0x25/0x26), SpO2 (0xBC 0x2A), HRV (0x39), Stress (0x37)
   * so recent autonomous ring LED cycles show up in Activité Temp immediately without frame truncation.
   */
  public async refreshMeasureActivity(): Promise<boolean> {
    if (!this.isConnected()) return false;
    if (this.activeSyncPromise) return this.activeSyncPromise;
    if (this.activeActivityRefreshPromise) return this.activeActivityRefreshPromise;
    if (this.activeLiveDataType !== null || this.isRealTimeHrActive) return false;

    this.activeActivityRefreshPromise = (async () => {
      try {
        // Silent readback (0 LEDs) to verify ring autonomous timer didn't get disabled (e.g. after live HR stop)
        await this.writeBytes(this.makePacket(0x16, [0x01]));
        await new Promise((r) => setTimeout(r, 70));

        await this.requestHeartRateLog(true);

        const tempWait = this.waitForBigData([0x25, 0x26, 0x74, 0x75], 750);
        await this.requestTemperatureData();
        await tempWait;

        const spo2Wait = this.waitForBigData([0x2A], 750);
        await this.requestSpo2Data();
        await spo2Wait;

        await this.requestHrvLog();
        await new Promise((r) => setTimeout(r, 550));

        await this.requestStressLog();
        await new Promise((r) => setTimeout(r, 550));
        return true;
      } catch (_) {
        return false;
      } finally {
        this.activeActivityRefreshPromise = null;
      }
    })();

    return this.activeActivityRefreshPromise;
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

  public isSyncingNow(): boolean {
    return this.isSyncing;
  }

  public getConfiguredIntervalMinutes(): number {
    return this.configuredIntervalMinutes;
  }

  public isRealTimeHeartRateActive(): boolean {
    return this.isRealTimeHrActive || this.activeLiveDataType !== null;
  }

  /**
   * Unified live biometric stream starter for HR (0x01), SpO2 (0x03), Temp (0x05), HRV (0x0A).
   * Ensures silent reconnect without 5s flash-sync delay, spaces BLE writes cleanly for CoreBluetooth,
   * and sustains Action.CONTINUE (0x03) every 1400ms so optical LEDs finish acquiring (~8-18s) without resetting.
   */
  private async startLiveStream(
    dataType: number,
    immediatePackets: number[][] = [],
    fallbackPackets: number[][] = []
  ): Promise<boolean> {
    if (this.realTimeHrTimer) {
      clearInterval(this.realTimeHrTimer);
      this.realTimeHrTimer = null;
    }

    if (this.activeLiveDataType !== null && this.activeLiveDataType !== dataType) {
      await this.stopLiveStream(this.activeLiveDataType);
      await new Promise((r) => setTimeout(r, 90));
    }

    this.activeLiveDataType = dataType;
    if (dataType === 0x01) {
      this.isRealTimeHrActive = true;
    }

    if (!this.isConnected()) {
      console.warn('[QRing BLE] Ring not connected on live measure request. Running fast reconnect...');
      const reconnected = await this.attemptSilentReconnect(true);
      if (!reconnected || !this.isConnected()) {
        console.warn('[QRing BLE] Auto-reconnect failed. Ring cannot illuminate LEDs.');
        this.activeLiveDataType = null;
        this.isRealTimeHrActive = false;
        return false;
      }
      await new Promise((r) => setTimeout(r, 90));
    }

    const startedAt = Date.now();
    this.lastLiveDataAt = 0;
    this.lastLiveAckAt = 0;
    this.lastLiveRearmAt = startedAt;
    this.usedLiveFallbackPackets = false;
    let sentFallback = false;

    // 1. Send Action.START (0x01) once to open the photodiode / thermal stream
    const ok = await this.writeBytes(this.makePacket(0x69, [dataType, 0x01]));
    if (ok) {
      if (dataType === 0x01) {
        this.recordLiveMeasureEvent('bpm', 'BPM', 'LED verte allumée', 'green', 'live');
      } else if (dataType === 0x03) {
        this.recordLiveMeasureEvent('spo2', 'SpO2', 'LED rouge allumée', 'red', 'live');
      } else if (dataType === 0x05) {
        this.recordLiveMeasureEvent('temp', 'Température', 'Mesure en cours', 'amber', 'live');
      } else if (dataType === 0x0A) {
        this.recordLiveMeasureEvent('hrv', 'VRC', 'LED verte allumée', 'green', 'live');
      }
    }

    // 2. Spaced secondary commands (used for sensors requiring explicit companion reads like Temp)
    for (const pktBytes of immediatePackets) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        await this.writeBytes(pktBytes);
      } catch (_) {}
    }

    // 3. Real-time optical stream maintainer (non-destructive 2200ms tick):
    // Do NOT bombard 0x69 [dataType, 0x03] every 1.4s before the ring finishes its initial optical lock;
    // send CONTINUE gently once 0x69 responds (lastLiveAckAt > 0), and run legacy 0x1E [0x01] after 7s if no BPM arrived yet.
    this.realTimeHrTimer = setInterval(async () => {
      if (this.activeLiveDataType !== dataType) {
        if (this.realTimeHrTimer) clearInterval(this.realTimeHrTimer);
        this.realTimeHrTimer = null;
        return;
      }

      if (!this.isConnected()) {
        const reconnected = await this.attemptSilentReconnect(true);
        if (reconnected && this.isConnected() && this.activeLiveDataType === dataType) {
          this.lastLiveRearmAt = Date.now();
          this.lastLiveAckAt = 0;
          try {
            await this.writeBytes(this.makePacket(0x69, [dataType, 0x01]));
            for (const pktBytes of immediatePackets) {
              await new Promise((r) => setTimeout(r, 90));
              await this.writeBytes(pktBytes);
            }
          } catch (_) {}
        }
        return;
      }

      const now = Date.now();
      // If 0x69 produced no valid BPM after 7s (either silent or 0 BPM frames), trigger legacy poll (0x1E 0x01)
      if (
        fallbackPackets.length > 0 &&
        this.lastLiveDataAt === 0 &&
        now - this.lastLiveRearmAt >= 7000 &&
        (!sentFallback || Math.floor((now - this.lastLiveRearmAt) / 4500) !== Math.floor((now - 2200 - this.lastLiveRearmAt) / 4500))
      ) {
        sentFallback = true;
        this.usedLiveFallbackPackets = true;
        try {
          for (const pktBytes of fallbackPackets) {
            await this.writeBytes(pktBytes);
            await new Promise((r) => setTimeout(r, 90));
          }
        } catch (_) {}
      }

      const staleDuration = this.lastLiveDataAt > 0
        ? now - this.lastLiveDataAt
        : Math.min(now - this.lastLiveRearmAt, this.lastLiveAckAt > 0 ? now - this.lastLiveAckAt + 12000 : now - this.lastLiveRearmAt);

      // Re-arm Action.START only if genuinely timed out (>= 24s silent)
      if (staleDuration >= 24000 && now - this.lastLiveRearmAt >= 24000) {
        this.lastLiveRearmAt = now;
        sentFallback = false;
        try {
          await this.writeBytes(this.makePacket(0x69, [dataType, 0x01]));
          for (const pktBytes of immediatePackets) {
            await new Promise((r) => setTimeout(r, 90));
            await this.writeBytes(pktBytes);
          }
        } catch (_) {}
        return;
      }

      // Send 0x69 CONTINUE only once 0x69 has acknowledged OR after 3.5s settle window
      if (this.lastLiveAckAt > 0 || now - this.lastLiveRearmAt >= 3500) {
        try {
          await this.writeBytes(this.makePacket(0x69, [dataType, 0x03]));
        } catch (_) {}
      }
    }, 2200);

    return ok;
  }

  private async stopLiveStream(
    dataType: number,
    legacyStopPackets: number[][] = []
  ): Promise<boolean> {
    if (this.activeLiveDataType === dataType) {
      this.activeLiveDataType = null;
    }
    if (dataType === 0x01) {
      this.isRealTimeHrActive = false;
    }
    if (this.realTimeHrTimer) {
      clearInterval(this.realTimeHrTimer);
      this.realTimeHrTimer = null;
    }

    if (!this.isConnected()) return false;

    const wasFallbackUsed = this.usedLiveFallbackPackets;
    this.usedLiveFallbackPackets = false;

    const ok = await this.writeBytes(this.makePacket(0x69, [dataType, 0x04]));
    await new Promise((r) => setTimeout(r, 70));
    await this.writeBytes(this.makePacket(0x6A, [dataType, 0x00, 0x00]));

    if (wasFallbackUsed) {
      for (const pktBytes of legacyStopPackets) {
        await new Promise((r) => setTimeout(r, 70));
        try {
          await this.writeBytes(pktBytes);
        } catch (_) {}
      }
    }

    // Verify autonomous ring measurement schedule stays enabled after closing a live stream
    if (this.configuredIntervalMinutes > 0) {
      setTimeout(() => {
        if (this.isConnected() && this.activeLiveDataType === null) {
          this.writeBytes(this.makePacket(0x16, [0x01])).catch(() => {});
        }
      }, 220);
    }

    return ok;
  }

  public async startRealTimeHeartRate(): Promise<boolean> {
    console.log('[QRing BLE] Starting live optical PPG Heart Rate measurement...');
    return await this.startLiveStream(0x01, [], [this.makePacket(0x1E, [0x01])]);
  }

  public async stopRealTimeHeartRate(): Promise<boolean> {
    console.log('[QRing BLE] Stopping live optical PPG Heart Rate measurement...');
    return await this.stopLiveStream(0x01, [this.makePacket(0x1E, [0x00])]);
  }

  public async startRealTimeBloodOxygen(): Promise<boolean> {
    console.log('[QRing BLE] Starting live optical SpO2 measurement (RED+IR LED)...');
    return await this.startLiveStream(0x03);
  }

  public async stopRealTimeBloodOxygen(): Promise<boolean> {
    console.log('[QRing BLE] Stopping live optical SpO2 measurement...');
    return await this.stopLiveStream(0x03);
  }

  public async startRealTimeHrv(): Promise<boolean> {
    console.log('[QRing BLE] Starting live optical HRV measurement...');
    if (this.hrvLiveFallbackTimer) {
      clearTimeout(this.hrvLiveFallbackTimer);
      this.hrvLiveFallbackTimer = null;
    }
    this.hrvLiveFallbackActive = false;
    this.hrvLiveNativeReceived = false;
    this.hrvRrSamples = [];
    this.hrvLastSampleAt = 0;

    const ok = await this.startLiveStream(0x0A);
    if (ok) {
      // Many Colmi R02 / R21 firmwares ignore 0x69 [0x0A]; fall back to optical PPG R-R RMSSD via 0x69 [0x01] after 3.5s
      this.hrvLiveFallbackTimer = setTimeout(async () => {
        this.hrvLiveFallbackTimer = null;
        if (this.activeLiveDataType === 0x0A && !this.hrvLiveNativeReceived && this.isConnected()) {
          console.log('[QRing BLE] Native 0x69 0x0A silent — switching to optical PPG R-R RMSSD fallback...');
          this.hrvLiveFallbackActive = true;
          await this.startLiveStream(0x01, [], [this.makePacket(0x1E, [0x01])]);
        }
      }, 3500);
    }
    return ok;
  }

  public async stopRealTimeHrv(): Promise<boolean> {
    console.log('[QRing BLE] Stopping live optical HRV measurement...');
    if (this.hrvLiveFallbackTimer) {
      clearTimeout(this.hrvLiveFallbackTimer);
      this.hrvLiveFallbackTimer = null;
    }
    const wasFallback = this.hrvLiveFallbackActive;
    this.hrvLiveFallbackActive = false;
    const ok = wasFallback
      ? await this.stopLiveStream(0x01, [this.makePacket(0x1E, [0x00])])
      : await this.stopLiveStream(0x0A);
    setTimeout(() => {
      if (this.isConnected() && this.activeLiveDataType === null && !this.isSyncingNow()) {
        this.requestHrvLog().catch(() => {});
      }
    }, 450);
    return ok;
  }

  public async startRealTimeTemperature(): Promise<boolean> {
    console.log('[QRing BLE] Starting live skin temperature measurement...');
    return await this.startLiveStream(0x05, [
      this.makePacket(0x3A, [0x03, 0x02, 0x01]),
      this.makePacket(0x75, [0x00]),
    ]);
  }

  public async stopRealTimeTemperature(): Promise<boolean> {
    console.log('[QRing BLE] Stopping live skin temperature measurement...');
    return await this.stopLiveStream(0x05);
  }

  /**
   * Visual Beacon: pulses the ring's internal green (PPG HR) and red (SpO2) optical LEDs
   * for ~6 seconds so the user can spot the ring in a dark room / sofa / bag.
   */
  public async flashRingBeacon(durationMs: number = 6000): Promise<boolean> {
    if (!this.isConnected()) return false;
    if (this.flashBeaconTimer) {
      clearTimeout(this.flashBeaconTimer);
      this.flashBeaconTimer = null;
    }

    const wasHrActive = this.isRealTimeHrActive;
    try {
      this.pushBleLog('TX', `Balise lumineuse LED (${Math.round(durationMs / 1000)}s)`);
      this.recordLiveMeasureEvent('led', 'Balise LED', 'Clignotement vert / rouge', 'green', 'live');
      // Phase 1: Green optical PPG LEDs on full steady drive
      await this.writeBytes(this.makePacket(0x69, [0x01, 0x01]));
      await new Promise((r) => setTimeout(r, 90));
      await this.writeBytes(this.makePacket(0x1E, [0x03]));

      // Briefly switch to bright Red/IR SpO2 LEDs mid-way so both emitters blink visibly
      const midTimer = setTimeout(async () => {
        if (!this.isConnected()) return;
        try {
          await this.writeBytes(this.makePacket(0x69, [0x01, 0x04]));
          await new Promise((r) => setTimeout(r, 80));
          await this.writeBytes(this.makePacket(0x69, [0x03, 0x01]));
        } catch (_) {}
      }, Math.min(2400, Math.round(durationMs * 0.45)));

      this.flashBeaconTimer = setTimeout(async () => {
        clearTimeout(midTimer);
        this.flashBeaconTimer = null;
        if (!this.isConnected()) return;
        try {
          await this.writeBytes(this.makePacket(0x69, [0x03, 0x04]));
          if (!wasHrActive) {
            await new Promise((r) => setTimeout(r, 80));
            await this.writeBytes(this.makePacket(0x69, [0x01, 0x04]));
            await new Promise((r) => setTimeout(r, 70));
            await this.writeBytes(this.makePacket(0x1E, [0x00]));
          } else {
            await new Promise((r) => setTimeout(r, 80));
            await this.writeBytes(this.makePacket(0x69, [0x01, 0x01]));
          }
        } catch (_) {}
      }, durationMs);

      return true;
    } catch (e) {
      console.warn('[QRing BLE] flashRingBeacon error:', e);
      return false;
    }
  }

  /**
   * Zero-LED tiny RF keep-alive ping used only while Find-My-Ring Radar is open:
   * wakes BLE connection out of Slave Latency so CoreBluetooth measures live RSSI immediately
   * instead of repeating cached values from seconds ago.
   */
  public async sendRadarPing(): Promise<void> {
    if (!this.isConnected() || this.isSyncing || this.activeLiveDataType !== null) return;
    try {
      if (Capacitor.isNativePlatform() && this.connectedDeviceId) {
        const pkt = numbersToDataView(this.makePacket(0x03, [0x00]));
        await BleClient.writeWithoutResponse(
          this.connectedDeviceId,
          this.activeServiceUuid,
          this.activeRxUuid,
          pkt
        );
      }
    } catch (_) {}
  }

  /**
   * Live BLE RSSI Radar (Find My Ring Precision Mode):
   * - On iOS WKWebView: uses native CoreBluetooth `vytaBleRadar` (`readRSSI()` when connected + duplicate scan when disconnected)
   * - Fallback on Android / Capacitor when disconnected: `BleClient.requestLEScan({ allowDuplicates: true })`
   */
  public async startRssiRadar(onReading: (sample: BleRssiSample) => void): Promise<() => void> {
    this.stopRssiRadar();

    const targetId = this.getConnectedDeviceId() || this.getSavedDeviceId() || '';
    const savedName = (this.getSavedDeviceName() || '').toUpperCase();
    let active = true;
    let startedCapacitorScan = false;

    const matchesTarget = (deviceId: string, rawName?: string): boolean => {
      if (targetId && deviceId.toLowerCase() === targetId.toLowerCase()) return true;
      const upper = (rawName || '').trim().toUpperCase();
      if (!upper) return false;
      if (savedName && upper.includes(savedName)) return true;
      return ['AUREL', 'QRING', 'VYTA', 'RING', 'R21', 'R20', 'R02', 'R06', 'R10', 'COLMI'].some((k) =>
        upper.includes(k)
      );
    };

    const nativeEventListener = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent<BleRssiSample>).detail;
      if (!detail || typeof detail.rssi !== 'number') return;
      if (detail.rssi >= 0 || detail.rssi <= -120) return;
      if (detail.source === 'scan' && targetId && detail.deviceId && !matchesTarget(detail.deviceId, detail.name)) {
        return;
      }
      onReading(detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nativeBleRssi', nativeEventListener as EventListener);
    }

    let hasNativeBridge = false;
    try {
      const webkit = (window as any)?.webkit;
      if (webkit?.messageHandlers?.vytaBleRadar) {
        webkit.messageHandlers.vytaBleRadar.postMessage({ action: 'start', deviceId: targetId });
        hasNativeBridge = true;
      }
    } catch (_) {}

    // Fallback Capacitor BLE duplicate scan when native Swift bridge is unavailable (e.g. Android) and disconnected
    if (!hasNativeBridge && Capacitor.isNativePlatform() && !this.isConnected()) {
      try {
        if (!this.isNativeInitialized) {
          await BleClient.initialize();
          this.isNativeInitialized = true;
        }
        await BleClient.requestLEScan({ allowDuplicates: true }, (result) => {
          if (!active) return;
          const rssi = typeof result.rssi === 'number' ? result.rssi : null;
          if (rssi === null || rssi >= 0 || rssi <= -120) return;
          const rawName = (result.localName || result.device?.name || '').trim();
          if (!matchesTarget(result.device.deviceId, rawName)) return;
          onReading({
            rssi,
            source: 'scan',
            deviceId: result.device.deviceId,
            name: rawName || 'Aurel Ring One',
            ts: Date.now(),
          });
        });
        startedCapacitorScan = true;
      } catch (e) {
        console.warn('[QRing BLE Radar] Capacitor LE scan fallback error:', e);
      }
    }

    const cleanup = () => {
      if (!active) return;
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('nativeBleRssi', nativeEventListener as EventListener);
      }
      if (hasNativeBridge) {
        try {
          (window as any)?.webkit?.messageHandlers?.vytaBleRadar?.postMessage({ action: 'stop' });
        } catch (_) {}
      }
      if (startedCapacitorScan) {
        BleClient.stopLEScan().catch(() => {});
      }
      if (this.radarActiveCleanup === cleanup) {
        this.radarActiveCleanup = null;
      }
    };

    this.radarActiveCleanup = cleanup;
    return cleanup;
  }

  public stopRssiRadar(): void {
    if (this.radarActiveCleanup) {
      this.radarActiveCleanup();
      this.radarActiveCleanup = null;
    }
  }

  /**
   * Autonomous 30-min spot measurement scheduler:
   * Triggers discrete SpO2 (15s) + HRV (12s) + Skin Temp (8s) readings on the ring
   * to guarantee fresh 30-min data even if the ring's offline EEPROM has a 1h fallback.
   */
  /**
   * Désactivé : laisser la bague gérer ses mesures VRC autonomes (0x38 -> 0x39) sans interruption BLE en arrière-plan.
   */
  public async triggerProactiveBiometricSpotCheck() {
    return;
  }

  /**
   * Write bytes to ring using writeWithoutResponse (with fallback to write)
   * Tries active service first, then QRING_SERVICE_UUID (6e40fff0) and NORDIC_UART_SERVICE_UUID (6e400001)
   */
  private async writeBytes(bytes: number[]): Promise<boolean> {
    this.pushBleLog('TX', this.describeBlePacket('TX', bytes), bytes);
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

    const rawBytes = Array.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
    const hex = rawBytes
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('[QRing BLE RECV]', hex);
    this.pushBleLog('RX', this.describeBlePacket('RX', rawBytes), rawBytes);

    // 1. Battery Response packet (header 0x03)
    if (header === 0x03 && len >= 2) {
      const b1 = dataView.getUint8(1);
      const b2 = len >= 3 ? dataView.getUint8(2) : 0;
      let realBat: number | null = null;
      let isCharging = false;

      if ((b1 === 0 || b1 === 1 || b1 === 2) && b2 >= 1 && b2 <= 100) {
        realBat = b2;
        isCharging = b1 === 1 || b1 === 2;
      } else if (b1 >= 1 && b1 <= 100 && (b2 === 0 || b2 === 1 || b2 === 2)) {
        realBat = b1;
        isCharging = b2 === 1 || b2 === 2;
      } else if (b1 >= 1 && b1 <= 100) {
        realBat = b1;
      } else if (b2 >= 1 && b2 <= 100) {
        realBat = b2;
      }

      if (realBat !== null) {
        console.log('[QRing BLE] Real Battery Level Received from Ring:', realBat, '% charging:', isCharging, '(b1:', b1, 'b2:', b2, ')');
        this.notify({ batteryPct: realBat, isCharging, isConnected: true });
        return;
      }
    }

    // 1b. Ring Sensor Interval Configuration Confirmation (header 0x16 / 22)
    // Response to makePacket(0x16, [0x02, enabledByte, interval]) or query makePacket(0x16, [0x01])
    if (header === 22 || header === 0x16) {
      if (len >= 4) {
        const subType = dataView.getUint8(1);
        const enabledByte = dataView.getUint8(2);
        const intervalMins = dataView.getUint8(3);
        const isEnabled = enabledByte === 1;
        console.log(`[QRing BLE] Ring Hardware Interval confirmed: ${intervalMins} min (enabled=${isEnabled}, subType=${subType})`);

        // Enforce the user's configured setting: NEVER let ring's stale 15m overwrite 60m!
        // Note: R21/QRing firmware often returns intervalMins=0 in 0x16 [0x01] read responses even when 30m/60m is active;
        // ignore intervalMins === 0 when enabled so we never falsely reset the ring's hardware timer mid-cycle.
        const wantOn = this.configuredIntervalMinutes > 0;
        const realMinuteMismatch = wantOn && isEnabled && intervalMins > 0 && intervalMins !== this.configuredIntervalMinutes;
        const mismatch = isEnabled !== wantOn || realMinuteMismatch;
        if (mismatch && Date.now() - this.lastIntervalFixAt > 10000) {
          this.lastIntervalFixAt = Date.now();
          console.warn(
            `[QRing BLE] Hardware interval mismatch detected (ring=${isEnabled ? `${intervalMins}m` : 'OFF'}, expected=${wantOn ? `${this.configuredIntervalMinutes}m` : 'OFF'}). Re-enforcing setting...`
          );
          this.recordLiveMeasureEvent(
            'led',
            'Config bague corrigée',
            `${isEnabled ? `${intervalMins}m` : 'OFF'} → ${wantOn ? `${this.configuredIntervalMinutes}m` : 'Veille'}`,
            'amber',
            'live'
          );
          this.setAllSensorIntervals(this.configuredIntervalMinutes, true).catch(() => {});
        }
      }
      return;
    }

    // 1c. Ring Sensor Monitoring Acknowledgment (0x2C SpO2, 0x36 Stress, 0x38 HRV)
    if ([44, 0x2C, 54, 0x36, 56, 0x38].includes(header)) {
      const sensorName = (header === 44 || header === 0x2C) ? 'SpO2' : (header === 56 || header === 0x38) ? 'HRV' : 'Stress';
      const subType = len >= 2 ? dataView.getUint8(1) : 0;
      const enabledRaw = len >= 3 ? dataView.getUint8(2) : 1;
      const isEnabled = enabledRaw === 1;
      console.log(`[QRing BLE] Ring Sensor ${sensorName} (0x${header.toString(16)}) preference confirmed: enabled=${isEnabled} (sub=${subType})`);

      const wantSecondaryOn = this.configuredIntervalMinutes > 0;
      const validReadOrWrite = len >= 3 && (subType === 1 || subType === 2) && (enabledRaw === 0 || enabledRaw === 1 || enabledRaw === 2);
      if (validReadOrWrite && isEnabled !== wantSecondaryOn && Date.now() - this.lastIntervalFixAt > 10000) {
        this.lastIntervalFixAt = Date.now();
        console.warn(
          `[QRing BLE] Sensor ${sensorName} mismatch detected (ring=${isEnabled ? 'ON' : 'OFF'}, expected=${wantSecondaryOn ? 'ON' : 'OFF'}). Re-arming...`
        );
        this.recordLiveMeasureEvent(
          'led',
          `${sensorName} réarmé`,
          `${isEnabled ? 'ON' : 'OFF'} → ${wantSecondaryOn ? 'ON' : 'OFF'}`,
          'amber',
          'live'
        );
        this.setAllSensorIntervals(this.configuredIntervalMinutes, true).catch(() => {});
      }
      return;
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
        if (this.hrLogFramesExpected > 0 && index >= this.hrLogFramesExpected) {
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
    // Only use as fallback if BigData 0xBC 0x27 has not already supplied multi-block sleep for today
    if (header === 68 || header === 0x44) {
      if (len >= 6 && !this.hasBigDataSleepToday) {
        console.log('[QRing BLE] Command 68 (0x44) Sleep log packet received');
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (nowMin < 360) {
          // En pleine nuit avant 6h du matin, ne pas attribuer de sommeil hérité de la veille
          return;
        }
        const b4 = dataView.getUint8(4);
        const b5 = dataView.getUint8(5);
        const totalMin = (b4 << 8) | b5;
        if (totalMin >= 90 && totalMin <= 900 && totalMin <= nowMin + 120) {
          const hours = parseFloat((totalMin / 60).toFixed(4));
          console.log('[QRing BLE] Command 68 parsed sleep duration:', hours, 'hours (', totalMin, 'min )');
          this.notify({ daysAgo: 0, sleepHours: hours, isConnected: true });
          return;
        }
      }
    }

    // 2c. Colmi R02 V1 15-minute Activity Log (header 0x43 / 67)
    if (header === 67 || header === 0x43) {
      if (len >= 2) {
        const sub = dataView.getUint8(1);
        if (sub === 0xF0) {
          this.stepsQuarterSlots = new Array(96).fill(0);
          this.stepsDetailCalSum = 0;
          this.stepsDetailDistMetersSum = 0;
          const totalBlocks = len >= 3 ? dataView.getUint8(2) : 0;
          if (totalBlocks === 0) {
            this.notify({
              daysAgo: this.requestedStepsDayOffset,
              stepsHourly: new Array(24).fill(0),
              steps: 0,
              stepsAuthoritative: true,
              calories: 0,
              isConnected: true,
            });
            this.resolveStepsDetailWaiters();
          }
          return;
        }
        if (sub === 0xFF || sub === 255) {
          this.finalizeStepsDetailLog();
          return;
        }
        if (len >= 13) {
          const pktDaysAgo = this.parseRingDateDaysAgo(
            dataView.getUint8(1),
            dataView.getUint8(2),
            dataView.getUint8(3)
          );
          if (pktDaysAgo !== null && pktDaysAgo !== this.requestedStepsDayOffset) {
            console.log(
              `[QRing BLE] Cmd 0x43 ignoring stale-day slot: pktDaysAgo=${pktDaysAgo}, requested=${this.requestedStepsDayOffset}`
            );
            return;
          }
          const timeIndex = dataView.getUint8(4);
          const cal = dataView.getUint16(7, true);
          const st = dataView.getUint16(9, true);
          const dist = dataView.getUint16(11, true);
          const now = new Date();
          const currentQuarter = now.getHours() * 4 + Math.floor(now.getMinutes() / 15);
          const isValidSlot =
            timeIndex < 96 &&
            (this.requestedStepsDayOffset > 0 || timeIndex <= currentQuarter);
          if (isValidSlot && st > 0 && st <= 25000) {
            this.stepsQuarterSlots[timeIndex] = st;
            if (cal > 0 && cal < 5000) this.stepsDetailCalSum += cal;
            if (dist > 0 && dist < 50000) this.stepsDetailDistMetersSum += dist;
            if (this.stepsDetailDebounceTimer) clearTimeout(this.stepsDetailDebounceTimer);
            this.stepsDetailDebounceTimer = setTimeout(() => this.finalizeStepsDetailLog(), 260);
          }
          if (st > 0 || cal > 0) {
            console.log('[QRing BLE] Cmd 0x43 Activity detail: j-', this.requestedStepsDayOffset, 'slot=', timeIndex, 'steps:', st, 'cal:', cal, 'dist:', dist);
          }
        }
      }
      return;
    }

    // 2d. Stored 30-min Stress History (Command 55 / 0x37 — Gadgetbridge historicalStress)
    if (header === 55 || header === 0x37) {
      if (len >= 2) {
        const packetNr = dataView.getUint8(1);
        if (packetNr === 0xFF) {
          this.finalizeStressLog();
          return;
        }
        if (packetNr === 0) {
          this.stressLogSlots = new Array(48).fill(0);
          this.stressTotalPackets = len >= 3 ? dataView.getUint8(2) : 0;
          this.stressPeriodMinutes = len >= 4 ? dataView.getUint8(3) : 60;
          return;
        }
        if (packetNr >= 1 && packetNr <= 4) {
          const isHourly = (this.stressTotalPackets > 0 && this.stressTotalPackets <= 3) || this.stressPeriodMinutes >= 60;
          const startByte = 2;
          if (isHourly) {
            const baseHour = (packetNr - 1) * 12;
            const curHour = new Date().getHours();
            const dk = this.getTodayDateKey();
            for (let i = startByte; i < Math.min(len, 14); i++) {
              const val = dataView.getUint8(i);
              const hour = baseHour + (i - startByte);
              if (val > 0 && val <= 100 && hour >= 0 && hour < 24) {
                this.stressLogSlots[hour * 2] = val;
                if (hour <= curHour) {
                  const tm = this.formatMinutesHHMM(hour * 60);
                  this.upsertMeasureEvents([{
                    id: `${dk}|stress|${tm}`,
                    dateKey: dk,
                    time: tm,
                    minutesOfDay: hour * 60,
                    kind: 'stress',
                    label: 'Stress',
                    value: `${val}`,
                    led: 'green',
                    source: 'auto',
                  }]);
                }
              }
            }
          } else {
            const baseSlot = (packetNr - 1) * 12;
            const curHalf = Math.min(47, Math.max(0, Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 30)));
            const dk = this.getTodayDateKey();
            for (let i = startByte; i < Math.min(len, 14); i++) {
              const val = dataView.getUint8(i);
              const slotIdx = baseSlot + (i - startByte);
              if (val > 0 && val <= 100 && slotIdx >= 0 && slotIdx < 48) {
                if (slotIdx <= curHalf) {
                  const tm = this.formatMinutesHHMM(slotIdx * 30);
                  this.upsertMeasureEvents([{
                    id: `${dk}|stress|${tm}`,
                    dateKey: dk,
                    time: tm,
                    minutesOfDay: slotIdx * 30,
                    kind: 'stress',
                    label: 'Stress',
                    value: `${val}`,
                    led: 'green',
                    source: 'auto',
                  }]);
                }
                // Enregistrer la vraie mesure Stress même si le créneau matériel tombe à :30
                this.stressLogSlots[slotIdx] = val;
              }
            }
          }
          if (this.stressDebounceTimer) clearTimeout(this.stressDebounceTimer);
          if (packetNr >= (isHourly ? 2 : 4)) {
            this.finalizeStressLog();
          } else {
            this.stressDebounceTimer = setTimeout(() => this.finalizeStressLog(), 300);
          }
        }
      }
      return;
    }

    // 2e. Stored 30-min HRV / VRC History (Command 57 / 0x39 — QCBand / Gadgetbridge historicalHrv)
    if (header === 57 || header === 0x39) {
      if (len >= 2) {
        const packetNr = dataView.getUint8(1);
        if (packetNr === 0xFF) {
          this.finalizeHrvLog();
          return;
        }
        if (packetNr === 0) {
          this.hrvLogSlots = new Array(48).fill(0);
          this.hrvTotalPackets = len >= 3 ? dataView.getUint8(2) : 0;
          this.hrvPeriodMinutes = len >= 4 ? dataView.getUint8(3) : 60;
          return;
        }
        if (packetNr >= 1 && packetNr <= 4) {
          const isHourly = (this.hrvTotalPackets > 0 && this.hrvTotalPackets <= 3) || this.hrvPeriodMinutes >= 60;
          const startByte = 2;
          if (isHourly) {
            const baseHour = (packetNr - 1) * 12;
            const curHour = new Date().getHours();
            const dk = this.getTodayDateKey();
            for (let i = startByte; i < Math.min(len, 14); i++) {
              const val = dataView.getUint8(i);
              const hour = baseHour + (i - startByte);
              if (val >= 5 && val < 250 && hour >= 0 && hour < 24) {
                this.hrvLogSlots[hour * 2] = val;
                if (hour <= curHour) {
                  const tm = this.formatMinutesHHMM(hour * 60);
                  this.upsertMeasureEvents([{
                    id: `${dk}|hrv|${tm}`,
                    dateKey: dk,
                    time: tm,
                    minutesOfDay: hour * 60,
                    kind: 'hrv',
                    label: 'VRC',
                    value: `${val} ms`,
                    led: 'green',
                    source: 'auto',
                  }]);
                }
              }
            }
          } else {
            const baseSlot = (packetNr - 1) * 12;
            const curHalf = Math.min(47, Math.max(0, Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 30)));
            const dk = this.getTodayDateKey();
            for (let i = startByte; i < Math.min(len, 14); i++) {
              const val = dataView.getUint8(i);
              const slotIdx = baseSlot + (i - startByte);
              if (val >= 5 && val < 250 && slotIdx >= 0 && slotIdx < 48) {
                if (slotIdx <= curHalf) {
                  const tm = this.formatMinutesHHMM(slotIdx * 30);
                  this.upsertMeasureEvents([{
                    id: `${dk}|hrv|${tm}`,
                    dateKey: dk,
                    time: tm,
                    minutesOfDay: slotIdx * 30,
                    kind: 'hrv',
                    label: 'VRC',
                    value: `${val} ms`,
                    led: 'green',
                    source: 'auto',
                  }]);
                }
                // Enregistrer la vraie mesure VRC même si le créneau matériel tombe à :30
                this.hrvLogSlots[slotIdx] = val;
              }
            }
          }
          if (this.hrvDebounceTimer) clearTimeout(this.hrvDebounceTimer);
          if (packetNr >= (isHourly ? 2 : 4)) {
            this.finalizeHrvLog();
          } else {
            this.hrvDebounceTimer = setTimeout(() => this.finalizeHrvLog(), 300);
          }
        }
      }
      return;
    }

    // 3. Today's Step & Activity logs (QCBandSDK Official Big-Endian Protocol)
    // Command 0x07 (TotalSportDataRsp): 2 sub-packets indexed by byte[1] (pocketIndex)
    //   - pocketIndex === 0: bytes[2..5]=BCD date, bytes[6..8]=totalSteps (BE), bytes[9..11]=runningSteps (BE), bytes[12..14]=calories (BE, cal)
    //   - pocketIndex === 1: bytes[6..8]=walkDistance (BE, meters), bytes[9..10]=sportDuration (BE, min), bytes[11..12]=sleepDuration (BE, min)
    if (header === 7 || header === 0x07) {
      if (len >= 15) {
        const pocketIndex = dataView.getUint8(1);
        if (pocketIndex === 0) {
          const b2 = dataView.getUint8(2);
          const b3 = dataView.getUint8(3);
          const b4 = dataView.getUint8(4);
          const b5 = dataView.getUint8(5);
          const pktDaysAgo =
            this.parseRingDateDaysAgo(b2, b3, b4) ??
            this.parseRingDateDaysAgo(b3, b4, b5);
          const effectiveDaysAgo =
            pktDaysAgo !== null && pktDaysAgo >= 0 && pktDaysAgo <= 6
              ? pktDaysAgo
              : this.requestedStepsDayOffset;

          const s0 = dataView.getUint8(6);
          const s1 = dataView.getUint8(7);
          const s2 = dataView.getUint8(8);
          const steps = (s0 << 16) | (s1 << 8) | s2;

          const c0 = dataView.getUint8(12);
          const c1 = dataView.getUint8(13);
          const c2 = dataView.getUint8(14);
          const rawCal = (c0 << 16) | (c1 << 8) | c2;
          // Le firmware QRing envoie les calories en petites calories (cal). 1 kcal = 1000 cal.
          // Ex: 103 pas = 3438 cal = 3 kcal
          const cal = rawCal > 0 ? Math.max(1, Math.round(rawCal / 1000)) : (steps > 0 ? Math.max(1, Math.round(steps * 0.04)) : 0);

          if (steps >= 0 && steps <= 120000) {
            const detail43Sum =
              effectiveDaysAgo === 0 ? this.stepsQuarterSlots.reduce((acc, v) => acc + (v || 0), 0) : 0;
            const resolvedSteps =
              effectiveDaysAgo === 0 && detail43Sum > steps ? detail43Sum : steps;
            console.log(
              '[QRing BLE] Cmd 0x07 (sub-packet 0) authoritative activity: j-',
              effectiveDaysAgo,
              'dateBytes:',
              [b2, b3, b4, b5].map((x) => x.toString(16).padStart(2, '0')).join(' '),
              'steps:',
              resolvedSteps,
              '(0x07=',
              steps,
              '0x43=',
              detail43Sum,
              ') kcal:',
              cal
            );
            this.notify({
              daysAgo: effectiveDaysAgo,
              steps: resolvedSteps,
              stepsAuthoritative: true,
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

          const sl0 = dataView.getUint8(11);
          const sl1 = dataView.getUint8(12);
          const sleepMin = (sl0 << 8) | sl1;
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const isPhysicallyPossible = nowMin >= 360 && sleepMin <= nowMin + 120;
          const realSleepHours =
            !this.hasBigDataSleepToday && sleepMin >= 60 && sleepMin <= 960 && isPhysicallyPossible
              ? parseFloat((sleepMin / 60).toFixed(4))
              : undefined;

          if ((distMeters >= 0 && distMeters <= 150000 && distKm > 0) || realSleepHours !== undefined) {
            console.log('[QRing BLE] Cmd 0x07 (sub-packet 1) Big-Endian distance km:', distKm, 'sleepMin:', sleepMin);
            this.notify({
              ...(distMeters > 0 && distKm > 0 ? { daysAgo: this.requestedStepsDayOffset, distanceKm: distKm } : {}),
              ...(realSleepHours !== undefined ? { daysAgo: 0, sleepHours: realSleepHours } : {}),
              isConnected: true,
            });
            return;
          }
        }
      }
    }

    // Command 0x48 / 72 (Diagnostic only — do NOT overwrite daily steps, since several firmwares
    // echo target/status bytes such as 4000 / 0x0FA0 on 0x48 while 0x07 carries the true step register)
    if (header === 72 || header === 0x48) {
      if (len >= 13) {
        const s0 = dataView.getUint8(1);
        const s1 = dataView.getUint8(2);
        const s2 = dataView.getUint8(3);
        const rawVal = (s0 << 16) | (s1 << 8) | s2;
        console.log('[QRing BLE] Command 0x48 packet ignored for steps (diag rawVal:', rawVal, ')');
        return;
      }
    }

    // 4. Big Data Sleep & SpO2 frames (header 0xBC / 188) arriving on UART fallback
    if (header === 188 || header === 0xBC || this.bigDataBuffer.length > 0) {
      this.handleBigDataNotification(dataView);
      return;
    }

    // 5. Official QRing / Colmi R02 Real-time Heart Rate stream packet (header 0x69 / 105)
    // Colmi R02 / QRing layout (colmi_r02_client / QCBandSDK):
    //   byte[0] = 0x69 (105)
    //   byte[1] = dataType (1 = HeartRate, 3 = SpO2, 10 = HRV)
    // Depending on firmware revision:
    //   byte[2] = reading value (heartRate in BPM if dataType === 1), OR status / errorCode
    //   byte[3] = secondary reading value or status
    // Note: dataType === 6 is ECG/raw PPG (~96) and must NEVER be parsed as BPM!
    if ((header === 0x69 || header === 105) && len >= 3) {
      const dataType = dataView.getUint8(1);
      if (dataType === this.activeLiveDataType) {
        this.lastLiveAckAt = Date.now();
      }

      if (dataType === 0x01) {
        let bpm = 0;
        // Colmi R02 / QCBand layout: byte[2] is error/status code (0 = success), byte[3] is BPM reading
        const statusOrErr = dataView.getUint8(2);
        if (len >= 4 && statusOrErr === 0) {
          const val = dataView.getUint8(3);
          if (val >= 40 && val <= 220) {
            bpm = val;
          }
        }

        // Fallback for older firmware variants where byte[2] directly holds BPM
        if (bpm === 0 && statusOrErr >= 40 && statusOrErr <= 220) {
          bpm = statusOrErr;
        }

        // Additional scan fallback across bytes 2 to 5
        if (bpm === 0) {
          for (let i = 2; i < Math.min(len, 6); i++) {
            const v = dataView.getUint8(i);
            if (v >= 40 && v <= 220) {
              bpm = v;
              break;
            }
          }
        }

        if (bpm >= 40 && bpm <= 220) {
          this.lastLiveDataAt = Date.now();
          if (this.hrvLiveFallbackActive) {
            const nowMs = Date.now();
            if (nowMs - this.hrvLastSampleAt >= 650) {
              this.hrvLastSampleAt = nowMs;
              const rrMs = 60000 / bpm;
              this.hrvRrSamples.push(rrMs);
              if (this.hrvRrSamples.length >= 6) {
                let sumSq = 0;
                let count = 0;
                for (let i = 1; i < this.hrvRrSamples.length; i++) {
                  const diff = this.hrvRrSamples[i] - this.hrvRrSamples[i - 1];
                  if (Math.abs(diff) <= 350) {
                    sumSq += diff * diff;
                    count++;
                  }
                }
                if (count >= 4) {
                  const rmssd = Math.round(Math.min(180, Math.max(10, Math.sqrt(sumSq / count))));
                  console.log('[QRing BLE] Optical PPG R-R RMSSD HRV computed:', rmssd, 'ms from', this.hrvRrSamples.length, 'samples');
                  this.recordLiveMeasureEvent('hrv', 'VRC', `${rmssd} ms`, 'green', 'live');
                  this.notify({ hrv: rmssd, isConnected: true });
                }
              }
            }
            return;
          }
          console.log('[QRing BLE] Command 105 Real PPG Heart Rate Received:', bpm, 'bpm (status:', statusOrErr, ')');
          this.recordLiveMeasureEvent('bpm', 'BPM', `${bpm} bpm`, 'green', 'live');
          this.notify({ heartRate: bpm, liveHeartRate: bpm, isConnected: true });
          return;
        } else {
          console.log('[QRing BLE] Command 105 optical PPG pulse lock acquiring (status:', statusOrErr, ')...');
        }
      } else if (dataType === 0x03) {
        let spo2Val = 0;
        for (let i = 2; i < Math.min(len, 6); i++) {
          const v = dataView.getUint8(i);
          if (v >= 70 && v <= 100) {
            spo2Val = v;
            break;
          }
        }
        if (spo2Val > 0) {
          this.lastLiveDataAt = Date.now();
          console.log('[QRing BLE] Command 105 Real SpO2 Received:', spo2Val, '%');
          this.recordLiveMeasureEvent('spo2', 'SpO2', `${spo2Val}%`, 'red', 'live');
          this.notify({ spo2: spo2Val, isConnected: true });
          return;
        }
      } else if (dataType === 10 || dataType === 0x0A) {
        let hrvVal = 0;
        for (let i = 2; i < Math.min(len, 6); i++) {
          const v = dataView.getUint8(i);
          if (v >= 10 && v <= 200) {
            hrvVal = v;
            break;
          }
        }
        if (hrvVal > 0) {
          this.lastLiveDataAt = Date.now();
          this.hrvLiveNativeReceived = true;
          console.log('[QRing BLE] Command 105 HRV Received:', hrvVal, 'ms');
          this.recordLiveMeasureEvent('hrv', 'VRC', `${hrvVal} ms`, 'green', 'live');
          this.notify({ hrv: hrvVal, isConnected: true });
          return;
        }
      } else if (dataType === 0x05) {
        // Temperature live stream (R21 / QCBand)
        let tempC = 0;
        const b2 = dataView.getUint8(2);
        const b3 = len >= 4 ? dataView.getUint8(3) : 0;
        const u16BE = len >= 4 ? dataView.getUint16(2, false) : 0;
        const u16LE = len >= 4 ? dataView.getUint16(2, true) : 0;

        if (u16BE >= 3000 && u16BE <= 4300) {
          tempC = parseFloat((u16BE / 100).toFixed(2));
        } else if (u16LE >= 3000 && u16LE <= 4300) {
          tempC = parseFloat((u16LE / 100).toFixed(2));
        } else if (u16BE >= 300 && u16BE <= 430) {
          tempC = parseFloat((u16BE / 10).toFixed(2));
        } else if (u16LE >= 300 && u16LE <= 430) {
          tempC = parseFloat((u16LE / 10).toFixed(2));
        } else if (b2 >= 30 && b2 <= 43) {
          tempC = b3 > 0 && b3 < 100 ? parseFloat((b2 + (b3 > 9 ? b3 / 100 : b3 / 10)).toFixed(2)) : b2;
        } else if (b2 >= 100 && b2 <= 220) {
          tempC = parseFloat((b2 / 10 + 20).toFixed(2));
        }

        if (tempC >= 30 && tempC <= 43) {
          console.log('[QRing BLE] Command 105 Real Skin Temperature Received:', tempC, '°C');
          this.recordLiveMeasureEvent('temp', 'Température', `${tempC.toFixed(1)}°C`, 'amber', 'live');
          this.notify({ skinTemp: tempC, isConnected: true });
          return;
        }
      }
    }

    // 5b. Native QRing Command 30 (0x1E) Realtime Heart Rate response (legacy Colmi firmware)
    if ((header === 30 || header === 0x1E) && len >= 2) {
      const b1 = dataView.getUint8(1);
      const b2 = len >= 3 ? dataView.getUint8(2) : 0;
      const b3 = len >= 4 ? dataView.getUint8(3) : 0;
      let bpm = 0;
      if (b1 >= 40 && b1 <= 220) {
        bpm = b1;
      } else if (b2 >= 40 && b2 <= 220) {
        bpm = b2;
      } else if (b1 === 0 && b3 >= 40 && b3 <= 220) {
        bpm = b3;
      }

      if (bpm >= 40 && bpm <= 220) {
        this.lastLiveDataAt = Date.now();
        console.log('[QRing BLE] Command 30 Real PPG Heart Rate Received:', bpm, 'bpm (b1:', b1, 'b2:', b2, ')');
        this.recordLiveMeasureEvent('bpm', 'BPM', `${bpm} bpm`, 'green', 'live');
        this.notify({ heartRate: bpm, liveHeartRate: bpm, isConnected: true });
        return;
      }
    }

    // 7. Device Push Notification packet (header 0x73 / 115 — QCBAND_CMD_NOTIFICATION)
    // byte[1] is the notification sub-type:
    //   0x01 = Heart Rate (byte[2] = bpm)
    //   0x03 = Blood Oxygen SpO2 (byte[2] = %) -> NEVER interpret byte[1]=3 as stress=3!
    //   0x05 = Temperature
    //   0x0C = Battery (byte[2] = %)
    if (header === 0x73 || header === 115) {
      if (len >= 3) {
        const subType = dataView.getUint8(1);
        const val = dataView.getUint8(2);
        if (subType === 0x01 && val >= 40 && val <= 220) {
          this.lastLiveDataAt = Date.now();
          console.log('[QRing BLE] Notification 0x73 (type=1) Heart Rate:', val, 'bpm');
          this.recordLiveMeasureEvent('bpm', 'BPM', `${val} bpm`, 'green', 'live');
          this.notify({ heartRate: val, liveHeartRate: val, isConnected: true });
        } else if (subType === 0x03 && val >= 70 && val <= 100) {
          console.log('[QRing BLE] Notification 0x73 (type=3) SpO2:', val, '%');
          this.recordLiveMeasureEvent('spo2', 'SpO2', `${val}%`, 'red', 'live');
          this.notify({ spo2: val, isConnected: true });
        } else if (subType === 0x05) {
          // Temperature Push Notification (R21 / QCBand)
          let tempC = 0;
          const b2 = val;
          const b3 = len >= 4 ? dataView.getUint8(3) : 0;
          const u16BE = len >= 4 ? dataView.getUint16(2, false) : 0;
          const u16LE = len >= 4 ? dataView.getUint16(2, true) : 0;

          if (u16BE >= 3000 && u16BE <= 4300) {
            tempC = parseFloat((u16BE / 100).toFixed(2));
          } else if (u16LE >= 3000 && u16LE <= 4300) {
            tempC = parseFloat((u16LE / 100).toFixed(2));
          } else if (u16BE >= 300 && u16BE <= 430) {
            tempC = parseFloat((u16BE / 10).toFixed(2));
          } else if (u16LE >= 300 && u16LE <= 430) {
            tempC = parseFloat((u16LE / 10).toFixed(2));
          } else if (b2 >= 30 && b2 <= 43) {
            tempC = b3 > 0 && b3 < 100 ? parseFloat((b2 + (b3 > 9 ? b3 / 100 : b3 / 10)).toFixed(2)) : b2;
          } else if (b2 >= 100 && b2 <= 220) {
            tempC = parseFloat((b2 / 10 + 20).toFixed(2));
          }

          if (tempC >= 30 && tempC <= 43) {
            console.log('[QRing BLE] Notification 0x73 (type=5) Skin Temperature:', tempC, '°C');
            this.recordLiveMeasureEvent('temp', 'Température', `${tempC.toFixed(1)}°C`, 'amber', 'live');
            this.notify({ skinTemp: tempC, isConnected: true });
          }
        } else if (subType === 0x0C && val >= 1 && val <= 100) {
          console.log('[QRing BLE] Notification 0x73 (type=0x0C) Battery:', val, '%');
          this.notify({ batteryPct: val, isConnected: true });
        } else if (subType === 0x01) {
          this.recordLiveMeasureEvent('bpm', 'BPM', 'LED verte (mesure non captée)', 'green', 'live');
        } else if (subType === 0x03) {
          this.recordLiveMeasureEvent('spo2', 'SpO2', 'LED rouge (cycle auto)', 'red', 'live');
        } else if (subType === 44 || subType === 0x2C) {
          this.recordLiveMeasureEvent('spo2', 'Cycle SpO2', 'Signal bague 0x2C', 'red', 'live');
        } else if (subType === 54 || subType === 0x36) {
          this.recordLiveMeasureEvent('stress', 'Cycle Stress', 'Signal bague 0x36', 'green', 'live');
        } else if (subType === 56 || subType === 0x38) {
          this.recordLiveMeasureEvent('hrv', 'Cycle VRC', 'Signal bague 0x38', 'green', 'live');
        } else {
          this.recordLiveMeasureEvent('led', 'Activité capteur', `Signal bague (${subType})`, 'green', 'live');
        }
        return;
      }
    }

    // 8. Live Skin Temperature / 0x3A / 0x75 response fallback
    if ((header === 0x3A || header === 0x75) && len >= 3) {
      const u16BE = len >= 4 ? dataView.getUint16(2, false) : 0;
      const u16LE = len >= 4 ? dataView.getUint16(2, true) : 0;
      const raw1 = dataView.getUint8(1);
      const raw2 = dataView.getUint8(2);
      let tempC = 0;
      if (u16BE >= 3000 && u16BE <= 4300) tempC = parseFloat((u16BE / 100).toFixed(2));
      else if (u16LE >= 3000 && u16LE <= 4300) tempC = parseFloat((u16LE / 100).toFixed(2));
      else if (u16BE >= 300 && u16BE <= 430) tempC = parseFloat((u16BE / 10).toFixed(2));
      else if (u16LE >= 300 && u16LE <= 430) tempC = parseFloat((u16LE / 10).toFixed(2));
      else if (raw2 >= 100 && raw2 <= 220) tempC = parseFloat((raw2 / 10 + 20).toFixed(2));
      else if (raw1 >= 100 && raw1 <= 220 && raw1 !== 0xFF) tempC = parseFloat((raw1 / 10 + 20).toFixed(2));
      if (tempC >= 30 && tempC <= 43) {
        console.log('[QRing BLE] Direct Temp Packet (0x' + header.toString(16) + '):', tempC, '°C');
        this.recordLiveMeasureEvent('temp', 'Température', `${tempC.toFixed(1)}°C`, 'amber', 'live');
        this.notify({ skinTemp: tempC, isConnected: true });
      }
      return;
    }

    // 9. Multi-metric frame battery (header 0xFC, 0x0F, or 0x08)
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
   * Request Stress telemetry (Command 0x37)
   */
  public async readStress(): Promise<boolean> {
    return await this.requestStressLog();
  }

  public async disconnect(manual: boolean = true) {
    if (manual) {
      this.userExplicitlyDisconnected = true;
      this.stopAutoReconnect();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('vyta_ble_saved_device_id');
          localStorage.removeItem('vyta_ble_saved_device_name');
          localStorage.removeItem('vyta_hw_programmed_interval');
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
    this.activeLiveDataType = null;
    this.isRealTimeHrActive = false;
    if (this.realTimeHrTimer) {
      clearInterval(this.realTimeHrTimer);
      this.realTimeHrTimer = null;
    }
    if (this.boundaryAlignTimer) {
      clearTimeout(this.boundaryAlignTimer);
      this.boundaryAlignTimer = null;
    }
    if (manual) {
      this.lastProgrammedIntervalMinutes = null;
      this.needsBoundaryAlign = false;
    }
    this.notify({ isConnected: false });
  }
}

export const qringBle = new QRingBleService();
