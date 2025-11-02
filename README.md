Taobel Phonics Tutor v2 (offline, self-contained sounds)

Included:
- React + Vite project ready for Vercel
- 26 placeholder WAV sounds in public/sounds/*.wav (distinct beeps)
- App uses those sounds and attempts to use a male SpeechSynthesis voice as fallback
- Local learner login (name), progress tracked in localStorage, admin access (name 'admin')

Deploy:
1. npm install
2. npm run build
3. Deploy to Vercel or GitHub Pages

To replace placeholder beeps with real male voice recordings:
- Put your A.wav ... Z.wav in public/sounds/ with exact lowercase names: a.wav, b.wav, ... z.wav
- Rebuild and redeploy
