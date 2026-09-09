import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Prevent Tauri WebView file drop, but allow HTML5 drag-and-drop on valid targets
// Valid drop targets must call e.preventDefault() in their own handlers
// This global handler only prevents default for non-sidebar areas
document.addEventListener('dragover', (e) => {
  const target = e.target as HTMLElement
  if (!target.closest('.sidebar')) {
    e.preventDefault()
  }
})
document.addEventListener('drop', (e) => {
  const target = e.target as HTMLElement
  if (!target.closest('.sidebar')) {
    e.preventDefault()
  }
})

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
