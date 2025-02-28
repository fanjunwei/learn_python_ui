import { Multi3DModel } from './base_3dmodel'
import { Vector3 } from 'three'

class Monster3DModel extends Multi3DModel {
    constructor(scene) {
        super(scene, 0.5, new Vector3(0, 0, 0), '@/assets/3d_model/怪物.glb', false)
        this.defaultAnimationName = 'Idle'
    }

    updateScene(gameState) {
        super.updateScene(gameState)
        this.disableAllSubModels()
        this.gameState.monsters.forEach((monster) => {
            let x = monster.x
            let y = monster.y
            let level = monster.level
            let key = `${x}-${y}-${level}`
            const newMonsterModel = this.getAndEnableSubModel(key)
            if(newMonsterModel.is_new){
                let position = this.mazeToPosition(x, y, level)
                newMonsterModel.model.position.copy(position)
                newMonsterModel.model.rotation.y = (monster.x + monster.y) * Math.PI * 0.2
                newMonsterModel.switchAnimation('Idle')
            }
        })
        this.updateSubModelsToScene()
    }
    updateAnimation(time, delta) {
        this.getEnabledSubModels().forEach((sub) => {
            if(sub.mixer){
                sub.mixer.update(delta)
            }
        })
    }
}

export default Monster3DModel 