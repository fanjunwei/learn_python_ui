import { Multi3DModel } from './base_3dmodel'
import { Vector3 } from 'three'
import * as THREE from 'three'

class Teleport3DModel extends Multi3DModel {
    constructor(scene) {
        super(scene, 0.5, new Vector3(0, 0, 0), '@/assets/3d_model/teleport.glb')
    }
    updateScene(gameState) {
        super.updateScene(gameState)
        this.disableAllSubModels()
        this.gameState.teleportGates.forEach((teleportGroup, groupIndex) => {
            teleportGroup.forEach((gate) => {
            let x = gate.x
            let y = gate.y
            let level = gate.level
            let key = `${x}-${y}-${level}`
            const newModel = this.getAndEnableSubModel(key)
            if (newModel.is_new) {
                const hue = (groupIndex * 50) % 360
                const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.5)
                newModel.model.traverse((node) => {
                    if (node.isMesh) {
                        node.material = node.material.clone()
                        node.material.color = color
                        node.material.emissive = color
                        node.material.emissiveIntensity = 2.0
                        if (node.material.metalness !== undefined) {
                            node.material.metalness = 0.8
                        }
                        if (node.material.roughness !== undefined) {
                            node.material.roughness = 0.2
                        }
                    }
                })
                let position = this.mazeToPosition(x, y, level)
                newModel.model.position.copy(position)
                newModel.switchAnimation('Idle')
                }
            })
        })
        this.updateSubModelsToScene()
    }

    updateAnimation(time, delta) {
        this.getEnabledSubModels().forEach((model, index) => {
            model.model.rotation.y = time + index * 0.1
        })
    }
}

export default Teleport3DModel 