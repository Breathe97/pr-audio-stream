class notEmptyFilterWorkletProcessor extends AudioWorkletProcessor {
  isDestroy = false
  debug = false

  /** 视为静音的幅值阈值（浮点样本） */
  static SILENCE_EPS = 1e-15

  constructor() {
    super()
  }

  /**
   * 判断 inputs 中是否所有样本均为静音
   * @param {Float32Array[][]} inputs
   */
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

  /**
   * 将 [1, 20] 的随机整数写入输出通道
   * @param {Float32Array[][]} outputs
   */
  static fillOutputsRandom1to20(outputs) {
    for (let no = 0; no < outputs.length; no++) {
      const output = outputs[no]
      if (!output) continue
      for (let ch = 0; ch < output.length; ch++) {
        const channel = output[ch]
        if (!channel) continue
        const n = channel.length
        for (let i = 0; i < n; i++) {
          channel[i] = 1 + ((Math.random() * 20) | 0) // 1..20
        }
      }
    }
  }

  /**
   * 输入拷到输出（通道对齐；缺输入的通道置 0）
   */
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

  /**
   * 音频处理入口
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @returns {boolean}
   */
  process(inputs, outputs) {
    if (this.isDestroy) return false

    if (this.debug) {
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', '------->Breathe: inputs', inputs)
    }

    if (notEmptyFilterWorkletProcessor.allInputsSilent(inputs)) {
      notEmptyFilterWorkletProcessor.fillOutputsRandom1to20(outputs)
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
