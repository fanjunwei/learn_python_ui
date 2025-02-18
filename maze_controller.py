import requests
import time
from typing import Dict, Any


class MazeController:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url

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

    def reset_game(self, custom_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """重置游戏"""
        response = requests.post(
            f"{self.base_url}/resetGame",
            json={"config": custom_config} if custom_config else {},
        )
        return response.json()


controller = MazeController()


def example_usage():
    # 获取初始游戏状态
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
