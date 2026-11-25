import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径，保证在 GitHub Pages 的子路径下资源也能正确加载
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    watch: {
      // 编辑器（含 AI 工具）原子写入时会生成临时目录，Vite 监听它会 EBUSY 崩掉
      ignored: ['**/.*.tmpdir/**', '**/*.tmpdir/**', '**/*.tmp', '**/dev-server.log'],
    },
  },
});
