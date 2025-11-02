\
import React, { useEffect, useMemo, useRef, useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const USERS_KEY = "taobel_users_v2";
const CURR_KEY = "taobel_current_user_v2";

function loadUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }catch{ return []; } }
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function generateId(){ return 'u_'+Date.now().toString(36); }

export default function App(){
  const [users, setUsers] = useState(() => loadUsers());
  const [currentUser, setCurrentUser] = useState(() => { try{ return JSON.parse(localStorage.getItem(CURR_KEY)); }catch{return null} });
  const [view, setView] = useState(currentUser ? 'app' : 'auth');
  const [nameInput, setNameInput] = useState('');
  const [gPlaying, setGPlaying] = useState(null);
  const audioRefs = useRef({});
  const [voice, setVoice] = useState(null);

  useEffect(()=>{
    LETTERS.forEach(l=>{ audioRefs.current[l] = new Audio('/public/sounds/' + l.toLowerCase() + '.wav'); });
    // pick a male voice if available
    const pickMale = (vs)=>{ if(!vs) return null; return vs.find(v=>/male|man|Daniel|Alex|Geraint|Thomas|en-GB/i.test(v.name || v.lang)) || vs.find(v=>/en-?/i.test(v.lang)); };
    const vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    const m = pickMale(vs); if(m) setVoice(m);
    if(window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { const vs2 = window.speechSynthesis.getVoices(); const m2 = pickMale(vs2); if(m2) setVoice(m2); };
  },[]);

  function signup(name){
    if(!name) return alert('Enter learner name');
    const u = { id: generateId(), name: name.trim(), progress: {}, createdAt: new Date().toISOString() };
    const next = [...users, u]; saveUsers(next); setUsers(next);
    localStorage.setItem(CURR_KEY, JSON.stringify(u)); setCurrentUser(u); setView('app');
  }

  function logout(){ localStorage.removeItem(CURR_KEY); setCurrentUser(null); setView('auth'); setNameInput(''); }

  function playLetter(L){
    setGPlaying(L);
    const a = audioRefs.current[L];
    if(a){ a.currentTime = 0; a.play().catch(()=>{}); }
    if(window.speechSynthesis && voice){ const u = new SpeechSynthesisUtterance(L + ' says ' + L); u.voice = voice; u.rate = 0.95; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }
    if(currentUser){ const nextUsers = users.map(u=>{ if(u.id !== currentUser.id) return u; const p = Object.assign({}, u.progress || {}); p[L] = (p[L] || 0) + 1; return {...u, progress: p}; }); setUsers(nextUsers); saveUsers(nextUsers); const updated = nextUsers.find(x=>x.id===currentUser.id); localStorage.setItem(CURR_KEY, JSON.stringify(updated)); setCurrentUser(updated); }
    setTimeout(()=> setGPlaying(null), 700);
  }

  if(view === 'auth') return (
    <div className="login-card card">
      <h2 className="brand">Taobel Phonics Tutor</h2>
      <div className="small">Enter learner name to start (type <strong>admin</strong> for admin access)</div>
      <div style={{marginTop:12}}>
        <input className="input" placeholder="Learner name" value={nameInput} onChange={e=>setNameInput(e.target.value)} />
        <div style={{marginTop:8, display:'flex', gap:8}}>
          <button className="button" onClick={()=> signup(nameInput)}>Start</button>
          <button className="button" onClick={()=>{ setNameInput(''); }}>Clear</button>
        </div>
      </div>
    </div>
  );

  if(currentUser && currentUser.name && currentUser.name.toLowerCase() === 'admin'){ return <AdminPanel users={users} setUsers={(u)=>{ setUsers(u); saveUsers(u); }} logout={logout} />; }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">Taobel Phonics Tutor</div>
        <div style={{marginLeft:'auto'}} className="small">Welcome {currentUser ? currentUser.name : ''} <button className="button" style={{marginLeft:8}} onClick={logout}>Logout</button></div>
      </div>

      <div className="grid">
        <section className="card">
          <h3>Tap each letter to hear its sound</h3>
          <div className="grid-letters" style={{marginTop:12}}>
            {LETTERS.map(L => (
              <div key={L} className={`letter ${gPlaying===L ? 'playing' : ''}`} onClick={()=>playLetter(L)}>
                <div style={{fontSize:28,fontWeight:800}}>{L}</div>
                <div className="small">Tap to play</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card">
          <h4>Progress</h4>
          {currentUser ? (
            <div>
              <div className="small">Learner: <strong>{currentUser.name}</strong></div>
              <div style={{marginTop:8}}>
                {Object.keys(currentUser.progress || {}).length===0 && <div className="small">No practice yet</div>}
                {LETTERS.map(L => (
                  <div key={L} style={{display:'flex',justifyContent:'space-between',alignItems:'center', marginTop:8}}>
                    <div>{L}</div>
                    <div style={{width:'60%'}}>
                      <div className="progress-bar"><div className="progress-fill" style={{width: Math.min(100, (currentUser.progress?.[L]||0)*10) + '%'}}></div></div>
                    </div>
                    <div className="small" style={{marginLeft:8}}>{currentUser.progress?.[L] || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="small">No user</div>}
        </aside>
      </div>
    </div>
  );
}

function AdminPanel({users,setUsers,logout}){
  return (
    <div className="container">
      <div style={{display:'flex',alignItems:'center'}}>
        <h2>Admin — Learners</h2>
        <div style={{marginLeft:'auto'}}><button className="button" onClick={logout}>Logout</button></div>
      </div>
      <div className="card" style={{marginTop:12}}>
        <h3>All Learners</h3>
        <div style={{maxHeight:400,overflow:'auto'}}>
          {users.map(u => (
            <div key={u.id} style={{padding:8,borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}>
              <div><strong>{u.name}</strong> <div className="small">({u.id})</div></div>
              <div className="small">Progress items: {Object.keys(u.progress||{}).length}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:12}}><button className="button" onClick={()=>{ if(confirm('Reset all progress?')){ const cleared = users.map(u=>({...u,progress:{}})); setUsers(cleared); localStorage.setItem(USERS_KEY, JSON.stringify(cleared)); alert('Progress cleared'); }}}>Reset all progress</button></div>
      </div>
    </div>
  );
}

function shuffle(a){ const arr=[...a]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
