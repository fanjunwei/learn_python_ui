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
        <el-col :span="13">
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
        <el-col :span="5">
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
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="map-card" :body-style="{ display: 'flex', justifyContent: 'center' }">
      <div class="map-grid" :style="gridStyle">
        <div v-for="(row, y) in mapData" :key="y" class="map-row">
          <div v-for="(cell, x) in row" :key="x" class="map-cell" :class="getCellClasses(x, y)"
            @mouseover="handleCellHover(x, y)" @mousedown="handleCellDown(x, y)"
            @mouseup="handleCellUp(x, y)">
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
const electron = window.require('electron')
const ipcRenderer = electron.ipcRenderer

// 地图尺寸
const width = ref(8)
const height = ref(8)
const currentTool = ref('wall')
const isDrawing = ref(false)

// 地图数据
const mapData = ref([])
const blueGems = ref([])
const redGems = ref([])
const monsters = ref([])
const startPos = ref(null)
const exitPos = ref(null)

// 保存地图
const saveMap = async () => {
  if (!startPos.value || !exitPos.value) {
    ElMessage.warning('请设置起点和终点！')
    return
  }

  // 将地图数据转换为简单的 0/1 数组
  const mazeArray = mapData.value.map(row =>
    row.map(cell => cell.walkable ? 1 : 0)
  )

  // 创建一个只包含简单数据类型的配置对象
  const mapConfig = {
    title: `迷宫配置`,
    maze: mazeArray,
    start: {
      x: startPos.value.x,
      y: startPos.value.y
    },
    blueGems: blueGems.value.map(gem => ({ x: gem.x, y: gem.y })),
    redGems: redGems.value.map(gem => ({ x: gem.x, y: gem.y })),
    monsters: monsters.value.map(monster => ({ x: monster.x, y: monster.y })),
    exit: {
      x: exitPos.value.x,
      y: exitPos.value.y
    },
    requiredBlueGems: blueGems.value.length,
    requiredRedGems: redGems.value.length
  }

  try {
    const result = await ipcRenderer.invoke('save-map', mapConfig)
    if (result.success) {
      ElMessage.success('地图保存成功！')
    } else if (result.message) {
      ElMessage.error('保存失败：' + result.message)
    }
  } catch (error) {
    ElMessage.error('保存失败：' + error.message)
  }
}

// 加载地图
const loadMap = async () => {
  try {
    const result = await ipcRenderer.invoke('load-map')
    if (result.success) {
      const config = result.data

      // 更新地图尺寸
      width.value = config.maze[0].length
      height.value = config.maze.length

      // 更新地图数据
      mapData.value = config.maze

      // 更新其他数据
      blueGems.value = config.blueGems
      redGems.value = config.redGems
      monsters.value = config.monsters
      startPos.value = config.start
      exitPos.value = config.exit
      ElMessage.success('地图加载成功！')
    } else if (result.message) {
      ElMessage.error('加载失败：' + result.message)
    }
  } catch (error) {
    ElMessage.error('加载失败：' + error.message)
  }
}

// 初始化地图
const initMap = () => {
  mapData.value = Array(height.value).fill().map(() =>
    Array(width.value).fill().map(() => ({ walkable: true }))
  )
}

// 调整地图大小
const resizeMap = () => {
  const newMap = Array(height.value).fill().map(() =>
    Array(width.value).fill().map(() => ({ walkable: true }))
  )

  // 复制现有数据
  mapData.value.forEach((row, y) => {
    if (y < height.value) {
      row.forEach((cell, x) => {
        if (x < width.value) {
          newMap[y][x] = { ...cell }
        }
      })
    }
  })

  mapData.value = newMap

  // 清理超出范围的对象
  const cleanPositions = (positions) => {
    return positions.filter(pos =>
      pos.x < width.value && pos.y < height.value
    )
  }

  blueGems.value = cleanPositions(blueGems.value)
  redGems.value = cleanPositions(redGems.value)
  monsters.value = cleanPositions(monsters.value)

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
  const classes = {
    'wall': !mapData.value[y][x].walkable,
    'blue-gem': blueGems.value.some(g => g.x === x && g.y === y),
    'red-gem': redGems.value.some(g => g.x === x && g.y === y),
    'monster': monsters.value.some(m => m.x === x && m.y === y),
    'start': startPos.value && startPos.value.x === x && startPos.value.y === y,
    'exit': exitPos.value && exitPos.value.x === x && exitPos.value.y === y
  }
  return classes
}

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
  switch (currentTool.value) {
    case 'wall':
      mapData.value[y][x].walkable = false
      break
    case 'eraser':
      mapData.value[y][x].walkable = true
      removeAllAtPosition(x, y)
      break
    case 'blueGem':
      if (mapData.value[y][x].walkable) {
        removeAllAtPosition(x, y)
        blueGems.value.push({ x, y })
      }
      break
    case 'redGem':
      if (mapData.value[y][x].walkable) {
        removeAllAtPosition(x, y)
        redGems.value.push({ x, y })
      }
      break
    case 'monster':
      if (mapData.value[y][x].walkable) {
        removeAllAtPosition(x, y)
        monsters.value.push({ x, y })
      }
      break
    case 'start':
      if (mapData.value[y][x].walkable) {
        removeAllAtPosition(x, y)
        startPos.value = { x, y }
      }
      break
    case 'exit':
      if (mapData.value[y][x].walkable) {
        removeAllAtPosition(x, y)
        exitPos.value = { x, y }
      }
      break
  }
}

// 移除指定位置的所有对象
const removeAllAtPosition = (x, y) => {
  blueGems.value = blueGems.value.filter(g => g.x !== x || g.y !== y)
  redGems.value = redGems.value.filter(g => g.x !== x || g.y !== y)
  monsters.value = monsters.value.filter(m => m.x !== x || m.y !== y)
  if (startPos.value && startPos.value.x === x && startPos.value.y === y) {
    startPos.value = null
  }
  if (exitPos.value && exitPos.value.x === x && exitPos.value.y === y) {
    exitPos.value = null
  }
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
</style>