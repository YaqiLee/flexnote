<script setup lang="ts">
import { useCanvasStore } from '../../stores/canvas'

const canvas = useCanvasStore()

const LABEL_PRESETS = [
  { name: '重点', bg: '#ffeaea', color: '#d32f2f' },
  { name: '安全', bg: '#fff8e1', color: '#f57f17' },
  { name: '理解', bg: '#e8f5e9', color: '#2e7d32' },
  { name: '公式', bg: '#e3f2fd', color: '#1565c0' },
  { name: '实操', bg: '#f3e5f5', color: '#7b1fa2' },
  { name: '易错', bg: '#fce4ec', color: '#c62828' },
]

function setBgColor(val: string) {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: val })
  }
}

function clearBg() {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: undefined })
  }
}

function setBorderRadius(val: string) {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { borderRadius: Number(val) })
  }
}

function changeLabelType(name: string) {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { labelName: name })
  }
}
</script>

<template>
  <div class="block-props-panel" @mousedown="(e: MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (tag !== 'select' && tag !== 'input' && tag !== 'option') e.preventDefault()
  }">
    <!-- Text block props -->
    <template v-if="canvas.selectedBlock?.type === 'text'">
      <label>背景</label>
      <input type="color" :value="canvas.selectedBlock?.bgColor || '#ffffff'" @input="setBgColor(($event.target as HTMLInputElement).value)" />
      <button @mousedown.prevent @click="clearBg" title="清除背景">✕</button>
      <div class="props-sep"></div>
      <label>圆角</label>
      <input type="range" min="0" max="30" :value="canvas.selectedBlock?.borderRadius || 0" @input="setBorderRadius(($event.target as HTMLInputElement).value)" />
    </template>

    <!-- Image block props -->
    <template v-if="canvas.selectedBlock?.type === 'image'">
      <label>圆角</label>
      <input type="range" min="0" max="30" :value="canvas.selectedBlock?.borderRadius || 0" @input="setBorderRadius(($event.target as HTMLInputElement).value)" />
      <div class="props-sep"></div>
      <label>背景</label>
      <input type="color" :value="canvas.selectedBlock?.bgColor || '#ffffff'" @input="setBgColor(($event.target as HTMLInputElement).value)" />
    </template>

    <!-- Label block props -->
    <template v-if="canvas.selectedBlock?.type === 'label'">
      <label>类型</label>
      <select :value="canvas.selectedBlock?.labelName || '重点'" @change="changeLabelType(($event.target as HTMLSelectElement).value)">
        <option v-for="p in LABEL_PRESETS" :key="p.name" :value="p.name">{{ p.name }}</option>
      </select>
    </template>

    <!-- Formula block props -->
    <template v-if="canvas.selectedBlock?.type === 'formula'">
      <label style="color: var(--text-secondary)">双击编辑公式文本</label>
    </template>

    <div class="props-sep"></div>
    <button class="delete-btn" @click="canvas.removeBlock(canvas.selectedBlock!.id)" title="删除">🗑</button>
  </div>
</template>

<style scoped>
.block-props-panel {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.block-props-panel label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-weight: 600;
}

.block-props-panel button {
  padding: 3px 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text);
  transition: all 0.1s;
  min-width: 28px;
  text-align: center;
}

.block-props-panel button:hover {
  background: var(--primary-light);
  border-color: var(--primary-border);
}

.block-props-panel input[type="color"] {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.block-props-panel input[type="range"] {
  width: 70px;
  accent-color: var(--primary);
  height: 4px;
}

.block-props-panel select {
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  background: var(--surface);
}

.props-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
}

.delete-btn {
  color: #e53935 !important;
}

.delete-btn:hover {
  background: #ffebee !important;
  border-color: #ef9a9a !important;
}
</style>
