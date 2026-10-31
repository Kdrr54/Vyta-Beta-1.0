import UIKit
import Capacitor
import WebKit
import CoreLocation

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

        case "pause":
            isWorkoutActive = false
            locationManager.stopUpdatingLocation()
            UIApplication.shared.isIdleTimerDisabled = false
            print("[Vyta Native] Workout GPS tracking paused")

        case "stop":
            isWorkoutActive = false
            locationManager.stopUpdatingLocation()
            UIApplication.shared.isIdleTimerDisabled = false
            print("[Vyta Native] Workout GPS tracking stopped")

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
