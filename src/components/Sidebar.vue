<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useNavStore } from '../stores/nav'

const nav = useNavStore()

// Context menu state
const ctxMenu = ref({ visible: false, x: 0, y: 0, type: '' as 'group' | 'note', targetId: '' })
const dialog = ref({
  visible: false,
  type: 'prompt' as 'prompt' | 'confirm',
  title: '',
  message: '',
  value: '',
  placeholder: '',
  confirmText: '确定',
  danger: false,
})
let dialogResolve: ((value: string | boolean | null) => void) | null = null

function showCtxMenu(e: MouseEvent, type: 'group' | 'note', targetId: string) {
  e.preventDefault()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, type, targetId }
}

function hideCtxMenu() {
  ctxMenu.value.visible = false
}

async function openPrompt(title: string, value = '', placeholder = ''): Promise<string | null> {
  return new Promise(resolve => {
    dialogResolve = value => resolve(typeof value === 'string' ? value : null)
    dialog.value = {
      visible: true,
      type: 'prompt',
      title,
      message: '',
      value,
      placeholder,
      confirmText: '确定',
      danger: false,
    }
    nextTick(() => document.querySelector<HTMLInputElement>('.app-dialog input')?.focus())
  })
}

function openConfirm(title: string, message: string, danger = false): Promise<boolean> {
  return new Promise(resolve => {
    dialogResolve = value => resolve(value === true)
    dialog.value = {
      visible: true,
      type: 'confirm',
      title,
      message,
      value: '',
      placeholder: '',
      confirmText: danger ? '删除' : '确定',
      danger,
    }
  })
}

function closeDialog(result: string | boolean | null) {
  dialog.value.visible = false
  const resolve = dialogResolve
  dialogResolve = null
  resolve?.(result)
}

function handleDialogKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeDialog(null)
  if (e.key === 'Enter' && dialog.value.type === 'prompt') closeDialog(dialog.value.value.trim() || null)
}

async function handleAddGroup() {
  const name = await openPrompt('新建分组', '', '请输入分组名称')
  if (typeof name === 'string' && name) nav.addGroup(name)
}

async function handleRenameGroup() {
  const group = nav.groups.find(g => g.id === ctxMenu.value.targetId)
  if (!group) return
  const name = await openPrompt('重命名分组', group.name, '请输入分组名称')
  if (typeof name === 'string' && name) nav.renameGroup(ctxMenu.value.targetId, name)
}

async function handleDeleteGroup() {
  const group = nav.groups.find(g => g.id === ctxMenu.value.targetId)
  if (!group) return
  if (await openConfirm('删除分组', `确定删除分组「${group.name}」及其所有笔记？`, true)) {
    nav.deleteGroup(ctxMenu.value.targetId)
  }
}

async function handleAddNote(groupId: string) {
  const title = await openPrompt('新建笔记', '', '请输入笔记标题')
  if (typeof title === 'string' && title) {
    const id = nav.addNote(groupId, title)
    if (id) nav.setActiveNote(id)
  }
}

async function handleRenameNote() {
  const title = nav.getNoteTitle(ctxMenu.value.targetId)
  if (!title) return
  const newTitle = await openPrompt('重命名笔记', title, '请输入笔记标题')
  if (typeof newTitle === 'string' && newTitle) nav.renameNote(ctxMenu.value.targetId, newTitle)
}

async function handleDeleteNote() {
  const title = nav.getNoteTitle(ctxMenu.value.targetId)
  if (!title) return
  if (await openConfirm('删除笔记', `确定删除笔记「${title}」？`, true)) {
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
            @click="() => nav.setActiveNote(item.id)"
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
      <div v-if="dialog.visible" class="dialog-backdrop" @mousedown.self="closeDialog(null)" @keydown="handleDialogKeydown">
        <div class="app-dialog" role="dialog" aria-modal="true" @keydown="handleDialogKeydown">
          <div class="dialog-icon" :class="{ danger: dialog.danger }">
            {{ dialog.danger ? '!' : '✦' }}
          </div>
          <div class="dialog-content">
            <h3>{{ dialog.title }}</h3>
            <p v-if="dialog.message">{{ dialog.message }}</p>
            <input
              v-if="dialog.type === 'prompt'"
              v-model="dialog.value"
              :placeholder="dialog.placeholder"
              maxlength="80"
              @keydown="handleDialogKeydown"
            />
            <div class="dialog-actions">
              <button class="dialog-btn secondary" @click="closeDialog(null)">取消</button>
              <button
                class="dialog-btn"
                :class="{ danger: dialog.danger }"
                @click="closeDialog(dialog.type === 'prompt' ? (dialog.value.trim() || null) : true)"
              >
                {{ dialog.confirmText }}
              </button>
            </div>
          </div>
        </div>
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

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(32, 33, 36, 0.28);
  backdrop-filter: blur(2px);
  animation: dialog-fade-in 0.16s ease-out;
}

.app-dialog {
  width: min(380px, 100%);
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px;
  background: var(--surface);
  border: 1px solid rgba(26, 115, 232, 0.12);
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(32, 33, 36, 0.2);
  animation: dialog-slide-in 0.18s ease-out;
}

.dialog-icon {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--primary);
  background: var(--primary-light);
  font-size: 16px;
  font-weight: 700;
}

.dialog-icon.danger {
  color: #d93025;
  background: #fce8e6;
}

.dialog-content {
  flex: 1;
  min-width: 0;
}

.dialog-content h3 {
  margin: 2px 0 7px;
  color: var(--text);
  font-size: 16px;
  line-height: 1.4;
}

.dialog-content p {
  margin-bottom: 14px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.dialog-content input {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  color: var(--text);
  background: #fafbfc;
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.dialog-content input:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.dialog-btn {
  min-width: 64px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid var(--primary);
  border-radius: 7px;
  color: #fff;
  background: var(--primary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: filter 0.15s, background 0.15s;
}

.dialog-btn:hover {
  filter: brightness(0.94);
}

.dialog-btn.secondary {
  border-color: var(--border);
  color: var(--text-secondary);
  background: var(--surface);
}

.dialog-btn.secondary:hover {
  background: var(--surface-hover);
  filter: none;
}

.dialog-btn.danger {
  border-color: #d93025;
  background: #d93025;
}

@keyframes dialog-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialog-slide-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
