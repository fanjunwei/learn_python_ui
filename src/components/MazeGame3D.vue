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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'
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
  action: null
})

// Three.js 相关变量
const container = ref(null)
let scene, camera, renderer, controls
let playerModel, playerMixer, playerAnimations = {}, monsterModel, monsterMixer, monsterAnimations = {}, walls = [], blueGemMeshes = [], redGemMeshes = [], monsterMeshes = [], exitMesh
let init = false
let clock = null
let targetPlayerPosition = new THREE.Vector3()
let targetPlayerRotation = 0
let currentPlayerPosition = new THREE.Vector3()
let currentPlayerRotation = 0
let animationProgress = 0
const playerFadeOutDuration = 1.0
let playerFadeOutProgress = playerFadeOutDuration
let currentAnimation = null

// 加载GLB模型
const loadPlayerModel = async () => {
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(new URL('@/assets/3d_model/player.glb', import.meta.url).href)
    playerModel = gltf.scene
    // 调整模型大小和位置
    playerModel.scale.set(0.5, 0.5, 0.5)
    playerModel.position.y = 0

    // 设置动画混合器
    playerMixer = new THREE.AnimationMixer(playerModel)

    // 加载所有动画
    gltf.animations.forEach(clip => {
      const action = playerMixer.clipAction(clip)
      playerAnimations[clip.name] = action
      console.log('加载动画:', clip.name)
    })

    // 设置默认动画为待机
    if (playerAnimations['Idle']) {
      playerAnimations['Idle'].play()
      currentAnimation = 'Idle'
    }

    // 修改玩家模型和怪物模型，使其投射阴影
    playerModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
      }
    })

    return playerModel
  } catch (error) {
    console.error('加载模型失败:', error)
    return null
  }
}

// 加载怪物模型
const loadMonsterModel = async () => {
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(new URL('@/assets/3d_model/怪物.glb', import.meta.url).href)
    monsterModel = gltf.scene

    // 设置原始模型的变换
    monsterModel.scale.set(0.5, 0.5, 0.5)
    monsterModel.position.y = 0

    // 设置动画混合器
    monsterMixer = new THREE.AnimationMixer(monsterModel)

    // 加载所有动画
    gltf.animations.forEach(clip => {
      const action = monsterMixer.clipAction(clip)
      monsterAnimations[clip.name] = action
      console.log('加载怪物动画:', clip.name)
    })

    // 设置默认动画为待机
    if (monsterAnimations['Idle']) {
      monsterAnimations['Idle'].play()
    }

    // 修改玩家模型和怪物模型，使其投射阴影
    monsterModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
      }
    })

    return monsterModel
  } catch (error) {
    console.error('加载怪物模型失败:', error)
    return null
  }
}

// 切换动画
const switchAnimation = (newAnimation) => {
  if (!playerMixer || !playerAnimations[newAnimation] || currentAnimation === newAnimation) return
  if (currentAnimation === newAnimation) {
    return
  }
  const fadeTime = 0.2
  if (currentAnimation && playerAnimations[currentAnimation]) {
    playerAnimations[currentAnimation].fadeOut(fadeTime)
  }

  playerAnimations[newAnimation].reset().fadeIn(fadeTime).play()
  currentAnimation = newAnimation
}

