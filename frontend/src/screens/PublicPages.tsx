import { useState, type ReactNode } from 'react'
import type { NavFn } from '../types'
import { SITE } from '../site'
import { PublicPage } from '../components/public/PublicChrome'

type Props = { navigate: NavFn; signedIn?: boolean }

const chrome = ({ navigate, signedIn = false }: Props) => ({
  signedIn,
  onStart: () => navigate(signedIn ? 'director' : 'login'),
  onSignIn: () => navigate(signedIn ? 'director' : 'login'),
})

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-semibold mt-10 mb-3" style={{ color: '#f4f0ea' }}>{children}</h2>
)
const P = ({ children }: { children: ReactNode }) => <p className="mb-4">{children}</p>
const UL = ({ children }: { children: ReactNode }) => <ul className="list-disc pl-5 space-y-2 mb-4 marker:text-zinc-600">{children}</ul>
const Mail = () => <a href={`mailto:${SITE.email}`} className="underline underline-offset-2" style={{ color: '#d4a84b' }}>{SITE.email}</a>
const Updated = () => <p className="text-sm text-zinc-500 mb-8">Last updated: {SITE.legalUpdated}</p>

export function About(props: Props) {
  return (
    <PublicPage title={`About ${SITE.name}`} eyebrow="Company" testId="page-about" {...chrome(props)}>
      <P>
        {SITE.name} is an AI filmmaking studio. You describe an idea — in a sentence, in any of 10 Indian languages — and
        it writes the film with you: the story, the characters, the screenplay, the dialogue, the scenes and the storyboard.
      </P>
      <P>
        It is built for the way films are made in India. A film can run from a short teaser to a full two-hour feature,
        and different families in the same film can speak their own languages, with subtitles. You stay the director:
        every section can be changed by hand or by telling the AI what you want.
      </P>
      <H2>What you can do today</H2>
      <UL>
        <li>Plan a film from one idea: story, cast with portraits, screenplay, dialogue, scenes and storyboard.</li>
        <li>Grow it into a full-length film of 10 minutes to 2 hours, with every scene scripted.</li>
        <li>Write in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati or Punjabi.</li>
        <li>Download the complete screenplay as a PDF or a text file.</li>
      </UL>
      <H2>Coming soon</H2>
      <P>Cinematic teasers, voices, music and scene-by-scene video.</P>
      <H2>Get in touch</H2>
      <P>Questions, feedback or partnerships: <Mail />.</P>
    </PublicPage>
  )
}

export function Contact(props: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [opened, setOpened] = useState(false)
  const field = 'w-full mt-1.5 px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600'
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ''}`
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject || `Message from ${name || 'the website'}`)}&body=${encodeURIComponent(body)}`
    setOpened(true)
  }
  return (
    <PublicPage title="Contact us" eyebrow="Company" testId="page-contact" {...chrome(props)}>
      <P>Questions, feedback, a bug, or a partnership idea — we read every message. Write to <Mail /> or use the form below.</P>
      <form onSubmit={send} className="mt-8 space-y-4" data-testid="contact-form">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-xs text-zinc-400">Your name
            <input className={field} value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="block text-xs text-zinc-400">Your email
            <input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
        </div>
        <label className="block text-xs text-zinc-400">Subject
          <input className={field} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Feedback on the full-length film" />
        </label>
        <label className="block text-xs text-zinc-400">Message
          <textarea className={`${field} resize-y`} rows={6} value={message} onChange={e => setMessage(e.target.value)} required />
        </label>
        <button type="submit" className="px-6 py-3 rounded-lg text-sm font-semibold hover:opacity-90" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
          Send message
        </button>
        {opened && <p className="text-sm text-zinc-400" role="status" data-testid="contact-opened">Your email app should open with the message ready — press send there. If it didn’t, write to <Mail />.</p>}
      </form>
    </PublicPage>
  )
}

