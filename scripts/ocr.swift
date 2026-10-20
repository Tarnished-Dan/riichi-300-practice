#!/usr/bin/env swift
import Foundation
import CoreGraphics
import ImageIO
import Vision

// Local-only Apple Vision OCR.
// Build: swiftc -module-cache-path /tmp/mahjong-swift-module-cache scripts/ocr.swift -o /tmp/mahjong-ocr
// Run: /tmp/mahjong-ocr image1.png image2.jpg
// boundingBox uses Vision's normalized coordinates: origin at bottom-left.
// pixelBoundingBox uses image pixels: origin at top-left.

struct Box: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct TextResult: Codable {
    let text: String
    let confidence: Float
    let boundingBox: Box
    let pixelBoundingBox: Box
}

struct ImageResult: Codable {
    let path: String
    let width: Int?
    let height: Int?
    let elapsedSeconds: Double
    let results: [TextResult]
    let error: String?
}

struct Output: Codable {
    let engine: String
    let revision: Int
    let requestedLanguages: [String]
    let supportedLanguages: [String]
    let recognitionLanguages: [String]
    let boundingBoxCoordinates: String
    let pixelBoundingBoxCoordinates: String
    let images: [ImageResult]
}

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
    FileHandle.standardError.write(Data("Usage: mahjong-ocr image1.png [image2.jpg ...]\n".utf8))
    exit(2)
}

let languageProbe = VNRecognizeTextRequest()
languageProbe.recognitionLevel = .accurate
let supported = try languageProbe.supportedRecognitionLanguages()
let preferred = ["ja-JP", "zh-Hans", "en-US"]
let languages = preferred.filter { supported.contains($0) }
var images: [ImageResult] = []
var failed = false

for path in paths {
    let started = Date()
    let url = URL(fileURLWithPath: path).standardizedFileURL
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        images.append(ImageResult(path: url.path, width: nil, height: nil,
                                  elapsedSeconds: Date().timeIntervalSince(started),
                                  results: [], error: "Cannot decode image"))
        failed = true
        continue
    }

    do {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = languages
        request.usesLanguageCorrection = false
        request.usesCPUOnly = true
        request.minimumTextHeight = 0.001
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        try handler.perform([request])

        let results: [TextResult] = (request.results ?? []).compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return TextResult(
                text: candidate.string,
                confidence: candidate.confidence,
                boundingBox: Box(x: box.minX, y: box.minY, width: box.width, height: box.height),
                pixelBoundingBox: Box(
                    x: box.minX * Double(image.width),
                    y: (1 - box.maxY) * Double(image.height),
                    width: box.width * Double(image.width),
                    height: box.height * Double(image.height)
                )
            )
        }
        images.append(ImageResult(path: url.path, width: image.width, height: image.height,
                                  elapsedSeconds: Date().timeIntervalSince(started),
                                  results: results, error: nil))
    } catch {
        images.append(ImageResult(path: url.path, width: image.width, height: image.height,
                                  elapsedSeconds: Date().timeIntervalSince(started),
                                  results: [], error: error.localizedDescription))
        failed = true
    }
}

let output = Output(
    engine: "Apple Vision VNRecognizeTextRequest (local)",
    revision: languageProbe.revision,
    requestedLanguages: preferred,
    supportedLanguages: supported,
    recognitionLanguages: languages,
    boundingBoxCoordinates: "normalized 0...1; origin bottom-left",
    pixelBoundingBoxCoordinates: "pixels; origin top-left",
    images: images
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try encoder.encode(output))
FileHandle.standardOutput.write(Data("\n".utf8))
exit(failed ? 1 : 0)
