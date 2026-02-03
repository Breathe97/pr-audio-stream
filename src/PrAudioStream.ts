interface RnnoiseWorkletInstance {
  createRnnoiseWorkletNode: (audioContext: AudioContext) => Promise<AudioWorkletNode>
  destroy: () => void
}

interface PrRnnoise {
  RnnoiseWorklet: new () => RnnoiseWorkletInstance
}

export class PrAudioStream {
  inputStream = new MediaStream() // 输入音频流 （原始音频）

  outputStream = new MediaStream() // 输出音频流 （处理后音频）

  inputGain = 1 // 麦克风音量
  enhanceGain = 1 // 麦克风增强音量 1+x

  bgsGain = 1 // 音效音量
  bgmGain = 1 // 音乐音量

  outputGain = 1 // 扬声器音量

  mixAudioMap = new Map<string, AudioBufferSourceNode>()

  // 音频上下文实例
  audioContext = new AudioContext()

  // 输入节点（处理器的音频）
  sourceNode: MediaStreamAudioSourceNode

  // 音量输入控制节点 (麦克风输入)
  inputGainNode: GainNode

  // 音量输入增强节点 (麦克风增强)
  enhanceGainNode: GainNode

  // 音效控制节点 (音效音量)
  bgsGainNode: GainNode

  // 背景音乐控制节点 (背景音乐音量)
  bgmGainNode: GainNode

  // @ts-ignore 噪音过滤节点
  rnnoiseNode: RNNoiseNode

  // 音频分析节点
  analyserNode: AnalyserNode

  // 缓冲区 存储分析节点的时域数据
  analyserArrayData: Uint8Array<ArrayBuffer>

  // 音量输出控制节点 （扬声器音量）
  outputGainNode: GainNode

  // 输出节点（处理后的音频）
  destinationNode: MediaStreamAudioDestinationNode

  // 是否开启降噪
  denoise = false

  // 是否静音
  mute = true

  rnnoiseWorklet?: RnnoiseWorkletInstance

  rnnoiseWorkletNode?: AudioWorkletNode

  // 过滤流
  filterStream = (old_stream: MediaStream) => {
    const new_stream = old_stream
    return new_stream
  }

  constructor(stream: MediaStream, audioContext?: AudioContext) {
    if (audioContext) {
      this.audioContext = audioContext
    }

    this.inputStream = stream

    // 创建音源节点
    this.sourceNode = this.audioContext.createMediaStreamSource(this.inputStream)

    // 创建音量输入控制节点
    this.inputGainNode = this.audioContext.createGain()
    {
      // 设置音量为1
      this.inputGainNode.gain.setValueAtTime(this.inputGain, this.audioContext.currentTime)
    }

    // 创建音量输入控制节点
    this.enhanceGainNode = this.audioContext.createGain()
    {
      // 设置音量为1
      this.enhanceGainNode.gain.setValueAtTime(this.enhanceGain, this.audioContext.currentTime)
    }

    // 创建音效输入控制节点
    this.bgsGainNode = this.audioContext.createGain()
    {
      // 设置音量为1
      this.bgsGainNode.gain.setValueAtTime(this.bgsGain, this.audioContext.currentTime)
    }

    // 创建背景音乐输入控制节点
    this.bgmGainNode = this.audioContext.createGain()
    {
      // 设置音量为1
      this.bgmGainNode.gain.setValueAtTime(this.bgmGain, this.audioContext.currentTime)
    }

    // 创建音频分析节点
    this.analyserNode = this.audioContext.createAnalyser()
    {
      // 设置快速傅里叶变换的大小
      this.analyserNode.fftSize = 512
      // 创建一个缓冲区来存储分析节点的时域数据
      this.analyserArrayData = new Uint8Array(this.analyserNode.frequencyBinCount)
    }

    // 创建音量输出控制节点
    this.outputGainNode = this.audioContext.createGain()
    {
      // 设置音量为1
      this.outputGainNode.gain.setValueAtTime(this.outputGain, this.audioContext.currentTime)
    }

    // 输出节点
    {
      this.destinationNode = this.audioContext.createMediaStreamDestination()
      this.outputStream = this.destinationNode.stream
    }

    // 连接默认节点
    {
      const { sourceNode, inputGainNode, enhanceGainNode, bgsGainNode, bgmGainNode, analyserNode, outputGainNode, destinationNode } = this

      sourceNode.connect(inputGainNode)

      inputGainNode.connect(enhanceGainNode) // 音量输入控制节点 - 音量增强节点

      // 分支一
      {
        enhanceGainNode.connect(analyserNode) // 音量增强节点 - 音量分析节点
        bgsGainNode.connect(analyserNode) // 音效节点 - 音量分析节点
        bgmGainNode.connect(analyserNode) // 背景音乐节点 - 音量分析节点
      }

      // 分支二
      {
        enhanceGainNode.connect(destinationNode) // 音量增强节点 - 远端控制输出节点
        bgsGainNode.connect(destinationNode) // 音效节点 - 远端控制输出节点
        bgmGainNode.connect(destinationNode) // 背景音乐节点 - 远端控制输出节点
      }

      outputGainNode.connect(this.audioContext.destination) // 音量输出控制节点 - 本地控制输出节点
    }

    this.audioContext.resume() // 尝试恢复暂停状态
  }

