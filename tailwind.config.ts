import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				dark: 'hsl(var(--primary-dark))',
  				foreground: 'hsl(var(--primary-foreground))',
				50: '#f0fdf4',
				100: '#dcfce7',
				200: '#bbf7d0',
				300: '#86efac',
				400: '#4ade80',
				500: '#22c55e',
				600: '#16a34a',
				700: '#15803d',
				800: '#166534',
				900: '#14532d',
				950: '#052e16'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))',
				50: '#f8fafc',
				100: '#f1f5f9',
				200: '#e2e8f0',
				300: '#cbd5e1',
				400: '#94a3b8',
				500: '#64748b',
				600: '#475569',
				700: '#334155',
				800: '#1e293b',
				900: '#0f172a',
				950: '#020617'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  				yellow: '#facc15',
  				green: '#22c55e',
  				blue: '#3b82f6',
  				purple: '#8b5cf6',
				primary: '#22c55e'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			glass: {
  				DEFAULT: 'rgba(60, 60, 75, 0.85)',
  				hover: 'rgba(70, 70, 90, 0.9)',
  				light: 'rgba(80, 80, 100, 0.8)',
  				surface: 'hsl(var(--surface))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			surface: {
  				primary: '#18181b',
  				secondary: '#1e1e23',
  				tertiary: '#2a2a35',
  				elevated: '#27272a'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			'4xl': '2rem'
  		},
  		spacing: {
  			'18': '4.5rem',
  			'88': '22rem',
  			'128': '32rem',
  			'144': '36rem'
  		},
  		fontFamily: {
  			sans: ['Inter', 'system-ui', 'sans-serif'],
  			display: ['Inter', 'system-ui', 'sans-serif'],
  			mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace']
  		},
  				fontSize: {
			'2xs': ['0.625rem', { lineHeight: '0.75rem' }],
			'xs': ['0.75rem', { lineHeight: '1rem' }],
			'sm': ['0.875rem', { lineHeight: '1.25rem' }],
			'base': ['1rem', { lineHeight: '1.5rem' }],
			'lg': ['1.125rem', { lineHeight: '1.75rem' }],
			'xl': ['1.25rem', { lineHeight: '1.75rem' }],
			'2xl': ['1.5rem', { lineHeight: '2rem' }],
			'3xl': ['2rem', { lineHeight: '2.25rem' }],
			'4xl': ['2.5rem', { lineHeight: '2.75rem' }],
			'5xl': ['3rem', { lineHeight: '3.25rem' }],
			'6xl': ['3.75rem', { lineHeight: '1' }],
			'display-sm': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
			'display-md': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '600' }],
			'display-lg': ['3rem', { lineHeight: '3.5rem', fontWeight: '700' }]
		},
  		backdropBlur: {
  			'xs': '2px',
  			'4xl': '72px'
  		},
  				boxShadow: {
			'glass': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15) inset',
			'glass-lg': '0 12px 40px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.15) inset',
			'primary': '0 10px 25px rgba(139, 92, 246, 0.25)',
			'glow': '0 0 20px rgba(139, 92, 246, 0.6)',
			'inner-light': 'inset 0 0 0 1px rgba(255, 255, 255, 0.15)',
			// Enhanced shadows for professional cards like the reference
			'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
			'card-hover': '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
			'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
			'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
			'deep': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
			'soft': '0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)'
		},
  		keyframes: {
  			fadeIn: {
  				'0%': { opacity: '0', transform: 'translateY(10px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			slideUp: {
  				'0%': { transform: 'translateY(100%)', opacity: '0' },
  				'100%': { transform: 'translateY(0)', opacity: '1' }
  			},
  			float: {
  				'0%, 100%': { transform: 'translateY(0px)' },
  				'50%': { transform: 'translateY(-10px)' }
  			},
  			shimmer: {
  				'0%': { backgroundPosition: '-200% 0' },
  				'100%': { backgroundPosition: '200% 0' }
  			}
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.5s ease-in-out',
  			'slide-up': 'slideUp 0.3s ease-out',
    			'float': 'float 3s ease-in-out infinite',
  			'shimmer': 'shimmer 2s linear infinite'
  		}
  	}
  },
  plugins: [
	require("tailwindcss-animate")
	// Note: @tailwindcss/typography temporarily removed due to Next.js cache issue
	// Will re-add when needed for typography-specific features
  ],
};
export default config;
