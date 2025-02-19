<template>
  <div class="app">
    <div class="nav-bar">
      <button @click="currentView = 'game'" :class="{ active: currentView === 'game' }">游戏</button>
      <button @click="currentView = 'editor'" :class="{ active: currentView === 'editor' }">地图编辑器</button>
    </div>
    <MazeGame v-if="currentView === 'game'" />
    <MapEditor v-if="currentView === 'editor'" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MazeGame from './components/MazeGame.vue'
import MapEditor from './components/MapEditor.vue'

const currentView = ref('game')
</script>

<style scoped>
.app {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f0f0f0;
}

.nav-bar {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.nav-bar button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  background: white;
  cursor: pointer;
  transition: background-color 0.3s;
  color: black;
}

.nav-bar button.active {
  background: #4CAF50;
  color: white;
}

.nav-bar button:hover:not(.active) {
  background: #e0e0e0;
}
</style> 