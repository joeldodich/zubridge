/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          light: 'var(--color-primary-light)',
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          darker: 'var(--color-primary-darker)',
        },
        reset: {
          DEFAULT: 'var(--color-reset)',
          hover: 'var(--color-reset-hover)',
          active: 'var(--color-reset-active)',
        },
        create: {
          DEFAULT: 'var(--color-create)',
          hover: 'var(--color-create-hover)',
          active: 'var(--color-create-active)',
        },
        close: {
          DEFAULT: 'var(--color-close)',
          hover: 'var(--color-close-hover)',
          active: 'var(--color-close-active)',
        },
        status: {
          ready: 'var(--color-status-ready)',
          error: 'var(--color-status-error)',
        },
        light: {
          bg: 'var(--color-light-bg)',
          text: 'var(--color-light-text)',
          runtime: 'var(--color-light-runtime)',
        },
        dark: {
          bg: 'var(--color-dark-bg)',
          text: 'var(--color-dark-text)',
        },
      },
      spacing: {
        'button-height': '38px',
        'button-width': '140px',
        'container-width': '300px',
      },
    },
  },
  plugins: [],
};
