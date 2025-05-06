/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      extend: {
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))",
          },
          destructive: {
            DEFAULT: "hsl(var(--destructive))",
            foreground: "hsl(var(--destructive-foreground))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))",
          },
          popover: {
            DEFAULT: "hsl(var(--popover))",
            foreground: "hsl(var(--popover-foreground))",
          },
          card: {
            DEFAULT: "hsl(var(--card))",
            foreground: "hsl(var(--card-foreground))",
          },
          // Space-themed color palette
          space: {
            black: "#0A0E17",
            darkBlue: "#0F1C2E",
            navy: "#1A2C42",
            blue: "#0D6EFD",
            cyan: "#0DCAF0",
            teal: "#20C997",
            purple: "#6F42C1",
            violet: "#8B5CF6",
            indigo: "#4F46E5",
            pink: "#D63384",
            alert: "#DC3545",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
          // Futuristic border radius
          control: "0.25rem 1rem",
          panel: "1rem",
        },
        fontFamily: {
          space: ["'Orbitron'", "'Rajdhani'", "sans-serif"],
          mono: ["'JetBrains Mono'", "monospace"],
        },
        boxShadow: {
          glow: "0 0 10px rgba(13, 110, 253, 0.5), 0 0 20px rgba(13, 110, 253, 0.3)",
          "glow-teal": "0 0 10px rgba(32, 201, 151, 0.5), 0 0 20px rgba(32, 201, 151, 0.3)",
          "glow-purple": "0 0 10px rgba(111, 66, 193, 0.5), 0 0 20px rgba(111, 66, 193, 0.3)",
          "glow-alert": "0 0 10px rgba(220, 53, 69, 0.5), 0 0 20px rgba(220, 53, 69, 0.3)",
        },
      },
    },
    plugins: [
      require("tailwindcss-animate"),
      require('@tailwindcss/typography')
      // Container queries plugin should only be added if it's in the dependencies
    ],
  }
  