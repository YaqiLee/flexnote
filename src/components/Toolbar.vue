<script setup lang="ts">
import { useCanvasStore } from '../stores/canvas'
import { saveAsset, assetUrl } from '../services/assetStore'

const canvas = useCanvasStore()

function setTool(tool: 'text' | 'image' | 'label' | 'formula') {
  canvas.setTool(canvas.currentTool === tool ? null : tool)
}

function triggerImage() {
  const input = document.getElementById('imgInput') as HTMLInputElement
  input?.click()
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const id = crypto.randomUUID()
  await saveAsset(id, file)
  const dims = await new Promise<{ w: number; h: number } | null>(resolve => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = assetUrl(id)
  })
  const scale = dims ? Math.min(1, 400 / dims.w, 300 / dims.h) : 1
  const width = dims ? Math.max(1, Math.round(dims.w * scale)) : 200
  const height = dims ? Math.max(1, Math.round(dims.h * scale)) : 80
  canvas.setPendingImage({ src: assetUrl(id), width, height })
  canvas.setTool('image')
  input.value = ''
}
</script>

<template>
  <div class="top-toolbar">
    <div class="tool-group">
      <button
        class="tool-btn"
        :class="{ active: canvas.currentTool === 'text' }"
        title="文本工具 (T)"
        @click="setTool('text')"
      >
        <span class="tool-icon">📝</span>
        <span class="tool-label">文本</span>
      </button>
      <button
        class="tool-btn"
        :class="{ active: canvas.currentTool === 'image' }"
        title="插入图片"
        @click="triggerImage"
      >
        <span class="tool-icon">🖼</span>
        <span class="tool-label">图片</span>
      </button>
      <button
        class="tool-btn"
        :class="{ active: canvas.currentTool === 'label' }"
        title="标签"
        @click="setTool('label')"
      >
        <span class="tool-icon">🏷</span>
        <span class="tool-label">标签</span>
      </button>
      <button
        class="tool-btn"
        :class="{ active: canvas.currentTool === 'formula' }"
        title="公式"
        @click="setTool('formula')"
      >
        <span class="tool-icon">∑</span>
        <span class="tool-label">公式</span>
      </button>
    </div>
    <input
      id="imgInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageUpload"
    />
  </div>
</template>

<style scoped>
.top-toolbar {
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  z-index: 20;
  height: 40px;
}

.tool-group {
  display: flex;
  gap: 4px;
}

.tool-btn {
  padding: 4px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
  height: 30px;
}

.tool-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.tool-btn.active {
  background: var(--primary-light);
  color: var(--primary);
}

.tool-icon {
  font-size: 14px;
  line-height: 1;
}

.tool-label {
  font-weight: 500;
}
</style>
