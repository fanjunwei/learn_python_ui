# Python 迷宫游戏 - 青少年编程学习工具

这是一个专门为青少年学习Python编程而设计的3D+2D迷宫游戏。通过编写Python代码来控制游戏角色的移动，学习者可以在实践中掌握Python编程的基础知识。

## 功能特点

- 3D迷宫环境（也支持2D迷宫），支持多层迷宫结构
- 通过Python代码控制角色移动
- 收集宝石（蓝宝石和红宝石）
- 躲避怪物
- 使用传送门在不同格子或不同层之间移动
- 内置地图编辑器，可以创建自定义迷宫

## 安装说明

1. 确保你的电脑已安装Python 3.6或更高版本
2. 安装游戏所需的Python依赖：
```bash
pip install -r requirements.txt
```

## 运行游戏

1. 安装依赖
```bash
npm install
```
2. 启动游戏客户端：
```bash
npm run electron:dev
```

3. 使用Python代码控制游戏：
在项目的`python`目录下，使用Python代码控制游戏：
```python
from maze_controller import controller

# 向前移动
controller.move_forward()

# 左转
controller.turn_left()

# 右转
controller.turn_right()

# 收集蓝宝石
controller.collect_blue_gem()

# 收集红宝石
controller.collect_red_gem()

# 重置游戏
controller.reset_game()
```

## Python API说明

游戏提供了以下Python API供学习者使用：

- `move_forward()`: 向前移动一步
- `turn_left()`: 向左转90度
- `turn_right()`: 向右转90度
- `collect_blue_gem()`: 收集蓝宝石
- `collect_red_gem()`: 收集红宝石
- `reset_game()`: 重置游戏
- `is_on_blue_gem()`: 检查是否在蓝宝石上
- `is_on_red_gem()`: 检查是否在红宝石上
- `get_game_state()`: 获取当前游戏状态

## 游戏目标

1. 在迷宫中收集指定数量的蓝宝石和红宝石
2. 躲避怪物
3. 找到并到达出口
4. 使用传送门在不同格子或不同层之间移动

## 编程学习要点

通过控制迷宫游戏，学习者可以掌握以下Python编程概念：

- 函数调用
- 条件判断
- 循环结构
- 变量使用
- 逻辑思维
- API调用
- JSON数据处理

## 开发者工具

游戏还提供了一个内置的地图编辑器，可以：

- 创建多层迷宫
- 设置墙壁位置
- 放置宝石和怪物
- 设置传送门
- 保存和加载地图配置

## 系统要求

- 操作系统：Windows/macOS/Linux
- Node.js 14.0或更高版本
- Python 3.6或更高版本
- 显卡需支持WebGL

## 注意事项

1. 确保游戏客户端运行时，Python代码才能成功控制游戏
2. 每次移动或转向操作都需要等待动画完成
3. 在收集宝石时需要确保角色正确位于宝石位置

## 许可证

MIT License 