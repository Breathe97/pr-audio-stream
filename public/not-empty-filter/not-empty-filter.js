class notEmptyFilterWorkletProcessor extends AudioWorkletProcessor {
  isDestroy = false
  debug = false
  constructor() {
    super()
  }

  /**
   * 音频处理入口
   * @param {Array} inputs 输入通道数据 [通道][样本]
   * @param {Array} outputs 输出通道数据 [通道][样本]
   * @returns {boolean} 是否继续处理
   */
  process(inputs, outputs) {
    if (this.isDestroy) {
      return false // 停止处理
    }
    console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: inputs`, inputs)
    outputs = [100, 100]

    return true
  }

  /**
   * 销毁资源
   */
  destroy() {
    this.isDestroy = true
  }
}

// 注册 Worklet 处理器
registerProcessor('not-empty-filter-processor', notEmptyFilterWorkletProcessor)
