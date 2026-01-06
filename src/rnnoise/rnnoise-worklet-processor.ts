class RnnoiseWorkletProcessor extends AudioWorkletProcessor {
  isDestroy = false
  rnnoise?: WebAssembly.Instance
  rnnoiseExports?: WebAssembly.Exports

  state!: number // RNNoise状态指针
  frameSize = 0 // 帧大小（480）
  memory!: WebAssembly.Memory // WASM内存

  inputBuffer = new Float32Array(0) // 输入缓冲区（单声道）
  outputBuffer = new Float32Array(0) // 输出缓冲区（单声道）

  inputPtr = 1024 // 输入缓冲区地址
  outputPtr = 2048 // 输出缓冲区地址

  constructor() {
    super()

    this.port.onmessage = async (event) => {
      const { data } = event
      switch (data.type) {
        case 'init':
          {
            const { rnnoiseWasmBuffer } = data
            this.initRnnoise(rnnoiseWasmBuffer)
          }
          break

        case 'destroy':
          {
            this.destroy()
          }
          break

        default:
          {
            console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: port.onmessage`, event)
          }
          break
      }
    }
    this.process = this.onProcess
  }

  /**
   * 初始化 Rnnoise
   * @param bytes
   */
  private initRnnoise = async (bytes: BufferSource) => {
    try {
      if (!bytes) throw new Error('The WasmBuffer object is mandatory.')

      // 加载 WASM 模块
      const importObject = {
        env: {
          emscripten_memcpy_big: (e: any) => {
            // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: emscripten_memcpy_big`, e)
          },
          emscripten_resize_heap: (e: any) => {
            console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: emscripten_resize_heap`, e)
          },
          __assert_fail: (e: any) => {
            console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: __assert_fail`, e)
          },
          abort: () => {
            throw new Error('abort')
          }
        }
      }
      const { instance } = await WebAssembly.instantiate(bytes, importObject)

      this.rnnoise = instance
      this.rnnoiseExports = instance.exports

      if (typeof this.rnnoiseExports.__wasm_call_ctors !== 'function') throw new Error('__wasm_call_ctors is not a function.')
      if (typeof this.rnnoiseExports.rnnoise_create !== 'function') throw new Error('rnnoise_create is not a function.')
      if (typeof this.rnnoiseExports.rnnoise_get_frame_size !== 'function') throw new Error('rnnoise_get_frame_size is not a function.')

      // 调用构造函数（如果存在）
      this.rnnoiseExports.__wasm_call_ctors()

      // 创建降噪状态
      this.state = this.rnnoiseExports.rnnoise_create()

      // 获取帧大小（通常为 480）
      this.frameSize = this.rnnoiseExports.rnnoise_get_frame_size()

      const { rnnoiseExports, state, frameSize } = this
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: RNNoise 初始化成功`, { rnnoiseExports, state, frameSize })
    } catch (error) {
      console.error('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: RNNoise 初始化失败`, error)
    }
  }

  // 输出静音
  private outputSilence = (outputs: Float32Array[][]) => {
    if (!outputs || outputs.length === 0) return

    for (let output of outputs) {
      if (output.length === 0) continue
      output = []
    }
  }

  // 合并缓冲区
  private concatBuffers = (buffer1: Float32Array<ArrayBuffer>, buffer2: Float32Array<ArrayBuffer>) => {
    const combined = new Float32Array(buffer1.length + buffer2.length)
    combined.set(buffer1)
    combined.set(buffer2, buffer1.length)
    return combined
  }

  // 输出到通道
  private outputToChannels = (outputs: Float32Array[][]) => {
    if (!outputs || outputs.length === 0) return

    const outputChannels = outputs[0]

    if (!outputChannels || outputChannels.length === 0) return

    const numSamples = Math.min(outputChannels[0].length, this.outputBuffer.length)

    // 复制到所有输出通道
    for (let ch = 0; ch < outputChannels.length; ch++) {
      for (let i = 0; i < numSamples; i++) {
        outputChannels[ch][i] = this.outputBuffer[i]
      }
    }

    // 更新输出缓冲区
    this.outputBuffer = this.outputBuffer.slice(numSamples)
  }

  // 处理音频帧
  private processFrame = (frame: Float32Array<ArrayBuffer>) => {
    if (!this.rnnoiseExports || !this.state || !this.memory) return frame

    // 转换音频格式: Float32 -> Int16
    const int16Frame = new Int16Array(this.frameSize)
    for (let i = 0; i < this.frameSize; i++) {
      const val = frame[i] * 32768
      int16Frame[i] = Math.max(-32768, Math.min(32767, val))
    }

    try {
      // 复制数据到 WASM 内存
      const inputView = new Int16Array(this.memory.buffer, this.inputPtr, this.frameSize)
      inputView.set(int16Frame)

      // 调用降噪函数
      if (typeof this.rnnoiseExports.rnnoise_process_frame !== 'function') throw new Error('rnnoise_process_frame is error.')

      this.rnnoiseExports.rnnoise_process_frame(this.state, this.inputPtr, this.outputPtr)

      // 读取处理结果
      const outputView = new Int16Array(this.memory.buffer, this.outputPtr, this.frameSize)

      // 转换回 Float32
      const processedFrame = new Float32Array(this.frameSize)
      for (let i = 0; i < this.frameSize; i++) {
        processedFrame[i] = outputView[i] / 32768
      }
      return processedFrame
    } catch (error) {
      console.error('帧处理错误:', error)
      return frame
    }
  }

  /**
   * 音频处理入口
   * @param inputs 输入
   * @param outputs 输出
   * @param parameters
   * @returns
   */
  private onProcess = (inputs: Float32Array[][], outputs: Float32Array[][]) => {
    if (this.isDestroy) {
      return false // 停止处理
    }

    // 未初始化时输出静音
    if (!this.rnnoiseExports || !this.state) {
      this.outputSilence(outputs)
      return true
    }

    // 获取输入通道
    const inputChannels = inputs[0]
    if (!inputChannels || inputChannels.length === 0) {
      this.outputSilence(outputs)
      return true
    }

    // 合并多声道为单声道
    const monoInput = new Float32Array(inputChannels[0].length)
    for (let i = 0; i < monoInput.length; i++) {
      let sum = 0
      for (let ch = 0; ch < inputChannels.length; ch++) {
        sum += inputChannels[ch][i]
      }
      monoInput[i] = sum / inputChannels.length
    }

    // 添加到输入缓冲区
    this.inputBuffer = this.concatBuffers(this.inputBuffer, monoInput)

    // 处理完整帧
    while (this.inputBuffer.length >= this.frameSize) {
      // 取出一帧
      const frame = this.inputBuffer.slice(0, this.frameSize)
      this.inputBuffer = this.inputBuffer.slice(this.frameSize)

      // 处理帧
      const processedFrame = this.processFrame(frame)

      // 添加到输出缓冲区
      this.outputBuffer = this.concatBuffers(this.outputBuffer, processedFrame)
    }

    // 输出处理后的音频
    this.outputToChannels(outputs)
    {
      const [input] = inputs
      const [inputChannel] = input

      const [output] = outputs
      const [outputChannel] = output

      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: channel`, inputChannel[0] === outputChannel[0])
    }

    return true
  }

  /**
   * 销毁
   */
  destroy = () => {
    this.isDestroy = true
  }
}

// 注册Worklet处理器
registerProcessor('rnnoise-worklet-processor', RnnoiseWorkletProcessor)
