# NEXUS visual refresh

11 November 2026. This update follows the user's request to change typography and colors, extend dark mode to the hero, improve motion responsiveness and redesign the presentation. It supersedes the earlier instruction to preserve the hero presentation.

The visual direction uses an editorial composition: a large left-aligned headline and search, a chrome knowledge sculpture and dimensional cards, generous spacing, quieter borders and a restrained botanical accent. Light mode uses warm ivory; dark mode uses deep graphite with a subtle green cast. NEXUS identity, actual knowledge records, universal Wikipedia search, evidence views, scientific models and account flows remain connected to their existing services.

Manrope Variable is used for headings and Geist Variable for interface/body copy. JetBrains Mono is reserved for small editorial labels and metadata. Fonts are served locally through Fontsource; their licenses are retained in `frontend/public/licenses`. A matching SVG app icon uses the existing network identity.

The root theme tokens in `app/globals.css` drive navigation, page surfaces, inputs, cards, reader pages and the hero. The hero no longer forces light color-scheme or hardcodes a white search/navigation surface. Theme selection retains the existing cookie and localStorage behavior. The bright knowledge cards are intentional artwork in both themes. Scientific object colors and evidence status distinctions remain meaningful rather than being recolored indiscriminately.

Motion changes:

- Hero card transitions: 1,250 ms to 560 ms; automatic advance: 6.2 to 4.8 seconds.
- Content entrances: 720 ms to 420 ms, maximum stagger 260 ms to 84 ms. Animated blur is removed. Entrances use individual translation so they do not block hover transforms.
- Pointer effects are coalesced once per animation frame, with cached bounds and reduced tilt; hover transform response is 160 ms rather than 550 ms.
- Mutation observation registers added subtrees in one frame instead of repeatedly scanning the full page. Revealed nonambient elements stop intersection observation.
- Topic fan transitions: 900 ms to 420 ms; direct hover response: 180 ms. Showcase entrances use translation/opacity rather than animated margin and blur.
- The hero WebGL scene stays mounted after first use and renders on demand when paused/offscreen. Only the active core card animates. Animation time accumulates while playing to avoid a resume jump.

Reduced-motion settings, manual card selection, playback control, mobile navigation and the SVG fallback remain supported. Duration reductions and rendering changes address the observed sources of delay; they are not a claim of a measured frame-rate improvement on every device.

Initial verification passed 20 desktop/mobile browser scenarios and 16 frontend unit tests. Visual screenshots were reviewed for both themes at desktop and mobile sizes. The optimized production build passes. The full production regression suite subsequently passed 80/80 desktop/mobile browser scenarios. Final regression evidence is recorded in `TEST_RESULTS.md` and `.tools/premium-browser-production.log`. The native visible-browser handoff encountered an OS capture failure; automated Chrome runs supply the browser verification and screenshots.
