//
//  AppDelegate.swift
//  soap4.me
//

//  Copyright (c) 2017 Anton Ignatov. All rights reserved.
//

import UIKit
import TVMLKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, TVApplicationControllerDelegate {

    var window: UIWindow?
    var appController: TVApplicationController?

    #if RELEASE
        static let tvBaseURL = "https://itaflixapp.netlify.app"
    #else
        static let tvBaseURL = "http://localhost:9001"
    #endif

    static let tvBootURL = "\(AppDelegate.tvBaseURL)/application.js"

    // MARK: Javascript Execution Helper

    func executeRemoteMethod(_ methodName: String, completion: @escaping (Bool) -> Void) {
        appController?.evaluate(inJavaScriptContext: { (context: JSContext) in
            let appObject : JSValue = context.objectForKeyedSubscript("App")

            if appObject.hasProperty(methodName) {
                appObject.invokeMethod(methodName, withArguments: [])
            }
        }, completion: completion)
    }

    // MARK: UIApplicationDelegate

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        window = UIWindow(frame: UIScreen.main.bounds)

        // Create the TVApplicationControllerContext for this application and set the properties that will be passed to the `App.onLaunch` function in JavaScript.
        let appControllerContext = TVApplicationControllerContext()

        // The JavaScript URL is used to create the JavaScript context for your TVMLKit application. Although it is possible to separate your JavaScript into separate files, to help reduce the launch time of your application we recommend creating minified and compressed version of this resource. This will allow for the resource to be retrieved and UI presented to the user quickly.
        if let javaScriptURL = URL(string: AppDelegate.tvBootURL) {
            appControllerContext.javaScriptApplicationURL = javaScriptURL
        }

        appControllerContext.launchOptions["BASEURL"] = AppDelegate.tvBaseURL as NSString

        if let launchOptions = launchOptions {
            for (kind, value) in launchOptions {
                appControllerContext.launchOptions[kind.rawValue] = value
            }
        }

        appController = TVApplicationController(context: appControllerContext, window: window, delegate: self)

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and stop playback
        executeRemoteMethod("onWillResignActive", completion: { (success: Bool) in
            // ...
        })
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        executeRemoteMethod("onDidEnterBackground", completion: { (success: Bool) in
            // ...
        })
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
        executeRemoteMethod("onWillEnterForeground", completion: { (success: Bool) in
            // ...
        })
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        executeRemoteMethod("onDidBecomeActive", completion: { (success: Bool) in
            // ...
        })
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
        executeRemoteMethod("onWillTerminate", completion: { (success: Bool) in
            // ...
        })
    }

    // MARK: TVApplicationControllerDelegate

    func appController(_ appController: TVApplicationController, evaluateAppJavaScriptIn jsContext: JSContext){
        let defaults = UserDefaults(suiteName: "group.com.antonignatov.soap4atv")
        let StoreInUserDefaults : @convention(block) (String, String) -> Void = {
            (key, value) -> Void in
            defaults?.set(value, forKey: key)
        }
        jsContext.setObject(unsafeBitCast(StoreInUserDefaults, to: AnyObject.self), forKeyedSubscript: "StoreInUserDefaults" as (NSCopying & NSObjectProtocol))

        // MARK: FetchWithReferer
        //
        // Su tvOS `Referer` e' un forbidden header per XMLHttpRequest: il webview
        // lo scarta in silenzio. vixsrc richiede quell'header sulla pagina /embed/
        // (risponde 403 senza), quindi il fetch viene fatto qui in nativo con
        // URLSession, dove l'header e' impostabile.
        //
        // Firma JS:
        //   FetchWithReferer(url, referer, requestId)
        //
        // PERCHE' NIENTE CALLBACK: una JSValue trattenuta in una closure
        // asincrona diventa invalida quando ITMLKit fa il drain delle
        // microtask, e `callWithArguments` fa crashare l'app in
        // -[__NSSetM addObject:] (stack: IKAppMediaItemBridge).
        // Quindi il risultato viene scritto in UserDefaults sotto una chiave
        // per requestId; il JS lo legge con polling tramite StoreInUserDefaults/
        // il suo getter. Nessuna chiamata JS cross-thread.
        let FetchWithReferer: @convention(block) (String, String, String) -> Void = {
            (urlString, referer, requestId) in

            guard let url = URL(string: urlString) else {
                defaults?.set("ERR:URL non valida", forKey: "vixfetch.\(requestId).error")
                defaults?.set(0, forKey: "vixfetch.\(requestId).status")
                defaults?.set("", forKey: "vixfetch.\(requestId).body")
                defaults?.set(true, forKey: "vixfetch.\(requestId).done")
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 " +
                "(KHTML, like Gecko) Version/13.1.2 Safari/605.1.15",
                forHTTPHeaderField: "User-Agent"
            )
            request.setValue(referer, forHTTPHeaderField: "Referer")
            request.setValue(
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                forHTTPHeaderField: "Accept"
            )
            request.setValue("https://vixsrc.to", forHTTPHeaderField: "Origin")

            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                let http = response as? HTTPURLResponse
                let status = http?.statusCode ?? 0
                let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                let message = error.map { String(describing: $0.localizedDescription) } ?? ""

                // Scrittura su UserDefaults: thread-safe, nessun oggetto JS.
                defaults?.set(status, forKey: "vixfetch.\(requestId).status")
                defaults?.set(body, forKey: "vixfetch.\(requestId).body")
                defaults?.set(message, forKey: "vixfetch.\(requestId).error")
                defaults?.set(true, forKey: "vixfetch.\(requestId).done")
            }
            task.resume()
        }
        jsContext.setObject(unsafeBitCast(FetchWithReferer, to: AnyObject.self), forKeyedSubscript: "FetchWithReferer" as (NSCopying & NSObjectProtocol))

        // Getter sincrono per leggere l'esito del fetch.
        // Firma JS: ReadFetchResult(requestId) -> { done, status, body, error }
        let ReadFetchResult: @convention(block) (String) -> [String: Any] = { requestId in
            let done = defaults?.bool(forKey: "vixfetch.\(requestId).done") ?? false
            let status = defaults?.integer(forKey: "vixfetch.\(requestId).status") ?? 0
            let body = defaults?.string(forKey: "vixfetch.\(requestId).body") ?? ""
            let error = defaults?.string(forKey: "vixfetch.\(requestId).error") ?? ""

            if done {
                defaults?.removeObject(forKey: "vixfetch.\(requestId).done")
                defaults?.removeObject(forKey: "vixfetch.\(requestId).status")
                defaults?.removeObject(forKey: "vixfetch.\(requestId).body")
                defaults?.removeObject(forKey: "vixfetch.\(requestId).error")
            }

            return ["done": done, "status": status, "body": body, "error": error]
        }
        jsContext.setObject(unsafeBitCast(ReadFetchResult, to: AnyObject.self), forKeyedSubscript: "ReadFetchResult" as (NSCopying & NSObjectProtocol))
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        appController?.evaluate(inJavaScriptContext: { (context: JSContext) in
            let globalObject : JSValue = context.globalObject

            if globalObject.hasProperty("openURLHandler") {
                globalObject.invokeMethod("openURLHandler", withArguments: [url.absoluteString])
            } else {
                print("no openURLHandler in js global object")
            }
        })
        return true
    }

    func appController(_ appController: TVApplicationController, didFinishLaunching options: [String: Any]?) {
        print("\(#function) invoked with options: \(options ?? [:])")
    }

    func appController(_ appController: TVApplicationController, didFail error: Error) {
        print("\(#function) invoked with error: \(error)")

        let title = "Error Launching Application"
        let message = error.localizedDescription
        let alertController = UIAlertController(title: title, message: message, preferredStyle:.alert )

        self.appController?.navigationController.present(alertController, animated: true, completion: {
            // ...
        })
    }

    func appController(_ appController: TVApplicationController, didStop options: [String: Any]?) {
        print("\(#function) invoked with options: \(options ?? [:])")
    }
}
