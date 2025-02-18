<template>
  <div class="game-container">
    <div class="status-bar">
      <div class="gem-counter">
        <span>蓝宝石: <span>{{ gameState.collectedBlueGems }}</span>/<span>{{ gameState.requiredBlueGems }}</span></span>
        <span>红宝石: <span>{{ gameState.collectedRedGems }}</span>/<span>{{ gameState.requiredRedGems }}</span></span>
      </div>
      <div class="exit-status">
        出口状态: <span>{{ gameState.exitOpen ? '开启' : '关闭' }}</span>
      </div>
    </div>
    <div class="maze" :style="mazeGridStyle">
      <div v-for="(row, y) in gameState.maze" :key="y" class="maze-row">
        <div v-for="(cell, x) in row" :key="x" 
             class="cell" 
             :class="{ 'wall': !cell.walkable }">
          <!-- 玩家 -->
          <div v-if="isPlayerPosition(x, y)" 
               class="player"
               :style="playerRotationStyle">
          </div>
          <!-- 蓝宝石 -->
          <div v-if="hasBluGem(x, y)" class="gem blue"></div>
          <!-- 红宝石 -->
          <div v-if="hasRedGem(x, y)" class="gem red"></div>
          <!-- 怪物 -->
          <div v-if="hasMonster(x, y)" class="monster"></div>
          <!-- 出口 -->
          <div v-if="isExit(x, y)" 
               class="exit"
               :class="{ 'open': gameState.exitOpen }">
          </div>
        </div>
      </div>
    </div>
    <div class="controls">
      <button @click="turn('left')">左转</button>
      <button @click="move">前进</button>
      <button @click="turn('right')">右转</button>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
  requiredRedGems: 0
})

// Toast消息
const toast = ref('')

// 计算属性
const mazeGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gameState.value.maze[0]?.length || 0}, 40px)`
}))

const playerRotationStyle = computed(() => ({
  transform: `translate(-50%, -50%) rotate(${gameState.value.playerDirection * 90}deg)`
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

const showToast = (message) => {
  toast.value = message
  setTimeout(() => {
    toast.value = ''
  }, 2000)
}

// 事件处理函数
const handleRenderGameState = (event, state) => {
  gameState.value = state
}

const handleShowToast = (event, message) => {
  showToast(message)
}

// 监听服务器消息
onMounted(() => {
  ipcRenderer.on('renderGameState', handleRenderGameState)
  ipcRenderer.on('showToast', handleShowToast)

  // 初始化游戏
  fetch('http://localhost:3000/resetGame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(error => {
    console.error('重置游戏失败:', error)
  })
})

// 清理事件监听
onUnmounted(() => {
  ipcRenderer.removeListener('renderGameState', handleRenderGameState)
  ipcRenderer.removeListener('showToast', handleShowToast)
})
</script>

<style scoped>
.maze-row {
  display: contents;
}
</style> 