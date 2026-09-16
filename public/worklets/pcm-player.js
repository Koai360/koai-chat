/**
 * pcm-player — AudioWorkletProcessor (S322, voz en tiempo real de Noa).
 *
 * Recibe audio PCM16 mono a 24 kHz (lo que manda Gemini Live vía el backend) en
 * `port.postMessage({type:"audio", buffer})`, lo encola y lo reproduce a la tasa
 * del AudioContext con resampleo lineal. `{type:"flush"}` vacía la cola (cuando
 * el usuario interrumpe a Noa). Publica `{type:"state", playing, queuedMs}` en
 * cada transición y `{type:"level", value}` cada ~100 ms para la onda.
 */
class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.source = 24000;
    this.step = this.source / sampleRate; // muestras fuente por muestra de salida
    this.queue = [];                      // Float32Array chunks
    this.head = 0;                        // índice (float) dentro de queue[0]
    this.playing = false;
    this.levelAcc = 0;
    this.levelN = 0;
    this.levelEvery = Math.round(sampleRate / 10);
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "audio" && d.buffer) {
        const i16 = new Int16Array(d.buffer);
        const f32 = new Float32Array(i16.length);
        for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
        this.queue.push(f32);
        if (!this.playing) this._state(true);
      } else if (d.type === "flush") {
        this.queue = [];
        this.head = 0;
        if (this.playing) this._state(false);
      }
    };
  }

  _queuedMs() {
    let n = 0;
    for (let i = 0; i < this.queue.length; i++) n += this.queue[i].length;
    return Math.round(((n - this.head) / this.source) * 1000);
  }

  _state(playing) {
    this.playing = playing;
    this.port.postMessage({ type: "state", playing, queuedMs: this._queuedMs() });
  }

  process(_inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    let sq = 0;
    for (let k = 0; k < out.length; k++) {
      let v = 0;
      if (this.queue.length > 0) {
        const cur = this.queue[0];
        const i = Math.floor(this.head);
        const frac = this.head - i;
        const a = cur[i];
        const b = i + 1 < cur.length ? cur[i + 1] : (this.queue[1] ? this.queue[1][0] : a);
        v = a + (b - a) * frac;
        this.head += this.step;
        if (this.head >= cur.length) {
          this.head -= cur.length;
          this.queue.shift();
          if (this.queue.length === 0) this.head = 0;
        }
      }
      out[k] = v;
      sq += v * v;
    }
    // copiar a los demás canales (si el destino es estéreo)
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    this.levelAcc += sq;
    this.levelN += out.length;
    if (this.levelN >= this.levelEvery) {
      const rms = Math.sqrt(this.levelAcc / this.levelN);
      this.port.postMessage({ type: "level", value: Math.min(1, rms * 3) });
      this.levelAcc = 0;
      this.levelN = 0;
    }
    if (this.playing && this.queue.length === 0) this._state(false);
    return true;
  }
}

registerProcessor("pcm-player", PcmPlayer);
