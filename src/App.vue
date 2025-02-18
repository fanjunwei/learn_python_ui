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
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f0f0;
}
</style> 