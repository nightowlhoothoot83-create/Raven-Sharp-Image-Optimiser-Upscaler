import React from "react";

const BRANDS = [
  { name: "MyCalendarTools", logo: "/brands/myCalendarTools.png", url: "https://mycalendartools.net" },
  { name: "MyCalcTools", logo: "/brands/myCalcTools.png", url: "https://mycalctools.net" },
  { name: "Wheel Name Picker", logo: "/brands/wheelNamePicker.png", url: "https://wheelnamepicker.com.au" },
  { name: "Raven Sharp", logo: "/brands/ravenSharpLogo.png", url: "https://raven-sharp.com" },
  { name: "Zyia Creations", logo: "/brands/zyiaCreations.png", url: "https://zyia-creations.printify.me/" },
  { name: "ADG Downloads", logo: "/brands/adgDownloads.png", url: "https://zyiacreations.etsy.com" },
  { name: "Feed the Feed", logo: "/brands/feedTheFeed.png", url: "https://www.facebook.com/share/1HfyRTQtg1/" },
  { name: "Spew Crew Kids", logo: "/brands/spewCrew.png", url: "https://www.youtube.com/@spewcrewkids" },
  { name: "Mystical Moments", logo: "/brands/mysticalMoments.png", url: "https://mysticalmoments.pages.dev" },
];

export default function ADGFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#080810]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <a href="https://ascensiondigitalgroup.com" target="_blank" rel="noopener noreferrer" className="inline-block">
          <img
            src="/brands/ascensionDigital.png"
            alt="Ascension Digital"
            className="w-[220px] h-auto rounded-xl mx-auto mb-5 object-contain"
            style={{ filter: "drop-shadow(0 0 16px rgba(6,214,255,0.3))" }}
          />
        </a>
        <h3 className="text-lg font-bold text-white mb-1">Part of the Ascension Digital Group</h3>
        <p className="text-sm text-[var(--muted)] mb-6">Elevating Your Digital Future</p>

        <div className="flex justify-center gap-4 flex-wrap mb-6 items-center">
          {BRANDS.map((brand) => (
            <a
              key={brand.name}
              href={brand.url}
              target="_blank"
              rel="noopener noreferrer"
              title={brand.name}
              aria-label={`${brand.name} (opens in new tab)`}
              className="opacity-85 hover:opacity-100 transition-opacity"
            >
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-[52px] h-[52px] rounded-xl object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>

        <a
          href="/about#support"
          className="inline-flex items-center justify-center rounded-full px-6 py-2.5 font-bold text-white no-underline transition-transform hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #06d6ff, #8b5cf6)",
            boxShadow: "0 0 20px rgba(6,214,255,0.3), 0 0 40px rgba(139,92,246,0.2)",
          }}
        >
          Support Us
        </a>
      </div>
    </footer>
  );
}
