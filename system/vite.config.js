import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // ВАЖНО: меняем базу на /system/, чтобы картинки и скрипты грузились правильно
  base: '/system/', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173, 
  }
})