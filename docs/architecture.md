# FlexNote 架构设计文档

## 1. 技术栈

- **框架**: Tauri 2 + Vue 3 + TypeScript
- **状态管理**: Pinia
- **构建工具**: Vite
- **后端**: Rust (Tauri)
- **存储**: Tauri FS (桌面) / localStorage (浏览器)

## 2. 整体架构

三层结构：组件层 → 状态层 → 存储层

- App.vue: 根布局 + 笔记切换逻辑
- Sidebar / Toolbar / NoteHeader / Canvas / PropsPanel: UI 组件
- useNavStore: 导航树状态
- useCanvasStore: 画布状态 + block CRUD + 撤销重做 + 自动保存
- storage.ts: 双通道持久化

## 3. 数据模型

### BlockData（画布块）

字段: id, type(text/image/label/formula), x, y, width, height, content, src, labelName, formula, bgColor, borderRadius, fontSize, fontColor, fontFamily, lineHeight, fontWeight, fontStyle, textDecoration, zIndex

### AppData（全局持久化）

字段: version(=1), groups(NavGroup[]), notes(Record<string, NoteData>), activeNoteId

### NoteData

字段: id, title, starred, blocks(BlockData[]), updatedAt

### NavGroup / NavItem

NavGroup: id, name, collapsed, items(NavItem[])
NavItem: id, title, starred, updatedAt

## 4. 状态管理

### useNavStore

管理左侧导航树和笔记元信息，不包含 block 数据。
核心方法: setActiveNote, toggleStar, toggleGroup, addGroup/renameGroup/deleteGroup, addNote/renameNote/deleteNote, loadFromData, updateNoteTimestamp

### useCanvasStore

管理当前笔记的所有 block 数据和编辑状态。
核心状态: blocks, selectedBlockId, selectedBlockIds, editingBlockId, currentTool, pendingImageData
核心方法: addBlock/updateBlock/removeBlock, selectBlock/selectBlocks/setEditing, alignBlocks/distributeBlocks, bringToFront, undo/redo/pushSnapshot, loadBlocks/loadNote, scheduleSave/saveNoteById, initFromStorage

## 5. 组件职责

- App.vue: 根布局；监听 activeNoteId 变化，串行执行保存旧笔记->加载新笔记
- Sidebar.vue: 分组/笔记树渲染、右键菜单、星标、CRUD
- Toolbar.vue: 工具选择（文本/图片/标签/公式）、撤销/重做
- NoteHeader.vue: 笔记标题显示与编辑
- Canvas.vue: 核心组件 - block 渲染、拖拽/缩放/框选/平移/粘贴/键盘快捷键
- PropsPanel.vue: 右侧属性面板容器
- TextFormatBar.vue: 文本格式工具条
- BlockPropsPanel.vue: 块级属性面板
- AlignToolbar.vue: 多选对齐/分布工具条

## 6. 存储层

### 双通道机制

saveAppData: isTauri() -> writeTextFile / else -> localStorage.setItem
loadAppData: isTauri() -> readTextFile / else -> localStorage.getItem
通过 window.__TAURI_INTERNALS__ 检测运行环境

### 自动保存流程

blocks 变化(deep watch) -> scheduleSave(500ms防抖) -> loadAppData -> 合并数据 -> saveAppData -> updateNoteTimestamp
笔记切换通过 switchQueue 串行化

## 7. 文本编辑双模式架构

### 两种模式

- 选中文本格式化: execCommand -> inline HTML标签 -> block.content(innerHTML)
- 块级样式设置: stripInlineFormatting + updateBlock -> block.fontSize/fontColor(CSS)

两种模式互斥：块级样式会先清除所有 inline 标签

### Format Adapter

所有 execCommand 封装在 src/utils/text-format.ts:
execBold/execItalic/execUnderline/execStrikeThrough/execForeColor/execFontName/execFontSize/stripInlineFormatting
组件只导入 adapter 函数，未来迁移只需修改 adapter 内部

### vInitHtml 指令

仅在 mount 时设置 innerHTML，避免 Vue 响应式与 contenteditable DOM 冲突。blur 时回写 el.innerHTML 到 store。

## 8. 画布交互系统

### 状态机

