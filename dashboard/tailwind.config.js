export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mongo: {
          green: '#00ed64',
          dark: '#00684a',
          black: '#001e2b',
          gray: '#1c2d38',
          light: '#e3fcf1',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d060',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
