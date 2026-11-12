import defaultTheme from 'tailwindcss/defaultTheme';

// ELEVATE v2 design system (Figma: IElevate_Blue_Print, frame 00_design_system).
// Navy carries structure and text; orange is reserved for the main action and
// highlights. `stone` and `slate` are remapped to the design's cool neutrals so
// existing borders, backgrounds and secondary text pick up the new palette.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
      },
      // Easier to read than the defaults (14px / 12px): body text 15px, small text 13px.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
      },
      colors: {
        // Navy
        brand: {
          50: '#E8EFF6', // Navy 50 · tints, selected
          100: '#D6E2EE',
          200: '#B5CADD',
          300: '#89A9C6',
          400: '#4F7BA3',
          500: '#1D5585',
          600: '#033962', // Navy 700 · brand, links
          700: '#022A49', // Navy 900 · footer, headings on light
          800: '#022A49',
          900: '#022A49',
        },
        // Orange
        accent: {
          50: '#FFF2E3', // Orange 50 · highlight tint
          100: '#FFE3C2',
          200: '#FFC98A',
          500: '#FE8101', // Orange 500 · main action
          550: '#EE7600', // main action, hover
          600: '#C25E00', // Orange 600 · orange text
          700: '#9A4B00',
        },
        // Cool neutrals: Canvas #F5F7F9, Border #D9DFE5
        stone: {
          50: '#F5F7F9',
          100: '#EDF1F4',
          200: '#D9DFE5',
          300: '#C3CCD5',
          400: '#98A4B0',
          500: '#6B7885',
          600: '#4A5866',
          700: '#36424E',
          800: '#232E39',
          900: '#14202B',
        },
        // Text: Ink #14202B, Ink muted #4A5866
        slate: {
          50: '#F5F7F9',
          100: '#EDF1F4',
          200: '#D9DFE5',
          300: '#B4BEC8',
          400: '#7D8996',
          500: '#4A5866',
          600: '#3D4A57',
          700: '#2C3845',
          800: '#1C2833',
          900: '#14202B',
        },
        success: '#1E7A4C',
        danger: '#B42318',
      },
    },
  },
  plugins: [],
};