空闲 -> mousedown(空白) -> 框选
空闲 -> mousedown(block) -> 拖拽准备 -> move>4px -> 拖拽中
空闲 -> mousedown(handle) -> 缩放中
空闲 -> mousedown(Space/中键) -> 平移中
keydown(Escape) -> 退出编辑/取消选择

### 关键交互

- 单击空白: 取消选择 + 清除文本选中 + 退出编辑
- 双击文本块: 进入编辑模式
- 拖拽block: mousedown+move>4px, pushSnapshot
- 缩放手柄: 八方向缩放
- 框选: mousedown(空白)+drag, 矩形碰撞检测
- 平移: Space+drag / 中键拖拽
- 粘贴: Ctrl+V, 解析文本/图片插入视口中心
- Delete/Backspace: 删除选中块
- Ctrl+Z/Y: 撤销/重做
- Ctrl+A: 全选

### 动态画布扩展

初始 3000x2000，block 接近边界或滚动到边缘时自动扩展(步长100px)

### 文本选中清除时序

Chromium contenteditable 特殊行为：click 中 removeAllRanges() 后 mouseup 仍恢复选中。
解决：在 mousedown 阶段清除编辑状态和选中，使 mouseup 时浏览器不恢复。

## 9. 核心数据流

### 笔记切换

用户点击 -> nav.setActiveNote -> App.vue watcher -> switchQueue串行:
1. canvas.saveNoteById(oldId)
2. canvas.loadNote(newId)
3. canvas.saveActiveNoteId(newId)

### 撤销/重做

修改 -> pushSnapshot -> undoStack.push(cloneBlocks), redoStack清空
Ctrl+Z: redoStack.push(current), blocks=undoStack.pop(), normalizeZIndices, scheduleSave
Ctrl+Y: undoStack.push(current), blocks=redoStack.pop(), normalizeZIndices, scheduleSave
使用 structuredClone(toRaw(blocks)) 深拷贝，上限50条

### z-index 管理

selectBlock/addBlock 递增 zIndexCounter
counter > blocks.length*2 时 normalizeZIndices 重新编号
undo/redo/load 后也执行 normalize

## 10. 关键技术决策

- 单JSON文件存储: 简化备份迁移，大数据量时有性能瓶颈
- contenteditable+execCommand: 零依赖快速实现，需Format Adapter隔离废弃API
- vInitHtml而非v-html: 避免Vue重渲染覆盖contenteditable DOM
- Pinia: Vue3官方推荐，TypeScript友好
- 无第三方画布库: 需求简单自研可控
- structuredClone: 比JSON序列化更安全更快
- mousedown清除选中: 绕过Chromium contenteditable恢复行为

## 11. 目录结构

flexnote/src/App.vue - 根组件+笔记切换
flexnote/src/main.ts - 入口
flexnote/src/stores/canvas.ts - 画布状态+block CRUD+撤销重做+自动保存
flexnote/src/stores/nav.ts - 导航树状态+分组/笔记CRUD
flexnote/src/services/storage.ts - 双通道持久化
flexnote/src/utils/text-format.ts - Format Adapter
flexnote/src/components/Canvas.vue - 画布核心
flexnote/src/components/Sidebar.vue - 左侧导航树
flexnote/src/components/Toolbar.vue - 顶部工具栏
flexnote/src/components/NoteHeader.vue - 笔记标题
flexnote/src/components/PropsPanel.vue - 右侧属性面板容器
flexnote/src/components/props/TextFormatBar.vue - 文本格式工具条
flexnote/src/components/props/BlockPropsPanel.vue - 块级属性面板
flexnote/src/components/props/AlignToolbar.vue - 对齐/分布工具条
flexnote/src-tauri/ - Tauri Rust后端
flexnote/docs/architecture.md - 本文档
flexnote/docs/gap-analysis.md - 功能差距分析

## 12. 已知限制与演进路线

### 当前限制

- execCommand已废弃
- 单JSON文件存储IO性能瓶颈
- 无协作/云同步
- 无连接线/箭头
- 图片base64内嵌增大文件体积

### 短期(1-2月)

- 图片文件化存储
- 导出PDF/PNG
- 全文搜索
- 标签/分类筛选

### 中期(3-6月)

- 迁移Input Events Level 2或TipTap
- 多文件格式(每笔记独立JSON)
- 连接线/箭头block类型
- 模板系统

### 长期

- 云同步/多设备协作
- 插件系统
- Markdown导入/导出
- AI辅助整理/摘要