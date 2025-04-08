// rollup.config.js
export default {
  input: './dist/index.js',
  external: ['zustand', 'zustand/vanilla'],
  output: {
    file: './dist/index.cjs',
    format: 'cjs',
    exports: 'named',
  },
};
