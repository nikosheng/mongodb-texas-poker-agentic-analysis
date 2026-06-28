export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a4a2e',
          dark: '#0d2b1a',
          light: '#256b42',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d060',
          dark: '#a8841a',
        },
        chip: {
          red: '#c0392b',
          blue: '#2980b9',
          black: '#1a1a1a',
          green: '#27ae60',
          white: '#ecf0f1',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'deal': 'dealCard 0.3s ease-out',
        'flip': 'flipCard 0.5s ease-in-out',
        'chip-toss': 'chipToss 0.4s ease-out',
        'pulse-gold': 'pulseGold 1.5s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        dealCard: {
          '0%': { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        flipCard: {
          '0%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        chipToss: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 8px #d4af37' },
          '50%': { boxShadow: '0 0 24px #d4af37, 0 0 48px #d4af3766' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
