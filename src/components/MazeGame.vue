<template>
  <div class="game-container">
    <div class="status-bar">
      <div class="gem-counter">
        <div class="gem-count">
          <div class="gem-icon blue"></div>
          <span>{{ gameState.collectedBlueGems }}/{{ gameState.requiredBlueGems }}</span>
        </div>
        <div class="gem-count">
          <div class="gem-icon red"></div>
          <span>{{ gameState.collectedRedGems }}/{{ gameState.requiredRedGems }}</span>
        </div>
      </div>
      <div class="exit-status">
        出口状态: <span>{{ gameState.exitOpen ? '开启' : '关闭' }}</span>
      </div>
    </div>
    <div id="maze" class="maze" :style="mazeGridStyle">
      <template v-if="gameState.maze && gameState.maze.length > 0">
        <div v-for="(row, y) in gameState.maze" :key="y" class="maze-row">
          <div v-for="(cell, x) in row" :key="x" class="cell" :class="{ 'wall': !cell.walkable }">
            <!-- 蓝宝石 -->
            <div v-if="hasBluGem(x, y)" class="gem blue"></div>
            <!-- 红宝石 -->
            <div v-if="hasRedGem(x, y)" class="gem red"></div>
            <!-- 怪物 -->
            <div v-if="hasMonster(x, y)" class="monster"></div>
            <!-- 出口 -->
            <div v-if="isExit(x, y)" class="gate" :class="{ 'open': gameState.exitOpen }">
            </div>
            <!-- 玩家 -->
            <div v-if="isPlayerPosition(x, y) && !gameState.gameOver" :class="playerClass">
            </div>

          </div>
        </div>
      </template>
    </div>
    <div class="controls">
      <button @click="turn('left')">左转</button>
      <button @click="move">前进</button>
      <button @click="turn('right')">右转</button>
      <button v-if="!gameState.autoCollect" @click="collectBlueGem">收集蓝宝石</button>
      <button v-if="!gameState.autoCollect" @click="collectRedGem">收集红宝石</button>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

// 游戏状态
const gameState = ref({
  maze: [],
  playerPosition: { x: 0, y: 0 },
  playerDirection: 0,
  blueGems: [],
  redGems: [],
  monsters: [],
  exit: { x: 0, y: 0 },
  exitOpen: false,
  collectedBlueGems: 0,
  collectedRedGems: 0,
  requiredBlueGems: 0,
  requiredRedGems: 0,
  gameOver: null,
  success: false,
  onGemType: 'none',
  autoCollect: false,
})

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

// 监听游戏状态变化
watch(() => gameState.value.gameOver, (newValue) => {
  console.log('游戏状态变化:', newValue)
  if (newValue) {
    if (!bgm.value.paused) {
      fadeOutBgm()
    }
  } else {
    if (bgm.value.paused) {
      bgm.value.volume = 1
      bgm.value.currentTime = 0
      bgm.value.play().catch(error => {
        console.warn('背景音乐播放失败:', error)
      })
    }
  }
})

// Toast消息
const toast = ref('')

// 显示提示消息
const showToast = (message) => {
  toast.value = message
  setTimeout(() => {
    toast.value = ''
  }, 2000)
}

// 计算属性
const mazeGridStyle = computed(() => {
  const cols = gameState.value.maze[0]?.length || 0
  console.log('迷宫列数:', cols)
  return cols ? {
    gridTemplateColumns: `repeat(${cols}, 40px)`,
    display: 'grid'
  } : {}
})

const playerClass = computed(() => ({
  'sprite': true,
  'up': gameState.value.playerDirection === 0,
  'right': gameState.value.playerDirection === 1,
  'down': gameState.value.playerDirection === 2,
  'left': gameState.value.playerDirection === 3,
}))

// 辅助函数
const isPlayerPosition = (x, y) => {
  return x === gameState.value.playerPosition.x && y === gameState.value.playerPosition.y
}

const hasBluGem = (x, y) => {
  return gameState.value.blueGems.some(g => g.x === x && g.y === y)
}

const hasRedGem = (x, y) => {
  return gameState.value.redGems.some(g => g.x === x && g.y === y)
}

const hasMonster = (x, y) => {
  return gameState.value.monsters.some(m => m.x === x && m.y === y)
}

const isExit = (x, y) => {
  return x === gameState.value.exit.x && y === gameState.value.exit.y
}

// 游戏操作
const move = async () => {
  try {
    await fetch('http://localhost:3000/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forward' })
    })
  } catch (error) {
    console.error('移动操作失败:', error)
  }
}

const turn = async (direction) => {
  try {
    await fetch('http://localhost:3000/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: direction === 'left' ? 'turnLeft' : 'turnRight'
      })
    })
  } catch (error) {
    console.error('转向操作失败:', error)
  }
}

