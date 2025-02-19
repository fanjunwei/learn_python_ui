import requests
import time
import tomli
from typing import Dict, Any
from pathlib import Path


class MazeController:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.config = self.load_config()

    def load_config(self) -> Dict[str, Any]:
        """加载TOML配置文件"""
        configs_dir = Path(__file__).parent / "configs"
        paths = list(configs_dir.glob("*.toml"))
        config_path = paths[0]
        try:
            with open(config_path, "rb") as f:
                config = tomli.load(f)
                return self.convert_config_format(config)
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            return None

    def convert_config_format(self, toml_config: Dict[str, Any]) -> Dict[str, Any]:
        """将TOML配置转换为游戏所需的格式"""
        return {
            "maze": [
                [{"walkable": cell} for cell in row] for row in toml_config["maze"]
            ],
            "start": toml_config["start"],
            "blueGems": toml_config["blueGems"],
            "redGems": toml_config["redGems"],
            "monsters": toml_config["monsters"],
            "exit": toml_config["exit"],
            "requiredBlueGems": toml_config["requiredBlueGems"],
            "requiredRedGems": toml_config["requiredRedGems"],
        }

    def get_game_state(self) -> Dict[str, Any]:
        """获取当前游戏状态"""
        response = requests.get(f"{self.base_url}/getGameState")
        return response.json()

    def move_forward(self) -> Dict[str, Any]:
        """向前移动"""
        response = requests.post(f"{self.base_url}/move", json={"action": "forward"})
        return response.json()

    def turn_left(self) -> Dict[str, Any]:
        """向左转"""
        response = requests.post(f"{self.base_url}/move", json={"action": "turnLeft"})
        return response.json()

    def turn_right(self) -> Dict[str, Any]:
        """向右转"""
        response = requests.post(f"{self.base_url}/move", json={"action": "turnRight"})
        return response.json()

    def collect_blue_gem(self) -> Dict[str, Any]:
        """收集蓝宝石"""
        response = requests.post(f"{self.base_url}/move", json={"action": "collect_blue"})
        return response.json()

    def collect_red_gem(self) -> Dict[str, Any]:
        """收集红宝石"""
        response = requests.post(
            f"{self.base_url}/move", json={"action": "collect_red"}
        )
        return response.json()

    def reset_game(self, custom_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """重置游戏"""
        config_to_use = custom_config if custom_config else self.config
        if not config_to_use:
            print("错误：没有可用的配置")
            return None

        response = requests.post(
            f"{self.base_url}/resetGame", json={"config": config_to_use}
        )
        return response.json()


controller = MazeController()
controller.reset_game()


def example_usage():
    # 创建控制器实例

    # 使用配置文件重置游戏
    print("重置游戏...")
    result = controller.reset_game()
    if not result:
        print("游戏重置失败")
        return

    print("游戏已重置")

    # 获取初始游戏状态
    state = controller.get_game_state()
    print("初始状态:", state)

    # 示例操作序列
    actions = [
        ("右转", controller.turn_right),
        ("向前", controller.move_forward),
        ("左转", controller.turn_left),
        ("向前", controller.move_forward),
        ("向前", controller.move_forward),
    ]

    # 执行操作序列
    for action_name, action in actions:
        print(f"\n执行操作: {action_name}")
        result = action()
        print(f"操作结果: {result.get('message', '成功')}")

        # 如果遇到怪物或到达终点，等待游戏重置
        if result.get("monsterHit") or result.get("reachedExit"):
            print("等待游戏重置...")
            time.sleep(2)
        else:
            # 操作间隔
            time.sleep(0.5)


if __name__ == "__main__":
    example_usage()
