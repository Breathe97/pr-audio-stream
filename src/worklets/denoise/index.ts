// GTCRN worklet 源码以字符串内联，运行时用 Blob URL 注册，不依赖部署路径
import gtcrnWorkletProcessorCode from './gtcrn-worklet-processor.js?raw'
// GTCRN wasm 由 Vite 处理，lib 构建会内联成 data URI，dev 下走本地资源路径
import gtcrnWasmUrl from './gtcrn.wasm?url'

// GTCRN 内核只吃 16k / 48k，其它采样率进 worklet 会直接抛错
const SUPPORTED_SAMPLE_RATES = [16000, 48000]

// 与 gtcrn-worklet-processor.js 内 registerProcessor 的名字严格一致，改了就废
const PROCESSOR_NAME = '@sapphi-red/web-noise-suppressor/gtcrn'

// 官方实现固定 2 声道（内部只处理第 0 声道）
const MAX_CHANNELS = 2

export class GtcrnDenoise {
  // 音频上下文实例
  audioContext!: AudioContext

  denoiseWorkletNode?: AudioWorkletNode

  // wasm 二进制缓存，避免重复拉取（100 多 KB，只拉一次）
  private wasmBinary?: ArrayBuffer

  // addModule 缓存，避免同一 context 重复注册 processor 报重名错
  private modulePromise?: Promise<void>

  private moduleAudioContext?: AudioContext

  /**
   * 当前上下文的采样率是否被 GTCRN 支持
   */
  static isSupported = (audioContext: AudioContext) => {
    return SUPPORTED_SAMPLE_RATES.includes(audioContext.sampleRate)
  }

  /**
   * 创建降噪节点（内部完成 worklet 加载 + wasm 加载）
   */
  createDenoiseWorkletNode = async (audioContext: AudioContext) => {
    // 重建前先销毁旧节点，避免链路泄漏
    this.destroy()
    this.audioContext = audioContext

    if (!GtcrnDenoise.isSupported(audioContext)) {
      throw new Error(`GTCRN 仅支持 16k / 48k 采样率，当前为 ${audioContext.sampleRate}Hz`)
    }

    // worklet 模块每个 context 只注册一次
    if (!this.modulePromise || this.moduleAudioContext !== audioContext) {
      // 用 Blob URL 加载，绕开打包后 assets 路径 / base 配置带来的 404
      const blobUrl = URL.createObjectURL(new Blob([gtcrnWorkletProcessorCode], { type: 'text/javascript' }))
      this.moduleAudioContext = audioContext
      this.modulePromise = audioContext.audioWorklet.addModule(blobUrl).finally(() => {
        URL.revokeObjectURL(blobUrl)
      })
    }
    await this.modulePromise

    // wasm 只拉一次，后续复用（worklet 侧拿到 binary 就不会自己 fetch）
    if (!this.wasmBinary) {
      const response = await fetch(gtcrnWasmUrl)
      if (!response.ok) throw new Error(`GTCRN wasm 加载失败：${response.status} ${gtcrnWasmUrl}`)
      this.wasmBinary = await response.arrayBuffer()
    }

    this.denoiseWorkletNode = new AudioWorkletNode(audioContext, PROCESSOR_NAME, {
      processorOptions: {
        maxChannels: MAX_CHANNELS,
        wasmBinary: this.wasmBinary
      }
    })

    return this.denoiseWorkletNode
  }

  /**
   * 销毁节点（wasm 缓存保留，下次开启不用重新拉）
   */
  destroy = () => {
    if (!this.denoiseWorkletNode) return
    this.denoiseWorkletNode.disconnect()
    // GTCRN worklet 只认字符串 'destroy'，与 not-empty-filter 的对象消息不同
    this.denoiseWorkletNode.port.postMessage('destroy')
    this.denoiseWorkletNode = undefined
  }
}
