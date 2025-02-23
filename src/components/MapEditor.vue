<template>
  <div class="editor-container">
    <el-card class="toolbar-card" style="min-width: 1142px;">
      <el-row align="middle">
        <el-col :span="6">
          <el-form label-position="top" class="size-controls">
            <el-form-item label="地图尺寸">
              <el-input-number v-model="width" :min="1" :max="20" @change="resizeMap" size="small" class="size-input" />
              <span class="size-input-x">x</span>
              <el-input-number v-model="height" :min="1" :max="20" @change="resizeMap" size="small"
                class="size-input" />
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="7">
          <div class="level-controls">
            <el-button-group>
              <el-button @click="addLevel" type="primary" plain>
                <el-icon>
                  <Plus />
                </el-icon>
                添加层级
              </el-button>
              <el-button @click="deleteLevel" type="danger" plain :disabled="levels.length <= 1">
                <el-icon>
                  <Delete />
                </el-icon>
                删除当前层
              </el-button>
            </el-button-group>
            <div class="level-selector">
              <span>当前层级：</span>
              <el-select v-model="currentLevel" size="small">
                <el-option v-for="(level, index) in levels" :key="index" :label="'第 ' + (index + 1) + ' 层'"
                  :value="index" />
              </el-select>
            </div>
          </div>
        </el-col>
        <el-col :span="9">
          <el-radio-group v-model="currentTool">
            <el-radio-button label="wall">
              <el-icon>
                <Picture />
              </el-icon>
              墙壁
            </el-radio-button>
            <el-radio-button label="blueGem">
              <div class="gem-icon blue"></div>
              蓝宝石
            </el-radio-button>
            <el-radio-button label="redGem">
              <div class="gem-icon red"></div>
              红宝石
            </el-radio-button>
            <el-radio-button label="monster">
              <el-icon>
                <Warning />
              </el-icon>
              怪物
            </el-radio-button>
            <el-radio-button label="teleport">
              <TeleportIcon class="svg-icon" />
              传送门
            </el-radio-button>
            <el-radio-button label="start">
              <el-icon>
                <Position />
              </el-icon>
              起点
            </el-radio-button>
            <el-radio-button label="exit">
              <el-icon>
                <Flag />
              </el-icon>
              终点
            </el-radio-button>
            <el-radio-button label="eraser">
              <el-icon>
                <Delete />
              </el-icon>
              橡皮擦
            </el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="7">
          <div class="file-controls">
            <el-button type="primary" @click="loadMap">
              <el-icon>
                <Folder />
              </el-icon>
              加载地图
            </el-button>
            <el-button type="success" @click="saveMap">
              <el-icon>
                <Download />
              </el-icon>
              保存地图
            </el-button>
            <el-button type="danger" @click="resetMap">
              <el-icon>
                <Refresh />
              </el-icon>
              重置
            </el-button>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="map-card" :body-style="{ display: 'flex', justifyContent: 'center' }">
      <div class="map-grid" :style="gridStyle">
        <div v-for="(row, y) in mapData" :key="y" class="map-row">
          <div v-for="(cell, x) in row" :key="x" class="map-cell" :class="getCellClasses(x, y)"
            :style="teleportGateStyle(x, y)" @mouseover="handleCellHover(x, y)" @mousedown="handleCellDown(x, y)"
            @mouseup="handleCellUp(x, y)">
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import TeleportIcon from '@/assets/icons/teleport.svg?component'
import { Plus, Delete } from '@element-plus/icons-vue'

const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

// 地图尺寸
const width = ref(4)
const height = ref(4)
const currentTool = ref('wall')
const isDrawing = ref(false)

// 地图数据
const currentLevel = ref(0)
const levels = ref([])
const mapData = computed(() => levels.value[currentLevel.value]?.mapData || [])
const blueGems = ref([])
const redGems = ref([])
const monsters = ref([])
const startPos = ref(null)
const exitPos = ref(null)
const teleportGates = ref([])

