import { randomUUID } from 'node:crypto';
import { isOperator } from './auth.mjs';

export const MAX_AUDIO_BYTES = 960044; // 30 seconds, mono PCM16 at 16 kHz.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Clients normalize supported input formats to a canonical WAV. Validate the
// actual container and sample count, never the extension or a claimed duration.
export function validateAudio(body) {
  if (!['alarm', 'voice'].includes(body.kind)) fail(400, 'Choose alarm sound or voice message.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || /[\x00-\x1f\x7f]/.test(body.name)) fail(400, 'Use an audio name of 1–80 characters.');
  const encoded = body.data;
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4) fail(413, 'Use audio up to 30 seconds long.');
  if (encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail(400, 'Invalid audio data.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) fail(400, 'Invalid audio data.');
  if (bytes.length < 3244 || bytes.length > MAX_AUDIO_BYTES || bytes.length % 2 !== 0 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) !== bytes.length - 8 ||
      bytes.toString('ascii', 8, 16) !== 'WAVEfmt ' || bytes.readUInt32LE(16) !== 16 ||
      bytes.readUInt16LE(20) !== 1 || bytes.readUInt16LE(22) !== 1 || bytes.readUInt32LE(24) !== 16000 ||
      bytes.readUInt32LE(28) !== 32000 || bytes.readUInt16LE(32) !== 2 || bytes.readUInt16LE(34) !== 16 ||
      bytes.toString('ascii', 36, 40) !== 'data' || bytes.readUInt32LE(40) !== bytes.length - 44)
    fail(400, 'Invalid audio. Upload or record it again.');
  if (!bytes.subarray(44).some(value => value !== 0)) fail(400, 'The recording is silent. Check your microphone and record again.');
  return { bytes, name: body.name.trim(), kind: body.kind, durationMs: Math.round((bytes.length - 44) / 32), byteLength: bytes.length };
}
export async function ownedAudio(db, id, userId) {
  if (!uuid.test(id)) fail(400, 'Invalid audio identifier.');
  const row = (await db.query('select id,name,kind,duration_ms,byte_length from eligtas.alert_audio where id=$1 and creator_id=$2', [id, userId])).rows[0];
  if (!row) fail(404, 'Audio is unavailable. Upload or record it again.');
  return { id: row.id, name: row.name, kind: row.kind, durationMs: row.duration_ms, byteLength: row.byte_length };
}
export function alertAudioRoutes(app, db, rateLimit) {
  app.post('/api/alert-audio', async (req, res) => {
    if (!isOperator(req.user)) fail(403, 'Approved command-center access is required.');
    rateLimit(req, 'audio-upload', 30, 3600000);
    const audio = validateAudio(req.body), id = randomUUID();
    await db.transaction(async tx => {
      // A per-account lock keeps the draft quota correct across concurrent uploads.
      await tx.query('select id from eligtas.users where id=$1 for update', [req.user.id]);
      await tx.query("delete from eligtas.alert_audio where created_at < now() - interval '24 hours' and not exists (select 1 from eligtas.alerts where audio->>'id'=alert_audio.id::text)");
      const count = (await tx.query("select count(*)::int as n from eligtas.alert_audio where creator_id=$1 and created_at > now() - interval '1 hour'", [req.user.id])).rows[0].n;
      if (count >= 30) fail(429, 'Audio upload limit reached. Please retry in an hour.');
      await tx.query('insert into eligtas.alert_audio(id,creator_id,name,kind,duration_ms,byte_length,data) values ($1,$2,$3,$4,$5,$6,$7)', [id, req.user.id, audio.name, audio.kind, audio.durationMs, audio.byteLength, audio.bytes]);
    });
    res.status(201).json({ id, name: audio.name, kind: audio.kind, durationMs: audio.durationMs, byteLength: audio.byteLength });
  });
  app.get('/api/alert-audio/:id', async (req, res) => {
    if (!uuid.test(req.params.id)) fail(404, 'Audio not found.');
    // Drafts belong to their author; sent audio is visible only to operators or
    // actual recipients. UUID knowledge alone never grants access.
    const row = (await db.query(`select data from eligtas.alert_audio x where x.id=$1 and (
      (x.creator_id=$2 and $3) or exists (
        select 1 from eligtas.alerts a where a.audio->>'id'=x.id::text and
        ($3 or exists (select 1 from eligtas.receipts r where r.alert_id=a.id and r.user_id=$2))
      ))`, [req.params.id, req.user.id, isOperator(req.user)])).rows[0];
    if (!row) fail(404, 'Audio not found.');
    res.set('Content-Type', 'audio/wav').set('Content-Disposition', 'inline; filename="alert-audio.wav"').send(Buffer.from(row.data));
  });
}