export function Privacy(props: Props) {
  return (
    <PublicPage title="Privacy Policy" eyebrow="Legal" testId="page-privacy" {...chrome(props)}>
      <Updated />
      <P>
        This policy explains what {SITE.name} (“we”, “us”) collects when you use the {SITE.name} website and studio, why,
        who processes it, and the choices you have. If anything is unclear, write to <Mail />.
      </P>

      <H2>1. What we collect</H2>
      <UL>
        <li><b>Account details</b> — when you sign in with Google, we receive your email address, name and profile picture from Google through our sign-in provider. We never see your Google password.</li>
        <li><b>Your films</b> — the ideas and prompts you type or speak, and everything the studio writes for them: stories, characters, screenplays, dialogue, scenes, storyboards, lyrics and full-length scripts, plus your edits and chat with the AI Director.</li>
        <li><b>Files you add</b> — documents you attach (for example a script) and any images, audio or video created for your films.</li>
        <li><b>Voice input</b> — if you use the microphone, the recording is sent for transcription to turn it into text.</li>
        <li><b>Settings</b> — your preferences, such as default language, voice and writing style.</li>
        <li><b>Usage records</b> — which AI services were used for your films and their cost, so we can show estimates and enforce budget limits; and basic technical logs (such as errors) needed to keep the service running.</li>
      </UL>

      <H2>2. How we use it</H2>
      <UL>
        <li>To sign you in and keep your films private to your account.</li>
        <li>To create, store and show your films, and to let you edit, download and delete them.</li>
        <li>To run, secure, fix and improve the service.</li>
        <li>To reply when you contact us.</li>
      </UL>
      <P>We do not sell your personal data, and we do not use your films for advertising.</P>

      <H2>3. AI services that process your content</H2>
      <P>To write and create your films, the text and files needed for each step are sent to these providers, which process them on our behalf:</P>
      <UL>
        <li><b>Sarvam AI</b> — writing the story, screenplay and dialogue, translation, voices and speech-to-text.</li>
        <li><b>OpenAI</b> — images such as character portraits and storyboard frames (only when image generation is switched on).</li>
        <li><b>Atlas Cloud (Seedance)</b> — video clips (only when video generation is switched on).</li>
      </UL>
      <P>Each provider handles data under its own terms and privacy policy. We send only what each step needs.</P>

      <H2>4. Where it’s stored</H2>
      <P>
        Your account and films are stored with our database and file-storage provider (Supabase). Your sign-in session is kept
        in your browser’s local storage so you stay signed in; we do not use advertising or tracking cookies.
      </P>

      <H2>5. How long we keep it</H2>
      <P>We keep your films and account until you delete them. Deleted projects and accounts are removed from our systems; copies in routine backups expire on their normal schedule.</P>

      <H2>6. Your choices and rights</H2>
      <UL>
        <li><b>Download your data</b> — Settings → Export gives you a copy of your account data and films.</li>
        <li><b>Delete</b> — delete any project from Projects, or your whole account from Settings → Delete account.</li>
        <li><b>Correct or ask</b> — edit your films at any time, or write to <Mail /> to ask what we hold, to correct it, or to raise a concern.</li>
      </UL>

      <H2>7. Security</H2>
      <P>Data is sent over encrypted connections, each account can see only its own films, and AI provider keys stay on our servers — never in your browser. No system is perfectly secure, so please keep your Google account protected.</P>

      <H2>8. Children</H2>
      <P>{SITE.name} is not meant for children under 13, and we do not knowingly collect their data. If you believe a child has signed up, contact us and we will delete the account.</P>

      <H2>9. Changes to this policy</H2>
      <P>If we change this policy, we will update the date at the top, and tell you in the app for important changes.</P>

      <H2>10. Contact</H2>
      <P>For privacy questions or requests: <Mail />.</P>
    </PublicPage>
  )
}

export function Terms(props: Props) {
  return (
    <PublicPage title="Terms of Service" eyebrow="Legal" testId="page-terms" {...chrome(props)}>
      <Updated />
      <P>These terms are an agreement between you and {SITE.name} for using the {SITE.name} website and studio (the “service”). By using the service you accept them.</P>

      <H2>1. Your account</H2>
      <P>You sign in with your own Google account and are responsible for what happens under it. You must be at least 13 years old, and old enough to accept these terms where you live.</P>

      <H2>2. Your content</H2>
      <UL>
        <li>You own the ideas, prompts and files you put into the service, and — as far as the law allows — the stories, scripts and other material the service creates for you.</li>
        <li>You give us permission to store and process your content only as needed to run the service for you, including sending it to the AI providers listed in our <a href="/privacy" className="underline underline-offset-2" style={{ color: '#d4a84b' }}>Privacy Policy</a>.</li>
        <li>AI can produce material that is similar to other people’s work or to what others receive. Check what you use, especially before publishing or selling it.</li>
      </UL>

      <H2>3. Acceptable use</H2>
      <P>Don’t use the service to:</P>
      <UL>
        <li>break the law, or infringe anyone’s copyright, trademark, privacy or other rights;</li>
        <li>create content that sexualises minors, harasses or threatens people, or promotes violence or hatred;</li>
        <li>impersonate real people in a misleading way, or create deceptive material meant to be taken as real;</li>
        <li>attack, overload, reverse-engineer or get around the limits of the service.</li>
      </UL>
      <P>We may remove content or suspend accounts that break these rules.</P>

      <H2>4. AI output</H2>
      <P>AI-generated content can contain mistakes, inaccuracies or unexpected results. It is provided for creative use; review it before relying on it.</P>

      <H2>5. Paid features</H2>
      <P>Some features (such as video and voices) may cost money when they launch. We will show the cost and ask before charging, and any paid plans will come with their own terms.</P>

      <H2>6. Changes and availability</H2>
      <P>We are improving the service all the time, so features may change, be added or be removed. We aim to keep it running but can’t promise it will always be available or error-free.</P>

      <H2>7. Ending</H2>
      <P>You can stop using the service and delete your account at any time from Settings. We may suspend or end access if these terms are broken.</P>

      <H2>8. Liability</H2>
      <P>The service is provided “as is”. To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of content — keep your own copies of anything important (you can download your scripts as PDF or TXT).</P>

      <H2>9. Changes to these terms</H2>
      <P>If we change these terms we will update the date at the top. Continuing to use the service after a change means you accept the new terms.</P>

      <H2>10. Contact</H2>
      <P>Questions about these terms: <Mail />.</P>
    </PublicPage>
  )
}
