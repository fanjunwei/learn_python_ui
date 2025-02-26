import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
let glbloader = new GLTFLoader()
class Base3DModel {
  constructor(scene, scale = 1, position = new Vector3(0, 0, 0), glbPath = null, multiply = false) {
    this.scene = scene
    this.scale = scale
    this.position = position
    this.glbPath = glbPath
    this.multiply = multiply
    this.mixer = null
    this.animations = {}
    this.animationFadeTime = 0.5
  }
  async init() {
    this.model = await this.createModel()
    if (!this.model) return
    this.model.scale.set(this.scale, this.scale, this.scale)
    this.model.position.set(this.position.x, this.position.y, this.position.z)
    this.model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
      }
    })
    if (!this.multiply) {
      this.scene.add(this.model)
    } 
  }

  async createModel() {
    if (!this.glbPath) return null
    return await this.loadModel(this.glbPath)
  }

  async loadModel(glbPath) {
    try {
      return await glbloader.loadAsync(new URL(glbPath, import.meta.url).href)
    } catch (error) {
      console.error('Error loading model:', error)
      return null
    }
  }

  initAnimation() {
    if (!this.model.animations || this.model.animations.length === 0) return
    this.mixer = new THREE.AnimationMixer(this.model)
    this.model.animations.forEach(animation => {
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

  updateScene(gameScene) {
    throw new Error('updateScene is not implemented')
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
  }
}

export default Base3DModel