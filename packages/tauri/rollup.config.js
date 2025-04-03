const sharedConfig = {
  plugins: [],
  external: ['zustand', 'zustand/vanilla'],
};

export default [
  {
    input: './dist/backend.js',
    output: {
      file: './dist/backend.cjs',
      format: 'cjs',
    },
    ...sharedConfig,
  },
  {
    input: './dist/index.js',
    output: {
      file: './dist/index.cjs',
      format: 'cjs',
    },
    ...sharedConfig,
  },
];
