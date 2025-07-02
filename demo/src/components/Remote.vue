<template>
  <div class="menus">
    <div class="menus-item">
      <div class="name">实时音量</div>
      <div class="action">{{ gain }}</div>
    </div>
    <div class="menus-item">
      <div class="name">音频输入</div>
      <div class="action"><el-slider style="width: 180px; padding: 0 20px" v-model="inputGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setInputGain(val/100)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">音频增强</div>
      <div class="action"><el-slider style="width: 180px; padding: 0 20px" v-model="enhanceGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setEnhanceGain(val/100)" :max="200" /></div>
    </div>
    <div class="menus-item">
      <div class="name">扬声器输出</div>
      <div class="action"><el-slider style="width: 180px; padding: 0 20px" v-model="outputGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setOutputGain(val/100)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">静音</div>
      <div class="action"><el-switch v-model="mute" @change="(mute:boolean)=>prAudio.setMute(mute)" /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PrAudioStream } from '../../../src/index'

const props = defineProps({
  pc: {
    type: RTCPeerConnection,
    required: true
  }
})

const gain = ref(0)
const inputGain = ref(100)
const enhanceGain = ref(0)
const outputGain = ref(100)
const mute = ref(false)

let prAudio: PrAudioStream

const init = async () => {
  // 监听远端轨道
  const ontrack = async (e: any) => {
    const { track } = e
    console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: ontrack`, track)
    // const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const stream = new MediaStream()
    stream.addTrack(track)

    prAudio = new PrAudioStream(stream)
    prAudio.setMute(false) // 取消静音

    const func = () => {
      gain.value = prAudio.getVolume()
      requestAnimationFrame(func)
    }
    func()
  }
  props.pc.addEventListener('track', ontrack)
}

init()
</script>
