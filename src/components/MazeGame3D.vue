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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'
import gsap from 'gsap'
import Player3DModel from '@/func/player_3dmodel'
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
let monsterModel, monsterMixer, monsterAnimations = {}, floorTiles = [], blueGemMeshes = [], redGemMeshes = [], monsterMeshes = [], exitMesh, teleportGateMeshes = [], teleportGateModel = null, gemModel = null
let init = false
let clock = null
let playerModel = null

// 添加层级高度常量
const LEVEL_HEIGHT = 5 // 每层迷宫之间的高度差
const FLOOR_TILE_HEIGHT = 1 // 地砖高度

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

// 加载传送门模型
const loadTeleportGateModel = async () => {
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(new URL('@/assets/3d_model/传送门.glb', import.meta.url).href)
    teleportGateModel = gltf.scene
    teleportGateModel.scale.set(0.5, 0.5, 0.5)
    return teleportGateModel
  } catch (error) {
    console.error('加载传送门模型失败:', error)
    return null
  }
}

// 初始化Three.js场景
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
  // 加载怪物模型
  await loadMonsterModel()
  // 加载传送门模型
  await loadTeleportGateModel()

  // 加载宝石模型
  const gemLoader = new GLTFLoader()
  try {
    const gemGltf = await gemLoader.loadAsync(new URL('@/assets/3d_model/gem.glb', import.meta.url).href)
    gemModel = gemGltf.scene
    gemModel.scale.set(0.2, 0.2, 0.2)
  } catch (error) {
    console.error('加载宝石模型失败:', error)
  }

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

    monsterMeshes.forEach(monster => {
      if (monster.userData.mixer) {
        monster.userData.mixer.update(delta)
      }
    })

    // 更新宝石动画
    let gems = [...blueGemMeshes, ...redGemMeshes]
    gems.forEach((gem, index) => {
      let distance = Math.sqrt(Math.pow(gem.position.x - playerModel.getPosition().x, 2) + Math.pow(gem.position.z - playerModel.getPosition().z, 2))
      let y = gem.userData.position.y
      if (distance < 1 && gem.userData.level === gameState.value.currentLevel) {
        y = y + (1 - distance) * 0.7
      }
      gem.position.y = y + Math.sin(time * 2 + index) * 0.1
      gem.rotation.y = (time + index * 0.1) * (index % 2 === 0 ? 1 : -1)
    })

    // 更新传送门动画
    teleportGateMeshes.forEach((gate, index) => {
      gate.rotation.y = time + index * 0.1
    })
    renderer.render(scene, camera)
  }
  animate()
  init = true
}

