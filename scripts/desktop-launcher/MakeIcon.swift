import AppKit
import Foundation

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

func drawIcon(_ pixels: Int) -> Data {
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
        isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let transform = NSAffineTransform()
    transform.scale(by: CGFloat(pixels) / 1024)
    transform.concat()
    NSColor(calibratedRed: 0.13, green: 0.29, blue: 0.24, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 72, y: 72, width: 880, height: 880), xRadius: 200, yRadius: 200).fill()
    NSColor(calibratedRed: 0.08, green: 0.20, blue: 0.16, alpha: 0.55).setFill()
    NSBezierPath(roundedRect: NSRect(x: 272, y: 146, width: 504, height: 690), xRadius: 62, yRadius: 62).fill()
    NSColor(calibratedRed: 0.72, green: 0.76, blue: 0.65, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 252, y: 172, width: 520, height: 690), xRadius: 62, yRadius: 62).fill()
    NSColor(calibratedRed: 0.98, green: 0.97, blue: 0.91, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 252, y: 196, width: 520, height: 666), xRadius: 62, yRadius: 62).fill()
    let font = NSFont(name: "STSongti-SC-Regular", size: 368) ?? NSFont.systemFont(ofSize: 340)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    ("何" as NSString).draw(in: NSRect(x: 252, y: 350, width: 520, height: 440), withAttributes: [
        .font: font, .foregroundColor: NSColor(calibratedRed: 0.16, green: 0.32, blue: 0.25, alpha: 1),
        .paragraphStyle: paragraph
    ])
    ("300" as NSString).draw(in: NSRect(x: 252, y: 270, width: 520, height: 90), withAttributes: [
        .font: NSFont.monospacedDigitSystemFont(ofSize: 70, weight: .medium),
        .foregroundColor: NSColor(calibratedRed: 0.56, green: 0.48, blue: 0.30, alpha: 1),
        .paragraphStyle: paragraph
    ])
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.representation(using: .png, properties: [:])!
}

for size in [16, 32, 128, 256, 512] {
    try drawIcon(size).write(to: output.appendingPathComponent("icon_\(size)x\(size).png"))
    try drawIcon(size * 2).write(to: output.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
