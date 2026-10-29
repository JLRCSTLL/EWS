export const MAX_AUDIO_SECONDS = 30;
export const alertAudioUrl = (id: string) => /^[0-9a-f-]{36}$/i.test(id) ? `/api/alert-audio/${id}` : '';

export function pcmWave(samples: Float32Array) {
  const data = new Uint8Array(44 + samples.length * 2), view = new DataView(data.buffer);
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, data.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); });
  return data;
}
export async function prepareAlertAudio(blob: Blob) {
  if (blob.size > 8 * 1024 * 1024 || !blob.size) throw new Error('Choose an audio file smaller than 8 MB.');
  const context = new AudioContext();
  try {
    let source: AudioBuffer;
    try { source = await context.decodeAudioData(await blob.arrayBuffer()); }
    catch { throw new Error('This audio format could not be read. Try MP3, WAV or M4A.'); }
    if (source.duration < .1 || source.duration > MAX_AUDIO_SECONDS + .02) throw new Error('Use a recording between 0.1 and 30 seconds. Shorten it before uploading.');
    const render = new OfflineAudioContext(1, Math.min(480000, Math.round(source.duration * 16000)), 16000);
    const node = render.createBufferSource(); node.buffer = source; node.connect(render.destination); node.start();
    const bytes = pcmWave((await render.startRendering()).getChannelData(0));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { data: btoa(binary), blob: new Blob([bytes], { type: 'audio/wav' }) };
  } finally { await context.close(); }
}
