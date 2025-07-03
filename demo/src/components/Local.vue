<template>
  <div class="menus">
    <div class="menus-item">
      <div class="name">实时音量</div>
      <div class="action">{{ gain }}</div>
    </div>
    <div class="menus-item">
      <div class="name">麦克风输入</div>
      <div class="action"><el-slider style="width: 180px; padding: 0 20px" v-model="inputGain" :format-tooltip="(val:number)=>`${val}%`" @change="(val:number) => prAudio.setInputGain(val/100)" /></div>
    </div>
    <div class="menus-item">
      <div class="name">麦克风增强</div>
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
const mute = ref(true)

let prAudio: PrAudioStream

const init = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  prAudio = new PrAudioStream(stream)

  // 将流添加至发射器中
  const new_stream = prAudio.getStream()
  const [track] = new_stream.getAudioTracks()
  props.pc.addTransceiver(track, { direction: 'sendonly' })

  // 尝试获取真流并替换假数据流

  const func = () => {
    gain.value = prAudio.getVolume()
    requestAnimationFrame(func)
  }
  func()
}

defineExpose({ init })
</script>
