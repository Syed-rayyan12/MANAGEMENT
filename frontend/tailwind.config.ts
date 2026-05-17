import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          2: 'var(--fg-2)',
          3: 'var(--fg-3)',
          4: 'var(--fg-4)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
          fg: 'var(--accent-fg)',
          compat: 'var(--accent-compat)',
          'compat-foreground': 'var(--accent-compat-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        'line-strong': 'var(--line-strong)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Status colors
        status: {
          green: 'var(--status-green)',
          'green-soft': 'var(--status-green-soft)',
          blue: 'var(--status-blue)',
          'blue-soft': 'var(--status-blue-soft)',
          violet: 'var(--status-violet)',
          'violet-soft': 'var(--status-violet-soft)',
          amber: 'var(--status-amber)',
          'amber-soft': 'var(--status-amber-soft)',
          red: 'var(--status-red)',
          'red-soft': 'var(--status-red-soft)',
        },
        // Workspace colors
        ws: {
          logo: 'var(--ws-logo)',
          'web-design': 'var(--ws-web-design)',
          'web-dev': 'var(--ws-web-dev)',
          content: 'var(--ws-content)',
        },
        // Chart colors
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        // Sidebar
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        '1': 'var(--shadow-1)',
        '2': 'var(--shadow-2)',
        '3': 'var(--shadow-3)',
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'kicker': ['10.5px', { lineHeight: '1', fontWeight: '500', letterSpacing: '0.08em' }],
        'pill': ['11px', { lineHeight: '1.2', fontWeight: '500' }],
        'body': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'card-title': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'card-id': ['10.5px', { lineHeight: '1', fontWeight: '500' }],
        'kpi': ['26px', { lineHeight: '1', fontWeight: '500' }],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
