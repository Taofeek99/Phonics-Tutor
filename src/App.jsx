\
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function App(){
  const units = useMemo(()=>[
    { id:"consonants", title:"Consonants", items:[{grapheme:"m",example:"map"},{grapheme:"p",example:"pen"},{grapheme:"t",example:"top"},{grapheme:"s",example:"sun"},{grapheme:"n",example:"net"},{grapheme:"k",example:"cat"}]},
    { id:"short-vowels", title:"Short vowels", items:[{grapheme:"a",example:"apple"},{grapheme:"e",example:"egg"},{grapheme:"i",example:"igloo"},{grapheme:"o",example:"octopus"},{grapheme:"u",example:"umbrella"}]},
    { id:"digraphs", title:"Digraphs", items:[{grapheme:"sh",example:"ship"},{grapheme:"ch",example:"chair"},{grapheme:"th",example:"thumb"},{grapheme:"ng",example:"ring"}]}
  ],[]);

  const [unitIndex,setUnitIndex]=useState(0);
  const unit=units[unitIndex];
  const [mode,setMode]=useState('learn');
  const [selected, setSelected] = useState(null);

  const [quizItems,setQuizItems]=useState([]);
  const [quizIndex,setQuizIndex]=useState(0);
  const [score,setScore]=useState(0);

  const recorderRef = useRef(null);
  const mediaRef = useRef(null);
  const audioCtxRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRecording,setIsRecording]=useState(false);

  useEffect(()=>{ if(window.speechSynthesis) window.speechSynthesis.getVoices(); },[]);

  function speak(text){ if(!window.speechSynthesis) return; const u=new SpeechSynthesisUtterance(text); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }

  function playGrapheme(it){ setSelected(it.grapheme); speak(`${it.grapheme}. For example: ${it.example}. Repeat after me: ${it.example}`); }

  function startQuiz(){ const pool = units.flatMap(u=>u.items); setQuizItems(shuffle(pool)); setQuizIndex(0); setScore(0); setMode('quiz'); }
  function handleQuizAnswer(choice){ const cur = quizItems[quizIndex]; const correct = choice.grapheme === cur.grapheme; if(correct) { setScore(s=>s+1); speak('Correct!'); } else { speak(`Not quite. The correct answer is ${cur.grapheme}`); } setTimeout(()=>{ if(quizIndex+1 >= quizItems.length) { speak(`Quiz finished. Score ${score + (correct?1:0)} of ${quizItems.length}`); setMode('learn'); } else setQuizIndex(i=>i+1); },900); }

  async function startRecording(){ if(isRecording){ stopRecording(); return; } try{ const s = await navigator.mediaDevices.getUserMedia({audio:true}); mediaRef.current = s; const rec = new MediaRecorder(s); const chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.onstop = async ()=>{ const blob = new Blob(chunks,{type:'audio/webm'}); const ab = await blob.arrayBuffer(); const ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx; const buf = await ctx.decodeAudioData(ab); drawWaveform(buf); s.getTracks().forEach(t=>t.stop()); }; recorderRef.current = rec; rec.start(); setIsRecording(true); }catch(e){ alert('Microphone access required'); } }
  function stopRecording(){ if(recorderRef.current && recorderRef.current.state==='recording') recorderRef.current.stop(); if(mediaRef.current) mediaRef.current.getTracks().forEach(t=>t.stop()); setIsRecording(false); }

  function drawWaveform(audioBuffer){ const canvas = canvasRef.current; if(!canvas) return; const ctx = canvas.getContext('2d'); const raw = audioBuffer.getChannelData(0); const step = Math.ceil(raw.length / canvas.width); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.beginPath(); for(let i=0;i<canvas.width;i++){ const v = raw[i*step]; const y = (1 - (v+1)/2) * canvas.height; if(i===0) ctx.moveTo(i,y); else ctx.lineTo(i,y);} ctx.strokeStyle='#0ea5a4'; ctx.lineWidth=1.2; ctx.stroke(); }

  return (
    <div className="container">
      <div className="header">
        <h1>Phonics Tutor</h1>
        <div style={{marginLeft:'auto'}} className="small">Interactive phonics, quizzes & practice</div>
      </div>

      <div className="grid">
        <section className="card">
          <nav style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>setMode('learn') } className={mode==='learn'? 'active':''}>Learn</button>
            <button onClick={()=>startQuiz()} className={mode==='quiz'? 'active':''}>Quiz</button>
            <button onClick={()=>setMode('record')}>Practice</button>
            <select value={unitIndex} onChange={e=>setUnitIndex(Number(e.target.value))} style={{marginLeft:'auto'}}>
              {units.map((u,i)=>(<option key={u.id} value={i}>{u.title}</option>))}
            </select>
          </nav>

          {mode==='learn' && (
            <div style={{marginTop:12}}>
              <h3>{unit.title}</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {unit.items.map(it=>(
                  <div key={it.grapheme} style={{padding:8,background:'#f8fafc',borderRadius:8}}>
                    <div style={{fontSize:20,fontWeight:700}}>{it.grapheme}</div>
                    <div className="small">Example: {it.example}</div>
                    <div style={{marginTop:8}}>
                      <button onClick={()=>playGrapheme(it)}>Play</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode==='quiz' && (
            <div style={{marginTop:12}}>
              <h3>Quiz</h3>
              <div className="small">Score: {score}</div>
              <div style={{marginTop:8}}>
                {quizItems[quizIndex] && (
                  <div style={{padding:10,background:'#fff',borderRadius:8}}>
                    <div>Which letter matches this word: <em>{quizItems[quizIndex].example}</em>?</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginTop:8}}>
                      {shuffle([quizItems[quizIndex], ...getDistractors(units, quizItems[quizIndex])]).map((c,i)=>(
                        <button key={i} onClick={()=>handleQuizAnswer(c)} style={{padding:10,borderRadius:6}}>{c.grapheme}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode==='record' && (
            <div style={{marginTop:12}}>
              <h3>Practice</h3>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button onClick={startRecording} style={{background:isRecording?'#ef4444':'#10b981',color:'#fff',padding:8,borderRadius:6}}>{isRecording?'Stop':'Record'}</button>
                <button onClick={()=>{ const c=canvasRef.current; if(c){ c.getContext('2d').clearRect(0,0,c.width,c.height); }}}>Clear</button>
                <div style={{marginLeft:'auto'}} className="small">Visual feedback below</div>
              </div>
              <canvas ref={canvasRef} width={800} height={120} style={{width:'100%',marginTop:10,background:'#fff',borderRadius:6}} />
            </div>
          )}
        </section>

        <aside className="card">
          <h4>Teacher Dashboard</h4>
          <div className="small">Learner tracking & simple session notes are saved locally.</div>
        </aside>
      </div>
    </div>
  );
}

function shuffle(a){ const arr=[...a]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function getDistractors(units,current){ const pool = units.flatMap(u=>u.items).filter(it=>it.grapheme!==current.grapheme); return shuffle(pool).slice(0,3); }
