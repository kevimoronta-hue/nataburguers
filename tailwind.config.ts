import type { Config } from 'tailwindcss';

/**
 * Los valores vienen del design system Nata Burger's (tokens.json).
 * No añadas colores, radios ni espacios que no estén ahí.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // `hover:` solo en dispositivos con puntero (@media (hover: hover)):
  // en táctil el estado hover se quedaría "pegado" tras el tap.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      transitionTimingFunction: {
        /** Salida rápida, asentamiento suave; sin rebote. */
        premium: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      colors: {
        bg: {
          base: '#080706',
          subtle: '#0d0b0a',
        },
        surface: {
          DEFAULT: '#12100f',
          raised: '#1a1715',
          hover: '#211d1a',
        },
        brand: {
          DEFAULT: '#ff5a00',
          bright: '#ff7417',
          ember: '#d94300',
          deep: '#8f2d00',
          on: '#080706',
        },
        ink: {
          DEFAULT: '#fff1d6',
          strong: '#fff9f0',
          muted: '#b8afa6',
          disabled: '#746d67',
        },
        line: {
          DEFAULT: '#2b2724',
          strong: '#786f68',
          brand: '#5c2400',
        },
        whatsapp: {
          DEFAULT: '#25d366',
          on: '#080706',
        },
        state: {
          success: '#31c46d',
          danger: '#ff4d4d',
          warning: '#ffb020',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Oswald', 'Arial Narrow', 'sans-serif'],
        ui: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
        pill: '999px',
      },
      boxShadow: {
        nav: '0 10px 30px rgba(0,0,0,0.55)',
        card: '0 2px 14px rgba(0,0,0,0.45)',
        drawer: '-18px 0 48px rgba(0,0,0,0.65)',
        brand: '0 8px 26px rgba(217,67,0,0.38)',
      },
      zIndex: {
        nav: '60',
        categories: '50',
        cartbar: '70',
        drawer: '80',
      },
      maxWidth: {
        shell: '1120px',
      },
      keyframes: {
        'ember-rise': {
          '0%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0' },
          '12%': { opacity: '0.9' },
          '100%': { transform: 'translate3d(14px,-220px,0) scale(0.4)', opacity: '0' },
        },
        'light-sweep': {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)', opacity: '0' },
          '30%': { opacity: '0.7' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)', opacity: '0' },
        },
        'stack-settle': {
          '0%': { transform: 'translateY(var(--stack-from)) scale(1.04)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'ember-rise': 'ember-rise var(--ember-duration,7s) linear infinite',
        'light-sweep': 'light-sweep 1.5s cubic-bezier(0.22,0.61,0.36,1) 0.15s both',
        'stack-settle': 'stack-settle 0.9s cubic-bezier(0.22,0.61,0.36,1) both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,0.61,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
