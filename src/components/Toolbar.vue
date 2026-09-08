<script setup lang="ts">
import { useCanvasStore } from '../stores/canvas'

const canvas = useCanvasStore()

function setTool(tool: 'text' | 'image' | 'label' | 'formula') {
  canvas.setTool(canvas.currentTool === tool ? null : tool)
}

function triggerImage() {
  const input = document.getElementById('imgInput') as HTMLInputElement
  input?.click()
}

function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    canvas.setPendingImage(reader.result as string)
    canvas.setTool('image')
  }
  reader.readAsDataURL(file)
  input.value = ''
}
</script>

<template>
  <div class="top-toolbar">
    <button
      class="tool-btn"
      :class="{ active: canvas.currentTool === 'text' }"
      @click="setTool('text')"
    >
      📝 文本
    </button>
    <button
      class="tool-btn"
      :class="{ active: canvas.currentTool === 'image' }"
      @click="triggerImage"
    >
      🖼 图片
    </button>
    <button
      class="tool-btn"
      :class="{ active: canvas.currentTool === 'label' }"
      @click="setTool('label')"
    >
      🏷 标签
    </button>
    <button
      class="tool-btn"
      :class="{ active: canvas.currentTool === 'formula' }"
      @click="setTool('formula')"
    >
      ∑ 公式
    </button>
    <input
      id="imgInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageUpload"
    />
    <div class="tool-sep"></div>
    <span class="toolbar-hint">Esc 取消工具 · Delete 删除 · 双击编辑文本</span>
  </div>
</template>

<style scoped>
.top-toolbar {
  padding: 8px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 20;
}

.tool-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: var(--primary-light);
  border-color: var(--primary-border);
  color: var(--primary);
}

.tool-btn.active {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}

.tool-sep {
  width: 1px;
  height: 22px;
  background: var(--border);
  margin: 0 6px;
}

.toolbar-hint {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
}
</style>
