<template>
  <div class="menus">
    <div class="menus-item">
      <div class="name">麦克风输入</div>
      <div class="action" style="padding: 0"><el-slider style="padding: 0 20px" v-model="inputGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setInputGain(val/100)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">麦克风增强</div>
      <div class="action" style="padding: 0"><el-slider style="width: 180px; padding: 0 20px" v-model="enhanceGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setEnhanceGain(val/100)" :max="200" /></div>
    </div>
    <div class="menus-span"></div>
    <div class="menus-item">
      <div class="name">即时音效</div>
      <div class="action">
        <div ref="audio_bgs_ref" class="action-waveSurfer"></div>
        <div class="btn" @click="addbgs">{{ '选择音频' }}</div>
      </div>
    </div>
    <div class="menus-item">
      <div class="name">输入音量</div>
      <div class="action" style="padding: 0"><el-slider style="width: 180px; padding: 0 20px" v-model="bgsGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setBgsGain(val/100)" :max="200" /></div>
    </div>
    <div class="menus-item">
      <div class="name">融合</div>
      <div class="action"><el-switch v-model="mixBgs" @change="(state:boolean)=>setMixBgs(state)" /></div>
    </div>
    <div class="menus-span"></div>
    <div class="menus-item">
      <div class="name">背景音乐</div>
      <div class="action">
        <div ref="audio_bgm_ref" class="action-waveSurfer"></div>
        <div class="btn" @click="addbgm">{{ '选择音频' }}</div>
      </div>
    </div>
    <div class="menus-item">
      <div class="name">输入音量</div>
      <div class="action" style="padding: 0"><el-slider style="width: 180px; padding: 0 20px" v-model="bgmGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setBgmGain(val/100)" :max="200" /></div>
    </div>
    <div class="menus-item">
      <div class="name">融合</div>
      <div class="action"><el-switch v-model="mixBgm" @change="(state:boolean)=>setMixBgm(state)" /></div>
    </div>
    <div class="menus-span"></div>
    <div class="menus-item">
      <div class="name">实时音量</div>
      <div class="action">
        <div class="action-audio">
          <div>{{ gain }}</div>
          <canvas ref="audio_canvas_ref" class="action-audio-canvas"></canvas>
        </div>
      </div>
    </div>
    <div class="menus-item">
      <div class="name">扬声器音量</div>
      <div class="action" style="padding: 0"><el-slider style="width: 180px; padding: 0 20px" v-model="outputGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setOutputGain(val/100)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">降噪</div>
      <div class="action"><el-switch v-model="denoise" @change="(denoise:boolean)=>prAudio.setDenoise(denoise)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">全部静音</div>
      <div class="action"><el-switch v-model="mute" @change="(mute:boolean)=>prAudio.setMute(mute)" /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import { PrAudioStream } from '../../../src/index'

const props = defineProps({
  pc: {
    type: RTCPeerConnection,
    required: true
  }
})

const audio_bgs_ref = ref()
const audio_bgm_ref = ref()

const gain = ref(0)
const inputGain = ref(100)
const enhanceGain = ref(0)

const bgsGain = ref(100)
const bgmGain = ref(100)

const outputGain = ref(100)

const denoise = ref(false)
const mute = ref(true)

let prAudio: PrAudioStream

let wavesurfer_bgs: WaveSurfer
let wavesurfer_bgm: WaveSurfer

