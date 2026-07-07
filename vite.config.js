import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { readFileSync, cpSync, copyFileSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const navbar = readFileSync(resolve(__dirname, 'partials/navbar.html'), 'utf-8')
const footer = readFileSync(resolve(__dirname, 'partials/footer.html'), 'utf-8')
const topBar = readFileSync(resolve(__dirname, 'partials/top-bar.html'), 'utf-8')

const injectData = { data: { navbar, footer, topBar } }

export default defineConfig({
  plugins: [
    createHtmlPlugin({
      minify: true,
      pages: [
        { filename: 'index.html',             template: 'index.html',             injectOptions: injectData },
        { filename: 'sobre.html',             template: 'sobre.html',             injectOptions: injectData },
        { filename: 'artigos.html',           template: 'artigos.html',           injectOptions: injectData },
        { filename: 'contactos.html',         template: 'contactos.html',         injectOptions: injectData },
        { filename: 'areas-de-atuacao.html',  template: 'areas-de-atuacao.html',  injectOptions: injectData },
      ]
    }),
    {
      name: 'copy-static',
      closeBundle() {
        cpSync(resolve(__dirname, 'js'), resolve(__dirname, 'dist/js'), { recursive: true })
        copyFileSync(resolve(__dirname, 'robots.txt'), resolve(__dirname, 'dist/robots.txt'))
        copyFileSync(resolve(__dirname, 'sitemap.xml'), resolve(__dirname, 'dist/sitemap.xml'))
        copyFileSync(resolve(__dirname, 'admin.html'), resolve(__dirname, 'dist/admin.html'))
      }
    }
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    open: true
  }
})
