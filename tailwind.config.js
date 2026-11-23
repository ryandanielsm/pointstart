/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          offwhite: '#F5F5F2',
          surface: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          dark: '#18181B',
          muted: '#71717A',
          lilac: '#818CF8',
          'lilac-light': '#EEF2FF',
          'lilac-dark': '#6366F1',
          emerald: '#10B981',
          'emerald-light': '#ECFDF5',
          amber: '#F59E0B',
          'amber-light': '#FFFBEB'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'shimmer-slide': 'shimmerSlide 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'subtle-pulse': 'subtlePulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'cloud-float': 'cloudFloat 12s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmerSlide: {
          '0%, 100%': { transform: 'translateX(-120%)', opacity: '0.3' },
          '50%': { transform: 'translateX(120%)', opacity: '1' }
        },
        subtlePulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.04)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        cloudFloat: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(20px, -15px) scale(1.08)' },
          '100%': { transform: 'translate(-15px, 10px) scale(0.96)' }
        }
      }
    },
  },
  plugins: [],
}

