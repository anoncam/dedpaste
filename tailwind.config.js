/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,ts}'],
  theme: {
    extend: {
      colors: {
        // Shebash-inspired color scheme
        primary: {
          50: '#f6f7ff',
          100: '#eef0ff',
          200: '#dee1ff',
          300: '#bbc3ff',
          400: '#8f8fff',
          500: '#7b5fff',
          600: '#634aff',
          700: '#5231f4',
          800: '#4526e0',
          900: '#3b1fb2'
        },
        secondary: {
          50: '#f8f9fa',
          100: '#edf0f2',
          200: '#d3dde4',
          300: '#a8bccb',
          400: '#6c92ae',
          500: '#4e7a9b',
          600: '#3c607f',
          700: '#324e67',
          800: '#2b3f55',
          900: '#253546'
        },
        dark: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d8d8dc',
          300: '#b6b7bd',
          400: '#908f99',
          500: '#7a7984',
          600: '#5f5e67',
          700: '#4a4952',
          800: '#2c2b31',
          900: '#18171c'
        },
        accent: '#03dac6',
        danger: '#cf6679',
        success: '#4caf50',
        warning: '#fd7e14'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      },
      boxShadow: {
        'inner-md': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'inner-lg': 'inset 0 4px 8px 0 rgba(0, 0, 0, 0.12)'
      }
    }
  },
  plugins: []
};