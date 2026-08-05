/* ═══════════════════════════════════════════════════════════
   Ridge genre engine — 34 genres, each a complete template:
   which visualiser suits it, what palette, how the scene art
   should look, how the thumbnail should read, and how to ask
   Suno for it.

   Mood is detected from the audio (core.js). Genre is chosen by
   you. Where they disagree, the genre wins on look and the mood
   wins on motion — a slow song in a fast genre should still move
   slowly.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const G = (name, family, visual, palette, scene, thumb, suno, tags) =>
  ({ name, family, visual, palette, scene, thumb, suno, tags });

export const GENRES = [
  /* ── Indian ───────────────────────────────────────────── */
  G('Kumaoni Folk','Indian','ridge',['#FFC257','#8FD9C9'],
    'Kumaon hillside terraces at dawn, pine forest, stone houses, mist in the valley, warm low sun',
    'warm gold on deep pine, hand-lettered feel',
    'Kumaoni folk, hudka and murli, female lead vocal, mountain reverb, unhurried',
    ['pahadi','kumaoni','folk','uttarakhand']),
  G('Hindustani Classical','Indian','aurora',['#FFC257','#FF7A9C'],
    'candlelit courtyard, marble and jaali screens, incense smoke, single tanpura, deep shadow',
    'ornate serif over dark red, gold rule',
    'Hindustani classical, tanpura drone, alap into slow teentaal, sarod and tabla',
    ['classical','raga','indian classical']),
  G('Bollywood Retro','Indian','grid',['#FF7A9C','#FFC257'],
    '1970s Bombay, film grain, neon marquee, taxi at night, saturated Kodachrome colour',
    'bold condensed caps, retro poster block',
    'retro Bollywood, live strings, brass stabs, tabla, dramatic vocal, analogue tape',
    ['bollywood','retro','filmi']),
  G('Sufi / Qawwali','Indian','pulse',['#FFC257','#7C6CFF'],
    'dargah at dusk, hanging lamps, whirling cloth, hands raised, warm haze',
    'flowing script feel, amber on indigo',
    'qawwali, harmonium, dholak, clapping, call-and-response chorus, building intensity',
    ['sufi','qawwali','devotional']),
  G('Bhajan / Devotional','Indian','aurora',['#FFC257','#8FD9C9'],
    'river ghat at sunrise, floating diyas, temple bells, soft gold light on water',
    'serene serif, cream on saffron',
    'devotional bhajan, harmonium and manjira, gentle male chorus, peaceful tempo',
    ['bhajan','devotional','bhakti']),
  G('Indie Hindi','Indian','strings',['#7C6CFF','#FF7A9C'],
    'rooftop at blue hour, city lights below, string lights, quiet intimacy',
    'clean sans, muted violet',
    'indie Hindi pop, clean electric guitar, brushed drums, honest close vocal',
    ['indie','hindi indie','desi indie']),
  G('Punjabi Folk','Indian','bars',['#FFC257','#FF7A9C'],
    'mustard fields in full yellow, open sky, tractor dust, harvest celebration',
    'heavy caps, yellow on deep green',
    'Punjabi folk, dhol, tumbi, algoza, energetic male vocal, celebratory',
    ['punjabi','bhangra','folk']),
  G('Ghazal','Indian','strings',['#7C6CFF','#5AC8FA'],
    'empty room, single lamp, rain on old windows, cigarette smoke, blue melancholy',
    'elegant italic serif, silver on midnight',
    'ghazal, sparse harmonium and sarangi, restrained vocal, long pauses, poetry-first',
    ['ghazal','urdu','poetry']),

  /* ── Electronic ───────────────────────────────────────── */
  G('Lofi Hip Hop','Electronic','nebula',['#8FD9C9','#7C6CFF'],
    'rainy window, desk lamp, cassette tapes, cat asleep, muted anime-still warmth',
    'small lowercase sans, soft pastel',
    'lofi hip hop, dusty vinyl crackle, mellow Rhodes, boom-bap drums, 75 bpm',
    ['lofi','chillhop','study']),
  G('Synthwave','Electronic','grid',['#FF7A9C','#5AC8FA'],
    'neon grid horizon, chrome sun, palm silhouettes, purple gradient sky, VHS scanlines',
    'chrome outline caps, magenta glow',
    'synthwave, analogue arpeggiator, gated reverb drums, 1984 Juno pads, 110 bpm',
    ['synthwave','retrowave','80s']),
  G('Deep House','Electronic','pulse',['#5AC8FA','#7C6CFF'],
    'empty club at 4am, fog and single beam, wet concrete, cool blue',
    'thin wide-tracked caps, ice blue',
    'deep house, warm sub bass, filtered chords, shuffled hats, 122 bpm',
    ['house','deep house','club']),
  G('Ambient','Electronic','aurora',['#8FD9C9','#5AC8FA'],
    'vast fog over still water, no horizon, pale light, almost nothing happening',
    'tiny type, enormous empty space',
    'ambient, long evolving pads, no percussion, field recordings, glacial',
    ['ambient','drone','soundscape']),
  G('Drum & Bass','Electronic','bars',['#FF7A9C','#8FD9C9'],
    'underpass at speed, motion streaks, sodium light, hard shadows',
    'aggressive italic caps, high contrast',
    'liquid drum and bass, rolling breakbeat, deep reese bass, 174 bpm',
    ['dnb','jungle','breakbeat']),
  G('Techno','Electronic','grid',['#F2F5FC','#FF7A9C'],
    'industrial hall, strobe, steel and dust, monochrome with one red light',
    'stark monospace, white on black',
    'techno, relentless kick, metallic percussion, hypnotic loop, 132 bpm',
    ['techno','industrial','warehouse']),
  G('Trance','Electronic','orbit',['#7C6CFF','#8FD9C9'],
    'star field, aurora over ice, endless motion, cosmic scale',
    'wide light sans, violet gradient',
    'uplifting trance, supersaw lead, long build, euphoric breakdown, 138 bpm',
    ['trance','uplifting','edm']),
  G('Chillstep','Electronic','nebula',['#5AC8FA','#7C6CFF'],
    'bioluminescent ocean at night, slow drifting particles, deep blue',
    'soft glow sans, cyan on navy',
    'chillstep, halftime drums, warm sub, ethereal female vocal chops, 140 bpm',
    ['chillstep','melodic dubstep']),
  G('Phonk','Electronic','pulse',['#FF7A9C','#F2F5FC'],
    'night drive, tunnel lights, drifting car, high contrast grain',
    'distorted heavy caps, blown-out white',
    'phonk, cowbell melody, distorted 808, memphis vocal chops, 140 bpm',
    ['phonk','drift','memphis']),

  /* ── Band & acoustic ──────────────────────────────────── */
  G('Acoustic Singer-Songwriter','Acoustic','strings',['#FFC257','#8FD9C9'],
    'sunlit wooden room, dust in the light, one guitar on a chair, lived-in',
    'handwritten feel, warm cream',
    'acoustic singer-songwriter, fingerpicked steel string, close intimate vocal, room tone',
    ['acoustic','singer songwriter','folk']),
  G('Indie Rock','Rock','bars',['#FF7A9C','#FFC257'],
    'small venue, sweat and haze, hands in the air, blown highlights',
    'photocopied zine caps',
    'indie rock, jangly guitars, driving bass, live drums, anthemic chorus',
    ['indie rock','alternative']),
  G('Post-Rock','Rock','aurora',['#7C6CFF','#8FD9C9'],
    'abandoned coastline, huge grey sky, tiny figure, slow build to enormous',
    'small caps lost in space',
    'post-rock, tremolo guitars, long crescendo, no vocals, cathartic peak',
    ['post rock','instrumental','cinematic']),
  G('Blues','Rock','strings',['#FFC257','#FF7A9C'],
    'roadside bar, neon beer sign, cigarette haze, deep amber',
    'weathered slab serif',
    'slow blues, bent electric guitar, brushed drums, Hammond organ, gravel vocal',
    ['blues','slow blues','guitar']),
  G('Jazz','Acoustic','orbit',['#FFC257','#7C6CFF'],
    'basement club, upright bass, low warm light, smoke, close crop',
    'elegant serif, gold on charcoal',
    'jazz quartet, upright bass walking, brushed kit, muted trumpet, late night',
    ['jazz','quartet','late night']),
  G('Reggae','Acoustic','bars',['#8FD9C9','#FFC257'],
    'beach at golden hour, palm shadows, faded paint, easy pace',
    'rounded bold, green and gold',
    'roots reggae, offbeat skank, deep bass, organ bubble, relaxed groove',
    ['reggae','roots','dub']),
  G('Country / Americana','Acoustic','ridge',['#FFC257','#FF7A9C'],
    'open plains, pickup truck, big sky, dry grass, late afternoon',
    'western slab, dusty tan',
    'americana, acoustic guitar and pedal steel, brushed snare, storytelling vocal',
    ['country','americana','folk']),

  /* ── Cinematic & score ────────────────────────────────── */
  G('Epic Orchestral','Cinematic','nebula',['#FFC257','#FF7A9C'],
    'mountain range from above, storm light, vast scale, volumetric god rays',
    'towering caps, gold on black',
    'epic orchestral, full strings, taiko and brass, choir, enormous dynamics',
    ['epic','orchestral','trailer']),
  G('Piano Solo','Cinematic','strings',['#F2F5FC','#7C6CFF'],
    'single grand piano, empty hall, one shaft of light, monochrome',
    'thin elegant serif, white on grey',
    'solo piano, felt hammers, close mic, sustain pedal, sparse and emotional',
    ['piano','neoclassical','solo']),
  G('Neoclassical','Cinematic','aurora',['#8FD9C9','#F2F5FC'],
    'winter forest, frost, bare branches, pale grey-blue light, stillness',
    'refined light serif, frost blue',
    'neoclassical, string quartet with piano, minimal repeating motif, tape hiss',
    ['neoclassical','modern classical','strings']),
  G('Dark Cinematic','Cinematic','nebula',['#7C6CFF','#FF7A9C'],
    'rain-black city from above, single lit window, deep shadow, thriller mood',
    'tight condensed caps, blood red accent',
    'dark cinematic, low pulsing drone, distorted cello, tension percussion',
    ['dark','tension','thriller']),

  /* ── Pop & vocal ──────────────────────────────────────── */
  G('Dream Pop','Pop','aurora',['#FF7A9C','#8FD9C9'],
    'overexposed film, flowers close up, soft focus bloom, pastel haze',
    'soft rounded sans, blush pink',
    'dream pop, reverb-drenched guitars, breathy layered vocal, hazy and slow',
    ['dream pop','shoegaze','ethereal']),
  G('Electropop','Pop','pulse',['#FF7A9C','#5AC8FA'],
    'colour-gel studio, hard shadows, glossy surfaces, bright saturated blocks',
    'chunky geometric caps, hot pink',
    'electropop, punchy synth bass, bright plucks, catchy chorus, 118 bpm',
    ['electropop','synth pop','pop']),
  G('R&B / Soul','Pop','orbit',['#FFC257','#7C6CFF'],
    'velvet interior, warm practical lamps, shallow depth, honeyed light',
    'smooth italic, gold on plum',
    'neo soul, warm Rhodes, laid-back drums, rich vocal harmony, 90 bpm',
    ['rnb','soul','neo soul']),
  G('Afrobeats','Pop','bars',['#FFC257','#8FD9C9'],
    'bright market colour, movement, fabric patterns, midday sun',
    'bold rounded caps, tropical palette',
    'afrobeats, log drum, syncopated percussion, warm bass, sunny melody, 105 bpm',
    ['afrobeats','afropop','dance']),


  /* ── Anime-inflected ──────────────────────────────────── */
  G('Anime Opening','Anime','shonen',['#FF3B6B','#3BE0FF'],
    'cel-shaded animation style, dramatic low angle, wind-blown cloth, speed lines, cherry petals, high-contrast rim light',
    'heavy italic caps with a hard outline, red and cyan',
    'anime opening, driving rock band, urgent strings, soaring vocal, key change into the chorus, 165 bpm',
    ['anime','opening','jrock','amv']),
  G('Shonen Battle','Anime','shonen',['#FFC257','#FF3B6B'],
    'cel-shaded action still, dust and debris mid-air, clenched fist, impact lines radiating, orange dusk sky',
    'brush-stroke caps, gold on charcoal',
    'shonen battle theme, taiko and shakuhachi against distorted guitar, choir stabs, relentless build',
    ['anime','battle','epic','shonen']),
  G('Anime Lofi','Anime','nebula',['#8FD9C9','#FF7A9C'],
    'cel-shaded quiet moment, girl on a train at dusk, warm window light, rain streaks, muted pastel palette',
    'soft rounded lowercase, mint on plum',
    'anime lofi, mellow Rhodes, brushed drums, vinyl crackle, wistful melody, 78 bpm',
    ['anime','lofi','chill','study']),
  G('City Pop','Anime','grid',['#FF7A9C','#5AC8FA'],
    '1980s anime cel style, neon Tokyo street, wet asphalt reflections, convertible, purple and pink night',
    'retro chrome script, magenta glow',
    'city pop, slap bass, glassy electric piano, bright brass, 80s Japanese pop production, 112 bpm',
    ['citypop','80s','retro','japan']),


  /* ── Dark anime, without anyone's copyright ───────────────
     The look people mean when they say "Akatsuki" is a specific
     protected costume design — a black cloak with red clouds is
     Naruto's, not a genre. These describe the mood around it:
     rain-soaked stone, hooded silhouettes, storm light. All the
     atmosphere, none of the claim. */
  G('Dark Ninja','Anime','shonen',['#7C6CFF','#FF3B6B'],
    'cel-shaded night, rain-soaked stone village, hooded silhouette on a rooftop, lantern glow through downpour, deep indigo and blood red, no visible face',
    'sharp brush caps with a hard shadow, violet on near-black',
    'dark shonen theme, shakuhachi over distorted low strings, taiko heartbeat, brooding and patient, 92 bpm',
    ['anime','dark','ninja','amv']),
  G('Rain Village','Anime','ink',['#5AC8FA','#7C6CFF'],
    'cel-shaded perpetual rain, grey concrete towers, paper talismans blowing, standing water reflecting neon, desaturated blue melancholy',
    'thin condensed caps, rain-grey on slate',
    'melancholy anime score, solo piano under rain foley, muted strings, long silences, 70 bpm',
    ['anime','rain','melancholy','sad']),
  G('Sword Duel','Anime','shonen',['#FFC257','#F2F5FC'],
    'cel-shaded standoff at dawn, two silhouettes across a courtyard, cherry petals in a still frame, hard rim light, moment before movement',
    'vertical brush strokes, gold on ink',
    'duel theme, koto and shamisen against orchestral swell, silence then explosion, dramatic dynamics',
    ['anime','samurai','duel','epic']),
  G('Mecha','Anime','grid',['#5AC8FA','#FF3B6B'],
    'cel-shaded industrial hangar, vast machine silhouette, warning lights, steam venting, low angle, cold steel and hazard orange',
    'stencilled military caps, cyan on gunmetal',
    'mecha theme, industrial percussion, brass fanfare, synth arpeggio, mechanical and relentless, 140 bpm',
    ['anime','mecha','industrial','epic']),

  /* ── More ground to cover ─────────────────────────────── */
  G('Drill','Electronic','pulse',['#F2F5FC','#FF7A9C'],
    'night estate, sodium lamps, breath in cold air, high contrast monochrome with one colour accent',
    'heavy blackletter-ish caps, white on black',
    'drill, sliding 808s, sparse dark piano, skittering hats, menacing space, 142 bpm',
    ['drill','rap','dark','uk']),
  G('Garage / 2-Step','Electronic','bars',['#8FD9C9','#FF7A9C'],
    'late night bus window, city smearing past, rain on glass, warm interior against cold outside',
    'rounded caps, mint on plum',
    'uk garage, shuffled 2-step drums, warm sub bass, chopped vocal, 134 bpm',
    ['garage','2step','ukg','dance']),
  G('Bhangra Fusion','Indian','bars',['#FFC257','#8FD9C9'],
    'wedding at night, string lights over a courtyard, colour everywhere, motion blur of dancing',
    'fat rounded caps, marigold on green',
    'bhangra fusion, dhol against four-on-the-floor, tumbi hook, big vocal chorus, 128 bpm',
    ['bhangra','punjabi','dance','wedding']),
  G('Carnatic','Indian','orbit',['#FFC257','#FF7A9C'],
    'temple corridor at dawn, stone pillars in receding light, jasmine and brass, warm ochre',
    'ornate serif, saffron on charcoal',
    'Carnatic, violin and mridangam, intricate rhythmic cycles, devotional intensity',
    ['carnatic','classical','south indian']),
  G('Trap Soul','Pop','nebula',['#7C6CFF','#FF7A9C'],
    'car interior at night, city lights out of focus through the windscreen, purple and amber bokeh',
    'soft italic, lilac on charcoal',
    'trap soul, rolling hi-hats, warm sub, filtered vocal, spacious and slow, 72 bpm',
    ['trapsoul','rnb','night','chill']),
  G('Post-Punk','Rock','strings',['#F2F5FC','#FF3B6B'],
    'grainy monochrome, empty industrial street, long shadows, brutalist concrete, one red door',
    'stark uppercase sans, white on black',
    'post-punk, chorused bass leading, angular guitar, motorik drums, deadpan vocal, 148 bpm',
    ['postpunk','indie','goth','alternative']),
  G('Devotional Chant','Functional','aurora',['#FFC257','#8FD9C9'],
    'sunrise over still water, mist, a single lamp, nothing moving, deep calm',
    'wide-spaced light caps, gold on cream',
    'chant, layered voices in unison, drone underneath, no percussion, meditative repetition',
    ['chant','mantra','meditation','spiritual']),
  G('Kids &amp; Family','Functional','pulse',['#FFC257','#8FD9C9'],
    'bright flat illustration, friendly rounded shapes, primary colours, sunny and simple, nothing frightening',
    'chunky rounded caps, primary colours',
    'children\'s music, ukulele and glockenspiel, clapping, simple singable melody, cheerful, 110 bpm',
    ['kids','family','children','nursery']),

  /* ── Functional ───────────────────────────────────────── */
  G('Study / Focus','Functional','nebula',['#8FD9C9','#5AC8FA'],
    'quiet library, rain outside, single desk lamp, soft depth of field',
    'plain small sans, low contrast',
    'focus music, minimal repetition, no vocals, steady soft texture, unobtrusive',
    ['study','focus','concentration']),
  G('Sleep / Meditation','Functional','aurora',['#7C6CFF','#8FD9C9'],
    'night sky over still lake, almost no movement, deep indigo, nothing to look at',
    'barely-there thin type',
    'sleep music, very slow pads, sub-bass warmth, no percussion, 432 hz feel',
    ['sleep','meditation','relaxation']),
  G('Workout','Functional','pulse',['#FF7A9C','#FFC257'],
    'gym at dawn, chalk dust, hard directional light, sweat and steel',
    'heavy italic caps, high energy',
    'workout music, driving four-on-floor, aggressive synth bass, 128 bpm',
    ['workout','gym','motivation'])
];

