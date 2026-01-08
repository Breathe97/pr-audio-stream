class RnnoiseWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    this.debug = false
    this.isDestroy = false
    this.rnnoiseModule = null
    this.frameSize = 0
    this.state = 0
    this.pcmInputBuf = 0
    this.pcmOutputBuf = 0
    this.memory = null

    // 简化缓冲区管理
    this.inputSamples = new Float32Array(0)
    this.outputSamples = new Float32Array(0)

    this.port.onmessage = async (event) => {
      const data = event.data
      switch (data.type) {
        case 'init':
          if (data.rnnoiseWasmBuffer) {
            this.debug = data.debug
            await this.initRnnoise(data.rnnoiseWasmBuffer)
          }
          break
        case 'destroy':
          this.destroy()
          break
        default:
          console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: port.onmessage`, event)
      }
    }
  }

  /**
   * 初始化 RNNoise WASM 模块
   * @param {ArrayBuffer} bytes WASM 二进制数据
   */
  async initRnnoise(bytes) {
    try {
      // WASM 导入函数
      const wasmImports = {
        __assert_fail: (condition, filename, line, func) => {
          console.error('Assertion failed:', { condition, filename, line, func })
        },
        emscripten_resize_heap: (newSize) => {
          console.log('Resizing heap to:', newSize)
          return 0
        },
        fd_write: (fd, iov, iovcnt, pnum) => {
          console.log('Writing to file descriptor:', fd)
          return 0
        },
        emscripten_memcpy_big: (dest, src, count) => {
          if (!this.memory) return dest
          const destView = new Uint8Array(this.memory.buffer, dest, count)
          const srcView = new Uint8Array(this.memory.buffer, src, count)
          destView.set(srcView)
          return dest
        },
        abort: () => {
          throw new Error('Abort called in WASM')
        }
      }

      // 实例化 WASM 模块
      const { instance } = await WebAssembly.instantiate(bytes, {
        env: wasmImports,
        wasi_snapshot_preview1: wasmImports
      })

      const rnnoiseModule = instance.exports
      this.rnnoiseModule = rnnoiseModule
      this.memory = rnnoiseModule.memory

      // 检查必要函数是否存在
      if (typeof rnnoiseModule.rnnoise_create !== 'function') {
        throw new Error('rnnoise_create is not a function')
      }
      if (typeof rnnoiseModule.rnnoise_get_frame_size !== 'function') {
        throw new Error('rnnoise_get_frame_size is not a function')
      }
      if (typeof rnnoiseModule.rnnoise_process_frame !== 'function') {
        throw new Error('rnnoise_process_frame is not a function')
      }
      if (typeof rnnoiseModule.malloc !== 'function') {
        throw new Error('malloc is not a function')
      }
      if (typeof rnnoiseModule.rnnoise_destroy !== 'function') {
        throw new Error('rnnoise_destroy is not a function')
      }

      // 初始化 WASM 模块
      if (typeof rnnoiseModule.__wasm_call_ctors === 'function') {
        rnnoiseModule.__wasm_call_ctors()
      }

      // 创建降噪状态
      this.state = rnnoiseModule.rnnoise_create()

      // 获取帧大小（通常为 480）
      this.frameSize = rnnoiseModule.rnnoise_get_frame_size()
      console.log('Detected frame size:', this.frameSize)

      // 分配 PCM 缓冲区（每个样本 4 字节）
      this.pcmInputBuf = rnnoiseModule.malloc(this.frameSize * 4)
      this.pcmOutputBuf = rnnoiseModule.malloc(this.frameSize * 4)

      console.log('RNNoise initialized:', {
        state: this.state,
        frameSize: this.frameSize,
        inputBuf: this.pcmInputBuf,
        outputBuf: this.pcmOutputBuf,
        memorySize: this.memory.buffer.byteLength
      })
    } catch (error) {
      console.error('RNNoise initialization failed:', error)
    }
  }

  /**
   * 处理音频帧
   * @param {Float32Array} frame 输入音频帧
   * @returns {Float32Array} 处理后的音频帧
   */
  processFrame(frame) {
    if (!this.rnnoiseModule || !this.state || !this.memory || !this.pcmInputBuf || !this.pcmOutputBuf) {
      console.warn('RNNoise not initialized')
      return frame
    }

    // 确保帧大小正确
    if (frame.length !== this.frameSize) {
      console.warn(`Frame size mismatch: expected ${this.frameSize}, got ${frame.length}`)
      // 创建正确大小的缓冲区并填充
      const paddedFrame = new Float32Array(this.frameSize).fill(0)
      const copyLength = Math.min(frame.length, this.frameSize)
      paddedFrame.set(frame.subarray(0, copyLength), 0)
      frame = paddedFrame
    }

    try {
      // 调试：记录输入音频统计信息
      const inputMax = Math.max(...frame.map(Math.abs))
      console.log(`Input frame max amplitude: ${inputMax.toFixed(4)}`)

      // 修复输入格式问题：RNNoise 期望 int16 范围 [-32768, 32767]
      // 但浏览器提供的是 float32 范围 [-1, 1]
      // 需要将 float32 转换为 int16 等效值
      const scaledFrame = new Float32Array(this.frameSize)
      for (let i = 0; i < this.frameSize; i++) {
        // 将 float32 转换为 int16 等效值
        scaledFrame[i] = frame[i] * 32768
      }

      // 创建输入内存视图
      const inputView = new Float32Array(this.memory.buffer, this.pcmInputBuf, this.frameSize)

      // 复制输入数据到 WASM 内存
      inputView.set(scaledFrame)

      // 调用降噪函数
      const vad = this.rnnoiseModule.rnnoise_process_frame(this.state, this.pcmOutputBuf, this.pcmInputBuf)
      // console.log('VAD result:', vad)

      // 创建输出内存视图
      const outputView = new Float32Array(this.memory.buffer, this.pcmOutputBuf, this.frameSize)

      // 修复输出格式：将 int16 等效值转换回 float32
      const processedFrame = new Float32Array(this.frameSize)
      for (let i = 0; i < this.frameSize; i++) {
        // 将 int16 等效值转换回 float32
        let sample = outputView[i] / 32768

        // 限制幅度范围
        if (sample > 1.0) sample = 1.0
        if (sample < -1.0) sample = -1.0

        processedFrame[i] = sample
      }

      return processedFrame
    } catch (error) {
      console.error('Frame processing error:', error)
      return frame
    }
  }

  /**
   * 音频处理入口 - 修复缓冲区管理
   * @param {Array} inputs 输入通道数据 [通道][样本]
   * @param {Array} outputs 输出通道数据 [通道][样本]
   * @returns {boolean} 是否继续处理
   */
  process(inputs, outputs) {
    if (this.isDestroy) {
      return false // 停止处理
    }

    // 未初始化时输出静音
    if (!this.rnnoiseModule || !this.state || !this.memory || !this.pcmInputBuf || !this.pcmOutputBuf) {
      this.outputSilence(outputs)
      return true
    }

    // 获取输入通道（取第一个输入源）
    const inputSources = inputs[0]
    if (!inputSources || inputSources.length === 0) {
      this.outputSilence(outputs)
      return true
    }

    // 合并多声道为单声道
    const monoInput = this.mergeChannels(inputSources)

    // 添加到输入样本队列
    const newInputSamples = new Float32Array(this.inputSamples.length + monoInput.length)
    newInputSamples.set(this.inputSamples)
    newInputSamples.set(monoInput, this.inputSamples.length)
    this.inputSamples = newInputSamples

    // 处理完整帧
    while (this.inputSamples.length >= this.frameSize) {
      // 取出一帧
      const frame = this.inputSamples.slice(0, this.frameSize)
      this.inputSamples = this.inputSamples.slice(this.frameSize)

      // 处理帧
      const processedFrame = this.processFrame(frame)

      // 添加到输出样本队列
      const newOutputSamples = new Float32Array(this.outputSamples.length + processedFrame.length)
      newOutputSamples.set(this.outputSamples)
      newOutputSamples.set(processedFrame, this.outputSamples.length)
      this.outputSamples = newOutputSamples
    }

    // 输出处理后的音频
    this.outputToChannels(outputs)

    return true
  }

  /**
   * 合并多个声道为单声道
   * @param {Array} channels 输入通道数组
   * @returns {Float32Array} 合并后的单声道音频
   */
  mergeChannels(channels) {
    if (channels.length === 0) return new Float32Array(0)
    if (channels.length === 1) return channels[0].slice() // 返回副本

    const length = Math.min(...channels.map((ch) => ch.length))
    const merged = new Float32Array(length)

    for (let i = 0; i < length; i++) {
      let sum = 0
      let validCount = 0

      for (let ch = 0; ch < channels.length; ch++) {
        if (i < channels[ch].length) {
          const sample = channels[ch][i]
          // 过滤掉无效值
          if (isFinite(sample)) {
            sum += sample
            validCount++
          }
        }
      }

      // 计算平均值，避免除以零
      merged[i] = validCount > 0 ? sum / validCount : 0
    }

    return merged
  }

  /**
   * 输出静音到所有通道
   * @param {Array} outputs 输出通道数组
   */
  outputSilence(outputs) {
    for (const output of outputs) {
      for (const channel of output) {
        channel.fill(0)
      }
    }
  }

  /**
   * 将输出样本复制到输出通道
   * @param {Array} outputs 输出通道数组
   */
  outputToChannels(outputs) {
    if (this.outputSamples.length === 0) return

    // 计算可以复制的最大样本数
    let samplesToCopy = this.outputSamples.length
    for (const output of outputs) {
      for (const channel of output) {
        samplesToCopy = Math.min(samplesToCopy, channel.length)
      }
    }

    if (samplesToCopy === 0) return

    // 复制数据到所有通道
    for (let i = 0; i < samplesToCopy; i++) {
      const sample = this.outputSamples[i]
      for (const output of outputs) {
        for (const channel of output) {
          if (i < channel.length) {
            channel[i] = sample
          }
        }
      }
    }

    // 更新输出样本队列
    if (this.outputSamples.length > samplesToCopy) {
      this.outputSamples = this.outputSamples.slice(samplesToCopy)
    } else {
      this.outputSamples = new Float32Array(0)
    }
  }

  /**
   * 销毁资源
   */
  destroy() {
    this.isDestroy = true

    if (this.rnnoiseModule) {
      // 销毁降噪状态
      if (this.state && typeof this.rnnoiseModule.rnnoise_destroy === 'function') {
        this.rnnoiseModule.rnnoise_destroy(this.state)
        this.state = 0
      }

      // 释放内存
      if (this.pcmInputBuf && typeof this.rnnoiseModule.free === 'function') {
        this.rnnoiseModule.free(this.pcmInputBuf)
        this.pcmInputBuf = 0
      }

      if (this.pcmOutputBuf && typeof this.rnnoiseModule.free === 'function') {
        this.rnnoiseModule.free(this.pcmOutputBuf)
        this.pcmOutputBuf = 0
      }

      this.rnnoiseModule = null
      this.memory = null
    }

    // 清空缓冲区
    this.inputSamples = new Float32Array(0)
    this.outputSamples = new Float32Array(0)
  }
}

// 注册 Worklet 处理器
registerProcessor('rnnoise-worklet-processor', RnnoiseWorkletProcessor)
