import UIKit
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController, WKUIDelegate {
    private weak var defaultUIDelegate: WKUIDelegate?

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
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        self.webView?.scrollView.bounces = false
        self.webView?.scrollView.alwaysBounceVertical = false
        self.webView?.scrollView.alwaysBounceHorizontal = false
    }

    // MARK: - WKUIDelegate: Suppress "localhost" web prompt and auto-grant to Vyta
    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestGeolocationPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        // Automatically grant location to the embedded app view.
        // This eliminates the secondary "localhost would like to use your current location" alert,
        // relying exclusively on the native iOS system dialog ("Vyta").
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

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
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

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
