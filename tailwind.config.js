/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#131316',
          dim: '#131316',
          bright: '#39393c',
          lowest: '#0e0e11',
          low: '#1b1b1e',
          container: '#1f1f22',
          high: '#2a2a2d',
          highest: '#353438',
        },
        primary: {
          DEFAULT: '#d0bcff',
          on: '#3c0091',
          container: '#a078ff',
          'on-container': '#340080',
          inverse: '#6d3bd7',
        },
        secondary: {
          DEFAULT: '#44e2cd',
          on: '#003731',
          container: '#03c6b2',
          'on-container': '#004d44',
        },
        tertiary: {
          DEFAULT: '#ffafd3',
          on: '#620040',
          container: '#e364a7',
          'on-container': '#560038',
        },
        'on-surface': '#e4e1e6',
        'on-surface-variant': '#cbc3d7',
        outline: '#958ea0',
        'outline-variant': '#494454',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Hanken Grotesk', 'sans-serif'],
      },
      borderRadius: {
        'lg': '1rem',
        'xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
