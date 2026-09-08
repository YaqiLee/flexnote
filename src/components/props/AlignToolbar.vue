<script setup lang="ts">
import { useCanvasStore } from '../../stores/canvas'

const canvas = useCanvasStore()

function align(direction: 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center') {
  canvas.alignBlocks(direction)
}

function distribute(axis: 'horizontal' | 'vertical') {
  canvas.distributeBlocks(axis)
}
</script>

<template>
  <div class="align-toolbar">
    <button title="左对齐" @click="align('left')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="2" y="8" width="12" height="3" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="1" y1="1" x2="1" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button title="水平居中" @click="align('h-center')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="4" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="2" y="8" width="12" height="3" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1" stroke-dasharray="2 1"/></svg>
    </button>
    <button title="右对齐" @click="align('right')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="6" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="2" y="8" width="12" height="3" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="15" y1="1" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button title="横向均分" @click="distribute('horizontal')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="1" y="5" width="3" height="6" rx="0.5" fill="currentColor"/><rect x="6.5" y="5" width="3" height="6" rx="0.5" fill="currentColor"/><rect x="12" y="5" width="3" height="6" rx="0.5" fill="currentColor"/><line x1="4" y1="8" x2="6.5" y2="8" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1 1"/><line x1="9.5" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1 1"/></svg>
    </button>
    <span class="separator" />
    <button title="顶对齐" @click="align('top')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="1" y1="1" x2="15" y2="1" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button title="垂直居中" @click="align('v-center')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="4" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2 1"/></svg>
    </button>
    <button title="底对齐" @click="align('bottom')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="6" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.5"/><line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button title="纵向均分" @click="distribute('vertical')">
      <svg viewBox="0 0 16 16" width="14" height="14"><rect x="5" y="1" width="6" height="3" rx="0.5" fill="currentColor"/><rect x="5" y="6.5" width="6" height="3" rx="0.5" fill="currentColor"/><rect x="5" y="12" width="6" height="3" rx="0.5" fill="currentColor"/><line x1="8" y1="4" x2="8" y2="6.5" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1 1"/><line x1="8" y1="9.5" x2="8" y2="12" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1 1"/></svg>
    </button>
  </div>
</template>

<style scoped>
.align-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.align-toolbar button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.align-toolbar button:hover {
  background: var(--bg, #f0f0f0);
}

.separator {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 4px;
}
</style>
