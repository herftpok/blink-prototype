// Кадры видео в PNG (с альфой, если она есть в HEVC): swift extract_frames.swift <видео> <папка> <кадров в секунду>
// Нужен build_assets.py: ffmpeg на машине может не быть, AVFoundation есть всегда.
import AVFoundation
import AppKit

let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let out = URL(fileURLWithPath: args[2])
let fps = Double(args[3]) ?? 15
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let duration = CMTimeGetSeconds(asset.duration)
var i = 0
var t = 0.0
while t < duration - 0.001 {
  let cg = try gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
  let rep = NSBitmapImageRep(cgImage: cg)
  let png = rep.representation(using: .png, properties: [:])!
  try png.write(to: out.appendingPathComponent(String(format: "%04d.png", i)))
  i += 1
  t += 1.0 / fps
}
print(i)
