import { Multi3DModel } from './base_3dmodel'
import { Vector3 } from 'three'
import * as THREE from 'three'


class Tree3DModel extends Multi3DModel {
    constructor(scene) {
        super(scene, 1, new Vector3(0, 0, 0), '@/assets/3d_model/tree.glb')
    }
    updateScene(gameState) {
        super.updateScene(gameState)
        if (this.gameState.action === 'reset') {
            this.disableAllSubModels()
            // 为每一层创建障碍     
            this.gameState.levels.forEach((level, levelIndex) => {
                // 创建障碍
                level.maze.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        let key = `${x}-${y}-${levelIndex}`
                        if (!cell.walkable) {
                            const subModel = this.getAndEnableSubModel(key)
                            let position = this.mazeToPosition(x, y, levelIndex)
                            subModel.model.position.copy(position)
                        }
                    })
                })
            })
            this.updateSubModelsToScene()
        }
    }

    updateAnimation(time, delta) {
        // console.log('updateAnimation', time, delta)
    }
}

export default Tree3DModel 