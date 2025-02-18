class MazeGame {
    constructor() {
        this.maze = [];
        this.playerPosition = { x: 0, y: 0 };
        this.playerDirection = 0; // 0: 上, 1: 右, 2: 下, 3: 左
        this.blueGems = [];
        this.redGems = [];
        this.monsters = [];
        this.exit = { x: 0, y: 0 };
        this.exitOpen = false;
        this.collectedBlueGems = 0;
        this.collectedRedGems = 0;
        this.requiredBlueGems = 3;
        this.requiredRedGems = 3;

        this.initializeControls();
        this.updateUI();
    }

    initializeControls() {
        document.getElementById('turnLeft').addEventListener('click', () => this.turn('left'));
        document.getElementById('moveForward').addEventListener('click', () => this.move());
        document.getElementById('turnRight').addEventListener('click', () => this.turn('right'));
    }

    async turn(direction) {
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
        if (result.success) {
            this.playerDirection = direction === 'left' ? 
                (this.playerDirection + 3) % 4 : 
                (this.playerDirection + 1) % 4;
            this.renderMaze();
        }
    }

    async move() {
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
        if (result.success) {
            // 使用服务器返回的新位置更新玩家位置
            if (result.newPosition) {
                this.playerPosition = result.newPosition;
            }

            if (result.gemCollected) {
                if (result.gemType === 'blue') {
                    this.collectedBlueGems++;
                    this.removeGem(this.playerPosition, 'blue');
                } else {
                    this.collectedRedGems++;
                    this.removeGem(this.playerPosition, 'red');
                }
            }

            if (result.monsterHit) {
                alert('你被怪物抓住了！游戏结束！');
                this.resetGame();
                return;
            }

            if (result.reachedExit) {
                alert('恭喜你完成迷宫！');
                this.resetGame();
                return;
            }

            this.renderMaze(); // 使用renderMaze替代updateUI来完全重新渲染迷宫
        } else if (result.hitWall) {
            alert('撞墙了！');
        }
    }

    getNextPosition() {
        const { x, y } = this.playerPosition;
        switch(this.playerDirection) {
            case 0: return { x, y: y - 1 }; // 上
            case 1: return { x: x + 1, y }; // 右
            case 2: return { x, y: y + 1 }; // 下
            case 3: return { x: x - 1, y }; // 左
        }
    }

    removeGem(position, type) {
        const gems = type === 'blue' ? this.blueGems : this.redGems;
        const index = gems.findIndex(g => g.x === position.x && g.y === position.y);
        if (index !== -1) {
            gems.splice(index, 1);
        }
    }

    updateUI() {
        // 更新玩家位置和方向
        const playerElement = document.querySelector('.player');
        if (playerElement) {
            playerElement.style.transform = `translate(-50%, -50%) rotate(${this.playerDirection * 90}deg)`;
        }

        // 更新宝石计数
        document.getElementById('blueGemCount').textContent = this.collectedBlueGems;
        document.getElementById('redGemCount').textContent = this.collectedRedGems;
        document.getElementById('requiredBlueGems').textContent = this.requiredBlueGems;
        document.getElementById('requiredRedGems').textContent = this.requiredRedGems;

        // 更新出口状态
        const exitStatus = document.getElementById('exitStatus');
        if (this.collectedBlueGems >= this.requiredBlueGems && 
            this.collectedRedGems >= this.requiredRedGems) {
            this.exitOpen = true;
            exitStatus.textContent = '开启';
            document.querySelector('.exit').classList.add('open');
        }
    }

    resetGame() {
        this.playerPosition = { x: 0, y: 0 };
        this.playerDirection = 0;
        this.collectedBlueGems = 0;
        this.collectedRedGems = 0;
        this.exitOpen = false;
        this.renderMaze();
    }

    // 设置迷宫配置
    async setMazeConfig(config) {
        // 先发送配置到服务器
        try {
            const response = await fetch('http://localhost:3000/setMazeConfig', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            if (!result.success) {
                console.error('设置迷宫配置失败');
                return;
            }
        } catch (error) {
            console.error('发送迷宫配置时出错:', error);
            return;
        }

        // 设置客户端状态
        this.maze = config.maze;
        this.playerPosition = config.start;
        this.blueGems = config.blueGems;
        this.redGems = config.redGems;
        this.monsters = config.monsters;
        this.exit = config.exit;
        this.requiredBlueGems = config.requiredBlueGems;
        this.requiredRedGems = config.requiredRedGems;
        this.collectedBlueGems = 0;
        this.collectedRedGems = 0;
        this.exitOpen = false;
        this.playerDirection = 0;

        this.renderMaze();
    }

    renderMaze() {
        const mazeElement = document.getElementById('maze');
        mazeElement.style.gridTemplateColumns = `repeat(${this.maze[0].length}, 40px)`;
        mazeElement.innerHTML = '';

        for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[y].length; x++) {
                const cell = document.createElement('div');
                cell.className = `cell ${this.maze[y][x].walkable ? '' : 'wall'}`;

                // 添加玩家
                if (x === this.playerPosition.x && y === this.playerPosition.y) {
                    const player = document.createElement('div');
                    player.className = 'player';
                    // 根据玩家方向设置旋转角度
                    player.style.transform = `translate(-50%, -50%) rotate(${this.playerDirection * 90}deg)`;
                    cell.appendChild(player);
                }

                // 添加蓝宝石
                if (this.blueGems.some(g => g.x === x && g.y === y)) {
                    const gem = document.createElement('div');
                    gem.className = 'gem blue';
                    cell.appendChild(gem);
                }

                // 添加红宝石
                if (this.redGems.some(g => g.x === x && g.y === y)) {
                    const gem = document.createElement('div');
                    gem.className = 'gem red';
                    cell.appendChild(gem);
                }

                // 添加怪物
                if (this.monsters.some(m => m.x === x && m.y === y)) {
                    const monster = document.createElement('div');
                    monster.className = 'monster';
                    cell.appendChild(monster);
                }

                // 添加出口
                if (x === this.exit.x && y === this.exit.y) {
                    const exit = document.createElement('div');
                    exit.className = `exit ${this.exitOpen ? 'open' : ''}`;
                    cell.appendChild(exit);
                }

                mazeElement.appendChild(cell);
            }
        }

        // 更新状态栏
        document.getElementById('blueGemCount').textContent = this.collectedBlueGems;
        document.getElementById('redGemCount').textContent = this.collectedRedGems;
        document.getElementById('requiredBlueGems').textContent = this.requiredBlueGems;
        document.getElementById('requiredRedGems').textContent = this.requiredRedGems;

        // 更新出口状态
        const exitStatus = document.getElementById('exitStatus');
        if (this.collectedBlueGems >= this.requiredBlueGems && 
            this.collectedRedGems >= this.requiredRedGems) {
            this.exitOpen = true;
            exitStatus.textContent = '开启';
            document.querySelector('.exit').classList.add('open');
        }
    }
}

// 创建游戏实例并初始化
const game = new MazeGame();

// 设置示例迷宫配置
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
    await game.setMazeConfig(exampleMazeConfig);
}); 