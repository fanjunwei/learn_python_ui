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


def generate_map_config(index):
    """生成单个地图配置"""
    width = random.randint(6, 8)
    height = random.randint(6, 8)
    wall_density = random.uniform(0.15, 0.25)

    maze = generate_maze(width, height, wall_density)
    used_positions = {(0, 0)}  # 起点位置

    # 生成宝石位置
    blue_gem_count = random.randint(3, 5)
    blue_gem_positions = get_valid_positions(maze, blue_gem_count, used_positions)
    used_positions.update(set(blue_gem_positions))

    red_gem_count = random.randint(3, 5)
    red_gem_positions = get_valid_positions(maze, red_gem_count, used_positions)
    used_positions.update(set(red_gem_positions))

    # 生成怪物位置
    monster_count = random.randint(2, 4)
    monster_positions = get_valid_positions(maze, monster_count, used_positions)
    used_positions.update(set(monster_positions))

    # 生成出口位置
    exit_positions = get_valid_positions(maze, 1, used_positions)
    exit_pos = exit_positions[0]

    config = {
        "title": f"迷宫配置 {index:03d}",
        "maze": maze,
        "start": {"x": 0, "y": 0},
        "blueGems": [{"x": x, "y": y} for x, y in blue_gem_positions],
        "redGems": [{"x": x, "y": y} for x, y in red_gem_positions],
        "monsters": [{"x": x, "y": y} for x, y in monster_positions],
        "exit": {"x": exit_pos[0], "y": exit_pos[1]},
        "requiredBlueGems": blue_gem_count,
        "requiredRedGems": red_gem_count,
    }

    return config


def generate_all_maps():
    """生成所有地图配置文件"""
    configs_dir = Path(__file__).parent / "configs"
    configs_dir.mkdir(exist_ok=True)

    for i in range(1, 22):  # 从002开始，因为001已经存在
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
