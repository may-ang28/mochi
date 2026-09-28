import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mochi',
        short_name: 'Mochi',
        description: 'Personal finance companion',
        theme_color: '#FA8FEF',
        background_color: '#FFF7F0',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
})