<template>
  <div class="editor-container">
    <div class="toolbar">
      <div class="size-controls">
        宽度: <input type="number" v-model="width" min="5" max="20" @change="resizeMap">
        高度: <input type="number" v-model="height" min="5" max="20" @change="resizeMap">
      </div>
      <div class="tool-controls">
        <button :class="{ active: currentTool === 'wall' }" @click="currentTool = 'wall'">墙壁</button>
        <button :class="{ active: currentTool === 'blueGem' }" @click="currentTool = 'blueGem'">蓝宝石</button>
        <button :class="{ active: currentTool === 'redGem' }" @click="currentTool = 'redGem'">红宝石</button>
        <button :class="{ active: currentTool === 'monster' }" @click="currentTool = 'monster'">怪物</button>
        <button :class="{ active: currentTool === 'start' }" @click="currentTool = 'start'">起点</button>
        <button :class="{ active: currentTool === 'exit' }" @click="currentTool = 'exit'">终点</button>
        <button :class="{ active: currentTool === 'eraser' }" @click="currentTool = 'eraser'">橡皮擦</button>
      </div>
      <div class="file-controls">
        <button @click="saveMap">保存地图</button>
      </div>
    </div>
    
    <div class="map-grid" :style="gridStyle">
      <div v-for="(row, y) in mapData" :key="y" class="map-row">
        <div v-for="(cell, x) in row" 
             :key="x" 
             class="map-cell"
             :class="getCellClasses(x, y)"
             @click="handleCellClick(x, y)"
             @mouseover="handleCellHover(x, y)"
             @mousedown="isDrawing = true"
             @mouseup="isDrawing = false">
        </div>
      </div>
    </div>
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

// 处理单元格点击
const handleCellClick = (x, y) => {
  handleCellModification(x, y)
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

// 保存地图
const saveMap = async () => {
  if (!startPos.value || !exitPos.value) {
    alert('请设置起点和终点！')
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
      alert('地图保存成功！')
    } else {
      alert('保存失败：' + result.message)
    }
  } catch (error) {
    alert('保存失败：' + error.message)
  }
}

// 初始化
initMap()
</script>

<style scoped>
.editor-container {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
  align-items: center;
}

.tool-controls {
  display: flex;
  gap: 10px;
}

.tool-controls button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  background: white;
  cursor: pointer;
}

.tool-controls button.active {
  background: #4CAF50;
  color: white;
}

.map-grid {
  display: inline-grid;
  background: #333;
  padding: 2px;
  border-radius: 5px;
}

.map-cell {
  width: 40px;
  height: 40px;
  background: white;
  position: relative;
  cursor: pointer;
}

.map-cell.wall {
  background: #333;
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
  background: #4CAF50;
}

.map-cell.exit {
  background: url('@/assets/gate.png') 0 0;
  background-size: 40px 160px;
}

input[type="number"] {
  width: 60px;
  padding: 4px;
  margin: 0 10px;
}

.file-controls button {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.file-controls button:hover {
  background: #45a049;
}
</style> 