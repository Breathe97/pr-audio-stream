// src/types/audioworklet.d.ts

declare global {
  // 扩展 Window 接口以包含 AudioWorkletProcessor 和 registerProcessor
  interface Window {
    AudioWorkletProcessor: typeof AudioWorkletProcessor
    registerProcessor: typeof registerProcessor
  }

  // 声明 AudioWorkletProcessor 类
  class AudioWorkletProcessor {
    readonly port: MessagePort
    constructor(options?: AudioWorkletNodeOptions)
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
  }

  // 声明 registerProcessor 函数
  function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void

  // 声明 AudioWorkletNodeOptions 接口
  interface AudioWorkletNodeOptions {
    outputChannelCount?: number[]
    parameterData?: Record<string, number>
    processorOptions?: any
  }

  // 声明 AudioWorkletGlobalScope 接口
  interface AudioWorkletGlobalScope {
    registerProcessor: typeof registerProcessor
    currentFrame: number
    currentTime: number
    sampleRate: number
    AudioWorkletProcessor: typeof AudioWorkletProcessor
  }

  // 声明 AudioWorkletNode 类（增强版）
  class AudioWorkletNode extends AudioNode {
    constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions)
    readonly port: MessagePort
    onprocessorerror: ((event: Event) => void) | null
    parameters: Map<string, AudioParam>
  }
}

export {}
