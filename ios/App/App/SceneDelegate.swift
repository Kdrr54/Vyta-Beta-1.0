import UIKit
import Capacitor
import WebKit
import CoreLocation
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
        let finalState = activity.content.state
        Task {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: finalState, staleDate: nil)
                await activity.end(content, dismissalPolicy: .immediate)
            } else {
                await activity.end(using: finalState, dismissalPolicy: .immediate)
            }
            print("[Vyta LiveActivity] Activity ended")
        }
        currentActivity = nil
    }
}
#endif

class MainViewController: CAPBridgeViewController, WKUIDelegate, CLLocationManagerDelegate, WKScriptMessageHandler {
    private weak var defaultUIDelegate: WKUIDelegate?
    private let locationManager = CLLocationManager()
    private var isWorkoutActive = false
    var recordedPoints: [[String: Any]] = []

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

        // Add script message handler for workout tracking
        self.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "vytaWorkoutTracker")
        self.webView?.configuration.userContentController.add(self, name: "vytaWorkoutTracker")
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
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
        let speed = max(0, loc.speed)
        let accuracy = loc.horizontalAccuracy
        let time = Int(loc.timestamp.timeIntervalSince1970 * 1000)

        let pointDict: [String: Any] = [
            "latitude": lat,
            "longitude": lng,
            "speed": speed,
            "accuracy": accuracy,
            "time": time
        ]
        recordedPoints.append(pointDict)

        let script = "window.dispatchEvent(new CustomEvent('nativeGpsUpdate', { detail: { latitude: \(lat), longitude: \(lng), speed: \(speed), accuracy: \(accuracy), time: \(time) } }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[Vyta Native] Location error: \(error.localizedDescription)")
    }

    func flushBufferedPointsToWeb() {
        guard !recordedPoints.isEmpty else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: recordedPoints, options: []),
              let jsonString = String(data: data, encoding: .utf8) else { return }

        let script = "window.dispatchEvent(new CustomEvent('nativeGpsBatchSync', { detail: \(jsonString) }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
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
