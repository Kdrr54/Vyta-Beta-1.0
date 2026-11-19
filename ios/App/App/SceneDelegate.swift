import UIKit
import Capacitor
import WebKit
import CoreLocation
import CoreBluetooth
import UserNotifications
#if canImport(ActivityKit)
import ActivityKit
#endif

#if canImport(ActivityKit)
@available(iOS 16.1, *)
class WorkoutLiveActivityManager {
    static let shared = WorkoutLiveActivityManager()
    private var currentActivity: Activity<WorkoutActivityAttributes>?

    func start(workoutTitle: String = "Course à pied") {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("[Vyta LiveActivity] Live Activities not enabled on device")
            return
        }

        // End any active one first
        end()

        let attributes = WorkoutActivityAttributes(workoutTitle: workoutTitle)
        let initialContentState = WorkoutActivityAttributes.ContentState(
            elapsedTime: 0,
            paceText: "--:--",
            distanceKm: 0.0,
            currentHeartRate: 0,
            isPaused: false,
            startDate: Date()
        )

        do {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: initialContentState, staleDate: nil)
                currentActivity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } else {
                currentActivity = try Activity.request(attributes: attributes, contentState: initialContentState, pushType: nil)
            }
            print("[Vyta LiveActivity] Activity started: \(currentActivity?.id ?? "")")
        } catch {
            print("[Vyta LiveActivity] Error starting activity: \(error.localizedDescription)")
        }
    }

    func update(elapsedTime: Int, paceText: String, distanceKm: Double, currentHeartRate: Int, isPaused: Bool) {
        guard let activity = currentActivity else { return }

        let calculatedStartDate = Date().addingTimeInterval(-Double(elapsedTime))
        let updatedState = WorkoutActivityAttributes.ContentState(
            elapsedTime: elapsedTime,
            paceText: paceText,
            distanceKm: distanceKm,
            currentHeartRate: currentHeartRate,
            isPaused: isPaused,
            startDate: calculatedStartDate
        )

        Task {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: updatedState, staleDate: nil)
                await activity.update(content)
            } else {
                await activity.update(using: updatedState)
            }
        }
    }

    func pause(elapsedTime: Int, paceText: String, distanceKm: Double, currentHeartRate: Int) {
        update(elapsedTime: elapsedTime, paceText: paceText, distanceKm: distanceKm, currentHeartRate: currentHeartRate, isPaused: true)
    }

    func resume(elapsedTime: Int, paceText: String, distanceKm: Double, currentHeartRate: Int) {
        update(elapsedTime: elapsedTime, paceText: paceText, distanceKm: distanceKm, currentHeartRate: currentHeartRate, isPaused: false)
    }

    func end() {
        guard let activity = currentActivity else { return }
        Task {
            if #available(iOS 16.2, *) {
                let finalState = activity.content.state
                let content = ActivityContent(state: finalState, staleDate: nil)
                await activity.end(content, dismissalPolicy: .immediate)
            } else {
                let finalState = activity.contentState
                await activity.end(using: finalState, dismissalPolicy: .immediate)
            }
            print("[Vyta LiveActivity] Activity ended")
        }
        currentActivity = nil
    }
}
#endif

class MainViewController: CAPBridgeViewController, WKUIDelegate, CLLocationManagerDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate, CBCentralManagerDelegate, CBPeripheralDelegate {
    private weak var defaultUIDelegate: WKUIDelegate?
    private let locationManager = CLLocationManager()
    private var isWorkoutActive = false
    var recordedPoints: [[String: Any]] = []

    // Native CoreBluetooth Find-My-Ring RSSI radar (dedicated serial queue keeps main UI thread free)
    private let bleRadarQueue = DispatchQueue(label: "com.aurel.ble.radar")
    private var bleCentralManager: CBCentralManager?
    private var radarTargetDeviceId: String?
    private var radarPeripheral: CBPeripheral?
    private var radarTimer: DispatchSourceTimer?
    private var isBleRadarActive = false

