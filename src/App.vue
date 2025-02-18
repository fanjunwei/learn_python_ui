<template>
  <div class="app">
    <MazeGame />
  </div>
</template>

<script setup>
import MazeGame from './components/MazeGame.vue'
</script>

<style scoped>
.app {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f0f0f0;
}
</style> 