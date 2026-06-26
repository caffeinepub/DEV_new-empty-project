import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-subtle sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Compass icon */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0"
          >
            <circle
              cx="18"
              cy="18"
              r="15"
              stroke="oklch(0.48 0.16 220)"
              strokeWidth="2"
              fill="oklch(0.48 0.16 220 / 0.08)"
            />
            <circle cx="18" cy="18" r="2.5" fill="oklch(0.48 0.16 220)" />
            {/* N needle */}
            <polygon
              points="18,7 16.5,17.5 18,15.5 19.5,17.5"
              fill="oklch(0.55 0.22 25)"
            />
            {/* S needle */}
            <polygon
              points="18,29 16.5,18.5 18,20.5 19.5,18.5"
              fill="oklch(0.52 0.04 230)"
            />
            <text
              x="18"
              y="5"
              textAnchor="middle"
              fontSize="4"
              fontWeight="bold"
              fill="oklch(0.48 0.16 220)"
            >
              N
            </text>
          </svg>
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-primary leading-tight tracking-tight">
              Gmailer
            </h1>
            <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">
              Your travel check-ins, delivered
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Airplane icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                fill="oklch(0.48 0.16 220 / 0.7)"
              />
            </svg>
            <span>
              © {new Date().getFullYear()}. Built with love using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline transition-smooth"
              >
                caffeine.ai
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
