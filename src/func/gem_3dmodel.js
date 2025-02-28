import { Multi3DModel } from './base_3dmodel'
import { Vector3 } from 'three'
import * as THREE from 'three'

class Gem3DModel extends Multi3DModel {
    constructor(scene, playerModel) {
        super(scene, 0.2, new Vector3(0, 0, 0), '@/assets/3d_model/gem.glb')
        this.defaultAnimationName = 'Idle'
        this.rotationSpeed = 0.02
        this.playerModel = playerModel
        // 创建蓝宝石材质
        this.blueMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x0000ff,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.5,
            emissive: 0x0000ff,
            emissiveIntensity: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.8
        })

        // 创建红宝石材质
        this.redMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xff0000,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.5,
            emissive: 0xff0000,
            emissiveIntensity: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.8
        })
    }

    updateScene(gameState) {
        super.updateScene(gameState)
        this.disableAllSubModels()
        const createGem = (gems ,type) => {
            // 为每个宝石创建一个模型实例
            gems.forEach((gem) => {
                let x = gem.x
                let y = gem.y
                let level = gem.level
                let key = `${type}-${x}-${y}-${level}`
                const subModel = this.getAndEnableSubModel(key)
                subModel.model.traverse((node) => {
                    if (node.isMesh) {
                        if(type === 'blue'){
                            node.material = this.blueMaterial
                        }else{
                            node.material = this.redMaterial
                        }
                    }
                })
                let position = this.mazeToPosition(x, y, level)
                position.y += 0.5
                subModel.userData.position = position
                subModel.userData.level = level
                subModel.model.position.copy(position)
            })
        }
        createGem(this.gameState.blueGems, 'blue')
        createGem(this.gameState.redGems, 'red')
        this.updateSubModelsToScene()
    }

    updateAnimation(time, delta) {
        this.getEnabledSubModels().forEach((subModel, index) => {
            let distance = Math.sqrt(Math.pow(subModel.model.position.x - this.playerModel.getPosition().x, 2) + Math.pow(subModel.model.position.z - this.playerModel.getPosition().z, 2))
            let y = subModel.userData.position.y
            if (distance < 1 && subModel.userData.level === this.gameState.currentLevel) {
              y = y + (1 - distance) * 0.7
            }
            subModel.model.position.y = y + Math.sin(time * 2 + index) * 0.1
            subModel.model.rotation.y = (time + index * 0.1) * (index % 2 === 0 ? 1 : -1)
          })
    }
}

export default Gem3DModel 