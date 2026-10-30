import SwiftUI
import WebKit
import UIKit

/// The shared responder map uses the existing session in an isolated cookie store.
/// Native duty GPS and notifications continue independently of this view.
struct ResponderView: UIViewRepresentable {
    let userID: String
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.09, green: 0.12, blue: 0.13, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if SecureStore.value("userID") == userID, let token = SecureStore.value("session"),
           let host = URL(string: API.origin)?.host,
           let cookie = HTTPCookie(properties: [.domain: host, .path: "/api", .name: "eligtas_session",
                .value: token, .secure: "TRUE", HTTPCookiePropertyKey("HttpOnly"): "TRUE"]) {
            config.websiteDataStore.httpCookieStore.setCookie(cookie) { [weak web] in
                guard SecureStore.value("userID") == userID else { return }
                web?.load(URLRequest(url: URL(string: API.origin + "/?nativeResponder=1#/public/responder")!))
            }
        }
        return web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.stopLoading()
        view.navigationDelegate = nil
        view.uiDelegate = nil
        view.configuration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {}
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            let own = URL(string: API.origin)!
            if url.scheme == "https", url.host == own.host, url.user == nil, url.port == nil || url.port == 443 {
                decisionHandler(.allow); return
            }
            if navigationAction.navigationType == .linkActivated, ["https", "tel"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
            return nil
        }
    }
}
