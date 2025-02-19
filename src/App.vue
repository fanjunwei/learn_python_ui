<template>
  <el-container class="app-container">
    <el-header>
      <el-menu mode="horizontal" :ellipsis="false" class="nav-menu">
        <el-menu-item index="game" @click="currentView = 'game'">
          <el-icon><Orange /></el-icon>
          <span>游戏</span>
        </el-menu-item>
        <el-menu-item index="editor" @click="currentView = 'editor'">
          <el-icon><Edit /></el-icon>
          <span>地图编辑器</span>
        </el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <MazeGame v-if="currentView === 'game'" />
      <MapEditor v-if="currentView === 'editor'" />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import MazeGame from './components/MazeGame.vue'
import MapEditor from './components/MapEditor.vue'

const currentView = ref('game')
</script>

<style>
.app-container {
  min-height: 100vh;
}
</style> 