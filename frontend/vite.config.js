import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'c39f5a36b2b8.ngrok-free.app' // add your ngrok domain here
    ]
  }
}
)