export const FAMILIES = [...new Set(GENRES.map(g => g.family))];
export const findGenre = name => GENRES.find(g => g.name === name) || null;

/**
 * Genre sets the look, detected mood sets the motion.
 * A slow song tagged Techno should still move slowly.
 */
export function resolveTemplate(genre, mood){
  const g = typeof genre === 'string' ? findGenre(genre) : genre;
  if (!g) return null;
  const calm = mood && (mood.energy < 0.42 || mood.pace < 0.34);
  const wild = mood && mood.energy > 0.78 && mood.pace > 0.62;

  // swap only when the genre's default fights the audio badly
  const STILL = { bars:'strings', pulse:'aurora', grid:'nebula' };
  const BUSY  = { aurora:'pulse', strings:'bars', ridge:'bars' };
  let visual = g.visual;
  if (calm && STILL[visual]) visual = STILL[visual];
  else if (wild && BUSY[visual]) visual = BUSY[visual];

  return {
    genre: g.name, family: g.family, visual,
    palette: g.palette,
    scene: g.scene,
    thumb: g.thumb,
    suno: g.suno,
    tags: g.tags,
    adjusted: visual !== g.visual,
    why: visual !== g.visual
      ? `${g.name} usually renders as ${g.visual}, but this track is ${calm ? 'slower' : 'faster'} than the genre expects, so it switched to ${visual}.`
      : `${g.name} renders as ${visual}.`
  };
}
