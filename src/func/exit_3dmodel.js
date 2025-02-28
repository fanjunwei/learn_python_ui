import { Base3DModel } from './base_3dmodel'
import { Vector3 } from 'three'
import * as THREE from 'three'

const FLOOR_TILE_HEIGHT = 0.2

class Exit3DModel extends Base3DModel {
    constructor(scene) {
        super(scene, 1, new Vector3(0, 0, 0), null, false)
    }
    async createModel() {
        const exitGeometry = new THREE.BoxGeometry(1, 0.05, 1)
        const exitMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x00ff00,
          metalness: 0.7,
          roughness: 0.3,
          transparent: true,
          opacity: 0.7,
          envMapIntensity: 1.2,
          emissive: 0x00ff00,
          emissiveIntensity: 0.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1
        })
        const exitMesh = new THREE.Mesh(exitGeometry, exitMaterial)
        return exitMesh
    }

    updateScene(gameState) {
        super.updateScene(gameState)
        let x = gameState.exit.x
        let y = gameState.exit.y
        let level = gameState.exit.level
        let position = this.mazeToPosition(x, y, level)
        position.y += 0.05
        this.model.position.copy(position)
        if (gameState.exitOpen) {
            this.model.material.color.set(0x00ff00)
            this.model.material.emissive.set(0x00ff00)
        } else {
            this.model.material.color.set(0xff0000)
            this.model.material.emissive.set(0xff0000)
        }
        this.addToScene()
    }

}

export default Exit3DModel 