import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_API_PROXY_TARGET ||
    (env.VITE_API_BASE_URL?.startsWith('http')
      ? env.VITE_API_BASE_URL
      : 'http://survey-general-api.test')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false,
          target: proxyTarget,
        },
      },
    },
  }
})
