// Original two-tone alarm: no third-party audio or external runtime download.
import { mkdir, writeFile } from 'node:fs/promises';
const rate = 22050, seconds = 1.3, count = Math.floor(rate * seconds);
const wav = Buffer.alloc(44 + count * 2);
wav.write('RIFF'); wav.writeUInt32LE(36 + count * 2, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate * 2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(count * 2,40);
for (let i = 0; i < count; i++) {
  const t = i / rate, envelope = t < .62 ? Math.min(1,t/.04,(.62-t)/.07) : 0;
  const phase = t < .3 ? 660 * t : 660 * .3 + 880 * (t-.3);
  wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * phase) * envelope * 20000),44 + i * 2);
}
const destination = new URL('../android/app/src/main/res/raw/',import.meta.url);
await mkdir(destination,{recursive:true}); await writeFile(new URL('alert_tone.wav',destination),wav);
