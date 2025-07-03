<template>
  <div>
    <div class="flex">
      <div class="col">
        <div class="col-name">
          <div>发送端</div>
          <div style="font-size: 14px" :style="[`color: ${pc_local_state === 'connected' ? '#006809' : '#77290a'}`]">{{ pc_local_state }}</div>
        </div>
        <Local ref="pc_local_ref" :pc="pc_local"></Local>
      </div>
      <div class="col">
        <div class="col-name">
          <div>接收端</div>
          <div style="font-size: 14px" :style="[`color: ${pc_local_state === 'connected' ? '#006809' : '#77290a'}`]">{{ pc_remote_state }}</div>
        </div>
        <Remote ref="pc_remote_ref" :pc="pc_remote"></Remote>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import Local from './components/Local.vue'
import Remote from './components/Remote.vue'

const pc_local = new RTCPeerConnection()
const pc_remote = new RTCPeerConnection()

const pc_local_ref = ref()
const pc_remote_ref = ref()

const pc_local_state = ref('')
const pc_remote_state = ref('')

const init = async () => {
  await nextTick()
  // 注册本地webrtc回调
  {
    const onicecandidate = (e: any) => {
      const { candidate } = e
      candidate && pc_remote.addIceCandidate(candidate)
    }
    pc_local.addEventListener('icecandidate', onicecandidate)

    const oniceconnectionstatechange = () => {
      pc_local_state.value = pc_local.iceConnectionState
    }
    pc_local.addEventListener('iceconnectionstatechange', oniceconnectionstatechange)
  }

  // 注册远端webrtc回调
  {
    const onicecandidate = (e: any) => {
      const { candidate } = e
      candidate && pc_local.addIceCandidate(candidate)
    }
    pc_remote.addEventListener('icecandidate', onicecandidate)

    const oniceconnectionstatechange = () => {
      pc_remote_state.value = pc_remote.iceConnectionState
    }
    pc_remote.addEventListener('iceconnectionstatechange', oniceconnectionstatechange)
  }

  await pc_local_ref.value.init()
  await pc_remote_ref.value.init()

  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: 建立连接`)

  const offer = await pc_local.createOffer()

  await pc_local.setLocalDescription(offer) // 创建发送凭证
  await pc_remote.setRemoteDescription(offer) // 本地设置发送凭证

  const answer = await pc_remote.createAnswer() // 远端设置发送凭证
  await pc_remote.setLocalDescription(answer) // 远端创建应答凭证

  await pc_local.setRemoteDescription(answer) // 本地设置应答凭证
}

init()
</script>

<style>
.flex {
  display: flex;
  gap: 20px;
  font-size: 16px;
}
.col {
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
}
.col-name {
  padding: 0 20px;
  height: 48px;
  line-height: 48px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
}

.menus {
  padding: 32px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  gap: 12px;
  font-size: 14px;
}
.menus-item {
  width: 100%;
  height: 32px;
  display: flex;
}
.name {
  margin-right: 20px;
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.action {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.audio-canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.btn {
  padding: 4px 8px;
  margin: auto;
  max-width: 60px;
  line-height: 20px;
  border-radius: 6px;
  background-color: #333333;
  cursor: pointer;
  transition: all 300ms ease-out;
}
.btn:hover {
  background-color: #0097ff;
}
</style>
