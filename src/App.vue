<script setup lang="ts">
import { onMounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Toolbar from './components/Toolbar.vue'
import NoteHeader from './components/NoteHeader.vue'
import Canvas from './components/Canvas.vue'
import PropsPanel from './components/PropsPanel.vue'
import { useCanvasStore } from './stores/canvas'
import { useNavStore } from './stores/nav'

const canvas = useCanvasStore()
const nav = useNavStore()
let ready = false

onMounted(async () => {
  await canvas.initFromStorage()
  ready = true
})

let switchQueue = Promise.resolve()
let switchToken = 0

watch(() => nav.activeNoteId, (newId, oldId) => {
  if (!ready || !newId || newId === oldId) return

  const token = ++switchToken
  switchQueue = switchQueue.then(async () => {
    if (oldId) await canvas.saveNoteById(oldId)
    if (token !== switchToken) return
    await canvas.loadNote(newId)
    await canvas.saveActiveNoteId(newId)
  }).catch(error => {
    console.error('[App] Note switch failed:', newId, error)
  })
})
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-area">
      <NoteHeader />
      <Toolbar />
      <div class="canvas-container">
        <Canvas />
        <PropsPanel />
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --surface: #ffffff;
  --surface-hover: #f5f7fa;
  --border: #e8eaed;
  --text: #202124;
  --text-secondary: #5f6368;
  --primary: #1a73e8;
  --primary-light: #e8f0fe;
  --primary-border: #a8c7fa;
  --bg: #f5f6fa;
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  --radius: 8px;
  --danger: #ff4d4f;
  --danger-light: #fff1f0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
}
</style>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.canvas-container {
  flex: 1;
  position: relative;
  display: flex;
  min-height: 0;
}
</style>