<script setup lang="ts">
import { computed } from 'vue'
import { useNavStore } from '../stores/nav'

const nav = useNavStore()

const currentNote = computed(() => {
  const id = nav.activeNoteId
  if (!id) return null
  for (const group of nav.groups) {
    const item = group.items.find(i => i.id === id)
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
    <div class="note-title-row">
      <input v-model="title" class="note-title-input" />
      <span
        class="note-star"
        :class="{ starred }"
        @click="toggleStar"
      >★</span>
    </div>
    <div class="note-meta">
      <span v-if="formattedTime">最后编辑：{{ formattedTime }}</span>
    </div>
  </div>
</template>

<style scoped>
.note-header {
  padding: 14px 28px 0;
  background: var(--surface);
  z-index: 5;
}

.note-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-number {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  background: var(--bg, #f5f6fa);
  padding: 2px 8px;
  border-radius: 4px;
}

.note-title-input {
  font-size: 22px;
  font-weight: 700;
  border: none;
  outline: none;
  flex: 1;
  background: transparent;
  color: var(--text);
}

.note-star {
  font-size: 20px;
  cursor: pointer;
  color: #ddd;
  transition: color 0.15s;
}

.note-star:hover {
  color: #f5a623;
}

.note-star.starred {
  color: #f5a623;
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
