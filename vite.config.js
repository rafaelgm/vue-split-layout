import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'demo') {
    // Config for running the demo
    return {
      plugins: [
          vue(),
        ],
      resolve: {
        alias: {
          'vue-split-layout/src': path.resolve(__dirname, './src'),
          'vue-split-layout': path.resolve(__dirname, './src'), // Alias for demo
        },
      },
      root: path.resolve(__dirname, 'demo'), // Point Vite to the demo folder
      base: '/vue-split-layout/', // Set base for GitHub Pages deployment
      build: {
        outDir: path.resolve(__dirname, 'docs'), // Output demo build to docs folder
        emptyOutDir: true,
      },
      server: {
        port: 8080,
      }
    }
  } else {
    // Config for building the library
    return {
      plugins: [
          vue(),
      ],
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.js'),
          name: 'VueSplitLayout',
          fileName: (format) => `vue-split-layout.${format === 'es' ? 'js' : format + '.cjs'}`,
          formats: ['es', 'umd']
        },
        rollupOptions: {
          external: ['vue', 'lodash/cloneDeep'], // Externalize lodash/cloneDeep if used directly
          output: {
            globals: {
              vue: 'Vue',
              'lodash/cloneDeep': '_.cloneDeep' // Provide global for lodash if needed in UMD
            },
            assetFileNames: (assetInfo) => {
              if (assetInfo.name === 'style.css') {
                return 'style.css';
              }
              return assetInfo.name;
            },
          },
        },
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          // Add alias for lodash if needed, or ensure it's correctly resolved
           'lodash/cloneDeep': 'lodash/cloneDeep',
        },
      },
    }
  }
});