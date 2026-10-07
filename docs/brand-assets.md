# RelayWa branding

Approved direction: RW monogram, white R, WhatsApp green W with its final stroke continuing into a send arrow. Text logo: RelayWa, white Relay and green Wa.

Separate transparent originals are in `apps/web/public/brand/relaywa-icon.png` and `relaywa-textlogo.png`. Web-sized derivatives are used by the shared Brand component on marketing, authentication, documentation and workspace/admin navigation. PNG favicons and the touch icon derive from the RW asset. The icon is also available for email templates when those are implemented.

Generated with the built-in image generation tool. Icon prompt: preserve the approved RW geometry; white R, green W and integrated arrow, transparent background. Wordmark prompt: text only, exact RelayWa capitalization, white Relay and green Wa, transparent background.

Interface icons use Font Awesome 6 through react-icons. Language and framework logos use Simple Icons and Font Awesome brand icons. Inter Variable is bundled locally, so typography does not need an external font request. Brand imagery remains separate from interface icons.

Placement: use the text logo alone in headers and navigation. Do not place the RW icon beside the wordmark. Use the RW icon separately for favicons, touch icons, loading screens and suitable email placements.

Theme: white foreground, WhatsApp green `#25D366`, black `#070909`, charcoal surfaces and subtle green-to-black gradients. Shared customer, marketing, authentication, docs and admin styles follow this palette. Violet accents were removed. Production web build passed after the palette update; browser visual verification remains pending because browser access to the existing preview tab was blocked by its URL policy.