// 保存地图
const saveMap = async () => {
  if (!startPos.value || !exitPos.value) {
    ElMessage.warning('请设置起点和终点！')
    return
  }

  try {
    // 将地图数据转换为简单的 0/1 数组，并确保所有对象都是纯数据
    const mapConfig = {
      title: '多层迷宫配置',
      start: {
        x: startPos.value.x,
        y: startPos.value.y,
        level: startPos.value.level
      },
      exit: {
        x: exitPos.value.x,
        y: exitPos.value.y,
        level: exitPos.value.level
      },
      levels: levels.value.map(level => ({
        maze: level.mapData.map(row => row.map(cell => cell.walkable ? 1 : 0)),
        blueGems: level.blueGems.map(gem => ({ x: gem.x, y: gem.y })),
        redGems: level.redGems.map(gem => ({ x: gem.x, y: gem.y })),
        monsters: level.monsters.map(monster => ({ x: monster.x, y: monster.y }))
      })),
      teleportGates: teleportGates.value.map(gate => [
        { x: gate[0].x, y: gate[0].y, level: gate[0].level },
        { x: gate[1].x, y: gate[1].y, level: gate[1].level }
      ]),
      requiredBlueGems: levels.value.reduce((sum, level) => sum + level.blueGems.length, 0),
      requiredRedGems: levels.value.reduce((sum, level) => sum + level.redGems.length, 0)
    }

    const result = await ipcRenderer.invoke('save-map', mapConfig)
    if (result.success) {
      ElMessage.success('地图保存成功！')
    } else if (result.message) {
      ElMessage.error('保存失败：' + result.message)
    }
  } catch (error) {
    console.error('保存错误:', error)
    ElMessage.error('保存失败：' + error.message)
  }
}

// 重置地图
const resetMap = () => {
  initMap()
}

// 加载地图
const loadMap = async () => {
  try {
    const result = await ipcRenderer.invoke('load-map')
    console.log('加载地图结果:', result)

    if (result.success && result.data) {
      const config = result.data
      console.log('地图配置:', config)

      // 验证配置数据的完整性
      if (!config.levels || !Array.isArray(config.levels) || config.levels.length === 0) {
        throw new Error('无效的地图配置：缺少层级数据')
      }

      if (!config.levels[0].maze || !Array.isArray(config.levels[0].maze) || config.levels[0].maze.length === 0) {
        throw new Error('无效的地图配置：缺少迷宫数据')
      }

      // 更新地图尺寸
      width.value = config.levels[0].maze[0].length
      height.value = config.levels[0].maze.length

      // 更新层级数据
      levels.value = config.levels.map(level => ({
        mapData: level.maze.map(row =>
          Array.isArray(row) ? row.map(cell => ({ walkable: !!cell })) : []
        ),
        blueGems: Array.isArray(level.blueGems) ? level.blueGems : [],
        redGems: Array.isArray(level.redGems) ? level.redGems : [],
        monsters: Array.isArray(level.monsters) ? level.monsters : [],
      }))

      // 更新其他数据
      currentLevel.value = 0
      startPos.value = config.start || { x: 0, y: 0, level: 0 }
      exitPos.value = config.exit || null
      teleportGates.value = Array.isArray(config.teleportGates) ? config.teleportGates : []

      ElMessage.success('地图加载成功！')
    } else if (result.message) {
      ElMessage.error('加载失败：' + result.message)
    } else {
      ElMessage.error('加载失败：无效的返回数据')
    }
  } catch (error) {
    console.error('加载地图错误:', error)
    ElMessage.error('加载失败：' + error.message)
  }
}

// 初始化地图
const initMap = () => {
  levels.value = [{
    mapData: Array(height.value).fill().map(() =>
      Array(width.value).fill().map(() => ({ walkable: true }))
    ),
    blueGems: [],
    redGems: [],
    monsters: [],
  }]
  currentLevel.value = 0
  startPos.value = { x: 0, y: 0, level: 0 }
  exitPos.value = null
  teleportGates.value = []
}

// 添加新层级
const addLevel = () => {
  levels.value.push({
    mapData: Array(height.value).fill().map(() =>
      Array(width.value).fill().map(() => ({ walkable: true }))
    ),
    blueGems: [],
    redGems: [],
    monsters: [],
  })
}

