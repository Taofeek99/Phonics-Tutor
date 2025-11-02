import React, { useEffect, useMemo, useRef, useState } from "react";

// Phonics Tutor - Interactive (single-file main component)
// NOTE: This is a runnable entry component. To keep the zip compact it uses built-in JS without external libs.

export default function PhonicsApp() {
  const units = useMemo(()=>[
    { id: "consonants", title: "Single consonant sounds", items: [{ grapheme: "m", example: "map" },{ grapheme: "p", example: "pen" },{ grapheme: "t", example: "top" },{ grapheme: "s", example: "sun" },{ grapheme: "n", example: "net" },{ grapheme: "k", example: "cat" },] },
    { id: "short-vowels", title: "Short vowels", items: [{ grapheme: "a", example: "apple" },{ grapheme: "e", example: "egg" },{ grapheme: "i", example: "igloo" },{ grapheme: "o", example: "octopus" },{ grapheme: "u", example: "umbrella" },] },
    { id: "digraphs", title: "Consonant digraphs", items: [{ grapheme: "sh", example: "ship" },{ grapheme: "ch", example: "chair" },{ grapheme: "th", example: "thumb" },{ grapheme: "ng", example: "ring" },] },
  ],[]);

  const [unitIndex,setUnitIndex] = useState(0);
  const unit = units[unitIndex];
  const [mode,setMode] = useState("learn"); // learn | quiz | record
  const [voiceRate,setVoiceRate] = useState(0.95);
  const [voicePitch,setVoicePitch] = useState(1);
  const [voice,setVoice] = useState(null);

  const [students,setStudents] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("pt_students")||"[]"); }catch{return [];} });
  const [currentStudentId,setCurrentStudentId] = useState(null);
  const [sessions,setSessions] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("pt_sessions")||"[]"); }catch{return [];} });

  const [quizItems,setQuizItems] = useState([]);
  const [quizIndex,setQuizIndex] = useState(0);
  const [score,setScore] = useState(0);
  const [showAnswer,setShowAnswer] = useState(false);

  // recording
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const [isRecording,setIsRecording] = useState(false);
  const [userAudioBuffer,setUserAudioBuffer] = useState(null);
  const [similarityScore,setSimilarityScore] = useState(null);
  const canvasRef = useRef(null);

  const audioAssets = useMemo(()=>({}),[]);

  useEffect(()=>{ function pick(){ const vs = window.speechSynthesis.getVoices()||[]; const found = vs.find(v=>/en-?/i.test(v.lang))||vs[0]||null; setVoice(found);} pick(); window.speechSynthesis.onvoiceschanged = pick; return ()=> window.speechSynthesis.onvoiceschanged=null; },[]);

  function speak(text){ if(!window.speechSynthesis) return; const u=new SpeechSynthesisUtterance(text); if(voice) u.voice=voice; u.rate=voiceRate; u.pitch=voicePitch; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }

  // Teacher functions
  function addStudent(name){ const id=`s_${Date.now()}`; const s={id,name,createdAt:new Date().toISOString()}; const next=[...students,s]; setStudents(next); localStorage.setItem('pt_students',JSON.stringify(next)); setCurrentStudentId(id); return id; }
  function removeStudent(id){ const next=students.filter(s=>s.id!==id); setStudents(next); localStorage.setItem('pt_students',JSON.stringify(next)); const ns=sessions.filter(sess=>sess.studentId!==id); setSessions(ns); localStorage.setItem('pt_sessions',JSON.stringify(ns)); if(currentStudentId===id) setCurrentStudentId(null); }
  function recordSession(result){ if(!currentStudentId) return; const sess={id:`sess_${Date.now()}`,studentId:currentStudentId,timestamp:new Date().toISOString(),result}; const next=[...sessions,sess]; setSessions(next); localStorage.setItem('pt_sessions',JSON.stringify(next)); }

  // Quiz
  function startQuiz(){ const pool = units.flatMap(u=>u.items).map(it=>({...it})); setQuizItems(shuffle(pool)); setQuizIndex(0); setScore(0); setShowAnswer(false); setMode('quiz'); }
  function handleQuizAnswer(choice){ const current=quizItems[quizIndex]; if(!current) return; const correct = choice.grapheme===current.grapheme; setShowAnswer(true); if(correct){ setScore(s=>s+1); speak('Correct!'); } else { speak(`Not quite. The correct sound is ${current.grapheme}, as in ${current.example}.`); } if(currentStudentId){ recordSession({type:'quiz', item:current, choice:choice.grapheme, correct}); } setTimeout(()=>{ setShowAnswer(false); if(quizIndex+1>=quizItems.length){ speak(`Quiz finished. Score ${score + (correct?1:0)} of ${quizItems.length}`); setMode('learn'); } else setQuizIndex(i=>i+1); },1000); }

  // Recording & compare (improved offline spectral MFCC-like features)
  async function startRecording(){
    if(isRecording) return stopRecording();
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      const src = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser(); analyser.fftSize=2048;
      analyserRef.current = analyser;
      src.connect(analyser);

      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e)=>chunks.push(e.data);
      recorder.onstop = async ()=>{
        const blob = new Blob(chunks,{type:'audio/webm'});
        const ab = await blob.arrayBuffer();
        const buf = await audioContextRef.current.decodeAudioData(ab.slice(0));
        setUserAudioBuffer(buf);
        stream.getTracks().forEach(t=>t.stop());
        mediaStreamRef.current=null;
        drawWaveform(buf);
        setIsRecording(false);
      };
      recorderRef.current = recorder; recorder.start();
      setIsRecording(true);
      visualizeAnalyser();
    }catch(err){ console.error(err); alert('Mic access required'); }
  }
  function stopRecording(){ if(recorderRef.current && recorderRef.current.state==='recording') recorderRef.current.stop(); if(mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t=>t.stop()); setIsRecording(false); }

  function visualizeAnalyser(){
    const canvas = canvasRef.current; if(!canvas) return; const ctx = canvas.getContext('2d'); const analyser = analyserRef.current; if(!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    function loop(){
      if(!analyserRef.current) return;
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.beginPath();
      const slice = canvas.width / data.length;
      for(let i=0;i<data.length;i++){
        const v=(data[i]-128)/128;
        const y = (v*canvas.height/2) + (canvas.height/2);
        if(i===0) ctx.moveTo(0,y); else ctx.lineTo(i*slice,y);
      }
      ctx.strokeStyle='#111'; ctx.lineWidth=1.5; ctx.stroke();
      if(isRecording) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function drawWaveform(audioBuffer){
    const canvas = canvasRef.current; if(!canvas || !audioBuffer) return; const ctx = canvas.getContext('2d');
    const raw = audioBuffer.getChannelData(0); const step = Math.ceil(raw.length / canvas.width);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.beginPath();
    for(let i=0;i<canvas.width;i++){
      const v = raw[i*step];
      const y = (1 - (v+1)/2) * canvas.height;
      if(i===0) ctx.moveTo(i,y); else ctx.lineTo(i,y);
    }
    ctx.strokeStyle='#0077cc'; ctx.lineWidth=1.2; ctx.stroke();
  }

  // Offline MFCC-like fingerprinting (short-window spectrogram -> log energies per mel band)
  function computeMFCCLike(audioBuffer){
    // Extract first channel, downsample to 16k if needed, then compute short-time energy in mel-like bands
    const sr = audioBuffer.sampleRate;
    const raw = audioBuffer.getChannelData(0);
    // take first 1.5s or full if shorter
    const N = Math.min(raw.length, Math.floor(sr * 1.5));
    const signal = raw.slice(0,N);
    // simple pre-emphasis
    const pre = new Float32Array(signal.length);
    const a = 0.97;
    pre[0] = signal[0];
    for(let i=1;i<signal.length;i++) pre[i] = signal[i] - a*signal[i-1];

    // frame size 25ms, hop 10ms
    const frameSize = Math.floor(0.025 * sr);
    const hop = Math.floor(0.01 * sr);
    const numFrames = Math.floor((pre.length - frameSize) / hop) + 1;
    const bands = 20; // mel-like
    const energies = new Array(bands).fill(0);

    // Generate triangular band boundaries on linear freq (approximation)
    const fmax = sr/2;
    for(let f=0; f<bands; f++){
      energies[f]=0;
    }
    // For each frame compute FFT magnitude (naive DFT for small frame)
    for(let i=0;i<numFrames;i++){
      const start = i*hop;
      const frame = pre.slice(start, start + frameSize);
      // apply Hamming window
      for(let n=0;n<frame.length;n++) frame[n] *= (0.54 - 0.46 * Math.cos(2*Math.PI*n/(frame.length-1)));
      // compute magnitude spectrum via FFT-like approach using real FFT (we'll compute bins linearly)
      const M = 256;
      const binMagnitudes = new Float32Array(M/2);
      for(let k=0;k<M/2;k++){
        let re=0, im=0;
        const omega = 2*Math.PI*k/M;
        // sample frame decorrelated to M bins
        const step = Math.max(1, Math.floor(frame.length / 64));
        for(let n=0;n<frame.length;n+=step){
          const val = frame[n];
          re += val * Math.cos(omega * n);
          im -= val * Math.sin(omega * n);
        }
        binMagnitudes[k] = Math.sqrt(re*re + im*im);
      }
      // map bins to mel-like bands (linear mapping here)
      const binsPerBand = Math.floor((M/2) / bands);
      for(let b=0;b<bands;b++){
        let sum=0;
        const startBin = b * binsPerBand;
        for(let kk=startBin; kk<startBin+binsPerBand && kk<binMagnitudes.length; kk++) sum += binMagnitudes[kk];
        energies[b] += sum;
      }
    }
    // average and log-compress
    const vec = energies.map(e=>Math.log10((e / Math.max(1,numFrames)) + 1e-6));
    // normalize to unit vector
    const max = Math.max(...vec.map(v=>Math.abs(v))) || 1;
    return vec.map(v=>v/max);
  }

  function compareBuffers(bufA, bufB){
    try{
      const a = computeMFCCLike(bufA);
      const b = computeMFCCLike(bufB);
      // cosine similarity
      let dot=0, na=0, nb=0;
      for(let i=0;i<a.length;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
      const sim = dot / (Math.sqrt(na)*Math.sqrt(nb) || 1);
      return sim;
    }catch(err){ console.error(err); return 0; }
  }

  async function compareWithReferenceURL(refUrl){
    try{
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const r = await fetch(refUrl);
      const ab = await r.arrayBuffer();
      const refBuf = await ctx.decodeAudioData(ab.slice(0));
      if(!userAudioBuffer){ alert('Please record learner first'); return; }
      const sim = compareBuffers(userAudioBuffer, refBuf);
      setSimilarityScore(Math.round(sim*100));
      if(currentStudentId) recordSession({type:'pronunciation', grapheme:getCurrentGrapheme(), similarity:Math.round(sim*100)});
      speak(`Similarity ${Math.round(sim*100)} percent`);
    }catch(err){ console.error(err); alert('Comparison failed'); }
  }

  function getCurrentGrapheme(){ if(mode==='quiz') return quizItems[quizIndex]?.grapheme; return unit.items[0]?.grapheme; }

  // utilities
  function shuffle(a){ const arr=[...a]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

  // render
  return (
    <div style={{padding:20}}>
      <header style={{display:'flex', alignItems:'center', gap:12}}>
        <h1>Phonics Tutor — Interactive (Offline scoring)</h1>
        <div style={{marginLeft:'auto'}}>
          <label>Rate</label>
          <input type="range" min="0.6" max="1.4" step="0.05" value={voiceRate} onChange={e=>setVoiceRate(Number(e.target.value))} />
          <label>Pitch</label>
          <input type="range" min="0.6" max="1.8" step="0.1" value={voicePitch} onChange={e=>setVoicePitch(Number(e.target.value))} />
        </div>
      </header>

      <main style={{display:'flex', gap:16, marginTop:16}}>
        <section style={{flex:2, background:'#fff', padding:12, borderRadius:10}}>
          <nav style={{display:'flex', gap:8, marginBottom:12}}>
            <button onClick={()=>setMode('learn')}>Learn</button>
            <button onClick={()=>startQuiz()}>Quiz</button>
            <button onClick={()=>setMode('record')}>Record & Compare</button>
          </nav>

          {mode==='learn' && (
            <div>
              <h2>{unit.title}</h2>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                {unit.items.map(it=>(
                  <div key={it.grapheme} style={{padding:8, background:'#f8fafc', borderRadius:8}}>
                    <div style={{fontSize:18,fontWeight:700}}>{it.grapheme}</div>
                    <div style={{opacity:0.8}}>Example: {it.example}</div>
                    <div style={{marginTop:8, display:'flex', gap:8}}>
                      <button onClick={()=>{ const url = null; if(url){ new Audio(url).play(); } else speak(`Sound ${it.grapheme}, as in ${it.example}. Repeat after me: ${it.example}.`); }}>Play</button>
                      <button onClick={()=>{ setMode('record'); }}>Practice</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode==='quiz' && (
            <div>
              <h2>Quiz</h2>
              <div>Score: {score}</div>
              {quizItems[quizIndex] ? (
                <div style={{padding:8, background:'#f8fafc', borderRadius:8}}>
                  <div>Which sound matches this word: <em>{quizItems[quizIndex].example}</em>?</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginTop:8}}>
                    {shuffle([quizItems[quizIndex], ...([].slice(0,3))]).map((c,i)=>(
                      <button key={i} onClick={()=>handleQuizAnswer(c)} style={{padding:8, borderRadius:6}}>{c.grapheme}</button>
                    ))}
                  </div>
                </div>
              ) : (<div>No quiz items</div>)}
            </div>
          )}

          {mode==='record' && (
            <div>
              <h2>Record & Compare</h2>
              <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12}}>
                <button onClick={()=> isRecording ? stopRecording() : startRecording()} style={{padding:8, borderRadius:6, background:isRecording?'#ef4444':'#10b981', color:'#fff'}}>{isRecording ? 'Stop' : 'Start Recording'}</button>
                <button onClick={()=>{ setUserAudioBuffer(null); setSimilarityScore(null); }}>Clear</button>
                <div style={{marginLeft:'auto'}}>Similarity: {similarityScore===null ? '—' : similarityScore + '%'}</div>
              </div>

              <canvas ref={canvasRef} width={800} height={120} style={{width:'100%', background:'#fff', borderRadius:6}} />

              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button onClick={async ()=>{ const g = getCurrentGrapheme(); alert('To compare with a reference audio file, add an asset and call compareWithReferenceURL with its URL.'); }}>Compare with asset</button>
                <button onClick={()=>{ if(userAudioBuffer) drawWaveform(userAudioBuffer); }}>Redraw</button>
              </div>
            </div>
          )}
        </section>

        <aside style={{flex:1, background:'#fff', padding:12, borderRadius:10}}>
          <h3>Teacher Dashboard</h3>
          <div style={{marginBottom:8}}>
            <input id="newStudent" placeholder="Learner name" style={{width:'100%', padding:8, borderRadius:6}} />
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <button onClick={()=>{ const el = document.getElementById('newStudent'); if(!el) return; const name = el.value.trim(); if(!name) return alert('Enter name'); addStudent(name); el.value=''; }}>Add learner</button>
              <button onClick={()=>{ // export CSV
                const rows=[['student','timestamp','result']];
                for(const s of sessions){ const name=(students.find(x=>x.id===s.studentId)||{}).name||'Unknown'; rows.push([name, s.timestamp, JSON.stringify(s.result)]); }
                const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\\n');
                const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='phonics_sessions.csv'; a.click(); URL.revokeObjectURL(url);
              }}>Export CSV</button>
            </div>
          </div>

          <div style={{marginBottom:8}}>
            <div style={{fontWeight:700}}>Learners</div>
            <div style={{maxHeight:200, overflow:'auto', marginTop:8}}>
              {students.map(s=>(
                <div key={s.id} style={{display:'flex', gap:8, alignItems:'center', padding:6, background: currentStudentId===s.id ? '#ecfdf5' : 'transparent', borderRadius:6}}>
                  <div style={{flex:1}}>{s.name}</div>
                  <button onClick={()=>setCurrentStudentId(s.id)}>Select</button>
                  <button onClick={()=>removeStudent(s.id)} style={{background:'#fee2e2'}}>Del</button>
                </div>
              ))}
              {students.length===0 && <div style={{opacity:0.6}}>No learners yet</div>}
            </div>
          </div>

          <div>
            <div style={{fontWeight:700}}>Recent sessions</div>
            <div style={{maxHeight:200, overflow:'auto', marginTop:8, fontSize:13}}>
              {sessions.slice().reverse().map(sess=>(
                <div key={sess.id} style={{padding:6,borderBottom:'1px solid #f1f5f9'}}>
                  {(students.find(x=>x.id===sess.studentId)||{}).name || 'Unknown'} — {sess.timestamp.split('T')[0]} — {sess.result && (sess.result.type || JSON.stringify(sess.result))}
                </div>
              ))}
              {sessions.length===0 && <div style={{opacity:0.6}}>No sessions yet</div>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
