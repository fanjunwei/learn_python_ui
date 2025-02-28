import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Vector3 } from 'three'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'
let glbloader = new GLTFLoader()
function disposeObject(obj) {
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
    obj.children.forEach(child => disposeObject(child))
  }
}
class Base3DModel {
  static LEVEL_HEIGHT = 5
  constructor(scene, scale = 1, position = new Vector3(0, 0, 0), glbPath = null, multiply = false) {
    if (!scene) {
      return
    }
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
    if (!this.gltf || this.gltf.animations.length === 0) return
    this.mixer = new THREE.AnimationMixer(this.model)
    this.gltf.animations.forEach(animation => {
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

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.model)
    }
    disposeObject(this.model)
    this.inited = false
  }
  mazeToPosition(x, y, level) {
    return new Vector3(x - this.gameState.maze[0].length / 2,
      level * Base3DModel.LEVEL_HEIGHT,
      y - this.gameState.maze.length / 2,
    )
  }
}

class Sub3DModel extends Base3DModel {
  constructor(model, key, animations = {}) {
    super()
    this.model = model
    this.key = key
    this.enabled = true
    this.addedToScene = false
    this.mixer = null
    this.animations = {}
    this.userData = {}
    this.initAnimation(animations)
  }
  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.model)
    }
    disposeObject(this.model)
  }
  initAnimation(animations) {
    if (!animations || Object.keys(animations).length === 0) return
    this.mixer = new THREE.AnimationMixer(this.model)
    Object.entries(animations).forEach(([name, originalAction]) => {
      const clip = originalAction.getClip()
      const action = this.mixer.clipAction(clip)
      this.animations[name] = action
    })
    if (this.defaultAnimationName) {
      this.switchAnimation(this.defaultAnimationName)
    }
  }
}
class Multi3DModel extends Base3DModel {
  constructor(scene, scale = 1, position = new Vector3(0, 0, 0), glbPath = null) {
    super(scene, scale, position, glbPath, true)
    this.sub_models = {}
  }
  getAndEnableSubModel(key) {
    if (this.sub_models[key]) {
      this.sub_models[key].enabled = true
      this.sub_models[key].is_new = false
      return this.sub_models[key]
    } else {
      let model = SkeletonUtils.clone(this.model)
      // const mixer = new THREE.AnimationMixer(model)
      // model.mixer = mixer

      // Object.entries(this.animations).forEach(([name, originalAction]) => {
      //   const clip = originalAction.getClip()
      //   const action = mixer.clipAction(clip)
      //   this.animations[name] = action
      // })
      let subModel = new Sub3DModel(model, key, this.animations)
      this.sub_models[key] = subModel
      subModel.is_new = true
      return subModel
    }
  }
  getEnabledSubModels() {
    return Object.values(this.sub_models).filter(model => model.enabled)
  }
  disableAllSubModels() {
    Object.values(this.sub_models).forEach(model => {
      model.enabled = false
    })
  }
  updateSubModelsToScene() {
    Object.values(this.sub_models).forEach(model => {
      if (model.enabled) {
        if (!model.addedToScene) {
          this.scene.add(model.model)
          model.addedToScene = true
        }
      } else {
        if (model.addedToScene) {
          this.scene.remove(model.model)
          model.addedToScene = false
        }
      }
    })
  }
  switchSubModelAnimation(key, animationName) {
    if (!this.sub_models[key]) return
    this.sub_models[key].switchAnimation(animationName)
  }
  clearSubModels() {
    Object.values(this.sub_models).forEach(model => {
      model.dispose()
    })
    this.sub_models = {}
  }
  dispose() {
    this.clearSubModels()
    super.dispose()
  }

}

export { Base3DModel, Multi3DModel }