// 始绘制频谱图
const audio_canvas_ref = ref()
const drawSpectrum = () => {
  //开始绘制频谱图
  const canvas = audio_canvas_ref.value
  const ctx = canvas.getContext('2d')!

  //定义一个渐变样式用于画图
  const gradient = ctx.createLinearGradient(0, 0, 0, 300)
  gradient.addColorStop(1, '#0097ff') //低音颜色
  gradient.addColorStop(0.5, '#0097ff') //中音颜色
  gradient.addColorStop(0, '#0097ff') //高音颜色

  //绘制频谱图
  const draw = () => {
    const { analyserNode, analyserArrayData } = prAudio
    const dataArray = analyserArrayData
    // 清空画布
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    // 让分析器节点分析出数据到数组中
    analyserNode.getByteFrequencyData(dataArray)
    // 设置canvas上下文绘制的颜色
    ctx.fillStyle = '#0097ff'
    // len表示获取分析到的音频数据数组长度的
    // 这里除以2.5是剔除不经常出现的高频的部分
    const len = dataArray.length / 2.5
    // barWidth表示每个波形矩形的宽度
    // 这里除以2是为了绘制对称的波形图
    const barWidth = width / len / 2
    for (let i = 0; i < len; i++) {
      // data是8位数组的每个数据，因为是一个字节，即data的值都是 <= 255
      const data = dataArray[i]
      // barHeight表示每个波形矩形的高度，值为单位长度乘canvas容器的高
      const barHeight = (data / 255) * height
      // 绘制点y
      const y = height - barHeight
      // 绘制点x1
      const x1 = i * barWidth + width / 2
      // 绘制点x2
      const x2 = width / 2 - (i + 1) * barWidth
      // 绘制右半部分波形图
      ctx.fillRect(x1, y, barWidth - 2, barHeight)
      // 绘制左半部分波形图
      ctx.fillRect(x2, y, barWidth - 2, barHeight)
    }
  }
  draw()
}

const init = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 48000 }, video: false })
  prAudio = new PrAudioStream(stream)

  // 将流添加至发射器中
  const new_stream = prAudio.getStream()
  const [track] = new_stream.getAudioTracks()
  props.pc.addTransceiver(track, { direction: 'sendonly' })

  // 尝试获取真流并替换假数据流

  const func = () => {
    gain.value = prAudio.getVolume()
    drawSpectrum()
    requestAnimationFrame(func)
  }
  func()

  wavesurfer_bgs = WaveSurfer.create({ container: audio_bgs_ref.value, waveColor: '#0097ff', progressColor: '#666666', height: 32 })
  wavesurfer_bgs.setMuted(true)

  wavesurfer_bgm = WaveSurfer.create({ container: audio_bgm_ref.value, waveColor: '#0097ff', progressColor: '#666666', height: 32 })
  wavesurfer_bgm.setMuted(true)
}

defineExpose({ init })

// 添加音效
const mixBgs = ref(true)
const addbgs = async () => {
  // @ts-ignore
  const [fileHandle] = await window?.showOpenFilePicker({ types: [{ description: '音频类型', accept: { 'audio/*': ['.mp3', '.gif', '.jpeg', '.jpg'] } }] })
  const file = await fileHandle.getFile()

  const arrayBuffer = await file.arrayBuffer()

  const blob = new Blob([arrayBuffer])

  const url = URL.createObjectURL(blob)

  await wavesurfer_bgs.load(url)

  const buffer = wavesurfer_bgs.getDecodedData()

  const loop = 3 // 播放次数
  for (let index = loop; index > 0; index--) {
    wavesurfer_bgs.play()
    await prAudio.mixAudio(buffer, 'bgs')
    await new Promise((resolve) => setTimeout(() => resolve(true), 300))
  }
}
const setMixBgs = (state: boolean) => {
  mixBgs.value = state
  prAudio.changeMix('bgs', state)
}

// 添加音乐
const mixBgm = ref(true)
const addbgm = async () => {
  // @ts-ignore
  const [fileHandle] = await window?.showOpenFilePicker({ types: [{ description: '音频类型', accept: { 'audio/*': ['.mp3', '.gif', '.jpeg', '.jpg'] } }] })
  const file = await fileHandle.getFile()

  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer])
  const url = URL.createObjectURL(blob)
  await wavesurfer_bgm.load(url)

  const buffer = wavesurfer_bgm.getDecodedData()

  const loop = 1 // 播放次数
  for (let index = loop; index > 0; index--) {
    wavesurfer_bgm.play()
    await prAudio.mixAudio(buffer, 'bgm')
    await new Promise((resolve) => setTimeout(() => resolve(true), 300))
  }
}
const setMixBgm = (state: boolean) => {
  mixBgm.value = state
  prAudio.changeMix('bgm', state)
}
</script>
