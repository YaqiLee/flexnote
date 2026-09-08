<script setup lang="ts">
import { useCanvasStore } from '../../stores/canvas'

const canvas = useCanvasStore()

function fmtExec(cmd: string) {
  document.execCommand(cmd)
}

function setFontSize(val: string) {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { fontSize: Number(val) })
  }
}

function setFontColor(val: string) {
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { fontColor: val })
  }
}
</script>

<template>
  <div class="text-format-bar" @mousedown="(e: MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (tag !== 'select' && tag !== 'input' && tag !== 'option') e.preventDefault()
  }">
    <button @mousedown.prevent @click="fmtExec('bold')" title="加粗"><b>B</b></button>
    <button @mousedown.prevent @click="fmtExec('italic')" title="斜体"><i>I</i></button>
    <button @mousedown.prevent @click="fmtExec('underline')" title="下划线"><u>U</u></button>
    <button @mousedown.prevent @click="fmtExec('strikeThrough')" title="删除线"><s>S</s></button>
    <div class="props-sep"></div>
    <label>字号</label>
    <select :value="canvas.selectedBlock?.fontSize || 14" @change="setFontSize(($event.target as HTMLSelectElement).value)">
      <option v-for="s in [10,11,12,13,14,15,16,18,20,22,24,28,32,36]" :key="s" :value="s">{{ s }}px</option>
    </select>
    <div class="props-sep"></div>
    <label>字色</label>
    <input type="color" :value="canvas.selectedBlock?.fontColor || '#333333'" @input="setFontColor(($event.target as HTMLInputElement).value)" />
  </div>
</template>

<style scoped>
.text-format-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.text-format-bar label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-weight: 600;
}

.text-format-bar button {
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

.text-format-bar button:hover {
  background: var(--primary-light);
  border-color: var(--primary-border);
}

.text-format-bar input[type="color"] {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.text-format-bar select {
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
</style>