// 更新场景
const updateScene = () => {
  console.log('3D更新场景')
  if (!init) {
    console.log('skip 3D更新场景')
    return
  }

  // 清理对象的通用函数
  const disposeObject = (obj) => {
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
  playerModel.updateScene(gameState.value)

 

  if (gameState.value.action === 'reset') {
    // 清理并重建所有层级的场景对象

    // 清理传送门
    teleportGateMeshes.forEach(gate => {
      disposeObject(gate)
      scene.remove(gate)
    })
    teleportGateMeshes = []

    // 创建传送门
    if (gameState.value.teleportGates && teleportGateModel) {
      gameState.value.teleportGates.forEach((gate, index) => {
        gate.forEach(pos => {
          const gateModel = SkeletonUtils.clone(teleportGateModel)
          const hue = (index * 50) % 360
          const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.5)

          gateModel.traverse((node) => {
            if (node.isMesh) {
              node.material = node.material.clone()
              node.material.color = color
              node.material.emissive = color
              node.material.emissiveIntensity = 2.0
              if (node.material.metalness !== undefined) {
                node.material.metalness = 0.8
              }
              if (node.material.roughness !== undefined) {
                node.material.roughness = 0.2
              }
            }
          })

          gateModel.position.set(
            pos.x - gameState.value.maze[0].length / 2,
            pos.level * LEVEL_HEIGHT,
            pos.y - gameState.value.maze.length / 2
          )
          scene.add(gateModel)
          teleportGateMeshes.push(gateModel)
        })
      })
    }

    // 清理旧的物体
    floorTiles.forEach(floorTile => {
      disposeObject(floorTile)
      scene.remove(floorTile)
    })
    floorTiles = []

    // 为每一层创建地砖
    gameState.value.levels.forEach((level, levelIndex) => {
      const levelY = levelIndex * LEVEL_HEIGHT
      const floorTileGeometry = new THREE.BoxGeometry(0.99, FLOOR_TILE_HEIGHT, 0.99)
      const floorTileMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffb5,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0
      })

      // 创建地砖
      level.maze.forEach((row, z) => {
        row.forEach((cell, x) => {
          if (cell.walkable) {
            const floorTile = new THREE.Mesh(floorTileGeometry, floorTileMaterial)
            floorTile.position.set(
              x - level.maze[0].length / 2,
              levelY - FLOOR_TILE_HEIGHT / 2,
              z - level.maze.length / 2
            )
            floorTile.castShadow = true
            floorTile.receiveShadow = true
            scene.add(floorTile)
            floorTiles.push(floorTile)
          }
        })
      })
    })


    // 清理并重建怪物
    monsterMeshes.forEach(monster => {
      if (monster.userData.mixer) {
        monster.userData.mixer.stopAllAction()
        monster.userData.mixer.uncacheRoot(monster)
      }
      disposeObject(monster)
      scene.remove(monster)
    })
    monsterMeshes = []

    // 在每一层放置怪物
    gameState.value.monsters.forEach((monster) => {
      if (monsterModel) {
        const newMonsterModel = SkeletonUtils.clone(monsterModel)
        newMonsterModel.scale.copy(monsterModel.scale)
        newMonsterModel.position.set(
          monster.x - gameState.value.maze[0].length / 2,
          monster.level * LEVEL_HEIGHT,
          monster.y - gameState.value.maze.length / 2
        )
        newMonsterModel.rotation.y = (monster.x + monster.y) * Math.PI * 0.2

        const mixer = new THREE.AnimationMixer(newMonsterModel)
        newMonsterModel.userData.mixer = mixer

        Object.entries(monsterAnimations).forEach(([name, originalAction]) => {
          const clip = originalAction.getClip()
          const action = mixer.clipAction(clip)
          if (name === 'Idle') {
            action.time = monster.level * 2
            action.play()
          }
        })

        scene.add(newMonsterModel)
        monsterMeshes.push(newMonsterModel)
      }
    })


    // 调整相机位置以适应多层迷宫
    const totalHeight = (gameState.value.levels.length - 1) * LEVEL_HEIGHT
    camera.position.set(5, totalHeight + 5, 5)
    controls.target.set(0, totalHeight / 2, 0)
    controls.update()
  }
  // 清理并重建宝石
  blueGemMeshes.forEach(gem => {
    disposeObject(gem)
    scene.remove(gem)
  })
  redGemMeshes.forEach(gem => {
    disposeObject(gem)
    scene.remove(gem)
  })
  blueGemMeshes = []
  redGemMeshes = []

  // 创建宝石
  if (gemModel) {
    // 创建蓝宝石材质
    const blueMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0000ff,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.5,
      emissive: 0x0000ff,
      emissiveIntensity: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.8
    })

    // 创建红宝石材质
    const redMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff0000,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.5,
      emissive: 0xff0000,
      emissiveIntensity: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.8
    })

    // 放置蓝宝石
    gameState.value.blueGems.forEach((gem) => {
      const blueMesh = gemModel.clone()
      blueMesh.traverse((node) => {
        if (node.isMesh) {
          node.material = blueMaterial
        }
      })
      let blueGemPosition = {
        x: gem.x - gameState.value.maze[0].length / 2,
        y: gem.level * LEVEL_HEIGHT + 0.5,
        z: gem.y - gameState.value.maze.length / 2
      }
      blueMesh.userData.position = blueGemPosition
      blueMesh.userData.level = gem.level
      blueMesh.position.copy(blueGemPosition)
      scene.add(blueMesh)
      blueGemMeshes.push(blueMesh)
    })

    // 放置红宝石
    gameState.value.redGems.forEach(gem => {
      const redMesh = gemModel.clone()
      redMesh.traverse((node) => {
        if (node.isMesh) {
          node.material = redMaterial
        }
      })
      let redGemPosition = {
        x: gem.x - gameState.value.maze[0].length / 2,
        y: gem.level * LEVEL_HEIGHT + 0.5,
        z: gem.y - gameState.value.maze.length / 2
      }
      redMesh.userData.position = redGemPosition
      redMesh.userData.level = gem.level
      redMesh.position.copy(redGemPosition)
      scene.add(redMesh)
      redGemMeshes.push(redMesh)
    })
  }

  // 创建出口
  if (exitMesh) {
    disposeObject(exitMesh)
    scene.remove(exitMesh)
  }
  if (gameState.value.exit) {
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
      gameState.value.exit.level * LEVEL_HEIGHT + 0.05,
      gameState.value.exit.y - gameState.value.maze.length / 2
    )
    scene.add(exitMesh)
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

  // 清理动画混合器
  if (playerModel) {
    playerModel.dispose()
  }

  // 清理所有怪物的动画混合器
  monsterMeshes.forEach(monster => {
    if (monster.userData.mixer) {
      monster.userData.mixer.stopAllAction()
      monster.userData.mixer.uncacheRoot(monster)
    }
  })

  // 清理所有材质和几何体
  const disposeObject = (obj) => {
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

  // 清理地砖
  floorTiles.forEach(floorTile => disposeObject(floorTile))
  floorTiles = []

  // 清理宝石
  blueGemMeshes.forEach(gem => disposeObject(gem))
  redGemMeshes.forEach(gem => disposeObject(gem))
  blueGemMeshes = []
  redGemMeshes = []

  // 清理怪物
  monsterMeshes.forEach(monster => disposeObject(monster))
  monsterMeshes = []

  // 清理传送门
  teleportGateMeshes.forEach(gate => disposeObject(gate))
  teleportGateMeshes = []

  // 清理出口
  if (exitMesh) {
    disposeObject(exitMesh)
    exitMesh = null
  }


  if (monsterModel) {
    disposeObject(monsterModel)
    monsterModel = null
  }
  if (teleportGateModel) {
    disposeObject(teleportGateModel)
    teleportGateModel = null
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

  // 重置所有动画相关变量
  init = false
  animationProgress = 0
  currentAnimation = null
  isTeleporting = false
  teleportProgress = 0

  console.log('3D资源清理完成')
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