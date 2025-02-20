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
    
    <div ref="container" class="game-view"></div>

    <div class="controls">
      <el-button @click="turn('left')" type="primary" plain>
        <el-icon><ArrowLeft /></el-icon>
        左转
      </el-button>
      <el-button @click="move" type="primary">
        <el-icon><ArrowUp /></el-icon>
        前进
      </el-button>
      <el-button @click="turn('right')" type="primary" plain>
        <el-icon><ArrowRight /></el-icon>
        右转
      </el-button>
      <el-button v-if="!gameState.autoCollect" @click="collectBlueGem" type="info">
        <el-icon><Collection /></el-icon>
        收集蓝宝石
      </el-button>
      <el-button v-if="!gameState.autoCollect" @click="collectRedGem" type="danger">
        <el-icon><Collection /></el-icon>
        收集红宝石
      </el-button>
      <el-button @click="resetGame" type="warning">
        <el-icon><RefreshRight /></el-icon>
        重置游戏
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
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

// Three.js 相关变量
const container = ref(null)
let scene, camera, renderer, controls
let player, walls = [], blueGemMeshes = [], redGemMeshes = [], monsterMeshes = [], exitMesh

// 初始化Three.js场景
const initThreeJS = async () => {
  // 创建场景
  scene = new THREE.Scene()

  // 创建相机
  camera = new THREE.PerspectiveCamera(75, container.value.clientWidth / container.value.clientHeight, 0.1, 1000)
  camera.position.set(5, 5, 10)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputEncoding = THREE.sRGBEncoding
  container.value.appendChild(renderer.domElement)

  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // 加载EXR环境贴图
  const exrLoader = new EXRLoader()
  exrLoader.setDataType(THREE.FloatType)
  const envMap = await exrLoader.loadAsync(new URL('@/assets/textures/autumn_field_puresky_4k.exr', import.meta.url).href)
  envMap.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = envMap
  scene.background = envMap

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  scene.add(directionalLight)

  // 创建玩家
  const playerGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const playerMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    metalness: 0.7,
    roughness: 0.3
  })
  player = new THREE.Mesh(playerGeometry, playerMaterial)
  player.position.y = 1.5
  scene.add(player)

  // 动画循环
  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}

// 更新场景
const updateScene = () => {
  if (!scene) return

  // 清除旧的物体
  walls.forEach(wall => scene.remove(wall))
  blueGemMeshes.forEach(gem => scene.remove(gem))
  redGemMeshes.forEach(gem => scene.remove(gem))
  monsterMeshes.forEach(monster => scene.remove(monster))
  if (exitMesh) scene.remove(exitMesh)

  walls = []
  blueGemMeshes = []
  redGemMeshes = []
  monsterMeshes = []

  // 创建墙壁
  const wallGeometry = new THREE.BoxGeometry(1, 1, 1)
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffb5,
    metalness: 0.6,
    roughness: 0.2
  })

  gameState.value.maze.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell.walkable) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial)
        wall.position.set(x - gameState.value.maze[0].length / 2, 0.5, y - gameState.value.maze.length / 2)
        scene.add(wall)
        walls.push(wall)
      }
    })
  })

  // 创建宝石
  const gemGeometry = new THREE.SphereGeometry(0.2, 32, 32)
  const blueGemMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x0000ff,
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1.5
  })
  const redGemMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000,
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1.5
  })

  gameState.value.blueGems.forEach(gem => {
    const blueMesh = new THREE.Mesh(gemGeometry, blueGemMaterial)
    blueMesh.position.set(
      gem.x - gameState.value.maze[0].length / 2,
      0.5,
      gem.y - gameState.value.maze.length / 2
    )
    scene.add(blueMesh)
    blueGemMeshes.push(blueMesh)
  })

  gameState.value.redGems.forEach(gem => {
    const redMesh = new THREE.Mesh(gemGeometry, redGemMaterial)
    redMesh.position.set(
      gem.x - gameState.value.maze[0].length / 2,
      0.5,
      gem.y - gameState.value.maze.length / 2
    )
    scene.add(redMesh)
    redGemMeshes.push(redMesh)
  })

  // 创建怪物
  const monsterGeometry = new THREE.ConeGeometry(0.3, 0.8, 32)
  const monsterMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff6600,
    metalness: 0.5,
    roughness: 0.5,
    envMapIntensity: 1
  })

  gameState.value.monsters.forEach(monster => {
    const monsterMesh = new THREE.Mesh(monsterGeometry, monsterMaterial)
    monsterMesh.position.set(
      monster.x - gameState.value.maze[0].length / 2,
      0.4,
      monster.y - gameState.value.maze.length / 2
    )
    scene.add(monsterMesh)
    monsterMeshes.push(monsterMesh)
  })

  // 创建出口
  const exitGeometry = new THREE.BoxGeometry(1, 1, 0.1)
  const exitMaterial = new THREE.MeshStandardMaterial({
    color: gameState.value.exitOpen ? 0x00ff00 : 0xff0000,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.7,
    envMapIntensity: 1.2
  })
  exitMesh = new THREE.Mesh(exitGeometry, exitMaterial)
  exitMesh.position.set(
    gameState.value.exit.x - gameState.value.maze[0].length / 2,
    0.5,
    gameState.value.exit.y - gameState.value.maze.length / 2
  )
  scene.add(exitMesh)

  // 更新玩家位置和旋转
  player.position.x = gameState.value.playerPosition.x - gameState.value.maze[0].length / 2
  player.position.z = gameState.value.playerPosition.y - gameState.value.maze.length / 2
  player.rotation.y = -gameState.value.playerDirection * Math.PI / 2
}

// 监听窗口大小变化
const handleResize = () => {
  if (!container.value || !camera || !renderer) return
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
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

// 监听游戏状态变化
watch(() => gameState.value, () => {
  updateScene()
}, { deep: true })

// 组件挂载
onMounted(async () => {
  console.log('组件已挂载')
  ipcRenderer.on('renderGameState', handleRenderGameState)
  window.addEventListener('resize', handleResize)

  // 初始化Three.js
  initThreeJS()

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

// 组件卸载
onUnmounted(() => {
  ipcRenderer.removeListener('renderGameState', handleRenderGameState)
  window.removeEventListener('resize', handleResize)
  
  // 清理Three.js资源
  if (renderer) {
    renderer.dispose()
    container.value?.removeChild(renderer.domElement)
  }
  if (controls) {
    controls.dispose()
  }
})
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1200px;
}

.game-view {
  width: 100%;
  height: 600px;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--el-bg-color);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
}

.gem-counter {
  display: flex;
  gap: 20px;
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
</style> 