/**
 * 静音时：在频域仅保留 bin 0～4（随机），其余为 0，再合成时域写入输出 — 即修改真实 PCM，经 Analyser(fftSize=512) 时前 5 个 bin 有能量、其余接近 0。
 * PERIOD 须与 PrAudioStream 中 analyserNode.fftSize 一致。
 */
class NotEmptyFilterWorkletProcessor extends AudioWorkletProcessor {
  isDestroy = false
  debug = false

  static SILENCE_EPS = 1e-15

  /** 与 src/PrAudioStream.ts 里 analyserNode.fftSize 保持一致 */
  static PERIOD = 512

  /** bin 0～4 随机复数（实部/虚部）的大致幅度尺度，可按听感/编码再调 */
  static BIN_SCALE = 0.02

  constructor() {
    super()
    this._silentPcm = new Float32Array(NotEmptyFilterWorkletProcessor.PERIOD)
    this._silentOff = NotEmptyFilterWorkletProcessor.PERIOD
    this.port.onmessage = event => {
      const message = event && event.data
      if (message && message.type === 'destroy') {
        this.destroy()
      }
    }
  }

  static allInputsSilent(inputs) {
    const eps = NotEmptyFilterWorkletProcessor.SILENCE_EPS
    for (let ni = 0; ni < inputs.length; ni++) {
      const input = inputs[ni]
      if (!input) continue
      for (let ch = 0; ch < input.length; ch++) {
        const channel = input[ch]
        if (!channel) continue
        const n = channel.length
        for (let i = 0; i < n; i++) {
          if (Math.abs(channel[i]) >= eps) return false
        }
      }
    }
    return true
  }

  /**
   * 仅 bin 0..4 非零（随机），满足实信号 IDFT，写入 this._silentPcm
   */
  refillSilentPcmFromFiveBins() {
    const N = NotEmptyFilterWorkletProcessor.PERIOD
    const scale = NotEmptyFilterWorkletProcessor.BIN_SCALE
    const re = new Float64Array(5)
    const im = new Float64Array(5)
    re[0] = (Math.random() * 2 - 1) * scale
    im[0] = 0
    for (let k = 1; k <= 4; k++) {
      re[k] = (Math.random() * 2 - 1) * scale
      im[k] = (Math.random() * 2 - 1) * scale
    }
    const invN = 1 / N
    const twoPiOverN = (2 * Math.PI) / N
    for (let n = 0; n < N; n++) {
      let s = re[0]
      for (let k = 1; k <= 4; k++) {
        const ang = twoPiOverN * k * n
        s += 2 * (re[k] * Math.cos(ang) - im[k] * Math.sin(ang))
      }
      this._silentPcm[n] = s * invN
    }
    this._silentOff = 0
  }

  fillOutputsSparseFiveBins(outputs) {
    const first = outputs[0]
    if (!first || !first[0]) return
    const frameLen = first[0].length

    for (let i = 0; i < frameLen; i++) {
      if (this._silentOff >= NotEmptyFilterWorkletProcessor.PERIOD) {
        this.refillSilentPcmFromFiveBins()
      }
      const v = this._silentPcm[this._silentOff++]
      for (let no = 0; no < outputs.length; no++) {
        const outPorts = outputs[no]
        if (!outPorts) continue
        for (let ch = 0; ch < outPorts.length; ch++) {
          const channel = outPorts[ch]
          if (channel) channel[i] = v
        }
      }
    }
  }

  static copyInputsToOutputs(inputs, outputs) {
    for (let no = 0; no < outputs.length; no++) {
      const outPorts = outputs[no]
      const inPorts = inputs[no]
      if (!outPorts) continue
      for (let ch = 0; ch < outPorts.length; ch++) {
        const outCh = outPorts[ch]
        if (!outCh) continue
        const inCh = inPorts && inPorts[ch]
        if (inCh && inCh.length === outCh.length) {
          outCh.set(inCh)
        } else if (inCh) {
          const n = Math.min(inCh.length, outCh.length)
          for (let i = 0; i < n; i++) outCh[i] = inCh[i]
          for (let i = n; i < outCh.length; i++) outCh[i] = 0
        } else {
          outCh.fill(0)
        }
      }
    }
  }

  process(inputs, outputs) {
    if (this.isDestroy) return false

    if (this.debug) {
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', '------->Breathe: inputs', inputs)
    }

    if (NotEmptyFilterWorkletProcessor.allInputsSilent(inputs)) {
      this.fillOutputsSparseFiveBins(outputs)
    } else {
      this._silentOff = NotEmptyFilterWorkletProcessor.PERIOD
      NotEmptyFilterWorkletProcessor.copyInputsToOutputs(inputs, outputs)
    }

    return true
  }

  destroy() {
    this.isDestroy = true
    try {
      this.port.close()
    } catch {}
  }
}

registerProcessor('not-empty-filter-processor', NotEmptyFilterWorkletProcessor)
