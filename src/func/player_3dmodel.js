import { Base3DModel } from './base_3dmodel'
import { Vector3 } from 'three'
import * as THREE from 'three'

class Player3DModel extends Base3DModel {
    constructor(scene) {
        super(scene, 0.5, new Vector3(0, 0, 0), '@/assets/3d_model/player.glb', false)
        this.defaultAnimationName = 'Idle'
        this.fadeOutDuration = 1
        this.fadeOutProgress = this.fadeOutDuration
        this.teleportDuration = 2
        this.teleportProgress = this.teleportDuration

    }
    moveTo(x = null, y = null, z = null, rx = null, ry = null, rz = null, hasAnimation = true) {
        console.log('moveTo', x, y, z, rx, ry, rz, hasAnimation)
        this.currentPosition = this.model.position.clone()
        this.currentRotation = this.model.rotation.clone()

        this.targetPosition = this.model.position.clone()
        if (x !== null) this.targetPosition.x = x
        if (y !== null) this.targetPosition.y = y
        if (z !== null) this.targetPosition.z = z
        this.targetRotation = this.model.rotation.clone()
        if (rx !== null) this.targetRotation.x = rx
        if (ry !== null) this.targetRotation.y = ry
        if (rz !== null) this.targetRotation.z = rz
        console.log('moveTo', this.targetPosition, this.targetRotation)
        if (!hasAnimation) {
            this.currentPosition.copy(this.targetPosition)
            this.currentRotation.copy(this.targetRotation)
            this.model.position.copy(this.targetPosition)
            this.model.rotation.copy(this.targetRotation)
            console.log('moveTo', this.model.position, this.model.rotation)
        } else {
            this.moveProgress = 0
        }
    }
    fadeOut() {
        this.fadeOutProgress = 0
    }
    show() {
        this.model.visible = true
        this.model.traverse((node) => {
            if (node.isMesh) {
                node.material.transparent = true
                node.material.opacity = 1
            }
        })
    }
    teleportTo(x, y, z) {
        this.teleportStartPosition = this.model.position.clone()
        this.teleportEndPosition = new Vector3(x, y, z)
        this.teleportProgress = 0
        this.switchAnimation('Idle')
    }

    updateAnimation(time, delta) {
        if (this.mixer) {
            this.mixer.update(delta)
        }
        if (!this.gameState) return
        // 更新移动动画
        let duration
        if (this.gameState.action === 'forward') {
            duration = 2
        } else if (this.gameState.action === 'turnLeft') {
            duration = 0.5
        } else if (this.gameState.action === 'turnRight') {
            duration = 0.5
        } else if (this.gameState.action === 'collect_blue') {
            duration = 2
        } else if (this.gameState.action === 'collect_red') {
            duration = 2
        } else {
            duration = 0.5
        }
        if (this.moveProgress < duration) {
            this.moveProgress += delta
            const t = Math.min(this.moveProgress / duration, 1)
            // 使用缓入缓出的缓动函数
            const easeT = t < 0.5 ? (1 - Math.cos(t * Math.PI)) / 2 : (1 + Math.sin((t - 0.5) * Math.PI)) / 2
            // 位置插值
            this.model.position.lerpVectors(this.currentPosition, this.targetPosition, easeT)
            console.log('updateAnimation model.position', this.model.position)
            // 旋转插值
            this.model.rotation.x = THREE.MathUtils.lerp(this.currentRotation.x, this.targetRotation.x, easeT)
            this.model.rotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.targetRotation.y, easeT)
            this.model.rotation.z = THREE.MathUtils.lerp(this.currentRotation.z, this.targetRotation.z, easeT)
            // 根据动画进度切换动画状态
            if (t < 0.8) {
                if (this.gameState.action === 'forward') {
                    this.switchAnimation('Walk')
                } else if (this.gameState.action === 'turnLeft') {
                    this.switchAnimation('Walk')
                } else if (this.gameState.action === 'turnRight') {
                    this.switchAnimation('Walk')
                } else if (this.gameState.action === 'collect_blue') {
                    this.switchAnimation('Jump')
                } else if (this.gameState.action === 'collect_red') {
                    this.switchAnimation('Jump')
                } else {
                    this.switchAnimation('Idle')
                }
            } else if (this.gameState.gameOver && this.gameState.success) {
                this.switchAnimation('Dance')
            } else {
                this.switchAnimation('Idle')
            }
        }
        // 更新淡出动画
        if (this.fadeOutProgress < this.fadeOutDuration) {
            this.fadeOutProgress += delta
            const opacity = 1 - (this.fadeOutProgress / this.fadeOutDuration)
            this.model.traverse((node) => {
                if (node.isMesh) {
                    node.material.opacity = Math.max(0, opacity)
                }
            })
        }
        // 更新传送动画
        if (this.teleportProgress < this.teleportDuration) {
            this.teleportProgress += delta
            const t = Math.min(this.teleportProgress / this.teleportDuration, 1)

            if (t <= 0.5) { // 渐隐阶段
                const fadeOutT = t / 0.5
                // 从当前层级高度渐变消失
                this.model.position.y = this.teleportStartPosition.y - fadeOutT * 0.5
                this.model.traverse((node) => {
                    if (node.isMesh) {
                        node.material.transparent = true
                        node.material.opacity = 1 - fadeOutT
                    }
                })
            } else if (t < 1) { // 渐显阶段
                const fadeInT = (t - 0.5) / 0.5
                this.model.visible = true
                this.model.position.copy(this.teleportEndPosition)
                // 在目标层级高度渐变出现
                this.model.position.y = this.teleportEndPosition.y + fadeInT * 0.5 - 0.5
                this.model.traverse((node) => {
                    if (node.isMesh) {
                        node.material.transparent = true
                        node.material.opacity = fadeInT
                    }
                })
            } else { // 传送完成
                this.teleportProgress = this.teleportDuration
                this.model.position.copy(this.teleportEndPosition)
                this.model.traverse((node) => {
                    if (node.isMesh) {
                        node.material.transparent = false
                        node.material.opacity = 1
                    }
                })
            }

        }
    }
    updateScene(gameState) {
        super.updateScene(gameState)
        console.log('class Player3DModel updateScene', this.gameState)
        this.show()
        // 处理游戏结束时的渐隐效果
        let postion = this.mazeToPosition(gameState.playerPosition.x, gameState.playerPosition.y, gameState.currentLevel)

        if (gameState.gameOver) {
            if (!gameState.success) {
                this.fadeOut()
            } else {
                postion.y += 0.05
            }
        }
        let targetPlayerRotation = -gameState.playerDirection * Math.PI / 2 + Math.PI

        if (gameState.action !== 'teleport') {
            if (gameState.action === 'reset') {
                this.switchAnimation('Idle')
            }
            this.moveTo(postion.x, postion.y, postion.z, null, targetPlayerRotation, null,
                gameState.action != 'reset')
        } else {
            this.teleportTo(postion.x, postion.y, postion.z)
        }

        this.addToScene()
    }

}

export default Player3DModel