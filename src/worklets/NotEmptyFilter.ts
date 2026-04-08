import notEmptyFilterWorkletProcessorUrl from '../../public/not-empty-filter/not-empty-filter.js?url'

export class NotEmptyFilterWorklet {
  // 音频上下文实例
  audioContext!: AudioContext

  notEmptyFilterWorkletNode?: AudioWorkletNode

  constructor() {}

  createNotEmptyFilterWorkletNode = async (audioContext: AudioContext) => {
    this.destroy()
    this.audioContext = audioContext

    await this.audioContext.audioWorklet.addModule(notEmptyFilterWorkletProcessorUrl)
    this.notEmptyFilterWorkletNode = new AudioWorkletNode(this.audioContext, 'not-empty-filter-processor')

    return this.notEmptyFilterWorkletNode
  }

  destroy = () => {
    this.notEmptyFilterWorkletNode?.disconnect()
    this.notEmptyFilterWorkletNode?.port.postMessage({ type: 'destroy' })
    this.notEmptyFilterWorkletNode = undefined
  }
}
