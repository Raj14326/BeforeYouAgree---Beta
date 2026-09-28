import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // Vuetify's autoImport-injected per-component CSS imports need to go
      // through Vite's transform (not Node's native loader, which chokes on
      // bare `.css`/`.sass` extensions) for prototype component tests.
      server: {
        deps: {
          inline: [/vuetify/],
        },
      },
    },
  }),
)
