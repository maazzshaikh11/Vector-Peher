import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceView from '../views/WorkspaceView.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/chat/:id', name: 'chat', component: WorkspaceView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
export default router
