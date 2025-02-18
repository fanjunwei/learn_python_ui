const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
let mainWindow;

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
  exit: { x: 0, y: 0 }
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
  blueGems: [{ x: 2, y: 2 }, { x: 4, y: 0 }, { x: 0, y: 4 }],
  redGems: [{ x: 0, y: 2 }, { x: 2, y: 0 }, { x: 4, y: 4 }],
  monsters: [{ x: 2, y: 1 }, { x: 2, y: 3 }],
  exit: { x: 4, y: 2 },
  requiredBlueGems: 3,
  requiredRedGems: 3
};

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
  const renderState = generateRenderState();
  res.json({
    success: true,
    gameState: renderState
  });
});

// 重置游戏
app.post('/resetGame', (req, res) => {
  const config = req.body.config || defaultMazeConfig;
  resetGameState(config);

  const renderState = generateRenderState();
  res.json({
    success: true,
    message: '游戏已重置',
    gameState: renderState
  });
});

// 设置迷宫配置
app.post('/setMazeConfig', (req, res) => {
  const config = req.body;
  resetGameState(config);

  const renderState = generateRenderState();
  res.json({
    success: true,
    message: '迷宫配置已更新',
    gameState: renderState
  });
});

// 处理移动请求
app.post('/move', (req, res) => {
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

  switch (action) {
    case 'forward':
      result = moveForward();
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

  // 添加提示消息
  if (result.hitWall) {
    result.message = '撞墙了！';
  } else if (result.gemCollected) {
    result.message = `获得${result.gemType === 'blue' ? '蓝' : '红'}宝石！`;
  } else if (result.monsterHit) {
    result.message = '你被怪物抓住了！游戏结束！';
    // 自动重置游戏
    setTimeout(() => resetGameState(defaultMazeConfig), 2000);
  } else if (result.reachedExit) {
    result.message = '恭喜你完成迷宫！';
    // 自动重置游戏
    setTimeout(() => resetGameState(defaultMazeConfig), 2000);
  }
  if (result.success) {
    mainWindow.webContents.send('renderGameState', renderState);
    if (result.message) {
      mainWindow.webContents.send('showToast', result.message);
    }
  }
  if (result.monsterHit || result.reachedExit) {
    setTimeout(async () => {
      mainWindow.webContents.send('resetGame');
    }, 2000);
  }

  res.json({
    ...result,
    gameState: renderState
  });
});

// 重置游戏状态
function resetGameState(config) {
  gameState.maze = JSON.parse(JSON.stringify(config.maze));
  gameState.playerPosition = { ...config.start };
  gameState.blueGems = JSON.parse(JSON.stringify(config.blueGems));
  gameState.redGems = JSON.parse(JSON.stringify(config.redGems));
  gameState.monsters = JSON.parse(JSON.stringify(config.monsters));
  gameState.exit = { ...config.exit };
  gameState.requiredBlueGems = config.requiredBlueGems;
  gameState.requiredRedGems = config.requiredRedGems;
  gameState.collectedBlueGems = 0;
  gameState.collectedRedGems = 0;
  gameState.exitOpen = false;
  gameState.playerDirection = 0;
}

// 生成渲染状态
function generateRenderState() {
  return {
    maze: gameState.maze,
    playerPosition: gameState.playerPosition,
    playerDirection: gameState.playerDirection,
    blueGems: gameState.blueGems,
    redGems: gameState.redGems,
    monsters: gameState.monsters,
    exit: gameState.exit,
    exitOpen: gameState.exitOpen,
    collectedBlueGems: gameState.collectedBlueGems,
    collectedRedGems: gameState.collectedRedGems,
    requiredBlueGems: gameState.requiredBlueGems,
    requiredRedGems: gameState.requiredRedGems
  };
}

// 移动前进
function moveForward() {
  const nextPosition = getNextPosition();
  const result = {
    success: false,
    hitWall: false,
    gemCollected: false,
    gemType: null,
    monsterHit: false,
    reachedExit: false
  };

  if (!isValidMove(nextPosition)) {
    result.hitWall = true;
    return result;
  }

  gameState.playerPosition = nextPosition;
  result.success = true;

  // 检查碰撞
  return checkCollisions(result);
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
function checkCollisions(result) {
  const pos = gameState.playerPosition;

  // 检查宝石
  const blueGemIndex = gameState.blueGems.findIndex(g => g.x === pos.x && g.y === pos.y);
  const redGemIndex = gameState.redGems.findIndex(g => g.x === pos.x && g.y === pos.y);

  if (blueGemIndex !== -1) {
    gameState.blueGems.splice(blueGemIndex, 1);
    gameState.collectedBlueGems++;
    result.gemCollected = true;
    result.gemType = 'blue';
  } else if (redGemIndex !== -1) {
    gameState.redGems.splice(redGemIndex, 1);
    gameState.collectedRedGems++;
    result.gemCollected = true;
    result.gemType = 'red';
  }

  // 检查怪物
  if (gameState.monsters.some(m => m.x === pos.x && m.y === pos.y)) {
    result.monsterHit = true;
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
  }

  return result;
}

const port = 3000;

function startServer(window) {
  mainWindow = window;
  http.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = {
  startServer,
  app
}