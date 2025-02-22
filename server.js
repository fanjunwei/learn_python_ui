const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs').promises;
const path = require('path');
let mainWindow;
let speed = 100;

// 获取用户数据目录
const getUserDataPath = () => {
  const app = require('electron').app || require('@electron/remote').app;
  let userDataPath = path.join(app.getPath('userData'), 'game_data');
  console.log('getUserDataPath:', userDataPath)
  return userDataPath;
};

// 确保目录存在
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

// 保存当前地图配置
const saveCurrentConfig = async (config) => {
  try {
    const dataDir = getUserDataPath();
    await ensureDirectoryExists(dataDir);
    const configPath = path.join(dataDir, 'current_map.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('地图配置已保存');
  } catch (error) {
    console.error('保存地图配置失败:', error);
  }
};

// 加载保存的地图配置
const loadSavedConfig = async () => {
  try {
    const configPath = path.join(getUserDataPath(), 'current_map.json');
    await fs.access(configPath);
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('加载地图配置失败:', error);
    return null;
  }
};

app.use(express.json());

// 游戏状态
let gameState = {
  maze: [],
  playerPosition: { x: 0, y: 0 },
  playerDirection: 0, // 0: 上, 1: 右, 2: 下, 3: 左
  blueGems: [],
  redGems: [],
  collectedBlueGems: 0,
  collectedRedGems: 0,
  requiredBlueGems: 3,
  requiredRedGems: 3,
  monsters: [],
  exitOpen: false,
  exit: { x: 0, y: 0 },
  gameOver: null,
  success: false,
  autoCollect: false,
  onGemType: 'none',
};

// 示例迷宫配置
const defaultMazeConfig = {
  maze: [
    [{ walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }],
    [{ walkable: true }, { walkable: false }, { walkable: true }, { walkable: false }, { walkable: true }],
    [{ walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }],
    [{ walkable: true }, { walkable: false }, { walkable: true }, { walkable: false }, { walkable: true }],
    [{ walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }, { walkable: true }]
  ],
  start: { x: 0, y: 0 },
  blueGems: [{ x: 2, y: 2 }, { x: 0, y: 4 }],
  redGems: [{ x: 2, y: 0 }, { x: 4, y: 4 }],
  monsters: [{ x: 2, y: 1 }, { x: 2, y: 3 }],
  teleportGates: [[{ x: 4, y: 0 }, { x: 0, y: 2 }], [{ x: 3, y: 2 }, { x: 0, y: 3 }]],
  exit: { x: 4, y: 2 },
  requiredBlueGems: 3,
  requiredRedGems: 3,
  autoCollect: false
};

let currentConfig = defaultMazeConfig;

// 添加CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 获取游戏状态
app.get('/getGameState', (req, res) => {
  console.log('收到获取游戏状态请求')
  const renderState = generateRenderState()
  console.log('生成的游戏状态:', renderState)
  res.json({
    success: true,
    gameState: renderState
  })
})

// 重置游戏
app.post('/resetGame', async (req, res) => {
  console.log('收到重置游戏请求')
  const config = req.body.config || currentConfig || defaultMazeConfig
  currentConfig = config

  // 如果提供了新的配置，保存它
  if (req.body.config) {
    await saveCurrentConfig(config)
  }

  resetGameState(config)

  const renderState = generateRenderState()
  console.log('重置后的游戏状态:', renderState)

  if (mainWindow) {
    console.log('发送游戏状态到主窗口')
    renderState.action = 'reset'
    mainWindow.webContents.send('renderGameState', renderState)
    mainWindow.webContents.send('playAudio', 'play_bgm')
  } else {
    console.warn('主窗口未初始化')
  }

  res.json({
    success: true,
    message: '游戏已重置',
    gameState: renderState
  })
})

app.post('/setSpeed', (req, res) => {
  speed = req.body.speed;
  console.log('速度已设置:', speed)
  res.json({
    success: true,
    message: '速度已设置'
  })
})

// 处理移动请求
app.post('/move', async (req, res) => {
  const { action } = req.body;
  let result = {
    success: false,
    hitWall: false,
    gemCollected: false,
    gemType: null,
    monsterHit: false,
    reachedExit: false,
    message: ''
  };
  if (gameState.onTeleport) {
    await new Promise(resolve => {
      const check = () => {
        if (!gameState.onTeleport) {
          console.log('传送结束')
          resolve();
        } else {
          setTimeout(check, 200);
        }
      }
      check();
    });
  }
  if (gameState.gameOver) {
    result.message = '游戏已结束！';
    res.json({
      ...result,
      gameState: generateRenderState()
    });
    return;
  }
  switch (action) {
    case 'forward':
      result = doOperate('forward');
      break;
    case 'collect_blue':
      result = doOperate('collect_blue');
      break;
    case 'collect_red':
      result = doOperate('collect_red');
      break;
    case 'turnLeft':
      result = turnLeft();
      break;
    case 'turnRight':
      result = turnRight();
      break;
  }

  // 生成渲染状态
  const renderState = generateRenderState();

  console.log('result:', result)

  // 添加提示消息
  if (result.hitWall) {
    result.message = '撞墙了！';
    mainWindow.webContents.send('playAudio', 'error');
  } else if (result.gemCollected) {
    result.message = `获得${result.gemType === 'blue' ? '蓝' : '红'}宝石！`;
    mainWindow.webContents.send('playAudio', 'gem');
  } else if (result.monsterHit) {
    result.message = '你被怪物抓住了！游戏结束！';
    mainWindow.webContents.send('playAudio', 'stop_bgm')
    mainWindow.webContents.send('playAudio', 'monster');
  } else if (result.reachedExit) {
    result.message = '恭喜你完成迷宫！';
    mainWindow.webContents.send('playAudio', 'stop_bgm')
    mainWindow.webContents.send('playAudio', 'complete');
  }
  if (action === 'collect_blue') {
    if (!result.gemCollected) {
      result.success = false
      result.message = '没有蓝宝石！';
      mainWindow.webContents.send('playAudio', 'error');
    }
  }
  if (action === 'collect_red') {
    if (!result.gemCollected) {
      result.success = false
      result.message = '没有红宝石！';
      mainWindow.webContents.send('playAudio', 'error');
    }
  }
  if (result.success) {
    renderState.action = action
    mainWindow.webContents.send('renderGameState', renderState);
  }
  if (result.message) {
    let type = 'success'
    if (!result.success) {
      type = 'error'
    }
    mainWindow.webContents.send('showToast', result.message, type);
  }
  let waitTime = 1000;
  if (action === 'forward') {
    waitTime = 2000;
  }
  waitTime = waitTime * (100 - speed) / 100;
  console.log('waitTime:', waitTime)
  await new Promise(resolve => {
    setTimeout(() => {
      res.json({
        ...result,
        gameState: renderState
      });
      resolve();
    }, waitTime);
  });
});

// 重置游戏状态
function resetGameState(config) {
  gameState.maze = JSON.parse(JSON.stringify(config.maze));
  gameState.playerPosition = { ...config.start };
  gameState.blueGems = JSON.parse(JSON.stringify(config.blueGems));
  gameState.redGems = JSON.parse(JSON.stringify(config.redGems));
  gameState.monsters = JSON.parse(JSON.stringify(config.monsters));
  gameState.teleportGates = JSON.parse(JSON.stringify(config.teleportGates));
  gameState.exit = { ...config.exit };
  gameState.requiredBlueGems = config.requiredBlueGems;
  gameState.requiredRedGems = config.requiredRedGems;
  gameState.autoCollect = !!config.autoCollect;
  gameState.collectedBlueGems = 0;
  gameState.collectedRedGems = 0;
  gameState.exitOpen = false;
  gameState.playerDirection = 0;
  gameState.gameOver = false;
  gameState.success = false;
}

// 生成渲染状态
function generateRenderState() {
  return gameState;
}

// 移动前进
function doOperate(operate) {
  const result = {
    success: false,
    hitWall: false,
    gemCollected: false,
    gemType: null,
    monsterHit: false,
    reachedExit: false
  };
  let nextPosition = null;
  if (operate === 'forward') {
    nextPosition = getNextPosition();
  }
  if (operate === 'forward') {
    if (!isValidMove(nextPosition)) {
      result.hitWall = true;
      return result;
    }
    gameState.playerPosition = nextPosition;
  }

  result.success = true;

  // 检查碰撞
  return checkCollisions(result, operate);
}

// 左转
function turnLeft() {
  gameState.playerDirection = (gameState.playerDirection + 3) % 4;
  return { success: true };
}

// 右转
function turnRight() {
  gameState.playerDirection = (gameState.playerDirection + 1) % 4;
  return { success: true };
}

// 获取下一个位置
function getNextPosition() {
  const { x, y } = gameState.playerPosition;
  switch (gameState.playerDirection) {
    case 0: return { x, y: y - 1 }; // 上
    case 1: return { x: x + 1, y }; // 右
    case 2: return { x, y: y + 1 }; // 下
    case 3: return { x: x - 1, y }; // 左
  }
}

// 检查移动是否有效
function isValidMove(position) {
  return gameState.maze[position.y] &&
    gameState.maze[position.y][position.x] &&
    gameState.maze[position.y][position.x].walkable;
}

// 检查碰撞
function checkCollisions(result, operate) {
  const pos = gameState.playerPosition;

  // 检查宝石
  const blueGemIndex = gameState.blueGems.findIndex(g => g.x === pos.x && g.y === pos.y);
  const redGemIndex = gameState.redGems.findIndex(g => g.x === pos.x && g.y === pos.y);

  if (blueGemIndex !== -1) {
    if (gameState.autoCollect || operate === 'collect_blue') {
      gameState.blueGems.splice(blueGemIndex, 1);
      gameState.collectedBlueGems++;
      result.gemCollected = true;
      gameState.onGemType = 'none';
    } else {
      gameState.onGemType = 'blue';
    }
    result.gemType = 'blue';
  } else if (redGemIndex !== -1) {
    if (gameState.autoCollect || operate === 'collect_red') {
      gameState.redGems.splice(redGemIndex, 1);
      gameState.collectedRedGems++;
      result.gemCollected = true;
      gameState.onGemType = 'none';
    } else {
      gameState.onGemType = 'red';
    }
    result.gemType = 'red';
  }
  else {
    gameState.onGemType = 'none';
  }

  // 检查怪物
  if (gameState.monsters.some(m => m.x === pos.x && m.y === pos.y)) {
    result.monsterHit = true;
    gameState.gameOver = true;
    gameState.success = false;
  }

  // 检查传送门
  let teleportGate = null;
  // 检查是否在传送门上, 传送门是两个点, 如果角色在一个点上, 则传送到另一个点上
  gameState.teleportGates.some(t => {
    return t.some(g => {
      if (t.length === 2) {
        const isOnGate = (gate, otherGate) => {
          let check = gate.x === pos.x && gate.y === pos.y;
          if (check) {
            return otherGate;
          }
          return null;
        }
        teleportGate = isOnGate(t[0], t[1]) || isOnGate(t[1], t[0]);
        return !!teleportGate;
      }
      return false;
    })
  })
  if (teleportGate) {
    let timeout = 200;
    timeout = timeout * (100 - speed) / 100;
    gameState.onTeleport = true;
    setTimeout(() => {
      if (teleportGate) {
        gameState.onTeleport = false;
        gameState.playerPosition = teleportGate;
        gameState.action = 'teleport';
        mainWindow.webContents.send('playAudio', 'teleport');
        mainWindow.webContents.send('renderGameState', generateRenderState());
      }
    }, timeout);
  }

  // 检查是否开启出口
  if (gameState.collectedBlueGems >= gameState.requiredBlueGems &&
    gameState.collectedRedGems >= gameState.requiredRedGems) {
    gameState.exitOpen = true;
  }

  // 检查出口
  if (gameState.exitOpen &&
    pos.x === gameState.exit.x &&
    pos.y === gameState.exit.y) {
    result.reachedExit = true;
    gameState.gameOver = true;
    gameState.success = true;
  }

  return result;
}

const port = 3000;
let server = null;

async function startServer(window) {
  mainWindow = window;

  // 尝试加载保存的配置
  const savedConfig = await loadSavedConfig();
  if (savedConfig) {
    console.log('加载保存的地图配置');
    currentConfig = savedConfig;
  }

  server = http.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
  });
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = {
  startServer,
  stopServer,
  app
}