// 删除当前层级
const deleteLevel = () => {
  if (levels.value.length > 1) {
    // 更新起点和终点的层级引用
    if (startPos.value && startPos.value.level === currentLevel.value) {
      startPos.value = null
    } else if (startPos.value && startPos.value.level > currentLevel.value) {
      startPos.value.level--
    }

    if (exitPos.value && exitPos.value.level === currentLevel.value) {
      exitPos.value = null
    } else if (exitPos.value && exitPos.value.level > currentLevel.value) {
      exitPos.value.level--
    }

    // 更新传送门的层级引用
    teleportGates.value = teleportGates.value.filter(gate => {
      // 移除涉及被删除层级的传送门
      if (gate[0].level === currentLevel.value || gate[1].level === currentLevel.value) {
        return false
      }
      // 更新高于被删除层级的层级引用
      if (gate[0].level > currentLevel.value) {
        gate[0].level--
      }
      if (gate[1].level > currentLevel.value) {
        gate[1].level--
      }
      return true
    })

    levels.value.splice(currentLevel.value, 1)
    currentLevel.value = Math.max(0, currentLevel.value - 1)
  }
}

// 调整地图大小
const resizeMap = () => {
  levels.value.forEach(level => {
    const newMap = Array(height.value).fill().map(() =>
      Array(width.value).fill().map(() => ({ walkable: true }))
    )

    // 复制现有数据
    level.mapData.forEach((row, y) => {
      if (y < height.value) {
        row.forEach((cell, x) => {
          if (x < width.value) {
            newMap[y][x] = { ...cell }
          }
        })
      }
    })

    level.mapData = newMap

    // 清理超出范围的对象
    const cleanPositions = (positions) => {
      return positions.filter(pos =>
        pos.x < width.value && pos.y < height.value
      )
    }

    level.blueGems = cleanPositions(level.blueGems)
    level.redGems = cleanPositions(level.redGems)
    level.monsters = cleanPositions(level.monsters)
  })

  if (startPos.value && (startPos.value.x >= width.value || startPos.value.y >= height.value)) {
    startPos.value = null
  }

  if (exitPos.value && (exitPos.value.x >= width.value || exitPos.value.y >= height.value)) {
    exitPos.value = null
  }
}

