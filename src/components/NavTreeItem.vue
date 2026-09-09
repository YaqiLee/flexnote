<script setup lang="ts">
import type { NavItem } from '../stores/nav'

defineProps<{
  item: NavItem
  depth: number
  activeId: string | null
  dragItemId: string | null
  dragOverId: string | null
  dragPosition: 'before' | 'after' | 'inside' | null
}>()

const emit = defineEmits<{
  select: [id: string]
  contextmenu: [e: MouseEvent]
  toggleStar: [id: string]
  toggleCollapsed: [id: string]
}>()
</script>

<template>
  <div
    class="tree-item-wrapper"
    :data-nav-id="item.id"
    data-nav-type="item"
    :class="{
      'drag-over-before': dragOverId === item.id && dragPosition === 'before',
      'drag-over-after': dragOverId === item.id && dragPosition === 'after',
      'drag-over-inside': dragOverId === item.id && dragPosition === 'inside',
    }"
  >
    <div
      class="tree-item"
      :class="{
        active: activeId === item.id,
        starred: item.starred,
        dragging: dragItemId === item.id,
        'has-children': item.children && item.children.length > 0,
      }"
      :style="{ paddingLeft: (24 + depth * 16) + 'px' }"
      @click="emit('select', item.id)"
      @contextmenu="emit('contextmenu', $event)"
    >
      <span
        v-if="item.children && item.children.length > 0"
        class="expand-arrow"
        :class="{ collapsed: item.collapsed }"
        @click.stop="emit('toggleCollapsed', item.id)"
      >▶</span>
      <span v-else class="expand-spacer"></span>
      <span
        class="star-icon"
        @click.stop="emit('toggleStar', item.id)"
      >★</span>
      <span class="item-title">📄 {{ item.title }}</span>
    </div>
  </div>

  <template v-if="item.children && item.children.length > 0 && !item.collapsed">
    <NavTreeItem
      v-for="child in item.children"
      :key="child.id"
      :item="child"
      :depth="depth + 1"
      :active-id="activeId"
      :drag-item-id="dragItemId"
      :drag-over-id="dragOverId"
      :drag-position="dragPosition"
      @select="(id: string) => emit('select', id)"
      @contextmenu="(e: MouseEvent) => emit('contextmenu', e)"
      @toggle-star="(id: string) => emit('toggleStar', id)"
      @toggle-collapsed="(id: string) => emit('toggleCollapsed', id)"
    />
  </template>
</template>

<style scoped>
.tree-item-wrapper {
  position: relative;
  padding: 0 6px;
}

.tree-item-wrapper.drag-over-before::before {
  content: '';
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
  z-index: 5;
}

.tree-item-wrapper.drag-over-after::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
  z-index: 5;
}

.tree-item-wrapper.drag-over-inside > .tree-item {
  background: var(--primary-light);
  outline: 2px dashed var(--primary-border);
  outline-offset: -2px;
}

.tree-item {
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 0;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}

.tree-item:hover {
  background: var(--surface-hover);
}

.tree-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}

.tree-item.dragging {
  opacity: 0.4;
}

.expand-arrow {
  font-size: 8px;
  width: 14px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.expand-arrow.collapsed {
  transform: rotate(0deg);
}

.expand-arrow:not(.collapsed) {
  transform: rotate(90deg);
}

.expand-spacer {
  width: 14px;
  flex-shrink: 0;
}

.star-icon {
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.tree-item.starred .star-icon {
  opacity: 1;
  color: #f5a623;
}

.tree-item:hover .star-icon {
  opacity: 0.5;
}

.item-title {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
