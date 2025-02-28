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
      <div class="level-info">
        当前层级: {{ gameState.currentLevel + 1 }}
      </div>
      <div class="exit-status">
        出口状态: <span>{{ gameState.exitOpen ? '开启' : '关闭' }}</span>
      </div>
    </div>

    <div ref="container" class="game-view">
      加载中...
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
import gsap from 'gsap'
import Player3DModel from '@/func/player_3dmodel'
import Monster3DModel from '@/func/monster_3dmodel'
import Gem3DModel from '@/func/gem_3dmodel'
import Teleport3DModel from '@/func/teleport_3dmodel'
import FloorTile3DModel from '@/func/floortile_3dmodel'
import Exit3DModel from '@/func/exit_3dmodel'
const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

// 游戏状态
const gameState = ref({
  maze: [],
  playerPosition: { x: 0, y: 0, level: 0 },
  currentLevel: 0,
  playerDirection: 0,
  blueGems: [],
  redGems: [],
  monsters: [],
  exit: { x: 0, y: 0, level: 0 },
  exitOpen: false,
  collectedBlueGems: 0,
  collectedRedGems: 0,
  requiredBlueGems: 0,
  requiredRedGems: 0,
  gameOver: null,
  success: false,
  onGemType: 'none',
  autoCollect: false,
  action: 'reset',
  teleportGates: []
})

// Three.js 相关变量
const container = ref(null)
let scene, camera, renderer, controls
let monsterModel
let teleportGateModel = null
let gemModel = null
let floorTileModel = null
let exitModel = null
let init = false
let clock = null
let playerModel = null

// 添加层级高度常量
const LEVEL_HEIGHT = 5 // 每层迷宫之间的高度差

// 初始化3D场景
const initThreeJS = async () => {
  console.log('初始化Three.js')
  // 创建场景
  scene = new THREE.Scene()
  clock = new THREE.Clock()

  // 创建相机
  camera = new THREE.PerspectiveCamera(75, container.value.clientWidth / container.value.clientHeight, 0.1, 1000)
  camera.position.set(2, 3, 2)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.physicallyCorrectLights = true
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  if (container.value.firstChild) {
    container.value.removeChild(container.value.firstChild)
  }
  container.value.innerHTML = ''
  container.value.appendChild(renderer.domElement)

  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // 加载EXR环境贴图
  const exrLoader = new EXRLoader()
  exrLoader.setDataType(THREE.FloatType)
  const envMap = await exrLoader.loadAsync(new URL('@/assets/textures/autumn_field_puresky_1k.exr', import.meta.url).href)
  envMap.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = envMap
  scene.background = envMap

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  scene.add(directionalLight)

  playerModel = new Player3DModel(scene)
  await playerModel.init()
  monsterModel = new Monster3DModel(scene)
  await monsterModel.init()
  gemModel = new Gem3DModel(scene, playerModel)
  await gemModel.init()
  teleportGateModel = new Teleport3DModel(scene)
  await teleportGateModel.init()
  floorTileModel = new FloorTile3DModel(scene)
  await floorTileModel.init()
  exitModel = new Exit3DModel(scene)
  await exitModel.init()

  // 动画循环
  const animate = () => {
    // 处理热加载的bug
    if (!clock) {
      return
    }
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const time = clock.getElapsedTime()

    // 更新控制器
    controls.update()
    playerModel.updateAnimation(time, delta)
    monsterModel.updateAnimation(time, delta)
    gemModel.updateAnimation(time, delta)
    teleportGateModel.updateAnimation(time, delta)
    renderer.render(scene, camera)
  }
  animate()
  init = true
}
// 更新场景
const updateScene = () => {
  if (!init) return

  playerModel.updateScene(gameState.value)
  monsterModel.updateScene(gameState.value)
  gemModel.updateScene(gameState.value)
  teleportGateModel.updateScene(gameState.value)
  floorTileModel.updateScene(gameState.value)
  exitModel.updateScene(gameState.value)
  if (gameState.value.action === 'reset') {
    // 调整相机位置以适应多层迷宫
    const totalHeight = (gameState.value.levels.length - 1) * LEVEL_HEIGHT
    camera.position.set(5, totalHeight + 5, 5)
    controls.target.set(0, totalHeight / 2, 0)
    controls.update()
  }


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
    await fetch('http://localhost:3000/resetGame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('初始化游戏失败:', error)
  }
}

// 事件处理函数
const handleRenderGameState = (event, state) => {
  console.log('收到游戏状态更新:', state)
  if (state && state.maze) {
    console.log('迷宫数据:', state.maze)
    const oldLevel = gameState.value.currentLevel
    gameState.value = state

    // 当层级变化时，更新相机位置
    if (oldLevel !== state.currentLevel) {
      const targetY = state.currentLevel * LEVEL_HEIGHT
      const cameraHeight = 8 // 相机高度偏移

      // 使用GSAP创建平滑动画
      gsap.to(camera.position, {
        y: targetY + cameraHeight,
        duration: 2,
        ease: "power2.inOut"
      })

      gsap.to(controls.target, {
        y: targetY,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
          controls.update()
        },
        onComplete: () => {
        }
      })
    }
    updateScene()
  } else {
    console.warn('收到无效的游戏状态:', state)
  }
}

// 组件挂载
onMounted(async () => {
  console.log('组件已挂载')
  ipcRenderer.on('renderGameState', handleRenderGameState)
  window.addEventListener('resize', handleResize)

  // 初始化Three.js
  await initThreeJS()

  // 初始化游戏
  await initGame()
})

// 组件卸载
onUnmounted(() => {
  console.log('清理3D资源...')
  ipcRenderer.removeListener('renderGameState', handleRenderGameState)
  window.removeEventListener('resize', handleResize)


  if (playerModel) {
    playerModel.dispose()
  }
  if (exitModel) {
    exitModel.dispose()
  }
  if (gemModel) {
    gemModel.dispose()
  }
  if (teleportGateModel) {
    teleportGateModel.dispose()
  }
  if (monsterModel) {
    monsterModel.dispose()
  }
  // 清理所有材质和几何体
  const disposeObject = (obj) => {
    if (!obj) return
    if (obj.geometry) {
      obj.geometry.dispose()
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose())
      } else {
        obj.material.dispose()
      }
    }
    if (obj.children) {
      obj.children.forEach(child => disposeObject(child))
    }
  }

  // 清理场景中的所有对象
  if (scene) {
    scene.traverse(disposeObject)
    scene.clear()
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    renderer = null
  }

  // 清理控制器
  if (controls) {
    controls.dispose()
    controls = null
  }

  // 清理相机
  if (camera) {
    camera = null
  }

  // 清理场景
  if (scene) {
    scene = null
  }

  // 清理时钟
  if (clock) {
    clock = null
  }
  init = false
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

.level-info {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  padding: 0 20px;
}
</style>