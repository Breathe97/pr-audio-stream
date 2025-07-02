<template>
  <div>
    <div class="flex">
      <div class="col">
        <div class="col-name">发送端</div>
        <Local :pc="pc_local"></Local>
      </div>
      <div class="col">
        <div class="col-name">接收端</div>
        <Remote :pc="pc_remote"></Remote>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Local from './components/Local.vue'
import Remote from './components/Remote.vue'

const pc_local = new RTCPeerConnection()
const pc_remote = new RTCPeerConnection()

async function init() {
  // 注册本地webrtc回调
  {
    const onicecandidate = (e: any) => {
      const { candidate } = e
      candidate && pc_remote.addIceCandidate(candidate)
    }
    pc_local.addEventListener('icecandidate', onicecandidate)

    const oniceconnectionstatechange = () => {
      const state = pc_local.iceConnectionState
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->pc_local: state`, state)
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
      const state = pc_remote.iceConnectionState
      console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->pc_remote: state`, state)
    }
    pc_remote.addEventListener('iceconnectionstatechange', oniceconnectionstatechange)
  }

  // 开始创建连接
  pc_local.addTransceiver('audio', { direction: 'sendonly' })

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
  height: 48px;
  line-height: 48px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  flex: 1;
}
</style>