const collectBlueGem = async () => {
  await fetch('http://localhost:3000/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'collect_blue' })
  })
}

const collectRedGem = async () => {
  await fetch('http://localhost:3000/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'collect_red' })
  })
}
// 初始化游戏
const initGame = async () => {
  try {
    console.log('开始初始化游戏...')
    const response = await fetch('http://localhost:3000/resetGame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await response.json()
    console.log('初始化游戏响应:', data)
    if (data.success) {
      console.log('更新游戏状态:', data.gameState)
      gameState.value = data.gameState
    }
  } catch (error) {
    console.error('初始化游戏失败:', error)
  }
}

// 事件处理函数
const handleRenderGameState = (event, state) => {
  console.log('收到游戏状态更新:', state)
  if (state && state.maze) {
    console.log('迷宫数据:', state.maze)
    gameState.value = state
  } else {
    console.warn('收到无效的游戏状态:', state)
  }
}

const handleShowToast = (event, message) => {
  showToast(message)
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
  }
}
// 监听服务器消息
onMounted(async () => {
  console.log('组件已挂载')
  ipcRenderer.on('renderGameState', handleRenderGameState)
  ipcRenderer.on('showToast', handleShowToast)
  ipcRenderer.on('playAudio', handlePlayAudio)

  // 初始化游戏
  await initGame()

  // 获取当前游戏状态
  try {
    const response = await fetch('http://localhost:3000/getGameState')
    const data = await response.json()
    console.log('获取游戏状态响应:', data)
    if (data.success) {
      gameState.value = data.gameState
    }
  } catch (error) {
    console.error('获取游戏状态失败:', error)
  }
})

// 清理事件监听
onUnmounted(() => {
  ipcRenderer.removeListener('renderGameState', handleRenderGameState)
  ipcRenderer.removeListener('showToast', handleShowToast)
  // 停止背景音乐
  bgm.value.pause()
  bgm.value.currentTime = 0
})
</script>

<style scoped>
.maze-row {
  display: contents;
}

.controls button {
  background-color: #4CAF50;
  color: white;
}

.controls button:hover {
  background-color: #45a049;
}

.maze {
  border: 1px solid #ccc;
}

.sprite {
  position: absolute;
  width: 40px;
  height: 40px;
  background-image: url('@/assets/dog_sprite.png');
  background-repeat: no-repeat;
  background-size: 160px 160px;
}

.sprite.down {
  animation: play_down 1.5s steps(4) infinite;
}

.sprite.up {
  animation: play_up 1.5s steps(4) infinite;
}

.sprite.left {
  animation: play_left 1.5s steps(4) infinite;
}

.sprite.right {
  animation: play_right 1.5s steps(4) infinite;
}

@keyframes play_down {
  from {
    background-position: 0 0;
    /* 从第一帧开始 */
  }

  to {
    background-position: -160px 0;
    /* 到最后一帧结束 */
  }
}

@keyframes play_up {
  from {
    background-position: 0 -80px;
    /* 从第一帧开始 */
  }

  to {
    background-position: -160px -80px;
    /* 到最后一帧结束 */
  }
}

@keyframes play_left {
  from {
    background-position: 0 -40px;
    /* 从第一帧开始 */
  }

  to {
    background-position: -160px -40px;
    /* 到最后一帧结束 */
  }
}

@keyframes play_right {
  from {
    background-position: 0 -120px;
    /* 从第一帧开始 */
  }

  to {
    background-position: -160px -120px;
    /* 到最后一帧结束 */
  }
}

.gem {
  position: absolute;
  width: 40px;
  height: 40px;
  background-image: url('@/assets/gem.png');
  background-repeat: no-repeat;
  background-size: 80px 40px;
}

.gem.red {
  background-position: 0 0;
}

.gem.blue {
  background-position: -40px 0;
}

.monster {
  position: absolute;
  width: 40px;
  height: 40px;
  background-image: url('@/assets/monster.png');
  background-repeat: no-repeat;
  background-size: 160px 160px;
  animation: play_monster 1.5s steps(4) infinite;
}

@keyframes play_monster {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -160px 0;
  }
}

.gate {
  position: absolute;
  width: 40px;
  height: 40px;
  background-image: url('@/assets/gate.png');
  background-repeat: no-repeat;
  background-size: 40px 160px;
  background-position: 0 0;
}

.gate.open {
  background-position: 0 -120px;
}

.gem-counter {
  display: flex;
  gap: 20px;
  align-items: center;
}

.gem-count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gem-icon {
  width: 24px;
  height: 24px;
  background-image: url('@/assets/gem.png');
  background-repeat: no-repeat;
  background-size: 48px 24px;
}

.gem-icon.red {
  background-position: 0 0;
}

.gem-icon.blue {
  background-position: -24px 0;
}

.gem-count span {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}
</style>