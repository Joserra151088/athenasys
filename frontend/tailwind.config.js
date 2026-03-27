/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0faf0',
          100: '#d8f0d8',
          200: '#b0e0b0',
          300: '#7ec97e',
          400: '#5db847',
          500: '#4aa33a',
          600: '#3a8c2c',
          700: '#2e7024',
          800: '#265920',
          900: '#1e481a',
        },
        navy: {
          50:  '#eef2fa',
          100: '#d5dff3',
          200: '#adc0e7',
          300: '#7a9ad6',
          400: '#4d77c5',
          500: '#2d5ab0',
          600: '#1e3f8a',
          700: '#1a3471',
          800: '#162b5e',
          900: '#10204a',
        },
        gold: {
          50:  '#fdf8ee',
          100: '#faefd0',
          200: '#f5d98d',
          300: '#f0bf4a',
          400: '#e8a820',
          500: '#d4921a',
          600: '#b87815',
          700: '#9a6010',
          800: '#7d4c0c',
          900: '#623b09',
        }
      }
    }
  },
  plugins: []
}
