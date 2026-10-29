import SwiftUI
import AVFAudio

struct AlertAudioView: View {
    let audio: AlertAudio
    let userID: String
    @State private var player: AVAudioPlayer?
    @State private var loading = false
    @State private var playing = false
    @State private var error = ""
    @State private var playbackTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(audio.kind == "voice" ? "Voice message" : "Attached alarm sound", systemImage: "waveform")
                .font(.headline)
            Text("\(audio.name) · \(Double(audio.durationMs) / 1000, specifier: "%.1f") sec").font(.caption).foregroundStyle(.secondary)
            Button {
                if playing || loading { stop() } else { play() }
            } label: {
                Label(loading ? "Cancel loading" : playing ? "Stop audio" : "Play audio", systemImage: loading ? "xmark" : playing ? "stop.fill" : "play.fill")
            }.buttonStyle(.bordered)
            if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.red) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            .onDisappear { stop() }
    }
    private func stop() {
        playbackTask?.cancel(); playbackTask = nil; player?.stop(); player = nil; playing = false; loading = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    private func play() {
        loading = true; error = ""
        playbackTask = Task { @MainActor in
            do {
                let data = try await API.shared.audio(audio.id, userID: userID)
                try Task.checkCancellation()
                let next = try AVAudioPlayer(data: data)
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try AVAudioSession.sharedInstance().setActive(true)
                player = next; next.prepareToPlay()
                guard next.play() else { throw APIError.message("Audio playback is unavailable.") }
                loading = false; playing = true
                try await Task.sleep(nanoseconds: UInt64((next.duration + 0.2) * 1_000_000_000))
                stop()
            } catch is CancellationError { }
            catch { stop(); self.error = error.localizedDescription }
        }
    }
}
