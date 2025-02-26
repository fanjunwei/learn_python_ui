import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Vector3 } from 'three'
import * as THREE from 'three'
let glbloader = new GLTFLoader()
class Base3DModel {
  static LEVEL_HEIGHT = 5
  constructor(scene, scale = 1, position = new Vector3(0, 0, 0), glbPath = null, multiply = false) {
    this.scene = scene
    this.scale = scale
    this.position = position
    this.glbPath = glbPath
    this.multiply = multiply
    this.mixer = null
    this.animations = {}
    this.animationFadeTime = 0.5
    this.addedToScene = false
    this.inited = false
  }
  async init() {
    this.model = await this.createModel()
    if (!this.model) return
    console.log('init model', this.model)
    this.model.scale.set(this.scale, this.scale, this.scale)
    this.model.position.set(this.position.x, this.position.y, this.position.z)
    this.model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
      }
    })
    if (!this.multiply) {
      // this.addToScene()
    }
    this.initAnimation()
    this.inited = true
  }
  addToScene() {
    if (!this.addedToScene) {
      console.log('addToScene', this.model)
      this.scene.add(this.model)
      this.addedToScene = true
    }
  }

  async createModel() {
    if (!this.glbPath) return null
    return await this.loadModel(this.glbPath)
  }

  async loadModel(glbPath) {
    try {
      console.log('loadModel', glbPath)
      let url = glbPath.replace('@', '/src')
      console.log('loadModel', url)
      this.gltf = await glbloader.loadAsync(url)
      return this.gltf.scene
    } catch (error) {
      console.error('Error loading model:', error)
      return null
    }
  }

  initAnimation() {
    console.log('initAnimation', this.gltf.animations)

    if (!this.gltf || this.gltf.animations.length === 0) return
    this.mixer = new THREE.AnimationMixer(this.model)
    this.gltf.animations.forEach(animation => {
      console.log('initAnimation', animation.name)
      const action = this.mixer.clipAction(animation)
      this.animations[animation.name] = action
    })
    if (this.defaultAnimationName) {
      this.switchAnimation(this.defaultAnimationName)
    }
  }


  stop(animationName) {
    if (!this.animations[animationName]) return
    this.animations[animationName].stop()
  }

  updateAnimation(time, deltaTime) {
    throw new Error('updateAnimation is not implemented')
  }

  updateScene(gameState) {
    this.gameState = gameState
  }
  getPosition() {
    if (!this.model) return null
    return this.model.position
  }
  switchAnimation(newAnimation) {
    if (!this.mixer || !this.animations[newAnimation] || this.currentAnimation === newAnimation) return
    const fadeTime = this.animationFadeTime
    if (this.currentAnimation && this.animations[this.currentAnimation]) {
      this.animations[this.currentAnimation].fadeOut(fadeTime)
    }

    this.animations[newAnimation].reset().fadeIn(fadeTime).play()
    this.currentAnimation = newAnimation
  }
  disposeObject(obj) {
    if (obj.geometry) {
      obj.geometry.dispose()
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose())
      } else {
        obj.material.dispose()
      }
    }
    if (obj.children) {
      obj.children.forEach(child => this.disposeObject(child))
    }
  }
  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.model)
    }
    this.disposeObject(this.model)
    this.inited = false
  }
  mazeToPosition(x, y, level) {
    return new Vector3(x - this.gameState.maze[0].length / 2,
      level * Base3DModel.LEVEL_HEIGHT,
       y - this.gameState.maze.length / 2,
      )
  }
}

export default Base3DModel