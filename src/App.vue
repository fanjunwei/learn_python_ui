<template>
  <el-container class="app-container">
    <el-header>
      <el-menu mode="horizontal" :ellipsis="false" class="nav-menu" :default-active="currentView">
        <el-menu-item index="game" @click="currentView = 'game'">
          <el-icon>
            <GameController />
          </el-icon>
          <span>游戏</span>
        </el-menu-item>
        <el-menu-item index="game3d" @click="currentView = 'game3d'">
          <el-icon>
            <GameController />
          </el-icon>
          <span>3D游戏</span>
        </el-menu-item>
        <el-menu-item index="editor" @click="currentView = 'editor'">
          <el-icon>
            <Edit />
          </el-icon>
          <span>地图编辑器</span>
        </el-menu-item>
        <div class="flex-spacer"></div>
        <div v-if="currentView !== 'editor'" class="game-settings">
          <div class="button-block">
            <el-button type="primary" @click="loadMap">加载地图</el-button>
          </div>
          速度：
          <div class="slider-block">
            <el-slider v-model="speed" :min="0" :max="100" :step="1" @change="handleSpeedChange" />
          </div>
          <div class="mute-switch">
            静音：
            <el-switch v-model="isMuted" @change="handleMuteChange" active-text="开" inactive-text="关"
              style="margin-left: 8px" />
          </div>
        </div>
      </el-menu>
    </el-header>
    <el-main>
      <MazeGame v-show="currentView === 'game'" />
      <MazeGame3D v-show="currentView === 'game3d'" />
      <MapEditor v-show="currentView === 'editor'" />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MazeGame from './components/MazeGame.vue'
import MazeGame3D from './components/MazeGame3D.vue'
import MapEditor from './components/MapEditor.vue'
import { ElMessage } from 'element-plus'
const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

const currentView = ref('game3d')
const speed = ref(0)
// 背景音乐
const bgm = ref(new Audio(new URL('@/assets/audio/bgm2.mp3', import.meta.url).href))
bgm.value.loop = true
const getGemAudio = ref(new Audio(new URL('@/assets/audio/get_gem.mp3', import.meta.url).href))
const getMonsterAudio = ref(new Audio(new URL('@/assets/audio/get_monster.mp3', import.meta.url).href))
const completeAudio = ref(new Audio(new URL('@/assets/audio/complete.mp3', import.meta.url).href))
const errorAudio = ref(new Audio(new URL('@/assets/audio/error.mp3', import.meta.url).href))
// 淡出背景音乐
const fadeOutBgm = () => {
  const fadeOutInterval = 50 // 每50毫秒调整一次音量
  const fadeOutStep = 0.05 // 每次减小0.05
  const fadeOutDuration = 1000 // 总共1秒完成淡出

  let currentVolume = bgm.value.volume
  const steps = fadeOutDuration / fadeOutInterval

  const interval = setInterval(() => {
    currentVolume = Math.max(0, currentVolume - fadeOutStep)
    bgm.value.volume = currentVolume

    if (currentVolume <= 0) {
      clearInterval(interval)
      bgm.value.pause()
      bgm.value.currentTime = 0
      bgm.value.volume = 1 // 重置音量为默认值
    }
  }, fadeOutInterval)
}

const isMuted = ref(false)

// 保存设置到本地存储
const saveSettings = () => {
  const settings = {
    speed: speed.value,
    isMuted: isMuted.value
  }
  localStorage.setItem('gameSettings', JSON.stringify(settings))
}

// 从本地存储加载设置
const loadSettings = () => {
  const settings = localStorage.getItem('gameSettings')
  if (settings) {
    const { speed: savedSpeed, isMuted: savedMuted } = JSON.parse(settings)
    speed.value = savedSpeed
    isMuted.value = savedMuted
    // 应用加载的设置
    handleSpeedChange(speed.value)
    handleMuteChange(isMuted.value)
  }
}

const handleSpeedChange = (value) => {
  fetch('http://localhost:3000/setSpeed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed: value })
  })
  saveSettings()
}

const resetGame = async (config) => {
  await fetch('http://localhost:3000/resetGame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: config })
  })
}

const handleMuteChange = (value) => {
  if (value) {
    // 静音
    bgm.value.volume = 0
    getGemAudio.value.volume = 0
    getMonsterAudio.value.volume = 0
    completeAudio.value.volume = 0
    errorAudio.value.volume = 0
  } else {
    // 取消静音
    bgm.value.volume = 1
    getGemAudio.value.volume = 1
    getMonsterAudio.value.volume = 1
    completeAudio.value.volume = 1
    errorAudio.value.volume = 1
  }
  saveSettings()
}

const handlePlayAudio = (event, audioType) => {

  if (isMuted.value && audioType !== 'play_bgm') {
    return
  }

  if (audioType === 'gem') {
    if (getGemAudio.value.played) {
      getGemAudio.value.pause()
    }
    getGemAudio.value.play()
  } else if (audioType === 'monster') {
    if (getMonsterAudio.value.played) {
      getMonsterAudio.value.pause()
    }
    getMonsterAudio.value.play()
  } else if (audioType === 'complete') {
    if (completeAudio.value.played) {
      completeAudio.value.pause()
    }
    completeAudio.value.play()
  } else if (audioType === 'error') {
    if (errorAudio.value.played) {
      errorAudio.value.pause()
    }
    errorAudio.value.play()
  } else if (audioType === 'play_bgm') {
    if (bgm.value.paused) {
      bgm.value.volume = isMuted.value ? 0 : 1
      bgm.value.currentTime = 0
      bgm.value.play().catch(error => {
        console.warn('背景音乐播放失败:', error)
      })
    }
  } else if (audioType === 'stop_bgm') {
    if (!bgm.value.paused) {
      fadeOutBgm()
    }
  }
}
const loadMap = async () => {
  try {
    const result = await ipcRenderer.invoke('load-map')
    if (result.success) {
      const config = result.data
      config.maze = config.maze.map(row => row.map(cell => ({ walkable: cell })))
      resetGame(config)
      ElMessage.success('地图加载成功！')
    } else if (result.message) {
      ElMessage.error('加载失败：' + result.message)
    }
  } catch (error) {
    ElMessage.error('加载失败：' + error.message)
  }
}
const handleShowToast = (event, message, type) => {
  if (!type) {
    type = 'success'
  }
  if (type === 'success') {
    ElMessage.success(message)
  } else if (type === 'error') {
    ElMessage.error(message)
  }
}
onMounted(async () => {
  ipcRenderer.on('playAudio', handlePlayAudio)
  ipcRenderer.on('showToast', handleShowToast)
  loadSettings() // 加载保存的设置
})
onUnmounted(() => {
  ipcRenderer.removeListener('playAudio', handlePlayAudio)
  ipcRenderer.removeListener('showToast', handleShowToast)

})
</script>

<style>
.app-container {
  min-height: 100vh;
}

.flex-spacer {
  flex: 1;
}

.mute-switch {
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.el-menu {
  display: flex !important;
  align-items: center;
}

.slider-block {
  margin-left: 12px;
  margin-right: 20px;
  width: 100px;
}

.button-block {
  margin-right: 10px;
}

.game-settings {
  display: flex;
  align-items: center;
  margin-right: 10px;
}
</style>