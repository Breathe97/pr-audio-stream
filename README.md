# pr-audio-stream

> Fast and efficient processing of audio streams in the browser. 基于 Web Audio API 的音频流处理库。

[![npm version](https://img.shields.io/npm/v/pr-audio-stream)](https://www.npmjs.com/package/pr-audio-stream)
[![GitHub](https://img.shields.io/github/license/Breathe97/pr-audio-stream)](https://github.com/Breathe97/pr-audio-stream)

## 简介

`pr-audio-stream` 是一个基于 Web Audio API 的浏览器音频流处理库，提供完整的音频处理管线：

- **音量控制** — 麦克风输入、增强、音效(BGS)、背景音乐(BGM)、扬声器输出，五路独立音量控制
- **音频融合** — 支持即时音效(BGS)和背景音乐(BGM)与麦克风输入混合
- **噪音抑制** — 集成 [pr-rnnoise](https://www.npmjs.com/package/pr-rnnoise) 实现实时降噪
- **静音保活** — 静音时自动填充非空音频数据，确保音频流持续活跃（WebRTC 场景下避免轨道休眠）
- **音频分析** — 内置频谱分析器，实时获取音量/频域数据
- **频谱可视化** — 通过 AnalyserNode 支持自定义频谱绘制
- **完整生命周期** — 创建、暂停、替换轨道、销毁等完备的 API

## 安装

```bash
npm i pr-audio-stream
```

## 快速开始

```ts
import { PrAudioStream } from 'pr-audio-stream'

// 获取麦克风流
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 },
  video: false
})

// 创建音频流处理器
const prAudio = new PrAudioStream(stream)

// 获取处理后的音频流（可用于 WebRTC 发送）
const outputStream = prAudio.getStream()
```

## API

### 构造函数

```ts
new PrAudioStream(stream: MediaStream)
```

创建一个新的音频流处理器实例，自动构建完整的音频图（AudioGraph）。

**音频图拓扑：**

```
sourceNode → inputGainNode → enhanceGainNode ─┬─→ analyserNode
                                                ├─→ destinationNode → outputStream
                                                └─→ outputGainNode → audioContext.destination
bgsGainNode ───────────────────────────────────┬─→ analyserNode
                                                └─→ destinationNode
bgmGainNode ───────────────────────────────────┬─→ analyserNode
                                                └─→ destinationNode
```

### 音量控制

| 方法 | 说明 | 范围 |
|------|------|------|
| `setInputGain(gain)` | 设置麦克风输入音量 | 0~1 |
| `setEnhanceGain(gain)` | 设置麦克风增强音量（1+x） | 0~1 |
| `setBgsGain(gain)` | 设置音效(BGS)音量 | 0~1 |
| `setBgmGain(gain)` | 设置背景音乐(BGM)音量 | 0~1 |
| `setOutputGain(gain)` | 设置扬声器（本地监听）音量 | 0~1 |

### 功能控制

| 方法 | 说明 |
|------|------|
| `setDenoise(state)` | 开启/关闭实时降噪（需先调用 `use()` 注入 `pr-rnnoise`） |
| `setMute(state)` | 静音/取消静音（控制本地扬声器输出） |
| `setNotEmpty(state)` | 开启/关闭静音保活（静音时填充非空音频数据） |
| `replaceTrack(track)` | 替换麦克风轨道 |
| `pause(pause)` | 暂停/恢复音频采集 |
| `getStream()` | 获取处理后的输出流 |
| `getVolume()` | 获取当前音量值（0~255） |
| `stop()` | 停止音频采集 |
| `destroy()` | 完全销毁所有资源，关闭 AudioContext |
| `use({ rnnoise })` | 注入降噪插件 |

### 音频融合

```ts
// 播放音效（BGS）
await prAudio.mixAudio(audioBuffer, 'bgs')

// 播放背景音乐（BGM）
await prAudio.mixAudio(audioBuffer, 'bgm')

// 停止
prAudio.mixAudioStop('bgs')

// 控制融合开关
prAudio.changeMix('bgm', true)  // 开启融合
prAudio.changeMix('bgm', false) // 关闭融合
```

### 音频分析

```ts
// 获取实时音量值
const volume = prAudio.getVolume()

// 访问分析器节点和频域数据
const { analyserNode, analyserArrayData } = prAudio
analyserNode.getByteFrequencyData(analyserArrayData)
// analyserArrayData 为 Uint8Array，包含频率分布数据
```

## 降噪功能

需要额外安装 [pr-rnnoise](https://www.npmjs.com/package/pr-rnnoise) 包：

```bash
npm i pr-rnnoise
```

```ts
import { PrAudioStream } from 'pr-audio-stream'
import { prRnnoise } from 'pr-rnnoise'

const prAudio = new PrAudioStream(stream)
prAudio.use({ rnnoise: prRnnoise })

// 开启降噪
await prAudio.setDenoise(true)

// 关闭降噪
await prAudio.setDenoise(false)
```

## 静音保活

在 WebRTC 通信中，当麦克风静音时，浏览器可能会因轨道无数据而触发休眠或降低编码码率。
`setNotEmpty(true)` 开启后，通过 AudioWorklet 在静音时段自动生成低能量的频域数据（仅保留 bin 0~4），保持音频流活跃。

```ts
// 开启
await prAudio.setNotEmpty(true)

// 关闭
await prAudio.setNotEmpty(false)
```

## 与 WebRTC 集成

```ts
const pc = new RTCPeerConnection()

// 发送端 - 将处理后的音频流通过 WebRTC 发送
const prAudio = new PrAudioStream(micStream)
const outputStream = prAudio.getStream()
const [track] = outputStream.getAudioTracks()
pc.addTransceiver(track, { direction: 'sendonly' })

// 接收端 - 处理远端音频
pc.addEventListener('track', (e) => {
  const stream = new MediaStream()
  stream.addTrack(e.track)
  const prAudio = new PrAudioStream(stream)
  prAudio.setMute(false) // 取消静音以监听
})
```

## 项目结构

```
pr-audio-stream/
├── src/
│   ├── index.ts                 # 入口文件
│   ├── PrAudioStream.ts         # 核心音频处理类
│   ├── vite-env.d.ts            # Vite 类型声明
│   └── worklets/
│       └── NotEmptyFilter.ts    # 静音保活 AudioWorklet 封装
├── public/
│   └── not-empty-filter/
│       └── not-empty-filter.js  # 静音保活 AudioWorkletProcessor
├── demo/                        # Vue 3 演示应用
│   ├── src/
│   │   ├── App.vue              # 主页面（WebRTC 对等连接）
│   │   ├── components/
│   │   │   ├── Local.vue        # 发送端（麦克风 → 处理 → 发送）
│   │   │   └── Remote.vue       # 接收端（接收 → 处理 → 播放）
│   │   └── main.ts              # 入口（Element Plus 集成）
│   └── package.json
├── package.json
├── tsconfig.json
└── vite.config.ts               # Vite 库模式构建配置
```

## 开发

```bash
# 构建库
npm run build

# 启动演示应用
cd demo
npm run dev
```

## 许可证

MIT

## 代码仓库

[github](https://github.com/breathe97/pr-tools)

## 贡献

breathe