// 初始化Three.js场景
const initThreeJS = async () => {
  console.log('初始化Three.js')
  // 创建场景
  scene = new THREE.Scene()
  clock = new THREE.Clock()

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

  // 加载玩家模型
  await loadPlayerModel()
  // 加载怪物模型
  await loadMonsterModel()

  scene.add(playerModel)

  // 动画循环
  const animate = () => {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()

    // 更新控制器
    controls.update()

    // 更新动画混合器
    if (playerMixer) {
      playerMixer.update(delta)
    }
    monsterMeshes.forEach(monster => {
      if (monster.userData.mixer) {
        monster.userData.mixer.update(delta)
      }
    })

    // 更新玩家动画
    let duration
    if (gameState.value.action === 'forward') {
      duration = 2
    } else if (gameState.value.action === 'turnLeft') {
      duration = 0.5
    } else if (gameState.value.action === 'turnRight') {
      duration = 0.5
    } else if (gameState.value.action === 'collect_blue') {
      duration = 2
    } else if (gameState.value.action === 'collect_red') {
      duration = 2
    } else {
      duration = 0.5
    }
    if (animationProgress < duration) {
      animationProgress += delta
      const t = Math.min(animationProgress / duration, 1)
      // const easeT = t * (2 - t) // 缓动函数
      const easeT = t

      if (playerModel) {
        // 位置插值
        playerModel.position.lerpVectors(currentPlayerPosition, targetPlayerPosition, easeT)
        // 旋转插值
        const currentAngle = currentPlayerRotation
        const targetAngle = targetPlayerRotation
        const angleDiff = ((targetAngle - currentAngle + Math.PI) % (Math.PI * 2)) - Math.PI
        playerModel.rotation.y = currentAngle + angleDiff * easeT

        // 根据动画进度切换动画状态
        if (t < 1) {
          if (gameState.value.action === 'forward') {
            switchAnimation('Walk')
          } else if (gameState.value.action === 'turnLeft') {
            switchAnimation('Walk')
          } else if (gameState.value.action === 'turnRight') {
            switchAnimation('Walk')
          } else if (gameState.value.action === 'collect_blue') {
            switchAnimation('Jump')
          } else if (gameState.value.action === 'collect_red') {
            switchAnimation('Jump')
          } else {
            switchAnimation('Idle')
          }
        } else if (gameState.value.gameOver && gameState.value.success) {
          switchAnimation('Jump')
        } else {
          switchAnimation('Idle')
        }
      }
    }
    if (playerFadeOutProgress < playerFadeOutDuration) {
      playerFadeOutProgress += delta
      const opacity = 1 - (playerFadeOutProgress / playerFadeOutDuration)
      playerModel.traverse((node) => {
        if (node.isMesh) {
          node.material.opacity = Math.max(0, opacity)
        }
      })
    }

    // 更新宝石动画
    const time = clock.getElapsedTime()
    blueGemMeshes.forEach((gem, index) => {

      let distance = Math.sqrt(Math.pow(gem.position.x - playerModel.position.x, 2) + Math.pow(gem.position.z - playerModel.position.z, 2))
      let y = 0.5
      if (distance < 1) {
        y = 0.5 + (1 - distance) * 0.7
      }
      gem.position.y = y + Math.sin(time * 2 + index) * 0.1
    })
    redGemMeshes.forEach((gem, index) => {
      let distance = Math.sqrt(Math.pow(gem.position.x - playerModel.position.x, 2) + Math.pow(gem.position.z - playerModel.position.z, 2))
      let y = 0.5
      if (distance < 1) {
        y = 0.5 + (1 - distance) * 0.7
      }
      gem.position.y = y + Math.sin(time * 2 + index + Math.PI) * 0.1
    })
    renderer.render(scene, camera)
  }
  animate()
  init = true
}

