/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Set 'Inter' as the default sans-serif font
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      // Define a new, modern color palette
      colors: {
        // Example: A more muted, professional blue
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Base colors for text
        text: {
          DEFAULT: '#36006B', // dark purple
          light: '#4b5563',   // gray-600
          subtle: '#9ca3af', // gray-400
        },
        // Base colors for backgrounds
        bg: {
          DEFAULT: '#ffffff',    // white
          subtle: '#f9fafb',   // gray-50
          muted: '#f3f4f6',    // gray-100
        },
        // Base colors for borders
        border: {
          DEFAULT: '#e5e7eb', // gray-200
          dark: '#d1d5db',    // gray-300
        },
      },
      // Add subtle animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideInUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideInUp: 'slideInUp 0.4s ease-out',
      },
    },
  },
  plugins: [],
}