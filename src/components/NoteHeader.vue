<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNavStore } from '../stores/nav'
import { useCanvasStore } from '../stores/canvas'
import { exportData, importData, saveAppData } from '../services/storage'

const nav = useNavStore()
const canvas = useCanvasStore()
const fileInput = ref<HTMLInputElement | null>(null)

async function handleExport() {
  await exportData()
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const data = await importData(file)
  if (data) {
    await saveAppData(data)
    nav.loadFromData(data)
    if (data.activeNoteId && data.notes[data.activeNoteId]) {
      canvas.loadBlocks(data.notes[data.activeNoteId].blocks)
    } else {
      canvas.loadBlocks([])
    }
  } else {
    alert('导入失败：文件格式无效')
  }
  input.value = ''
}

const currentNote = computed(() => {
  const id = nav.activeNoteId
  if (!id) return null
  for (const group of nav.groups) {
    const item = nav.findItemInTree(group.items, id)
    if (item) return item
  }
  return null
})

const formattedTime = computed(() => {
  const ts = currentNote.value?.updatedAt
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const title = computed({
  get: () => currentNote.value?.title ?? '',
  set: (val: string) => {
    const id = nav.activeNoteId
    if (id) nav.renameNote(id, val)
  },
})

const starred = computed(() => {
  const id = nav.activeNoteId
  return id ? nav.isNoteStarred(id) : false
})

function toggleStar() {
  const id = nav.activeNoteId
  if (id) nav.toggleStar(id)
}
</script>

<template>
  <div v-if="currentNote" class="note-header">
    <div class="header-left">
      <input v-model="title" class="note-title-input" placeholder="无标题笔记" />
      <span
        class="note-star"
        :class="{ starred }"
        title="收藏"
        @click="toggleStar"
      >★</span>
    </div>
    <div class="header-right">
      <span v-if="formattedTime" class="note-time" :title="'最后编辑：' + formattedTime">{{ formattedTime }}</span>
      <button class="header-btn" title="导出数据" @click="handleExport">💾</button>
      <button class="header-btn" title="导入数据" @click="triggerImport">📂</button>
      <input ref="fileInput" type="file" accept=".json" style="display:none" @change="handleImport" />
    </div>
  </div>
</template>

<style scoped>
.note-header {
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  z-index: 5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.note-title-input {
  font-size: 15px;
  font-weight: 600;
  border: none;
  outline: none;
  flex: 1;
  min-width: 0;
  background: transparent;
  color: var(--text);
}

.note-title-input::placeholder {
  color: var(--text-secondary);
  font-weight: 400;
}

.note-star {
  font-size: 15px;
  cursor: pointer;
  color: #ddd;
  transition: color 0.15s;
  flex-shrink: 0;
  line-height: 1;
}

.note-star:hover {
  color: #f5a623;
}

.note-star.starred {
  color: #f5a623;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.note-time {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 8px;
}

.header-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
  border-radius: 4px;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
  line-height: 1;
}

.header-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}
</style>
