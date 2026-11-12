import starts from './demo.chapters.json'

/**
 * The "Watch Demo" video (a screen recording of the app) and its chapters.
 * Re-record with `npm run demo:record`; it writes the chapter start times to demo.chapters.json.
 */
export const DEMO = {
  src: '/demo/cinema-ai-demo.mp4',
  poster: '/demo/cinema-ai-demo.jpg',
  duration: starts.duration,
  chapters: [
    { label: 'Idea', start: starts.idea, caption: 'Describe your idea — in any language' },
    { label: 'Story & cast', start: starts.story, caption: 'AI writes the story and the cast, each with a portrait' },
    { label: 'Full film', start: starts.full, caption: 'Grow it into a full-length film — every scene scripted' },
    { label: 'Languages', start: starts.languages, caption: 'Two families, two languages — with subtitles' },
    { label: 'Script', start: starts.script, caption: 'Read the whole screenplay and download it as PDF or TXT' },
  ],
}
