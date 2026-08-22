# Design QA — entrada, esfera y transición de nubes

## Artifacts

- Source visual truth: `/tmp/RustDesk/cliprdr-server/Language_School_Esfera_Nubes_Creativas_CORREGIDA (2).html`
- Source desktop intro: `/tmp/language-school-entry-audit.VrCGdi/01-reference-intro.png`
- Source desktop clouds: `/tmp/language-school-entry-audit.VrCGdi/02-reference-clouds.png`
- Implementation desktop intro: `/tmp/language-school-entry-build-qa/01-implemented-intro.png`
- Implementation desktop clouds: `/tmp/language-school-entry-build-qa/02-implemented-clouds.png`
- Implementation mobile intro: `/tmp/language-school-entry-build-qa/03-implemented-mobile-intro.png`
- Implementation mobile clouds: `/tmp/language-school-entry-build-qa/04-implemented-mobile-clouds.png`
- Desktop intro comparison: `/tmp/language-school-entry-build-qa/07-desktop-intro-comparison.jpg`
- Desktop cloud comparison: `/tmp/language-school-entry-build-qa/08-desktop-cloud-comparison.jpg`
- Mobile intro comparison: `/tmp/language-school-entry-build-qa/09-mobile-intro-comparison.jpg`
- Mobile cloud comparison: `/tmp/language-school-entry-build-qa/10-mobile-cloud-comparison.jpg`

## Normalization

- Desktop viewport and source/implementation pixels: `1280 × 720`, device scale factor `1`.
- Mobile viewport and source/implementation pixels: `390 × 844`, device scale factor `1`.
- Comparisons place the source on the left and the implementation on the right at identical viewport size and interaction timing.
- Intro state: settled sphere, airplane and enabled `ENTRAR` action.
- Cloud state: 900 ms after activating the transition.

## Full-view comparison evidence

- The pink cloud image, central opening, tonal density, crop and whiteout direction match the supplied source at desktop and mobile sizes.
- The production intro intentionally preserves the existing Language School sphere treatment. Its stronger land fill and airplane position are an accepted product constraint rather than a mismatch introduced by this change.
- The main composition, brand hierarchy and bottom entry action remain stable on desktop and mobile.

## Focused comparison evidence

- Cloud asset quality: the supplied 1672 × 941 PNG was converted to a local 1440 × 810 WebP without visible halos or crop loss. The optimized asset is 88,178 bytes.
- Typography and copy: existing Montserrat/Playball hierarchy and `ENTRAR` copy are unchanged.
- Spacing and layout rhythm: sphere centering, CTA position and mobile safe-area spacing remain intact.
- Colors and tokens: the cloud transition now uses the source pink palette instead of the previous near-white gradients.
- Icons: the existing airplane and CTA arrow are unchanged.

## Interaction and accessibility checks

- Keyboard-semantic `ENTRAR` button remains enabled and accessible.
- Reduced-motion transition remains implemented with a shorter, non-travelling state.
- Returning from an external document through browser history replays the intro.
- Internal SPA navigation back to `/` does not replay the intro.
- Desktop and mobile browser console: no warnings or errors after the geometry fix.

## Comparison history

1. Earlier P1: deployed cloud transition appeared almost white and did not match the pink volumetric source.
   - Fix: replaced synthetic white cloud gradients with the optimized supplied cloud asset and source-matched masks/timing.
   - Post-fix evidence: desktop and mobile cloud comparison images listed above.
2. Earlier P1: Three.js reported a `LatheGeometry` bounding-sphere `NaN` error.
   - Fix: clamped the airplane tail radius input before the fractional power calculation.
   - Post-fix evidence: fresh desktop and mobile sessions report no console warnings or errors.
3. Earlier P1: `sessionStorage` skipped the intro after leaving and returning in the same tab.
   - Fix: replaced tab-session persistence with document-lifetime state plus BFCache `pageshow` replay.
   - Post-fix evidence: external-return test shows `ENTRAR`; internal-navigation return shows the Home page without replay.
4. Earlier P2: the first intro module bundled all 3D code before rendering the production composition.
   - Fix: split the globe and airplane into deferred chunks, preload the cloud transition, reduce texture resolution/DPR and delay the detailed atlas request.
   - Post-fix evidence: the `IntroPage` entry chunk is 2.59 kB uncompressed and the immediate CSS sphere is visible before the enhanced artwork.

## Findings

- No actionable P0, P1 or P2 visual or interaction differences remain for the requested scope.
- P3 follow-up: a future pass could merge the two WebGL canvases, but it is not required for the current visual or perceived-load target.

## Implementation checklist

- [x] Pink cloud asset integrated and optimized.
- [x] Desktop and mobile transition matched to source.
- [x] Sphere load made progressive.
- [x] Three.js `NaN` error removed.
- [x] External return replays intro.
- [x] Internal navigation does not replay intro.
- [x] Production build passes in demo mode.

final result: passed