// 更新场景
const updateScene = () => {
  if (!init || !playerModel) return
  playerModel.traverse((node) => {
    if (node.isMesh) {
      node.material.transparent = true
      node.material.opacity = 1
    }
  })

  // 处理游戏结束时的渐隐效果
  if (gameState.value.gameOver && !gameState.value.success) {
    playerFadeOutProgress = 0
  }

  // 设置目标位置和旋转
  targetPlayerPosition.set(
    gameState.value.playerPosition.x - gameState.value.maze[0].length / 2,
    0,
    gameState.value.playerPosition.y - gameState.value.maze.length / 2
  )
  targetPlayerRotation = -gameState.value.playerDirection * Math.PI / 2 + Math.PI

  // 如果是第一次设置位置，直接设置而不是动画
  if (gameState.value.action === 'reset') {
    switchAnimation('Idle')
    currentPlayerPosition.copy(targetPlayerPosition)
    playerModel.position.copy(targetPlayerPosition)
    currentPlayerRotation = targetPlayerRotation
    playerModel.rotation.y = targetPlayerRotation
  } else {
    // 开始新的动画
    currentPlayerPosition.copy(playerModel.position)
    currentPlayerRotation = playerModel.rotation.y
    animationProgress = 0
  }

  // 清除旧的物体
  walls.forEach(wall => scene.remove(wall))
  if (exitMesh) scene.remove(exitMesh)

  walls = []

  // 创建墙壁
  const wallGeometry = new THREE.BoxGeometry(0.99, 0.99, 0.99)
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffb5,
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    reflectivity: 1.0
  })

  gameState.value.maze.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell.walkable) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial)
        wall.position.set(x - gameState.value.maze[0].length / 2, -0.5, y - gameState.value.maze.length / 2)
        wall.receiveShadow = true
        scene.add(wall)
        walls.push(wall)
      }
    })
  })

  // 创建宝石
  if (gameState.value.action === 'reset' || gameState.value.action === 'collect_blue') {
    const createBlueGem = () => {
      blueGemMeshes.forEach(gem => scene.remove(gem))
      blueGemMeshes = []
      const gemGeometry = new THREE.SphereGeometry(0.2, 32, 32)
      const blueGemMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0000ff,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 1.5,
        emissive: 0x0000ff,
        emissiveIntensity: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      })
      gameState.value.blueGems.forEach((gem, index) => {
        const blueMesh = new THREE.Mesh(gemGeometry, blueGemMaterial)
        blueMesh.position.set(
          gem.x - gameState.value.maze[0].length / 2,
          0.5,
          gem.y - gameState.value.maze.length / 2
        )
        scene.add(blueMesh)
        blueGemMeshes.push(blueMesh)
      })
    }
    if (gameState.value.action === 'reset') {
      createBlueGem()
    } else if (gameState.value.action === 'collect_blue') {
      setTimeout(() => {
        createBlueGem()
      }, 1000)
    }
  }
  if (gameState.value.action === 'reset' || gameState.value.action === 'collect_red') {
    const createRedGem = () => {
      redGemMeshes.forEach(gem => scene.remove(gem))
      redGemMeshes = []
      const gemGeometry = new THREE.SphereGeometry(0.2, 32, 32)
      const redGemMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xff0000,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 1.5,
        emissive: 0xff0000,
        emissiveIntensity: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      })
      gameState.value.redGems.forEach((gem, index) => {
        const redMesh = new THREE.Mesh(gemGeometry, redGemMaterial)
        redMesh.position.set(
          gem.x - gameState.value.maze[0].length / 2,
          0.5,
          gem.y - gameState.value.maze.length / 2
        )
        scene.add(redMesh)
        redGemMeshes.push(redMesh)
      })
    }
    if (gameState.value.action === 'reset') {
      createRedGem()
    } else if (gameState.value.action === 'collect_red') {
      setTimeout(() => {
        createRedGem()
      }, 1000)
    }
  }
  if (gameState.value.action === 'reset') {
    monsterMeshes.forEach(monster => scene.remove(monster))
    monsterMeshes = []
    // 创建怪物
    gameState.value.monsters.forEach((monster, index) => {
      if (monsterModel) {
        // 使用SkeletonUtils克隆带骨骼的模型
        const newMonsterModel = SkeletonUtils.clone(monsterModel)

        // 复制原始模型的变换
        newMonsterModel.scale.copy(monsterModel.scale)
        newMonsterModel.position.set(
          monster.x - gameState.value.maze[0].length / 2,
          monsterModel.position.y,
          monster.y - gameState.value.maze.length / 2
        )
        newMonsterModel.rotation.y = (monster.x + monster.y) * Math.PI * 0.2

        // 为每个怪物创建独立的动画混合器

        // 为每个怪物创建独立的动画混合器
        const mixer = new THREE.AnimationMixer(newMonsterModel)
        newMonsterModel.userData.mixer = mixer

        // 复制所有动画到新的怪物
        Object.entries(monsterAnimations).forEach(([name, originalAction]) => {
          const clip = originalAction.getClip()
          const action = mixer.clipAction(clip)
          if (name === 'Idle') {
            // 为每个怪物错开动画播放时间
            action.time = index * 2 // 每个怪物错开0.5秒播放
            action.play()
          }
        })

        scene.add(newMonsterModel)
        monsterMeshes.push(newMonsterModel)
      }
    })
  }

  // 创建出口
  const exitGeometry = new THREE.BoxGeometry(1, 0.05, 1)
  const exitMaterial = new THREE.MeshPhysicalMaterial({
    color: gameState.value.exitOpen ? 0x00ff00 : 0xff0000,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.7,
    envMapIntensity: 1.2,
    emissive: gameState.value.exitOpen ? 0x00ff00 : 0xff0000,
    emissiveIntensity: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  })
  exitMesh = new THREE.Mesh(exitGeometry, exitMaterial)
  exitMesh.position.set(
    gameState.value.exit.x - gameState.value.maze[0].length / 2,
    0.05,
    gameState.value.exit.y - gameState.value.maze.length / 2
  )
  scene.add(exitMesh)
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
  console.log('3D收到游戏状态更新:', state)
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