/**
 * pcm-capture — AudioWorkletProcessor (S322, voz en tiempo real de Noa).
 *
 * Toma el micrófono a la tasa del AudioContext (48 kHz en iOS/Chrome, a veces
 * 44.1 kHz), lo resamplea LINEALMENTE a 16 kHz mono y lo entrega en frames
 * Int16 de 40 ms (640 muestras = 1280 bytes) por `port.postMessage`, listos
 * para mandar al WS del backend como binario. Cada ~100 ms manda el nivel RMS
 * (0-1) para la onda de la UI.
 *
 * Por qué no MediaRecorder: Gemini Live sólo acepta PCM crudo; webm/opus no sirve.
 * Por qué resamplear acá: iOS ignora `sampleRate` en getUserMedia/AudioContext.
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = 16000;
    this.step = sampleRate / this.target; // muestras de entrada por muestra de salida
    this.pos = 0;                          // posición fraccional dentro de `carry`
    this.carry = new Float32Array(0);      // resto de entrada no consumido
    this.frame = new Int16Array(640);      // 40 ms @ 16 kHz
    this.fill = 0;
    this.levelAcc = 0;
    this.levelN = 0;
    this.levelEvery = Math.round(sampleRate / 10); // ~100 ms
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "mute") this.muted = !!e.data.value;
    };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || ch.length === 0) return true;

    // nivel RMS del bloque (antes de resamplear)
    let sq = 0;
    for (let i = 0; i < ch.length; i++) sq += ch[i] * ch[i];
    this.levelAcc += sq;
    this.levelN += ch.length;
    if (this.levelN >= this.levelEvery) {
      const rms = Math.sqrt(this.levelAcc / this.levelN);
      this.port.postMessage({ type: "level", value: Math.min(1, rms * 4) });
      this.levelAcc = 0;
      this.levelN = 0;
    }
    if (this.muted) return true;

    // concatenar resto + bloque nuevo
    const inp = new Float32Array(this.carry.length + ch.length);
    inp.set(this.carry, 0);
    inp.set(ch, this.carry.length);

    let p = this.pos;
    const n = inp.length;
    while (p + 1 < n) {
      const i = Math.floor(p);
      const frac = p - i;
      const s = inp[i] + (inp[i + 1] - inp[i]) * frac;
      const v = Math.max(-1, Math.min(1, s));
      this.frame[this.fill++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.fill === this.frame.length) {
        const out = this.frame.buffer.slice(0);
        this.port.postMessage({ type: "audio", buffer: out }, [out]);
        this.fill = 0;
      }
      p += this.step;
    }
    // guardar el resto (desde floor(p)) y la fracción
    const keepFrom = Math.floor(p);
    this.carry = inp.slice(keepFrom);
    this.pos = p - keepFrom;
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