// 网格样式
const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${width.value}, 40px)`,
  gap: '2px',
  backgroundColor: '#333',
  padding: '2px',
  borderRadius: '5px'
}))

// 获取单元格的类名
const getCellClasses = (x, y) => {
  const level = levels.value[currentLevel.value]
  const classes = {
    'wall': !level.mapData[y][x].walkable,
    'blue-gem': level.blueGems.some(g => g.x === x && g.y === y),
    'red-gem': level.redGems.some(g => g.x === x && g.y === y),
    'monster': level.monsters.some(m => m.x === x && m.y === y),
    'start': startPos.value && startPos.value.x === x && startPos.value.y === y && startPos.value.level === currentLevel.value,
    'exit': exitPos.value && exitPos.value.x === x && exitPos.value.y === y && exitPos.value.level === currentLevel.value,
    'teleport-gate': teleportGates.value.some(t => t.some(g => g.x === x && g.y === y && g.level === currentLevel.value)),
    'teleport-gate-0': teleportGateState.value === 1 && teleportGate0.value && teleportGate0.value.x === x && teleportGate0.value.y === y && teleportGate0.value.level === currentLevel.value,
  }
  return classes
}

const teleportGateStyle = (x, y) => {
  const index = teleportGates.value.findIndex(t => t.some(g => g.x === x && g.y === y && g.level === currentLevel.value))
  if (index !== -1) {
    let color = index * 50 % 360
    return {
      '--teleport-base-color': `hsl(${color}, 70%, 50%)`
    }
  } else {
    return {}
  }
}

const teleportGateState = ref(0);
const teleportGate0 = ref(null);

watch(currentTool, (newVal) => {
  if (newVal !== 'teleport') {
    teleportGateState.value = 0
    teleportGate0.value = null
  }
})

const handleCellDown = (x, y) => {
  isDrawing.value = true
  handleCellModification(x, y)
}
const handleCellUp = (x, y) => {
  isDrawing.value = false
}
// 处理单元格悬停
const handleCellHover = (x, y) => {
  if (isDrawing.value) {
    handleCellModification(x, y)
  }
}

// 处理单元格修改
const handleCellModification = (x, y) => {
  const level = levels.value[currentLevel.value]

  switch (currentTool.value) {
    case 'wall':
      level.mapData[y][x].walkable = false
      break
    case 'eraser':
      level.mapData[y][x].walkable = true
      removeAllAtPosition(x, y)
      break
    case 'blueGem':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        level.blueGems.push({ x, y })
      }
      break
    case 'redGem':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        level.redGems.push({ x, y })
      }
      break
    case 'monster':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        level.monsters.push({ x, y })
      }
      break
    case 'start':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        startPos.value = { x, y, level: currentLevel.value }
      }
      break
    case 'exit':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        exitPos.value = { x, y, level: currentLevel.value }
      }
      break
    case 'teleport':
      if (level.mapData[y][x].walkable) {
        removeAllAtPosition(x, y)
        if (teleportGateState.value === 0) {
          teleportGate0.value = { x, y, level: currentLevel.value }
          teleportGateState.value = 1
        } else if (teleportGate0.value) {
          teleportGates.value.push([
            { ...teleportGate0.value },
            { x, y, level: currentLevel.value }
          ])
          teleportGateState.value = 0
          teleportGate0.value = null
        }
      }
      break
  }
}

// 移除指定位置的所有对象
const removeAllAtPosition = (x, y) => {
  const level = levels.value[currentLevel.value]

  level.blueGems = level.blueGems.filter(g => g.x !== x || g.y !== y)
  level.redGems = level.redGems.filter(g => g.x !== x || g.y !== y)
  level.monsters = level.monsters.filter(m => m.x !== x || m.y !== y)

  if (startPos.value &&
    startPos.value.x === x &&
    startPos.value.y === y &&
    startPos.value.level === currentLevel.value) {
    startPos.value = null
  }

  if (exitPos.value &&
    exitPos.value.x === x &&
    exitPos.value.y === y &&
    exitPos.value.level === currentLevel.value) {
    exitPos.value = null
  }

  teleportGates.value = teleportGates.value.filter(t =>
    !t.some(g => g.x === x && g.y === y && g.level === currentLevel.value)
  )
}

// 初始化
initMap()

</script>

<style scoped>
.editor-container {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar-card {
  margin-bottom: 20px;
}

.size-controls {
  display: flex;
  align-items: center;
}

.file-controls {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.map-card {
  padding: 20px;
  background: var(--el-color-primary-light-5);
}

.map-grid {
  display: inline-grid;
  background: #333;
  padding: 2px;
  border-radius: 5px;
  gap: 2px;
}

.map-row {
  display: contents;
}

.map-cell {
  width: 40px;
  height: 40px;
  background: white;
  position: relative;
  cursor: pointer;
  border: 1px solid #ccc;
  box-sizing: border-box;
  transition: all 0.3s;
}

.map-cell:hover {
  border-color: var(--el-color-primary);
}

.map-cell.wall {
  background: #333;
  border-color: #222;
}

.map-cell.blue-gem::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: url('@/assets/gem.png') -24px 0;
  background-size: 48px 24px;
}

.map-cell.red-gem::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: url('@/assets/gem.png') 0 0;
  background-size: 48px 24px;
}

.map-cell.monster::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: url('@/assets/monster.png') 0 0;
  background-size: 160px 160px;
}

.map-cell.teleport-gate::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  background: conic-gradient(from 0deg,
      var(--teleport-base-color, #4a90e2) 0%,
      color-mix(in srgb, var(--teleport-base-color, #4a90e2) 80%, white) 25%,
      var(--teleport-base-color, #4a90e2) 50%,
      color-mix(in srgb, var(--teleport-base-color, #4a90e2) 80%, white) 75%,
      var(--teleport-base-color, #4a90e2) 100%);
  animation: rotate 2s linear infinite;
  border-radius: 50%;
}

.map-cell.teleport-gate-0::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: url('@/assets/icons/teleport-first.svg') 0 0 no-repeat;
  background-size: 40px 40px;
}

.map-cell.start {
  background: var(--el-color-success-light-5);
}

.map-cell.exit {
  background: url('@/assets/gate.png') 0 0;
  background-size: 40px 160px;
}

.size-input {
  width: 80px;
}

.size-input-x {
  margin-left: 5px;
  margin-right: 5px;
}

.gem-icon {
  width: 14px;
  height: 14px;
  background-image: url('@/assets/gem.png');
  background-repeat: no-repeat;
  background-size: 28px 14px;
  display: inline-block;
}

.gem-icon.red {
  background-position: 0 0;
}

.gem-icon.blue {
  background-position: -14px 0;
}

.level-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  align-items: center;
}

.level-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-right: 10px;
}

.level-selector span {
  margin-right: 10px;
  word-break: keep-all;
  white-space: nowrap;
}
</style>