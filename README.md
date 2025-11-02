Phonics Tutor - Interactive (offline scoring)
=============================================

This is a minimal React + Vite project scaffold for the Phonics Tutor interactive app.
It includes:
- Teacher dashboard (localStorage)
- Record & Compare (offline MFCC-like scoring)
- Simple UI without Tailwind (inline styles)

To run:
1. npm install
2. npm run dev

Notes:
- Add pre-recorded audio files in public/assets/audio and map them in the component if you want exact reference clips.
- The offline scoring is a lightweight MFCC-like approach implemented in JS for browser-only use.
