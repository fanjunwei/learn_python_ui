import random
from pathlib import Path
import tomli_w


def generate_maze(width=6, height=6, wall_density=0.2):
    """生成随机迷宫布局"""
    maze = []
    for y in range(height):
        row = []
        for x in range(width):
            # 确保起点和周围的格子是可行走的
            if (x == 0 and y == 0) or (x == 1 and y == 0) or (x == 0 and y == 1):
                row.append(True)
            else:
                row.append(random.random() > wall_density)
        maze.append(row)
    return maze


def get_valid_positions(maze, count, exclude_positions=None):
    """获取指定数量的有效位置"""
    if exclude_positions is None:
        exclude_positions = set()

    valid_positions = []
    for y in range(len(maze)):
        for x in range(len(maze[0])):
            if maze[y][x] and (x, y) not in exclude_positions:
                valid_positions.append((x, y))

    return random.sample(valid_positions, min(count, len(valid_positions)))


def generate_level_config(width, height, wall_density, used_positions=None):
    """生成单层迷宫配置"""
    if used_positions is None:
        used_positions = set()

    maze = generate_maze(width, height, wall_density)
    level_used_positions = used_positions.copy()

    # 生成宝石位置
    blue_gem_count = random.randint(2, 3)
    blue_gem_positions = get_valid_positions(maze, blue_gem_count, level_used_positions)
    level_used_positions.update(set(blue_gem_positions))

    red_gem_count = random.randint(2, 3)
    red_gem_positions = get_valid_positions(maze, red_gem_count, level_used_positions)
    level_used_positions.update(set(red_gem_positions))

    # 生成怪物位置
    monster_count = random.randint(1, 2)
    monster_positions = get_valid_positions(maze, monster_count, level_used_positions)
    level_used_positions.update(set(monster_positions))

    return {
        "maze": maze,
        "blueGems": [{"x": x, "y": y} for x, y in blue_gem_positions],
        "redGems": [{"x": x, "y": y} for x, y in red_gem_positions],
        "monsters": [{"x": x, "y": y} for x, y in monster_positions],
    }, level_used_positions


def generate_map_config(index):
    """生成多层迷宫配置"""
    level_count = random.randint(2, 3)  # 随机生成2-3层迷宫
    levels = []
    all_used_positions = set()
    teleport_gates = []

    # 为每层生成基本配置
    for level in range(level_count):
        width = random.randint(6, 8)
        height = random.randint(6, 8)
        wall_density = random.uniform(0.15, 0.25)

        level_config, used_positions = generate_level_config(
            width, height, wall_density, all_used_positions
        )
        levels.append(level_config)
        all_used_positions.update(used_positions)

    # 生成起点（在第一层）
    start = {"x": 0, "y": 0, "level": 0}

    # 生成终点（在最后一层）
    last_level = levels[-1]
    exit_positions = get_valid_positions(last_level["maze"], 1, set())
    exit_pos = exit_positions[0]
    exit = {"x": exit_pos[0], "y": exit_pos[1], "level": level_count - 1}

    # 生成层间传送门
    for i in range(level_count - 1):
        current_level = levels[i]
        next_level = levels[i + 1]

        # 在当前层找一个传送点
        current_positions = get_valid_positions(current_level["maze"], 1, set())
        current_pos = current_positions[0]

        # 在下一层找一个传送点
        next_positions = get_valid_positions(next_level["maze"], 1, set())
        next_pos = next_positions[0]

        # 添加传送门
        teleport_gates.append(
            [
                {"x": current_pos[0], "y": current_pos[1], "level": i},
                {"x": next_pos[0], "y": next_pos[1], "level": i + 1},
            ]
        )

    # 计算所需宝石总数
    total_blue_gems = sum(len(level["blueGems"]) for level in levels)
    total_red_gems = sum(len(level["redGems"]) for level in levels)

    config = {
        "title": f"多层迷宫配置 {index:03d}",
        "start": start,
        "exit": exit,
        "levels": levels,
        "teleportGates": teleport_gates,
        "requiredBlueGems": total_blue_gems,
        "requiredRedGems": total_red_gems,
    }

    return config


def generate_all_maps():
    """生成所有地图配置文件"""
    configs_dir = Path(__file__).parent / "configs"
    configs_dir.mkdir(exist_ok=True)

    for i in range(1, 22):  # 生成21个配置文件
        config = generate_map_config(i)
        config_path = configs_dir / f"{i:03d}_config.toml"
        if config_path.exists():
            print(f"地图配置 {config_path} 已存在")
            continue
        with open(config_path, "wb") as f:
            tomli_w.dump(config, f)
        print(f"生成地图配置: {config_path}")


if __name__ == "__main__":
    generate_all_maps()
