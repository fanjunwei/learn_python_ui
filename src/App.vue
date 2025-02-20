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
import { ref, onMounted } from 'vue'
import MazeGame from './components/MazeGame.vue'
import MazeGame3D from './components/MazeGame3D.vue'
import MapEditor from './components/MapEditor.vue'
const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

const currentView = ref('game')
// 背景音乐
const bgm = ref(new Audio(new URL('@/assets/audio/bgm.mp3', import.meta.url).href))
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

const handlePlayAudio = (event, audioType) => {
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
      bgm.value.volume = 1
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
onMounted(async () => {
  ipcRenderer.on('playAudio', handlePlayAudio)
})

</script>

<style>
.app-container {
  min-height: 100vh;
}
</style>