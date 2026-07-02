@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 17% 4%;
    --foreground: 210 20% 98%;
    --card: 240 16% 7%;
    --card-foreground: 210 20% 98%;
    --popover: 240 16% 7%;
    --popover-foreground: 210 20% 98%;
    --primary: 258 90% 66%;
    --primary-foreground: 210 20% 98%;
    --secondary: 240 14% 12%;
    --secondary-foreground: 210 20% 98%;
    --muted: 240 14% 12%;
    --muted-foreground: 215 16% 47%;
    --accent: 240 14% 12%;
    --accent-foreground: 210 20% 98%;
    --destructive: 0 84% 65%;
    --destructive-foreground: 210 20% 98%;
    --border: 240 6% 15%;
    --input: 240 6% 15%;
    --ring: 258 90% 66%;
    --radius: 0.75rem;
  }
}

@layer base {
  * { @apply border-border; }
  html, body, #root { height: 100%; }
  body {
    @apply bg-raven-bg text-raven-text font-body antialiased;
    background-image: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139, 92, 246, 0.12), transparent 60%),
                      radial-gradient(ellipse 60% 40% at 90% 110%, rgba(34, 211, 238, 0.06), transparent 60%);
    background-attachment: fixed;
  }
  ::selection { background: rgba(139, 92, 246, 0.4); color: #fff; }
}

@layer components {
  .glass {
    background: rgba(14, 14, 20, 0.65);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .label-tiny {
    @apply text-[10px] uppercase tracking-[0.2em] text-raven-muted font-body;
  }

  .pill {
    @apply px-3 py-1.5 rounded-full text-xs font-medium font-body border border-transparent text-raven-muted hover:text-raven-text transition-colors cursor-pointer select-none;
  }
  .pill-active {
    @apply bg-raven-violet/15 text-raven-violetBright border-raven-violet/40;
  }

  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-full font-display tracking-[0.18em] uppercase text-base px-7 py-3 text-white;
    background: linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%);
    box-shadow: 0 0 24px rgba(139, 92, 246, 0.35), inset 0 1px 0 rgba(255,255,255,0.18);
    transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .btn-primary:hover { box-shadow: 0 0 36px rgba(167, 139, 250, 0.55), inset 0 1px 0 rgba(255,255,255,0.25); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }

  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-raven-border text-raven-text/85 hover:text-raven-text hover:border-white/20 hover:bg-white/[0.03] transition-colors;
  }

  .surface {
    @apply bg-raven-surface border border-raven-border rounded-xl;
  }

  .input-base {
    @apply bg-[#0A0A0E] border border-raven-border rounded-md px-3 py-2 text-sm font-body text-raven-text placeholder:text-raven-muted focus:border-raven-violet focus:ring-2 focus:ring-raven-violet/30 outline-none transition;
  }

  /* Range slider styling */
  input[type="range"].rs {
    @apply w-full appearance-none bg-transparent cursor-pointer;
    height: 22px;
  }
  input[type="range"].rs::-webkit-slider-runnable-track {
    height: 4px; border-radius: 999px;
    background: linear-gradient(90deg, #8B5CF6 var(--p, 0%), rgba(255,255,255,0.08) var(--p, 0%));
  }
  input[type="range"].rs::-moz-range-track {
    height: 4px; border-radius: 999px; background: rgba(255,255,255,0.08);
  }
  input[type="range"].rs::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    height: 16px; width: 16px; border-radius: 50%;
    background: #fff; border: 2px solid #8B5CF6;
    margin-top: -6px;
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
  }
  input[type="range"].rs::-moz-range-thumb {
    height: 16px; width: 16px; border-radius: 50%;
    background: #fff; border: 2px solid #8B5CF6;
  }

  /* Logo presentation — show the original product-shot PNG cleanly framed on dark UI */
  .logo-plate {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
}
