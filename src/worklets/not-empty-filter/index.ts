import notEmptyFilterWorkletProcessorUrl from './not-empty-filter.js?url'

export class NotEmptyFilterWorklet {
  // 音频上下文实例
  audioContext!: AudioContext

  notEmptyFilterWorkletNode?: AudioWorkletNode

  // addModule 缓存，同一 context 只注册一次 processor
  private modulePromise?: Promise<void>

  private moduleAudioContext?: AudioContext

  createNotEmptyFilterWorkletNode = async (audioContext: AudioContext) => {
    this.destroy()
    this.audioContext = audioContext

    // 同一 context 复用同一次 addModule，避免重复注册 processor
    if (!this.modulePromise || this.moduleAudioContext !== audioContext) {
      this.moduleAudioContext = audioContext
      this.modulePromise = audioContext.audioWorklet.addModule(notEmptyFilterWorkletProcessorUrl)
    }
    await this.modulePromise

    this.notEmptyFilterWorkletNode = new AudioWorkletNode(audioContext, 'not-empty-filter-processor')

    return this.notEmptyFilterWorkletNode
  }

  destroy = () => {
    if (!this.notEmptyFilterWorkletNode) return
    this.notEmptyFilterWorkletNode.disconnect()
    // 与 not-empty-filter.js 内监听的消息结构保持一致
    this.notEmptyFilterWorkletNode.port.postMessage({ type: 'destroy' })
    this.notEmptyFilterWorkletNode = undefined
  }
}
