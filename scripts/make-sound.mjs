/**
 * Writes assets/complete.wav — the chime that plays when a board is finished.
 *
 * Generated rather than downloaded so the sound is reviewable as code: a rising
 * C-E-G-C arpeggio, each note a sine with a little second harmonic for warmth,
 * a few milliseconds of attack so it doesn't click, and an exponential decay.
 *
 * Run with:  npm run make-sound
 */
import { writeFileSync } from 'node:fs';

const RATE = 22050;
const NOTES = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
const SPACING = 0.1; // seconds between note starts
const RING = 1.0; // how long each note takes to fade out
/** a low root under the arpeggio, so the chime has body and not just sparkle */
const ROOT = 261.63; // C4
const LENGTH = SPACING * (NOTES.length - 1) + RING;

const samples = new Float64Array(Math.ceil(LENGTH * RATE));
NOTES.forEach((freq, i) => {
  const start = Math.floor(i * SPACING * RATE);
  // later notes a touch quieter, so the chord settles instead of piling up
  const level = 0.5 - i * 0.06;
  for (let n = 0; n + start < samples.length; n++) {
    const t = n / RATE;
    if (t > RING) break;
    const attack = Math.min(1, t / 0.006);
    // slower than it was: the chime plays over the music, and a fast decay left
    // nothing but a click by the time the track came back up
    const decay = Math.exp(-t * 3.1);
    const wave = Math.sin(2 * Math.PI * freq * t) + 0.22 * Math.sin(4 * Math.PI * freq * t);
    samples[start + n] += level * attack * decay * wave;
  }
});

// the root, quiet and slow, underneath
for (let n = 0; n < samples.length; n++) {
  const t = n / RATE;
  const decay = Math.exp(-t * 2.4);
  samples[n] += 0.3 * Math.min(1, t / 0.01) * decay * Math.sin(2 * Math.PI * ROOT * t);
}

// normalise to just under full scale, so it is loud without clipping
let peak = 0;
for (const s of samples) peak = Math.max(peak, Math.abs(s));
const gain = peak > 0 ? 0.97 / peak : 1;

const data = Buffer.alloc(samples.length * 2);
for (let i = 0; i < samples.length; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain * 32767))), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

writeFileSync('assets/complete.wav', Buffer.concat([header, data]));
console.log(`wrote assets/complete.wav — ${(  (header.length + data.length) / 1024).toFixed(0)} KB, ${LENGTH.toFixed(2)}s`);
