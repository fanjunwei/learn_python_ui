const { defineConfig } = require('vite')
const vue = require('@vitejs/plugin-vue')
const path = require('path')
const svgLoader = require('vite-svg-loader')

module.exports = defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls: {
          includeAbsolute: false,
        },
      },
    }),
    svgLoader()
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  svgLoader: {
    svgoConfig: {
      multipass: true
    }
  }
}) 