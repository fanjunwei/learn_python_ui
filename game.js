const { ipcRenderer } = require('electron');
class MazeGame {
    constructor() {
        this.initializeControls();
        ipcRenderer.on('renderGameState', (event, gameState) => {
            this.renderGameState(gameState);
        });
        ipcRenderer.on('showToast', (event, message) => {
            this.showToast(message);
        });
        ipcRenderer.on('resetGame', () => {
            this.resetGame();
        });
    }

    // 显示toast提示
    showToast(message) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        toast.addEventListener('animationend', () => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        });
    }

    initializeControls() {
        document.getElementById('turnLeft').addEventListener('click', () => this.turn('left'));
        document.getElementById('moveForward').addEventListener('click', () => this.move());
        document.getElementById('turnRight').addEventListener('click', () => this.turn('right'));
    }

    // 渲染游戏状态
    renderGameState(gameState) {
        const mazeElement = document.getElementById('maze');
        mazeElement.style.gridTemplateColumns = `repeat(${gameState.maze[0].length}, 40px)`;
        mazeElement.innerHTML = '';

        for (let y = 0; y < gameState.maze.length; y++) {
            for (let x = 0; x < gameState.maze[y].length; x++) {
                const cell = document.createElement('div');
                cell.className = `cell ${gameState.maze[y][x].walkable ? '' : 'wall'}`;

                // 添加玩家
                if (x === gameState.playerPosition.x && y === gameState.playerPosition.y) {
                    const player = document.createElement('div');
                    player.className = 'player';
                    player.style.transform = `translate(-50%, -50%) rotate(${gameState.playerDirection * 90}deg)`;
                    cell.appendChild(player);
                }

                // 添加蓝宝石
                if (gameState.blueGems.some(g => g.x === x && g.y === y)) {
                    const gem = document.createElement('div');
                    gem.className = 'gem blue';
                    cell.appendChild(gem);
                }

                // 添加红宝石
                if (gameState.redGems.some(g => g.x === x && g.y === y)) {
                    const gem = document.createElement('div');
                    gem.className = 'gem red';
                    cell.appendChild(gem);
                }

                // 添加怪物
                if (gameState.monsters.some(m => m.x === x && m.y === y)) {
                    const monster = document.createElement('div');
                    monster.className = 'monster';
                    cell.appendChild(monster);
                }

                // 添加出口
                if (x === gameState.exit.x && y === gameState.exit.y) {
                    const exit = document.createElement('div');
                    exit.className = `exit ${gameState.exitOpen ? 'open' : ''}`;
                    cell.appendChild(exit);
                }

                mazeElement.appendChild(cell);
            }
        }

        // 更新状态栏
        document.getElementById('blueGemCount').textContent = gameState.collectedBlueGems;
        document.getElementById('redGemCount').textContent = gameState.collectedRedGems;
        document.getElementById('requiredBlueGems').textContent = gameState.requiredBlueGems;
        document.getElementById('requiredRedGems').textContent = gameState.requiredRedGems;
        document.getElementById('exitStatus').textContent = gameState.exitOpen ? '开启' : '关闭';
    }

    async turn(direction) {
        try {
            const response = await fetch('http://localhost:3000/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: direction === 'left' ? 'turnLeft' : 'turnRight'
                }),
            });

            const result = await response.json();
         
        } catch (error) {
            console.error('转向操作失败:', error);
        }
    }

    async move() {
        try {
            const response = await fetch('http://localhost:3000/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'forward'
                }),
            });

            const result = await response.json();
        } catch (error) {
            console.error('移动操作失败:', error);
        }
    }

    async resetGame() {
        try {
            const response = await fetch('http://localhost:3000/setMazeConfig', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(exampleMazeConfig)
            });

            const result = await response.json();
            if (result.success) {
                this.renderGameState(result.gameState);
            }
        } catch (error) {
            console.error('重置游戏失败:', error);
        }
    }
}

// 创建游戏实例
const game = new MazeGame();

// 示例迷宫配置
const exampleMazeConfig = {
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

// 等待DOM加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', async () => {
    await game.resetGame();
}); 