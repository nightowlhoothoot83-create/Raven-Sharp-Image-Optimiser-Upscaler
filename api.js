const ASCENSION_LOGO =
  "/raven-logo.png";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-20 border-t border-raven-border bg-black/40"
      data-testid="site-footer"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 flex flex-col items-center text-center gap-5">
        <a
          href="https://ascensiondigital.group"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-col items-center gap-2"
          data-testid="ascension-logo-link"
        >
          <span className="label-tiny text-raven-muted group-hover:text-raven-violetBright transition-colors">
            Part of the Ascension Group
          </span>
          <img
            src={ASCENSION_LOGO}
            alt="Ascension Digital"
            className="h-20 w-auto object-contain rounded-md transition-opacity group-hover:opacity-90"
          />
        </a>
        <div className="text-xs text-raven-muted">
          © {year} Raven Sharp · Built for designers, sellers, and print pros.
        </div>
      </div>
    </footer>
  );
}
