import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    print("[]")
    exit(0)
}
let imagePath = CommandLine.arguments[1]
let url = URL(fileURLWithPath: imagePath)
guard let image = NSImage(contentsOf: url),
      let tiffData = image.tiffRepresentation,
      let ciImage = CIImage(data: tiffData) else {
    fputs("LOAD_FAIL\n", stderr)
    exit(1)
}

struct TextItem: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

let request = VNRecognizeTextRequest { req, err in
    guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
    var items: [TextItem] = []
    for observation in obs {
        if let topCandidate = observation.topCandidates(1).first {
            let box = observation.boundingBox
            items.append(TextItem(
                text: topCandidate.string,
                confidence: topCandidate.confidence,
                x: Double(box.origin.x),
                y: Double(box.origin.y),
                width: Double(box.size.width),
                height: Double(box.size.height)
            ))
        }
    }
    if let data = try? JSONEncoder().encode(items),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        print("[]")
    }
}
request.recognitionLevel = .accurate
let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
try? handler.perform([request])
