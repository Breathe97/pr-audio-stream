class notEmptyFilterWorkletProcessor extends AudioWorkletProcessor {
  isDestroy = false
  debug = false

  /** 视为静音的幅值阈值（浮点样本） */
  static SILENCE_EPS = 1e-15

  /**
   * 静音时注入白噪声抖动峰值（约 ±0.001，约为原先的 1/15，正常音量下几乎听不见；样本仍非零）。
   */
  static DITHER_PEAK = 0.001

  constructor() {
    super()
  }

  static allInputsSilent(inputs) {
    const eps = notEmptyFilterWorkletProcessor.SILENCE_EPS
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

  static fillOutputsDither(outputs) {
    const peak = notEmptyFilterWorkletProcessor.DITHER_PEAK
    for (let no = 0; no < outputs.length; no++) {
      const output = outputs[no]
      if (!output) continue
      for (let ch = 0; ch < output.length; ch++) {
        const channel = output[ch]
        if (!channel) continue
        const n = channel.length
        for (let i = 0; i < n; i++) {
          channel[i] = (Math.random() * 2 - 1) * peak
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

    if (notEmptyFilterWorkletProcessor.allInputsSilent(inputs)) {
      notEmptyFilterWorkletProcessor.fillOutputsDither(outputs)
    } else {
      notEmptyFilterWorkletProcessor.copyInputsToOutputs(inputs, outputs)
    }

    return true
  }

  destroy() {
    this.isDestroy = true
  }
}

registerProcessor('not-empty-filter-processor', notEmptyFilterWorkletProcessor)
