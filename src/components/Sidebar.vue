<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useNavStore } from '../stores/nav'

const nav = useNavStore()

// Context menu state
const ctxMenu = ref({ visible: false, x: 0, y: 0, type: '' as 'group' | 'note', targetId: '' })

function showCtxMenu(e: MouseEvent, type: 'group' | 'note', targetId: string) {
  e.preventDefault()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, type, targetId }
}

function hideCtxMenu() {
  ctxMenu.value.visible = false
}

function handleAddGroup() {
  const name = prompt('输入分组名称:')
  if (name?.trim()) nav.addGroup(name.trim())
}

function handleRenameGroup() {
  const group = nav.groups.find(g => g.id === ctxMenu.value.targetId)
  if (!group) return
  const name = prompt('重命名分组:', group.name)
  if (name?.trim()) nav.renameGroup(ctxMenu.value.targetId, name.trim())
}

function handleDeleteGroup() {
  const group = nav.groups.find(g => g.id === ctxMenu.value.targetId)
  if (!group) return
  if (confirm(`确定删除分组「${group.name}」及其所有笔记？`)) {
    nav.deleteGroup(ctxMenu.value.targetId)
  }
}

function handleAddNote(groupId: string) {
  const title = prompt('输入笔记标题:')
  if (title?.trim()) {
    const id = nav.addNote(groupId, title.trim())
    if (id) nav.setActiveNote(id)
  }
}

function handleRenameNote() {
  const title = nav.getNoteTitle(ctxMenu.value.targetId)
  if (!title) return
  const newTitle = prompt('重命名笔记:', title)
  if (newTitle?.trim()) nav.renameNote(ctxMenu.value.targetId, newTitle.trim())
}

function handleDeleteNote() {
  const title = nav.getNoteTitle(ctxMenu.value.targetId)
  if (!title) return
  if (confirm(`确定删除笔记「${title}」？`)) {
    nav.deleteNote(ctxMenu.value.targetId)
  }
}

onMounted(() => {
  document.addEventListener('click', hideCtxMenu)
})
onUnmounted(() => {
  document.removeEventListener('click', hideCtxMenu)
})
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span>⚡</span> FlexNote
      <button class="header-add" @click="handleAddGroup" title="新建分组">+</button>
    </div>

    <div class="tree">
      <div v-for="group in nav.groups" :key="group.id" class="tree-group">
        <div
          class="tree-group-title"
          :class="{ collapsed: group.collapsed }"
          @click="nav.toggleGroup(group.id)"
          @contextmenu="showCtxMenu($event, 'group', group.id)"
        >
          <span class="arrow">▼</span>
          📁 {{ group.name }}
        </div>
        <div v-show="!group.collapsed" class="tree-items">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="tree-item"
            :class="{
              active: nav.activeNoteId === item.id,
              starred: item.starred,
            }"
            @click="() => { console.log('[Sidebar] click:', item.id, 'title:', item.title); nav.setActiveNote(item.id) }"
            @contextmenu="showCtxMenu($event, 'note', item.id)"
          >
            <span
              class="star-icon"
              @click.stop="nav.toggleStar(item.id)"
            >★</span>
            📄 {{ item.title }}
          </div>
          <div class="add-btn" @click="handleAddNote(group.id)">+ 添加页</div>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="shortcut-entry">📝 快速笔记</div>
      <div class="shortcut-entry">❌ 错题本</div>
      <div class="shortcut-entry">⭐ 收藏夹</div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @click.stop
      >
        <template v-if="ctxMenu.type === 'group'">
          <div class="ctx-item" @click="handleRenameGroup">✏️ 重命名</div>
          <div class="ctx-item danger" @click="handleDeleteGroup">🗑 删除分组</div>
        </template>
        <template v-else>
          <div class="ctx-item" @click="handleRenameNote">✏️ 重命名</div>
          <div class="ctx-item danger" @click="handleDeleteNote">🗑 删除笔记</div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sidebar {
  width: 250px;
  min-width: 250px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  user-select: none;
  z-index: 10;
}

.sidebar-header {
  padding: 16px 18px;
  font-size: 17px;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.5px;
}

.header-add {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.header-add:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: var(--primary-border);
}

.tree {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.tree-group-title {
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tree-group-title:hover {
  background: var(--primary-light);
  color: var(--primary);
}

.tree-group-title .arrow {
  transition: transform 0.2s;
  font-size: 9px;
}

.tree-group-title.collapsed .arrow {
  transform: rotate(-90deg);
}

.tree-items {
  padding-left: 8px;
}

.tree-item {
  padding: 6px 14px 6px 24px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}

.tree-item:hover {
  background: var(--primary-light);
}

.tree-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}

.tree-item .star-icon {
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tree-item.starred .star-icon {
  opacity: 1;
  color: #f5a623;
}

.tree-item:hover .star-icon {
  opacity: 0.5;
}

.add-btn {
  margin: 3px 14px 6px;
  padding: 5px;
  text-align: center;
  font-size: 12px;
  color: var(--primary);
  border: 1px dashed var(--primary-border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.add-btn:hover {
  background: var(--primary-light);
}

.sidebar-footer {
  border-top: 1px solid var(--border);
  padding: 6px;
}

.shortcut-entry {
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #555;
  transition: background 0.1s;
}

.shortcut-entry:hover {
  background: var(--primary-light);
}

.ctx-menu {
  position: fixed;
  z-index: 1000;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  min-width: 140px;
}

.ctx-item {
  padding: 7px 14px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.1s;
}

.ctx-item:hover {
  background: var(--primary-light);
}

.ctx-item.danger {
  color: #e53935;
}

.ctx-item.danger:hover {
  background: #ffebee;
}
</style>
