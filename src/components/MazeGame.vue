<template>
  <div class="game-container">
    <div class="status-bar">
      <div class="gem-counter">
        <div v-if="gameState.requiredBlueGems > 0" class="gem-count">
          <div class="gem-icon blue"></div>
          <span>{{ gameState.collectedBlueGems }}/{{ gameState.requiredBlueGems }}</span>
        </div>
        <div v-if="gameState.requiredRedGems > 0" class="gem-count">
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
      <el-button @click="turn('left')" type="primary" plain>
        <el-icon>
          <ArrowLeft />
        </el-icon>
        左转
      </el-button>
      <el-button @click="move" type="primary">
        前进
      </el-button>
      <el-button @click="turn('right')" type="primary" plain>
        <el-icon>
          <ArrowRight />
        </el-icon>
        右转
      </el-button>
      <el-button v-if="!gameState.autoCollect" @click="collectBlueGem" type="success">
        <div class="gem-icon blue"></div>
        收集蓝宝石
      </el-button>
      <el-button v-if="!gameState.autoCollect" @click="collectRedGem" type="success">
        <div class="gem-icon red"></div>
        收集红宝石
      </el-button>
      <el-button @click="resetGame" type="danger">
        <el-icon>
          <RefreshRight />
        </el-icon>
        重置游戏
      </el-button>
    </div>
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

const resetGame = async () => {
  await fetch('http://localhost:3000/resetGame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
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


// 监听服务器消息
onMounted(async () => {
  console.log('组件已挂载')
  ipcRenderer.on('renderGameState', handleRenderGameState)
  // 初始化游戏
  await initGame()
})

// 清理事件监听
onUnmounted(() => {
  ipcRenderer.removeListener('renderGameState', handleRenderGameState)
  // 停止背景音乐
  bgm.value.pause()
  bgm.value.currentTime = 0
})
</script>

<style scoped>
.maze-row {
  display: contents;
}

.maze {
  display: grid;
  gap: 2px;
  background-color: #333;
  padding: 2px;
  border-radius: 5px;
  margin: 20px 0;
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

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
}

.cell {
  width: 40px;
  height: 40px;
  background-color: white;
  position: relative;
}

.cell.wall {
  background-color: #333;
}
</style>