    override func viewDidLoad() {
        super.viewDidLoad()
        self.defaultUIDelegate = self.webView?.uiDelegate
        self.webView?.uiDelegate = self

        self.webView?.scrollView.bounces = false
        self.webView?.scrollView.alwaysBounceVertical = false
        self.webView?.scrollView.alwaysBounceHorizontal = false
        self.webView?.scrollView.isScrollEnabled = false
        self.webView?.backgroundColor = .black
        self.webView?.isOpaque = true

        setupWorkoutTracking()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        self.webView?.scrollView.bounces = false
        self.webView?.scrollView.alwaysBounceVertical = false
        self.webView?.scrollView.alwaysBounceHorizontal = false
    }

    private func setupWorkoutTracking() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 2.0 // Meters
        locationManager.activityType = .fitness
        locationManager.pausesLocationUpdatesAutomatically = false

        if #available(iOS 9.0, *) {
            locationManager.allowsBackgroundLocationUpdates = true
        }
        if #available(iOS 11.0, *) {
            locationManager.showsBackgroundLocationIndicator = true
        }

        // Add script message handlers for workout tracking, BLE radar & native alerts
        self.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "vytaWorkoutTracker")
        self.webView?.configuration.userContentController.add(self, name: "vytaWorkoutTracker")
        self.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "vytaNotification")
        self.webView?.configuration.userContentController.add(self, name: "vytaNotification")
        self.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "vytaBleRadar")
        self.webView?.configuration.userContentController.add(self, name: "vytaBleRadar")
        UNUserNotificationCenter.current().delegate = self
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "vytaBleRadar" {
            guard let dict = message.body as? [String: Any], let action = dict["action"] as? String else { return }
            if action == "start" {
                let rawId = (dict["deviceId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanId = (rawId?.isEmpty == false) ? rawId : nil
                self.startNativeBleRadar(targetDeviceId: cleanId)
            } else if action == "stop" {
                self.stopNativeBleRadar()
            }
            return
        }

        if message.name == "vytaNotification" {
            guard let dict = message.body as? [String: Any], let action = dict["action"] as? String else { return }
            let center = UNUserNotificationCenter.current()
            if action == "requestPermission" {
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                    if let error = error {
                        print("[Vyta Notifications] Auth error: \(error.localizedDescription)")
                    } else {
                        print("[Vyta Notifications] Permission granted: \(granted)")
                    }
                }
                return
            }
            if action == "schedule" {
                let title = (dict["title"] as? String) ?? "Aurel Ring"
                let body = (dict["body"] as? String) ?? ""
                let category = (dict["category"] as? String) ?? "general"
                center.getNotificationSettings { settings in
                    let triggerDispatch = {
                        let content = UNMutableNotificationContent()
                        content.title = title
                        content.body = body
                        content.sound = .default
                        content.threadIdentifier = "aurel-\(category)"
                        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.25, repeats: false)
                        let req = UNNotificationRequest(identifier: "aurel-\(category)-\(UUID().uuidString)", content: content, trigger: trigger)
                        center.add(req, withCompletionHandler: nil)
                    }
                    if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                        triggerDispatch()
                    } else if settings.authorizationStatus == .notDetermined {
                        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                            if granted { triggerDispatch() }
                        }
                    }
                }
            }
            return
        }

        guard message.name == "vytaWorkoutTracker" else { return }
        guard let dict = message.body as? [String: Any], let action = dict["action"] as? String else { return }

        switch action {
        case "start":
            isWorkoutActive = true
            recordedPoints.removeAll()
            locationManager.requestAlwaysAuthorization()
            locationManager.startUpdatingLocation()
            UIApplication.shared.isIdleTimerDisabled = true
            print("[Vyta Native] Background Workout GPS tracking started")

            #if canImport(ActivityKit)
            if #available(iOS 16.1, *) {
                let title = (dict["workoutTitle"] as? String) ?? "Course à pied"
                WorkoutLiveActivityManager.shared.start(workoutTitle: title)
            }
            #endif

        case "update":
            #if canImport(ActivityKit)
            if #available(iOS 16.1, *) {
                let elapsed = (dict["elapsedTime"] as? Int) ?? 0
                let pace = (dict["paceText"] as? String) ?? "--:--"
                let dist = (dict["distanceKm"] as? Double) ?? 0.0
                let hr = (dict["currentHeartRate"] as? Int) ?? 0
                let isPaused = (dict["isPaused"] as? Bool) ?? false
                WorkoutLiveActivityManager.shared.update(
                    elapsedTime: elapsed,
                    paceText: pace,
                    distanceKm: dist,
                    currentHeartRate: hr,
                    isPaused: isPaused
                )
            }
            #endif

        case "pause":
            isWorkoutActive = false
            locationManager.stopUpdatingLocation()
            UIApplication.shared.isIdleTimerDisabled = false
            print("[Vyta Native] Workout GPS tracking paused")

            #if canImport(ActivityKit)
            if #available(iOS 16.1, *) {
                let elapsed = (dict["elapsedTime"] as? Int) ?? 0
                let pace = (dict["paceText"] as? String) ?? "--:--"
                let dist = (dict["distanceKm"] as? Double) ?? 0.0
                let hr = (dict["currentHeartRate"] as? Int) ?? 0
                WorkoutLiveActivityManager.shared.pause(
                    elapsedTime: elapsed,
                    paceText: pace,
                    distanceKm: dist,
                    currentHeartRate: hr
                )
            }
            #endif

        case "resume":
            isWorkoutActive = true
            locationManager.startUpdatingLocation()
            UIApplication.shared.isIdleTimerDisabled = true
            print("[Vyta Native] Workout GPS tracking resumed")

            #if canImport(ActivityKit)
            if #available(iOS 16.1, *) {
                let elapsed = (dict["elapsedTime"] as? Int) ?? 0
                let pace = (dict["paceText"] as? String) ?? "--:--"
                let dist = (dict["distanceKm"] as? Double) ?? 0.0
                let hr = (dict["currentHeartRate"] as? Int) ?? 0
                WorkoutLiveActivityManager.shared.resume(
                    elapsedTime: elapsed,
                    paceText: pace,
                    distanceKm: dist,
                    currentHeartRate: hr
                )
            }
            #endif

        case "stop":
            isWorkoutActive = false
            locationManager.stopUpdatingLocation()
            recordedPoints.removeAll()
            UIApplication.shared.isIdleTimerDisabled = false
            print("[Vyta Native] Workout GPS tracking stopped")

            #if canImport(ActivityKit)
            if #available(iOS 16.1, *) {
                WorkoutLiveActivityManager.shared.end()
            }
            #endif

        case "sync":
            flushBufferedPointsToWeb()

        default:
            break
        }
    }

    // MARK: - CLLocationManagerDelegate (Fires in Foreground, Background & Lock Screen)
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isWorkoutActive, let loc = locations.last else { return }
        guard loc.horizontalAccuracy >= 0 && loc.horizontalAccuracy <= 40 else { return }

        let lat = loc.coordinate.latitude
        let lng = loc.coordinate.longitude
        // loc.speed is -1 if invalid or Doppler speed unavailable. Keep -1 so web layer knows hardware speed is unknown.
        let speed = loc.speed >= 0 ? loc.speed : -1.0
        let accuracy = loc.horizontalAccuracy
        let time = Int(loc.timestamp.timeIntervalSince1970 * 1000)

        let pointDict: [String: Any] = [
            "latitude": lat,
            "longitude": lng,
            "speed": speed,
            "accuracy": accuracy,
            "time": time
        ]

        // Ne bufferiser QUE si l'application est en tâche de fond (écran éteint / verrouillé)
        if UIApplication.shared.applicationState != .active {
            recordedPoints.append(pointDict)
        } else {
            // En premier plan, envoyer immédiatement au web view en temps réel
            let script = "window.dispatchEvent(new CustomEvent('nativeGpsUpdate', { detail: { latitude: \(lat), longitude: \(lng), speed: \(speed), accuracy: \(accuracy), time: \(time) } }));"
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(script, completionHandler: nil)
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[Vyta Native] Location error: \(error.localizedDescription)")
    }

    func flushBufferedPointsToWeb() {
        guard isWorkoutActive, !recordedPoints.isEmpty else {
            recordedPoints.removeAll()
            return
        }
        let pointsToSend = recordedPoints
        recordedPoints.removeAll()
        guard let data = try? JSONSerialization.data(withJSONObject: pointsToSend, options: []),
              let jsonString = String(data: data, encoding: .utf8) else { return }

        let script = "window.dispatchEvent(new CustomEvent('nativeGpsBatchSync', { detail: \(jsonString) }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    // MARK: - Native CoreBluetooth RSSI Radar (Find My Ring)
    private func isCandidateRingPeripheral(name: String?, uuidString: String) -> Bool {
        if let targetId = radarTargetDeviceId,
           uuidString.caseInsensitiveCompare(targetId) == .orderedSame {
            return true
        }
        guard let upper = name?.uppercased(), !upper.isEmpty else { return false }
        let keywords = ["AUREL", "QRING", "VYTA", "RING", "R21", "R20", "R02", "R06", "R10", "COLMI"]
        return keywords.contains { upper.contains($0) }
    }

    private func startNativeBleRadar(targetDeviceId: String?) {
        bleRadarQueue.async { [weak self] in
            guard let self = self else { return }
            self.radarTargetDeviceId = targetDeviceId
            self.isBleRadarActive = true
            if self.bleCentralManager == nil {
                self.bleCentralManager = CBCentralManager(
                    delegate: self,
                    queue: self.bleRadarQueue,
                    options: [CBCentralManagerOptionShowPowerAlertKey: false]
                )
                return
            }
            if self.bleCentralManager?.state == .poweredOn {
                self.beginBleRadarLookup()
            }
        }
    }

    private func stopNativeBleRadar() {
        bleRadarQueue.async { [weak self] in
            guard let self = self else { return }
            self.isBleRadarActive = false
            self.radarTimer?.cancel()
            self.radarTimer = nil
            self.bleCentralManager?.stopScan()
            self.radarPeripheral?.delegate = nil
        }
    }

    private func startRadarPollTimer() {
        radarTimer?.cancel()
        radarTimer = nil
        let timer = DispatchSource.makeTimerSource(queue: bleRadarQueue)
        timer.schedule(deadline: .now() + .milliseconds(50), repeating: .milliseconds(150))
        timer.setEventHandler { [weak self] in
            guard let self = self, self.isBleRadarActive, let periph = self.radarPeripheral else { return }
            if periph.state == .connected {
                periph.readRSSI()
            }
        }
        timer.resume()
        radarTimer = timer
    }

    private func beginBleRadarLookup() {
        guard isBleRadarActive, let central = bleCentralManager, central.state == .poweredOn else { return }

        radarTimer?.cancel()
        radarTimer = nil

        let serviceUUIDs = [
            CBUUID(string: "6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E"),
            CBUUID(string: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"),
            CBUUID(string: "DE5BF728-D711-4E47-AF26-65E3012A5DC7"),
            CBUUID(string: "FEE7"),
            CBUUID(string: "180F"),
            CBUUID(string: "180D"),
            CBUUID(string: "180A"),
            CBUUID(string: "1800")
        ]
        let connected = central.retrieveConnectedPeripherals(withServices: serviceUUIDs)
        let connectedMatch = connected.first(where: {
            isCandidateRingPeripheral(name: $0.name, uuidString: $0.identifier.uuidString)
        })

        // Attach to already-connected peripheral to poll readRSSI() with 100% radio priority
        if let p = connectedMatch {
            central.stopScan()
            radarPeripheral = p
            p.delegate = self
            if p.state == .connected {
                p.readRSSI()
                startRadarPollTimer()
            } else {
                central.connect(p, options: nil)
                startRadarPollTimer()
            }
        } else {
            radarPeripheral = nil
            // Disconnected / nearby ring: scan with AllowDuplicates for live advertising RSSI
            central.scanForPeripherals(
                withServices: nil,
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
            )
        }
    }

    private func dispatchBleRssiToWeb(rssi: Int, source: String, deviceId: String, name: String) {
        let safeId = deviceId
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let safeName = name
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: " ")
        let ts = Int(Date().timeIntervalSince1970 * 1000)
        let script = "window.dispatchEvent(new CustomEvent('nativeBleRssi', { detail: { rssi: \(rssi), source: '\(source)', deviceId: \"\(safeId)\", name: \"\(safeName)\", ts: \(ts) } }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn && isBleRadarActive {
            beginBleRadarLookup()
        } else if central.state != .poweredOn {
            radarTimer?.cancel()
            radarTimer = nil
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard isBleRadarActive, peripheral.identifier == radarPeripheral?.identifier else { return }
        central.stopScan()
        peripheral.readRSSI()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard isBleRadarActive, peripheral.identifier == radarPeripheral?.identifier else { return }
        radarTimer?.cancel()
        radarTimer = nil
        radarPeripheral = nil
        central.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        guard isBleRadarActive else { return }
        let val = RSSI.intValue
        guard val < 0 && val > -120 else { return }
        let advName = (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? peripheral.name
        guard isCandidateRingPeripheral(name: advName, uuidString: peripheral.identifier.uuidString) else { return }
        dispatchBleRssiToWeb(
            rssi: val,
            source: "scan",
            deviceId: peripheral.identifier.uuidString,
            name: advName ?? "Aurel Ring One"
        )
    }

    func peripheral(_ peripheral: CBPeripheral, didReadRSSI RSSI: NSNumber, error: Error?) {
        guard isBleRadarActive, error == nil else { return }
        let val = RSSI.intValue
        guard val < 0 && val > -120 else { return }
        dispatchBleRssiToWeb(
            rssi: val,
            source: "connected",
            deviceId: peripheral.identifier.uuidString,
            name: peripheral.name ?? "Aurel Ring One"
        )
    }

    // MARK: - WKUIDelegate: Suppress "localhost" web prompt and auto-grant to Vyta
    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestGeolocationPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    // MARK: - Forward standard WKUIDelegate calls to Capacitor's default handler
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        if let defaultUIDelegate = defaultUIDelegate {
            defaultUIDelegate.webView?(webView, runJavaScriptAlertPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        if let defaultUIDelegate = defaultUIDelegate {
            defaultUIDelegate.webView?(webView, runJavaScriptConfirmPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(false)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWith prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        if let defaultUIDelegate = defaultUIDelegate {
            defaultUIDelegate.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt, defaultText: defaultText, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(nil)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        return defaultUIDelegate?.webView?(webView, createWebViewWith: configuration, for: navigationAction, windowFeatures: windowFeatures)
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        if let defaultUIDelegate = defaultUIDelegate {
            defaultUIDelegate.webView?(webView, requestMediaCapturePermissionFor: origin, initiatedByFrame: frame, type: type, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.grant)
        }
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        if let defaultUIDelegate = defaultUIDelegate {
            defaultUIDelegate.webView?(webView, requestDeviceOrientationAndMotionPermissionFor: origin, initiatedByFrame: frame, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.grant)
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if let mainVC = window?.rootViewController as? MainViewController {
            mainVC.flushBufferedPointsToWeb()
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
