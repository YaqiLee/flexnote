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

function setBorderColor(val: string) {
  if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    canvas.updateBlock(canvas.selectedBlockId, {
      borderColor: val,
      borderWidth: block?.borderWidth || 1,
    })
  }
}

function setBorderWidth(val: string) {
  if (canvas.selectedBlockId) {
    const w = Number(val)
    const block = canvas.selectedBlock
    canvas.updateBlock(canvas.selectedBlockId, {
      borderWidth: w > 0 ? w : undefined,
      borderColor: w > 0 ? (block?.borderColor || '#cccccc') : undefined,
    })
  }
}

function setBorderStyle(val: string) {
  if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    canvas.updateBlock(canvas.selectedBlockId, {
      borderStyle: val as 'solid' | 'dashed' | 'dotted' | 'double',
      borderWidth: block?.borderWidth || 1,
      borderColor: block?.borderColor || '#cccccc',
    })
  }
}

function clearBorder() {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { borderColor: undefined, borderWidth: undefined, borderStyle: undefined })
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
      <label>边框</label>
      <input type="color" :value="canvas.selectedBlock?.borderColor || '#cccccc'" @input="setBorderColor(($event.target as HTMLInputElement).value)" title="边框颜色" />
      <select :value="canvas.selectedBlock?.borderWidth || 0" @change="setBorderWidth(($event.target as HTMLSelectElement).value)" title="边框宽度" class="border-width-select">
        <option :value="0">无</option>
        <option :value="1">1px</option>
        <option :value="2">2px</option>
        <option :value="3">3px</option>
        <option :value="4">4px</option>
        <option :value="5">5px</option>
      </select>
      <select :value="canvas.selectedBlock?.borderStyle || 'solid'" @change="setBorderStyle(($event.target as HTMLSelectElement).value)" title="边框类型" class="border-style-select">
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
        <option value="double">双线</option>
      </select>
      <button v-if="canvas.selectedBlock?.borderWidth" @mousedown.prevent @click="clearBorder" title="清除边框">✕</button>
      <div class="props-sep"></div>
      <label>圆角</label>
      <input type="number" min="0" max="100" :value="canvas.selectedBlock?.borderRadius || 0" @input="setBorderRadius(($event.target as HTMLInputElement).value)" class="radius-input" />
    </template>

    <!-- Image block props -->
    <template v-if="canvas.selectedBlock?.type === 'image'">
      <label>圆角</label>
      <input type="number" min="0" max="100" :value="canvas.selectedBlock?.borderRadius || 0" @input="setBorderRadius(($event.target as HTMLInputElement).value)" class="radius-input" />
      <div class="props-sep"></div>
      <label>背景</label>
      <input type="color" :value="canvas.selectedBlock?.bgColor || '#ffffff'" @input="setBgColor(($event.target as HTMLInputElement).value)" />
      <div class="props-sep"></div>
      <label>边框</label>
      <input type="color" :value="canvas.selectedBlock?.borderColor || '#cccccc'" @input="setBorderColor(($event.target as HTMLInputElement).value)" title="边框颜色" />
      <select :value="canvas.selectedBlock?.borderWidth || 0" @change="setBorderWidth(($event.target as HTMLSelectElement).value)" title="边框宽度" class="border-width-select">
        <option :value="0">无</option>
        <option :value="1">1px</option>
        <option :value="2">2px</option>
        <option :value="3">3px</option>
        <option :value="4">4px</option>
        <option :value="5">5px</option>
      </select>
      <select :value="canvas.selectedBlock?.borderStyle || 'solid'" @change="setBorderStyle(($event.target as HTMLSelectElement).value)" title="边框类型" class="border-style-select">
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
        <option value="double">双线</option>
      </select>
      <button v-if="canvas.selectedBlock?.borderWidth" @mousedown.prevent @click="clearBorder" title="清除边框">✕</button>
    </template>

    <!-- Label block props -->
    <template v-if="canvas.selectedBlock?.type === 'label'">
      <label>类型</label>
      <select :value="canvas.selectedBlock?.labelName || '重点'" @change="changeLabelType(($event.target as HTMLSelectElement).value)">
        <option v-for="p in LABEL_PRESETS" :key="p.name" :value="p.name">{{ p.name }}</option>
      </select>
    </template>

    <div class="props-sep"></div>
    <button class="delete-btn" @click="canvas.selectedBlockId && canvas.removeBlock(canvas.selectedBlockId)" title="删除">🗑</button>
  </div>
</template>

<style scoped>
.block-props-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.block-props-panel label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-weight: 600;
}

.block-props-panel button {
  padding: 4px 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text);
  transition: all 0.12s;
  min-width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.block-props-panel button:hover {
  background: var(--primary-light);
  border-color: var(--primary-border);
}

.block-props-panel input[type="color"] {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
}

.block-props-panel input[type="range"] {
  width: 70px;
  accent-color: var(--primary);
  height: 4px;
}

.block-props-panel select {
  padding: 3px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  background: var(--surface);
  height: 26px;
}

.border-width-select {
  width: 54px;
}

.border-style-select {
  width: 58px;
}

.radius-input {
  width: 48px;
  height: 26px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  background: var(--surface);
  color: var(--text);
  text-align: center;
}

.radius-input:focus {
  outline: none;
  border-color: var(--primary);
}

.props-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

.delete-btn {
  color: #e53935 !important;
}

.delete-btn:hover {
  background: #ffebee !important;
  border-color: #ef9a9a !important;
}

</style>
