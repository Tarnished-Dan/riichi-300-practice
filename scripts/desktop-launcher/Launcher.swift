import AppKit
import Foundation

// Locate the website beside the app, so the complete folder can be moved.
let appFolder = Bundle.main.bundleURL.deletingLastPathComponent()
let candidates = [appFolder, appFolder.deletingLastPathComponent()]
let project = candidates.first {
    FileManager.default.fileExists(atPath: $0.appendingPathComponent("dist/index.html").path)
        && FileManager.default.fileExists(atPath: $0.appendingPathComponent("scripts/serve.py").path)
} ?? appFolder
let arguments = CommandLine.arguments
let shouldOpenBrowser = !arguments.contains("--no-open")
var port = 8765
if let index = arguments.firstIndex(of: "--port"), index + 1 < arguments.count,
   let value = Int(arguments[index + 1]), (1...65535).contains(value) {
    port = value
}
let website = URL(string: "http://127.0.0.1:\(port)/")!
let offlinePage = project.appendingPathComponent("dist/index.html")

enum WebsiteState {
    case ready, unavailable, occupied
}

func websiteState() -> WebsiteState {
    let result = ProbeResult()
    let done = DispatchSemaphore(value: 0)
    var request = URLRequest(url: website, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1)
    request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
    let task = URLSession.shared.dataTask(with: request) { data, response, _ in
        if let response = response as? HTTPURLResponse {
            let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            result.state = response.statusCode == 200 && body.contains("<title>何切练习室")
                ? .ready : .occupied
        }
        done.signal()
    }
    task.resume()
    if done.wait(timeout: .now() + 2) == .timedOut {
        task.cancel()
        return .unavailable
    }
    return result.state
}

final class ProbeResult: @unchecked Sendable {
    var state: WebsiteState = .unavailable
}

func fail(_ message: String) -> Never {
    if !shouldOpenBrowser {
        FileHandle.standardError.write(Data("\(message)\n".utf8))
        exit(1)
    }
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    app.activate(ignoringOtherApps: true)
    let alert = NSAlert()
    alert.messageText = "何切练习室暂时无法打开"
    alert.informativeText = message
    alert.alertStyle = .warning
    alert.addButton(withTitle: "好")
    alert.runModal()
    exit(1)
}

func openWebsite(_ server: Process? = nil) -> Never {
    if !shouldOpenBrowser {
        print("project=\(project.path)")
        print("url=\(website.absoluteString)")
        if let server = server { print("serverPID=\(server.processIdentifier)") }
        exit(0)
    }
    guard NSWorkspace.shared.open(website) else {
        fail("网站已启动，请在浏览器中打开 \(website.absoluteString)")
    }
    exit(0)
}

let script = project.appendingPathComponent("scripts/serve.py")
guard FileManager.default.fileExists(atPath: script.path),
      FileManager.default.fileExists(atPath: offlinePage.path) else {
    fail("找不到网站文件。请完整解压，并保持“何切练习室.app”与 dist、scripts 文件夹在同一目录。")
}

switch websiteState() {
case .ready:
    openWebsite()
case .occupied:
    fail("本机 \(port) 端口正在运行其他网页。请关闭占用该端口的程序后重试，或双击“打开练习网站.html”使用离线入口。")
case .unavailable:
    break
}

// A fresh Mac may not have Python or Command Line Tools; the static site also
// works directly from disk, without installing a runtime.
let pythonLocations = [
    "/Library/Developer/CommandLineTools/usr/bin/python3",
    "/Applications/Xcode.app/Contents/Developer/usr/bin/python3",
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3"
]
guard let python = pythonLocations.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
    if shouldOpenBrowser && NSWorkspace.shared.open(offlinePage) { exit(0) }
    fail("本机未找到 Python。请双击“打开练习网站.html”直接离线使用。")
}

do {
    let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("cn.local.heqie300", isDirectory: true)
    try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
    let logURL = cache.appendingPathComponent("server-\(port).log")
    FileManager.default.createFile(atPath: logURL.path, contents: nil)
    let log = try FileHandle(forWritingTo: logURL)
    let server = Process()
    server.executableURL = URL(fileURLWithPath: python)
    server.arguments = [script.path, "--port", String(port), "--no-open"]
    server.currentDirectoryURL = project
    server.standardInput = FileHandle.nullDevice
    server.standardOutput = log
    server.standardError = log
    try server.run()
    for _ in 0..<30 {
        Thread.sleep(forTimeInterval: 0.2)
        if websiteState() == .ready {
            openWebsite(server)
        }
        if !server.isRunning {
            // Another launch may have won the race to bind the same port.
            if websiteState() == .ready {
                openWebsite()
            }
            fail("网站服务启动失败。日志保存在：\n\(logURL.path)")
        }
    }
    fail("网站服务没有及时响应。日志保存在：\n\(logURL.path)")
} catch {
    fail("启动失败：\(error.localizedDescription)")
}
