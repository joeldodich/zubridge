const sharedConfig = {
  plugins: [],
  external: ['zustand', 'zustand/vanilla'],
};

export default [
  {
    input: './dist/index.js',
    output: {
      file: './dist/index.cjs',
      format: 'cjs',
    },
    ...sharedConfig,
  },
];