  /**
   * 使用插件
   */
  use = ({ rnnoise }: { rnnoise: PrRnnoise }) => {
    this.rnnoiseWorklet = new rnnoise.RnnoiseWorklet()
  }

  private _changeSource = () => {
    // 连接默认节点
    this.sourceNode.disconnect()
    this.sourceNode = this.audioContext.createMediaStreamSource(this.inputStream)
    this.sourceNode.connect(this.inputGainNode)
  }

  /**
   * 替换轨道
   * @param track MediaStreamTrack
   */
  replaceTrack = (track: MediaStreamTrack) => {
    const tracks = this.inputStream.getTracks()
    for (const track of tracks) {
      this.inputStream.removeTrack(track)
    }
    this.inputStream.addTrack(track)
    this._changeSource()
  }

  /**
   * 停止流
   */
  stop = () => {
    // 获取到现在的轨道
    {
      const tracks = this.inputStream.getTracks()
      // 停止并删除之前的轨道
      for (const track of tracks) {
        track.stop()
        this.inputStream.removeTrack(track)
      }
    }
  }

  /**
   * 暂停
   * @param pause
   */
  pause = async (pause: boolean) => {
    const tracks = this.inputStream.getTracks()
    for (const track of tracks) {
      track.enabled = !pause
    }
  }

  /**
   * 获取数据流
   */
  getStream = () => {
    const stream = this.filterStream(this.outputStream) // 过滤后的流
    // {
    //   const tracks = stream.getTracks()
    //   console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: getStream`, tracks)
    // }
    return stream
  }

  /**
   * 静音
   * @param state 是否开启
   */
  setMute = (state: boolean = true) => {
    this.mute = state
    this.analyserNode.disconnect()
    if (state === false) {
      this.analyserNode.connect(this.outputGainNode) // 取消静音
    }
  }

  /**
   * 降噪
   * @param state 是否开启
   */
  setDenoise = async (state: boolean = true) => {
    if (!this.rnnoiseWorklet) return
    this.inputGainNode.disconnect()
    this.rnnoiseWorklet.destroy()
    if (state) {
      this.rnnoiseWorkletNode = await this.rnnoiseWorklet.createRnnoiseWorkletNode(this.audioContext)
      this.inputGainNode.connect(this.rnnoiseWorkletNode)
      this.rnnoiseWorkletNode.connect(this.enhanceGainNode)
    } else {
      this.inputGainNode.connect(this.enhanceGainNode)
    }
    this.denoise = state
  }

  /**
   * 设置麦克风输入音量
   */
  setInputGain = (gain: number) => {
    this.inputGain = gain
    this.inputGainNode.gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  /**
   * 设置麦克风增强音量
   */
  setEnhanceGain = async (gain: number) => {
    this.enhanceGain = gain + 1
    this.enhanceGainNode.gain.setValueAtTime(this.enhanceGain, this.audioContext.currentTime)
  }

  /**
   * 设置音效输入音量
   */
  setBgsGain = (gain: number) => {
    this.bgsGain = gain
    this.bgsGainNode.gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  /**
   * 设置背景音乐输入音量
   */
  setBgmGain = (gain: number) => {
    this.bgmGain = gain
    this.bgmGainNode.gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  /**
   * 设置扬声器音量
   */
  setOutputGain = (gain: number) => {
    this.outputGain = gain
    this.outputGainNode.gain.setValueAtTime(this.outputGain, this.audioContext.currentTime)
  }

  /**
   * 获取输入音量
   */
  getVolume = () => {
    const { analyserNode, analyserArrayData } = this
    analyserNode.getByteFrequencyData(analyserArrayData)
    let sum = 0
    for (let i = 0; i < analyserArrayData.length; i++) {
      sum += analyserArrayData[i]
    }
    // 计算平均音量
    const averageVolume = Math.ceil(sum / analyserArrayData.length)
    return averageVolume
  }

  /**
   * 融合音频
   */
  mixAudio = (buffer: AudioBuffer | null, kind: 'bgs' | 'bgm' = 'bgm') => {
    return new Promise(async (resolve, reject) => {
      try {
        // 清除可能存在的播放节点
        {
          const source = this.mixAudioMap.get(kind)
          source && source.stop()
        }

        const node = kind === 'bgs' ? this.bgsGainNode : this.bgmGainNode

        const source = this.audioContext.createBufferSource()
        this.mixAudioMap.set(kind, source)
        source.buffer = buffer
        source.connect(node)
        source.onended = () => {
          // 播放完成之后断开节点
          source.disconnect(node)
          this.mixAudioMap.delete(kind)
          resolve(true)
        }
        source.start(0)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 停止融合音频
   */
  mixAudioStop = (kind: 'bgs' | 'bgm') => {
    const source = this.mixAudioMap.get(kind)
    source?.stop()
  }

  /**
   * 改变融合状态
   */
  changeMix = (kind: 'bgs' | 'bgm', mix: boolean) => {
    const node = kind === 'bgs' ? this.bgsGainNode : this.bgmGainNode
    if (mix) {
      node.connect(this.destinationNode) // 开启融合
    } else {
      node.disconnect(this.destinationNode) // 取消融合
    }
  }
}
