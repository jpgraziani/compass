import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Constants ────────────────────────────────────────────────────────────────
const WORKSPACE_ID = 'compass-shared-v1'

const PRIORITY_CONFIG = {
  high:   { label: 'Urgent', color: '#D95F3B' },
  medium: { label: 'Normal', color: '#E8A838' },
  low:    { label: 'Chill',  color: '#3BA89A' },
}
const LIST_COLORS  = ['#3BA89A','#5B8DD9','#E8A838','#D95F3B','#7B6ED6','#D9607B']
const LIST_ICONS   = ['◈','◆','◉','▣','◍','◐']
const TRIP_EMOJIS  = ['🌴','🏔️','🏙️','🏖️','🗺️','🏕️','🌊','🏛️','🎭','🌸','🎿','🍜']
const TRIP_COLORS  = ['#D95F3B','#5B8DD9','#E8A838','#3BA89A','#7B6ED6','#D9607B','#5BB8A8','#C97A3A']

function genId() { return Math.random().toString(36).slice(2, 10) }

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return ''
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}
function tripDuration(s, e) {
  if (!s || !e) return ''
  const days = Math.round((new Date(e+'T00:00:00') - new Date(s+'T00:00:00')) / 86400000)
  return `${days} day${days!==1?'s':''}`
}
function daysUntil(start) {
  if (!start) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((new Date(start+'T00:00:00') - today) / 86400000)
}
function getDaysInRange(start, end) {
  if (!start || !end) return []
  const days = [], s = new Date(start+'T00:00:00'), e = new Date(end+'T00:00:00')
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1))
    days.push(d.toISOString().slice(0,10))
  return days
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#FDFAF6',      // warm white
  bgAlt:    '#F5F0E8',      // sandy cream
  bgCard:   '#FFFFFF',
  border:   '#E8E0D0',
  borderMd: '#D4C9B5',
  text:     '#2C2416',      // warm near-black
  textMd:   '#6B5D4A',      // warm brown-grey
  textLt:   '#A8997E',      // light warm grey
  accent:   '#D95F3B',      // terracotta coral
  accentB:  '#5B8DD9',      // ocean blue
  accentG:  '#3BA89A',      // sea green
  sun:      '#E8A838',      // golden
  shadow:   'rgba(44,36,22,0.08)',
  shadowMd: 'rgba(44,36,22,0.14)',
}

// ─── Global styles ────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body, #root { background:${C.bg}; min-height:100vh; font-family:'Inter',sans-serif; color:${C.text}; }
  ::-webkit-scrollbar { display:none; }
  input,textarea,select { font-family:'Inter',sans-serif; color:${C.text}; }
  button { font-family:'Inter',sans-serif; }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes shimmer  { 0%{opacity:0.6} 50%{opacity:1} 100%{opacity:0.6} }
  input[type="date"]::-webkit-calendar-picker-indicator { opacity:0.4; }
  input[type="time"]::-webkit-calendar-picker-indicator { opacity:0.4; }
`

// shared input style
const fi = {
  width:'100%', background:C.bgCard, border:`1.5px solid ${C.border}`,
  borderRadius:12, padding:'12px 14px', color:C.text, fontSize:14,
  outline:'none', display:'block', transition:'border-color 0.15s',
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode]   = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [name, setName]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!email || !pass) return
    setLoading(true); setErr('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: name } } })
        if (error) throw error
        setErr('Check your email to confirm your account!')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) throw error
        onAuth(data.user)
      }
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(160deg, #FDF6EC 0%, #F0EAD8 50%, #E8DECA 100%)`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <style>{G}</style>
      {/* decorative blobs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-15%', right:'-15%', width:'55vw', height:'55vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(217,95,59,0.12) 0%, transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:'-10%', left:'-10%', width:'45vw', height:'45vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(91,141,217,0.1) 0%, transparent 70%)' }}/>
        <div style={{ position:'absolute', top:'40%', left:'5%', width:'30vw', height:'30vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(59,168,154,0.08) 0%, transparent 70%)' }}/>
      </div>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:380, animation:'fadeUp 0.5s ease' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🧭</div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:36, fontWeight:700, color:C.text, letterSpacing:-0.5 }}>Compass</div>
          <div style={{ fontSize:13, color:C.textLt, marginTop:6, fontStyle:'italic', fontFamily:"'Lora',serif" }}>Your shared life organizer</div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.85)', backdropFilter:'blur(12px)', border:`1px solid ${C.border}`, borderRadius:24, padding:'28px 24px', boxShadow:`0 8px 32px ${C.shadow}` }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.5, color:C.textLt, marginBottom:18, textTransform:'uppercase' }}>
            {mode==='login' ? 'Welcome back' : 'Create your account'}
          </div>

          {mode==='signup' && (
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{...fi, marginBottom:10}} />
          )}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={{...fi, marginBottom:10}} />
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&submit()} style={{...fi, marginBottom:18}} />

          {err && (
            <div style={{ fontSize:13, color: err.includes('Check') ? C.accentG : C.accent, marginBottom:16, padding:'10px 14px', background: err.includes('Check') ? 'rgba(59,168,154,0.08)' : 'rgba(217,95,59,0.08)', borderRadius:10, border:`1px solid ${err.includes('Check') ? 'rgba(59,168,154,0.25)' : 'rgba(217,95,59,0.25)'}` }}>
              {err}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{ width:'100%', padding:'14px 0', background:`linear-gradient(135deg, ${C.accent}, #C84E2A)`, border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:`0 4px 14px rgba(217,95,59,0.3)` }}>
            {loading ? '...' : mode==='login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:C.textMd }}>
            {mode==='login' ? "New here? " : "Already have an account? "}
            <span onClick={()=>{setMode(m=>m==='login'?'signup':'login');setErr('')}} style={{ color:C.accent, cursor:'pointer', fontWeight:500, textDecoration:'underline', textUnderlineOffset:2 }}>
              {mode==='login' ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bottom Sheet Modal ───────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(44,36,22,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:C.bg, borderTop:`1px solid ${C.border}`, borderRadius:'22px 22px 0 0', padding:'20px 20px 48px', animation:'slideUp 0.25s cubic-bezier(0.34,1.1,0.64,1)', maxHeight:'90vh', overflowY:'auto', boxShadow:`0 -8px 40px ${C.shadowMd}` }}>
        <div style={{ width:36, height:4, borderRadius:2, background:C.borderMd, margin:'0 auto 18px' }}/>
        {title && <div style={{ fontFamily:"'Lora',serif", fontSize:21, fontWeight:600, color:C.text, marginBottom:18 }}>{title}</div>}
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:6, textTransform:'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function Btn({ children, onClick, color, variant='solid', small, disabled, full }) {
  const bg = color || C.accent
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '8px 16px' : '13px 22px',
      width: full ? '100%' : 'auto',
      background: variant==='solid' ? `linear-gradient(135deg, ${bg}, ${bg}dd)` : 'transparent',
      border: variant==='outline' ? `1.5px solid ${bg}55` : 'none',
      borderRadius: 12,
      color: variant==='solid' ? '#fff' : bg,
      fontSize: small ? 12 : 13,
      fontWeight: 600,
      cursor: 'pointer',
      opacity: disabled ? 0.5 : 1,
      boxShadow: variant==='solid' ? `0 3px 12px ${bg}33` : 'none',
      letterSpacing: 0.2,
    }}>{children}</button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BOARD TAB ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function CardForm({ initial, listColor, submitLabel, onSubmit, onDelete }) {
  const [text, setText]    = useState(initial?.text||'')
  const [priority, setPri] = useState(initial?.priority||'medium')
  return (
    <>
      <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="What needs to be done..." style={{...fi, resize:'none', marginBottom:14, lineHeight:1.6}}/>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:8, textTransform:'uppercase' }}>Priority</div>
        <div style={{ display:'flex', gap:8 }}>
          {Object.entries(PRIORITY_CONFIG).map(([k,cfg])=>(
            <button key={k} onClick={()=>setPri(k)} style={{ flex:1, padding:'9px 0', background:priority===k?`${cfg.color}15`:C.bgAlt, border:`1.5px solid ${priority===k?cfg.color:C.border}`, borderRadius:10, color:priority===k?cfg.color:C.textMd, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s' }}>{cfg.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={()=>text.trim()&&onSubmit({text:text.trim(),priority})} style={{ flex:1, padding:'13px 0', background:`linear-gradient(135deg,${listColor},${listColor}dd)`, border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:`0 3px 12px ${listColor}33` }}>{submitLabel}</button>
        {onDelete&&<button onClick={onDelete} style={{ padding:'13px 18px', background:'rgba(217,95,59,0.08)', border:'1px solid rgba(217,95,59,0.2)', borderRadius:12, color:C.accent, fontSize:13, cursor:'pointer' }}>Delete</button>}
      </div>
    </>
  )
}

function ListForm({ initial, submitLabel, onSubmit, onDelete, onClearAll }) {
  const [title, setTitle] = useState(initial?.title||'')
  const [color, setColor] = useState(initial?.color||LIST_COLORS[0])
  const [icon, setIcon]   = useState(initial?.icon||LIST_ICONS[0])
  return (
    <>
      <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="List name..." style={{...fi, marginBottom:14}}/>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:8, textTransform:'uppercase' }}>Color</div>
        <div style={{ display:'flex', gap:10 }}>
          {LIST_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:color===c?`3px solid ${C.text}`:'3px solid transparent', boxShadow:color===c?`0 0 0 2px ${c}44`:'none', transition:'all 0.15s' }}/>)}
        </div>
      </div>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:8, textTransform:'uppercase' }}>Icon</div>
        <div style={{ display:'flex', gap:8 }}>
          {LIST_ICONS.map(i=><div key={i} onClick={()=>setIcon(i)} style={{ width:38, height:38, borderRadius:10, cursor:'pointer', background:icon===i?`${color}18`:C.bgAlt, border:`1.5px solid ${icon===i?color:C.border}`, color:icon===i?color:C.textMd, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, transition:'all 0.15s' }}>{i}</div>)}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:onClearAll?10:0 }}>
        <button onClick={()=>title.trim()&&onSubmit({title:title.trim(),color,icon})} style={{ flex:1, padding:'13px 0', background:`linear-gradient(135deg,${color},${color}dd)`, border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>{submitLabel}</button>
        {onDelete&&<button onClick={onDelete} style={{ padding:'13px 18px', background:'rgba(217,95,59,0.08)', border:'1px solid rgba(217,95,59,0.2)', borderRadius:12, color:C.accent, fontSize:13, cursor:'pointer' }}>Delete</button>}
      </div>
      {onClearAll&&<button onClick={onClearAll} style={{ width:'100%', padding:'11px 0', background:'transparent', border:`1.5px solid rgba(217,95,59,0.25)`, borderRadius:12, color:C.accent, fontSize:12, fontWeight:500, cursor:'pointer', letterSpacing:0.3 }}>Clear all items</button>}
    </>
  )
}

function SwipeCard({ card, listColor, pri, onToggle, onEdit, onDelete, dragHandleProps, isDragging }) {
  const [swipeX, setSwipeX]   = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0), startY = useRef(0), isScrolling = useRef(null)
  const T = 80

  function onTS(e) { startX.current=e.touches[0].clientX; startY.current=e.touches[0].clientY; isScrolling.current=null; setSwiping(true) }
  function onTM(e) {
    const dx=e.touches[0].clientX-startX.current, dy=e.touches[0].clientY-startY.current
    if (isScrolling.current===null) isScrolling.current=Math.abs(dy)>Math.abs(dx)
    if (isScrolling.current) { setSwiping(false); setSwipeX(0); return }
    setSwipeX(Math.max(-T, Math.min(T,dx)))
  }
  function onTE() { setSwiping(false); if (Math.abs(swipeX)>T*0.7) onDelete(); else setSwipeX(0) }

  const abs=Math.abs(swipeX), prog=abs/T, show=abs>15, isL=swipeX<0

  return (
    <div style={{ position:'relative', overflow:'hidden', borderRadius:12, opacity:isDragging?0.4:1 }}>
      <div style={{ position:'absolute', inset:0, background:`rgba(217,95,59,${show&&!isL?prog*0.15:0})`, display:'flex', alignItems:'center', paddingLeft:16, borderRadius:12 }}>
        <span style={{ fontSize:12, color:C.accent, fontWeight:600, opacity:show&&!isL?prog:0 }}>← Delete</span>
      </div>
      <div style={{ position:'absolute', inset:0, background:`rgba(217,95,59,${show&&isL?prog*0.15:0})`, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:16, borderRadius:12 }}>
        <span style={{ fontSize:12, color:C.accent, fontWeight:600, opacity:show&&isL?prog:0 }}>Delete →</span>
      </div>
      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 12px', background:card.done?C.bgAlt:C.bgCard, border:`1.5px solid ${card.done?C.border:C.border}`, borderLeft:`3px solid ${card.done?C.borderMd:pri.color}`, borderRadius:12, transition:swiping?'none':'transform 0.25s cubic-bezier(0.25,1,0.5,1)', transform:`translateX(${swipeX}px)`, position:'relative', zIndex:1, userSelect:'none', boxShadow:`0 2px 8px ${C.shadow}` }}>
        <div {...dragHandleProps} style={{ display:'flex', flexDirection:'column', gap:3, padding:'0 4px', cursor:'grab', flexShrink:0, touchAction:'none' }}>
          {[0,1,2].map(i=><div key={i} style={{ width:13, height:1.5, borderRadius:1, background:C.borderMd }}/>)}
        </div>
        <div onClick={onToggle} style={{ width:20, height:20, borderRadius:6, flexShrink:0, cursor:'pointer', background:card.done?`${listColor}20`:'transparent', border:`1.5px solid ${card.done?listColor:C.borderMd}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
          {card.done&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke={listColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span style={{ flex:1, fontSize:13, lineHeight:1.5, color:card.done?C.textLt:C.text, textDecoration:card.done?'line-through':'none' }}>{card.text}</span>
        {!card.done&&<span style={{ fontSize:10, fontWeight:500, color:pri.color, background:`${pri.color}12`, padding:'3px 8px', borderRadius:6, border:`1px solid ${pri.color}25`, flexShrink:0 }}>{pri.label}</span>}
        <button onClick={onEdit} style={{ background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:7, width:28, height:28, color:C.textMd, fontSize:13, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✎</button>
      </div>
    </div>
  )
}

function SortableCard({ card, listColor, pri, onToggle, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id:card.id })
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition }}>
      <SwipeCard card={card} listColor={listColor} pri={pri} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} dragHandleProps={{...attributes,...listeners}} isDragging={isDragging}/>
    </div>
  )
}

function SortableList({ list, children, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id:list.id })
  return <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition, opacity:isDragging?0.5:1 }}>{children({dragHandleProps:{...attributes,...listeners}})}</div>
}

function ChartsView({ lists }) {
  const donut = lists.map(l=>({ name:l.title, value:l.cards.filter(c=>!c.done).length, color:l.color, icon:l.icon, total:l.cards.length })).filter(d=>d.total>0)
  const priData = [
    { label:'Urgent', color:C.accent, count:lists.reduce((a,l)=>a+l.cards.filter(c=>!c.done&&c.priority==='high').length,0) },
    { label:'Normal', color:C.sun,    count:lists.reduce((a,l)=>a+l.cards.filter(c=>!c.done&&c.priority==='medium').length,0) },
    { label:'Chill',  color:C.accentG,count:lists.reduce((a,l)=>a+l.cards.filter(c=>!c.done&&c.priority==='low').length,0) },
  ]
  const comp = lists.map(l=>({ name:l.title, color:l.color, done:l.cards.filter(c=>c.done).length, pending:l.cards.filter(c=>!c.done).length, pct:l.cards.length>0?Math.round(l.cards.filter(c=>c.done).length/l.cards.length*100):0 }))
  const tot=lists.reduce((a,l)=>a+l.cards.length,0), done=lists.reduce((a,l)=>a+l.cards.filter(c=>c.done).length,0)
  const pct=tot>0?Math.round(done/tot*100):0
  const R=Math.PI/180
  const rLabel=({cx,cy,midAngle,innerRadius,outerRadius,percent})=>{
    if(percent<0.08)return null
    const r=innerRadius+(outerRadius-innerRadius)*0.5, x=cx+r*Math.cos(-midAngle*R), y=cy+r*Math.sin(-midAngle*R)
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fontFamily="Inter">{`${Math.round(percent*100)}%`}</text>
  }
  const card=(children,mb=10)=><div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 16px', marginBottom:mb, boxShadow:`0 2px 10px ${C.shadow}` }}>{children}</div>
  const secLabel=(t)=><div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:14, textTransform:'uppercase' }}>{t}</div>
  return (
    <div style={{ padding:'0 14px 20px' }}>
      {card(<>
        {secLabel('Overall Progress')}
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ position:'relative', width:88, height:88, flexShrink:0 }}>
            <ResponsiveContainer width={88} height={88}>
              <PieChart><Pie data={[{v:done},{v:Math.max(tot-done,0)}]} dataKey="v" innerRadius={27} outerRadius={40} startAngle={90} endAngle={-270} strokeWidth={0}><Cell fill={C.accentG}/><Cell fill={C.bgAlt}/></Pie></PieChart>
            </ResponsiveContainer>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontSize:17, fontWeight:700, color:C.accentG, fontFamily:"'Lora',serif" }}>{pct}%</div>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:600, color:C.text }}>{done} <span style={{ fontSize:13, color:C.textLt, fontWeight:400 }}>/ {tot} done</span></div>
            <div style={{ fontSize:12, color:C.textMd, marginTop:3 }}>{tot-done} items remaining</div>
            <div style={{ marginTop:10, height:5, borderRadius:3, background:C.bgAlt, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${C.accentG},${C.accentB})`, borderRadius:3 }}/>
            </div>
          </div>
        </div>
      </>)}
      {card(<>
        {secLabel('Pending by List')}
        {donut.every(d=>d.value===0)?<div style={{ textAlign:'center', padding:'18px 0', color:C.textLt, fontSize:13 }}>All done — nice work! 🎉</div>:(
          <>
            <ResponsiveContainer width="100%" height={165}>
              <PieChart><Pie data={donut.filter(d=>d.value>0)} dataKey="value" innerRadius={46} outerRadius={74} paddingAngle={3} labelLine={false} label={rLabel}>{donut.filter(d=>d.value>0).map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip contentStyle={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, fontFamily:'Inter', fontSize:12, color:C.text }}/></PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:6 }}>
              {donut.map((d,i)=><div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:9, height:9, borderRadius:'50%', background:d.color, flexShrink:0 }}/><span style={{ flex:1, fontSize:13, color:C.textMd }}>{d.icon} {d.name}</span><span style={{ fontSize:12, color:d.color, fontWeight:600 }}>{d.value}</span><span style={{ fontSize:11, color:C.textLt }}>/{d.total}</span></div>)}
            </div>
          </>
        )}
      </>)}
      {card(<>
        {secLabel('Completion Rate')}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {comp.map((d,i)=><div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}><span style={{ fontSize:13, color:C.textMd }}>{d.name}</span><span style={{ fontSize:12, fontWeight:600, color:d.color }}>{d.pct}%</span></div><div style={{ height:6, borderRadius:3, background:C.bgAlt, overflow:'hidden' }}><div style={{ height:'100%', width:`${d.pct}%`, background:`linear-gradient(90deg,${d.color}aa,${d.color})`, borderRadius:3 }}/></div><div style={{ fontSize:11, color:C.textLt, marginTop:3 }}>{d.done} done · {d.pending} pending</div></div>)}
        </div>
      </>)}
      {card(<>
        {secLabel('By Priority')}
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={priData} barSize={36} margin={{top:0,right:0,bottom:0,left:-20}}>
            <XAxis dataKey="label" tick={{ fill:C.textLt, fontSize:11, fontFamily:'Inter' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:C.textLt, fontSize:10, fontFamily:'Inter' }} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip contentStyle={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, fontFamily:'Inter', fontSize:12 }} cursor={{ fill:`${C.bgAlt}` }}/>
            <Bar dataKey="count" radius={[5,5,0,0]}>{priData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', justifyContent:'space-around', marginTop:6 }}>
          {priData.map(d=><div key={d.label} style={{ textAlign:'center' }}><div style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:600, color:d.color }}>{d.count}</div><div style={{ fontSize:10, color:C.textLt, letterSpacing:0.5 }}>{d.label}</div></div>)}
        </div>
      </>,0)}
    </div>
  )
}

function BoardTab({ lists, setLists }) {
  const [boardView, setBoardView] = useState('board')
  const [modal, setModal]   = useState(null)
  const [activeId, setActiveId] = useState(null)
  const boardRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint:{ distance:8 } }),
    useSensor(TouchSensor, { activationConstraint:{ delay:250, tolerance:8 } })
  )

  function updateCard(lid,cid,patch) { setLists(ls=>ls.map(l=>l.id!==lid?l:{...l,cards:l.cards.map(c=>c.id!==cid?c:{...c,...patch})})) }
  function removeCard(lid,cid) { setLists(ls=>ls.map(l=>l.id!==lid?l:{...l,cards:l.cards.filter(c=>c.id!==cid)})) }
  function addCard(lid,card) {
    setLists(ls=>ls.map(l=>l.id!==lid?l:{...l,cards:[card,...l.cards]}))
    setTimeout(()=>boardRef.current?.scrollTo({top:0,behavior:'smooth'}),50)
  }
  function updateList(lid,patch) { setLists(ls=>ls.map(l=>l.id!==lid?l:{...l,...patch})) }
  function removeList(lid) { setLists(ls=>ls.filter(l=>l.id!==lid)) }
  function addList(data) { setLists(ls=>[...ls,{id:genId(),cards:[],...data}]) }
  function clearCards(lid) { setLists(ls=>ls.map(l=>l.id!==lid?l:{...l,cards:[]})) }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over||active.id===over.id) return
    if (lists.some(l=>l.id===active.id)) {
      setLists(ls=>arrayMove(ls,ls.findIndex(l=>l.id===active.id),ls.findIndex(l=>l.id===over.id)))
      return
    }
    let srcId=null,dstId=null
    for (const l of lists) {
      if (l.cards.some(c=>c.id===active.id)) srcId=l.id
      if (l.cards.some(c=>c.id===over.id)||l.id===over.id) dstId=l.id
    }
    if (!srcId||!dstId||srcId!==dstId) return
    setLists(ls=>ls.map(l=>{
      if (l.id!==srcId) return l
      return {...l,cards:arrayMove(l.cards,l.cards.findIndex(c=>c.id===active.id),l.cards.findIndex(c=>c.id===over.id))}
    }))
  }

  const totalP = lists.reduce((a,l)=>a+l.cards.filter(c=>!c.done).length,0)
  const totalH = lists.reduce((a,l)=>a+l.cards.filter(c=>!c.done&&c.priority==='high').length,0)

  return (
    <div ref={boardRef} style={{ flex:1, overflowY:'auto', background:C.bg }}>
      {/* Header */}
      <div style={{ padding:'18px 16px 0', position:'sticky', top:0, zIndex:10, background:`linear-gradient(180deg,${C.bg} 78%,transparent 100%)` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, color:C.text }}>Board</div>
          <button onClick={()=>setModal({type:'newList'})} style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:10, padding:'8px 14px', color:C.textMd, fontSize:12, fontWeight:500, cursor:'pointer', boxShadow:`0 2px 6px ${C.shadow}` }}>+ List</button>
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', gap:4, marginBottom:14, background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:12, padding:3 }}>
          {[['board','Lists'],['charts','Charts']].map(([k,lbl])=>(
            <button key={k} onClick={()=>setBoardView(k)} style={{ flex:1, padding:'8px 0', background:boardView===k?C.bgCard:'transparent', border:boardView===k?`1px solid ${C.border}`:'1px solid transparent', borderRadius:10, color:boardView===k?C.text:C.textMd, fontSize:12, fontWeight:boardView===k?600:400, cursor:'pointer', boxShadow:boardView===k?`0 1px 4px ${C.shadow}`:'none', transition:'all 0.15s' }}>{lbl}</button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display:'flex', marginBottom:16, background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', boxShadow:`0 2px 8px ${C.shadow}` }}>
          {[{lbl:'Lists',val:lists.length,c:C.accentB},{lbl:'Pending',val:totalP,c:C.accentG},{lbl:'Urgent',val:totalH,c:C.accent}].map((s,i)=>(
            <div key={s.lbl} style={{ flex:1, textAlign:'center', padding:'12px 0', borderRight:i<2?`1px solid ${C.border}`:'none' }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, color:s.c }}>{s.val}</div>
              <div style={{ fontSize:10, color:C.textLt, letterSpacing:0.8, marginTop:1 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {boardView==='board' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({active})=>setActiveId(active.id)} onDragEnd={handleDragEnd}>
          <div style={{ padding:'0 12px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            <SortableContext items={lists.map(l=>l.id)} strategy={verticalListSortingStrategy}>
              {lists.map((list,li)=>{
                const pending=list.cards.filter(c=>!c.done).length
                return (
                  <SortableList key={list.id} list={list} isDragging={activeId===list.id}>
                    {({dragHandleProps})=>(
                      <div style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:16, overflow:'hidden', animation:`fadeUp 0.3s ease ${li*0.05}s both`, boxShadow:`0 2px 10px ${C.shadow}` }}>
                        {/* color accent bar */}
                        <div style={{ height:3, background:`linear-gradient(90deg,${list.color},${list.color}66)` }}/>
                        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 13px', borderBottom:`1px solid ${C.border}` }}>
                          <div {...dragHandleProps} style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:`${list.color}15`, border:`1.5px solid ${list.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:list.color, cursor:'grab', touchAction:'none' }}>{list.icon}</div>
                          <div style={{ flex:1, cursor:'pointer' }} onClick={()=>setModal({type:'editList',list})}>
                            <div style={{ fontFamily:"'Lora',serif", fontSize:15, fontWeight:600, color:C.text }}>{list.title}</div>
                            <div style={{ fontSize:11, color:C.textLt, marginTop:1 }}>{pending} pending · tap to edit</div>
                          </div>
                          <div style={{ width:24, height:24, borderRadius:'50%', background:`${list.color}15`, border:`1.5px solid ${list.color}44`, color:list.color, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>{pending}</div>
                        </div>
                        <div style={{ padding:'8px 10px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                          {list.cards.length===0&&<div style={{ textAlign:'center', padding:'14px 0', color:C.textLt, fontSize:12, fontStyle:'italic' }}>No items yet</div>}
                          <SortableContext items={list.cards.map(c=>c.id)} strategy={verticalListSortingStrategy}>
                            {list.cards.map(card=>{
                              const pri=PRIORITY_CONFIG[card.priority]||PRIORITY_CONFIG.medium
                              return <SortableCard key={card.id} card={card} listColor={list.color} pri={pri} onToggle={()=>updateCard(list.id,card.id,{done:!card.done})} onEdit={()=>setModal({type:'editCard',listId:list.id,card})} onDelete={()=>removeCard(list.id,card.id)}/>
                            })}
                          </SortableContext>
                          <button onClick={()=>setModal({type:'addCard',list})} style={{ marginTop:3, padding:'9px 0', background:'transparent', border:`1.5px dashed ${list.color}33`, borderRadius:10, color:list.color, fontSize:12, fontWeight:500, cursor:'pointer', opacity:0.8 }}>+ Add item</button>
                        </div>
                      </div>
                    )}
                  </SortableList>
                )
              })}
            </SortableContext>
          </div>
        </DndContext>
      ) : <ChartsView lists={lists}/>}

      {modal?.type==='editCard'&&(()=>{const list=lists.find(l=>l.id===modal.listId);return<Modal title="Edit Item" onClose={()=>setModal(null)}><CardForm initial={modal.card} listColor={list?.color||C.accent} submitLabel="Save Changes" onSubmit={d=>{updateCard(modal.listId,modal.card.id,d);setModal(null)}} onDelete={()=>{removeCard(modal.listId,modal.card.id);setModal(null)}}/></Modal>})()}
      {modal?.type==='addCard'&&<Modal title={`Add to ${modal.list.title}`} onClose={()=>setModal(null)}><CardForm listColor={modal.list.color} submitLabel="Add Item" onSubmit={d=>{addCard(modal.list.id,{id:genId(),done:false,...d});setModal(null)}}/></Modal>}
      {modal?.type==='newList'&&<Modal title="New List" onClose={()=>setModal(null)}><ListForm submitLabel="Create List" onSubmit={d=>{addList(d);setModal(null)}}/></Modal>}
      {modal?.type==='editList'&&<Modal title="Edit List" onClose={()=>setModal(null)}><ListForm initial={modal.list} submitLabel="Save Changes" onSubmit={d=>{updateList(modal.list.id,d);setModal(null)}} onDelete={()=>{removeList(modal.list.id);setModal(null)}} onClearAll={()=>{clearCards(modal.list.id);setModal(null)}}/></Modal>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TRIPS TAB ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function TripCard({ trip, onClick }) {
  const until=daysUntil(trip.start_date), isPast=until!==null&&until<0
  return (
    <div onClick={onClick} style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:18, overflow:'hidden', cursor:'pointer', animation:'fadeUp 0.4s ease', boxShadow:`0 3px 12px ${C.shadow}`, transition:'transform 0.15s, box-shadow 0.15s' }}>
      <div style={{ height:4, background:`linear-gradient(90deg,${trip.color||C.accent},${trip.color||C.accent}66)` }}/>
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:32 }}>{trip.emoji||'✈️'}</div>
          {until!==null&&until>=0&&<div style={{ background:`${trip.color||C.accent}15`, border:`1px solid ${trip.color||C.accent}33`, borderRadius:20, padding:'4px 11px', fontSize:11, fontWeight:500, color:trip.color||C.accent }}>{until===0?'Today!':`${until}d away`}</div>}
          {isPast&&<div style={{ background:C.bgAlt, borderRadius:20, padding:'4px 11px', fontSize:11, color:C.textLt }}>Completed</div>}
        </div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:700, color:C.text, marginBottom:2 }}>{trip.title}</div>
        <div style={{ fontSize:12, color:C.textMd, marginBottom:8 }}>{trip.destination}</div>
        {trip.start_date&&<div style={{ fontSize:11, color:C.textLt }}>📅 {formatDate(trip.start_date)}{trip.end_date?` — ${formatDate(trip.end_date)}`:''}{trip.start_date&&trip.end_date?` · ${tripDuration(trip.start_date,trip.end_date)}`:''}</div>}
      </div>
    </div>
  )
}

function NewTripModal({ onSave, onClose }) {
  const [title,setTitle]=useState(''), [dest,setDest]=useState(''), [start,setStart]=useState(''), [end,setEnd]=useState(''), [emoji,setEmoji]=useState('🌴'), [color,setColor]=useState(TRIP_COLORS[0])
  return (
    <Modal title="New Trip" onClose={onClose}>
      <Field label="Trip Name"><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Paris Anniversary" style={fi}/></Field>
      <Field label="Destination"><input value={dest} onChange={e=>setDest(e.target.value)} placeholder="e.g. Paris, France" style={fi}/></Field>
      <div style={{ display:'flex', gap:10, marginBottom:14 }}>
        <div style={{ flex:1 }}><Field label="Start"><input type="date" value={start} onChange={e=>setStart(e.target.value)} style={fi}/></Field></div>
        <div style={{ flex:1 }}><Field label="End"><input type="date" value={end} onChange={e=>setEnd(e.target.value)} style={fi}/></Field></div>
      </div>
      <Field label="Emoji"><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{TRIP_EMOJIS.map(e=><div key={e} onClick={()=>setEmoji(e)} style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, cursor:'pointer', background:emoji===e?`${color}18`:C.bgAlt, border:`1.5px solid ${emoji===e?color:C.border}`, transition:'all 0.15s' }}>{e}</div>)}</div></Field>
      <Field label="Color"><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{TRIP_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:color===c?`3px solid ${C.text}`:'3px solid transparent', boxShadow:color===c?`0 0 0 2px ${c}44`:'none', transition:'all 0.15s' }}/>)}</div></Field>
      <div style={{ marginTop:6 }}><Btn onClick={()=>title.trim()&&onSave({id:genId(),title:title.trim(),destination:dest.trim(),start_date:start,end_date:end,emoji,color,flights:[],lodging:[],itinerary:{},notes:'',packing:[],budget:{total:'',items:[]},created_at:new Date().toISOString()})} color={color||C.accent} full>Create Trip</Btn></div>
    </Modal>
  )
}

function FlightsSection({ flights, onChange }) {
  const [adding,setAdding]=useState(false)
  const [form,setForm]=useState({direction:'outbound',airline:'',flight_number:'',from:'',to:'',date:'',depart_time:'',arrive_time:'',confirmation:'',notes:''})
  function save() { if(!form.from||!form.to)return; onChange([...flights,{id:genId(),...form}]); setAdding(false); setForm({direction:'outbound',airline:'',flight_number:'',from:'',to:'',date:'',depart_time:'',arrive_time:'',confirmation:'',notes:''}) }
  return (
    <div>
      {flights.map(f=>(
        <div key={f.id} style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 15px', marginBottom:9, boxShadow:`0 2px 8px ${C.shadow}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:10, fontWeight:600, letterSpacing:0.5, color:f.direction==='outbound'?C.accent:C.accentB, background:f.direction==='outbound'?`${C.accent}12`:`${C.accentB}12`, padding:'2px 8px', borderRadius:5 }}>{f.direction === 'outbound' ? 'Outbound' : 'Return'}</span>
                {f.airline&&<span style={{ fontSize:12, color:C.textMd }}>{f.airline} {f.flight_number}</span>}
              </div>
              <div style={{ fontFamily:"'Lora',serif", fontSize:17, fontWeight:600, color:C.text }}>{f.from} → {f.to}</div>
              {f.date&&<div style={{ fontSize:12, color:C.textMd, marginTop:2 }}>{formatDate(f.date)}{f.depart_time&&` · ${f.depart_time}`}{f.arrive_time&&` → ${f.arrive_time}`}</div>}
              {f.confirmation&&<div style={{ fontSize:11, color:C.textLt, marginTop:3 }}>Conf: {f.confirmation}</div>}
            </div>
            <button onClick={()=>onChange(flights.filter(x=>x.id!==f.id))} style={{ background:'transparent', border:'none', color:C.textLt, fontSize:20, cursor:'pointer' }}>×</button>
          </div>
        </div>
      ))}
      {adding?(
        <div style={{ background:C.bgCard, border:`1.5px solid ${C.accent}44`, borderRadius:14, padding:'14px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {['outbound','return'].map(d=><button key={d} onClick={()=>setForm(f=>({...f,direction:d}))} style={{ flex:1, padding:'8px 0', background:form.direction===d?`${C.accent}12`:C.bgAlt, border:`1.5px solid ${form.direction===d?C.accent:C.border}`, borderRadius:10, color:form.direction===d?C.accent:C.textMd, fontSize:12, fontWeight:500, cursor:'pointer', textTransform:'capitalize' }}>{d}</button>)}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input value={form.airline} onChange={e=>setForm(f=>({...f,airline:e.target.value}))} placeholder="Airline" style={{...fi,flex:1}}/><input value={form.flight_number} onChange={e=>setForm(f=>({...f,flight_number:e.target.value}))} placeholder="Flight #" style={{...fi,flex:1}}/></div>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} placeholder="From (JFK)" style={{...fi,flex:1}}/><input value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))} placeholder="To (CDG)" style={{...fi,flex:1}}/></div>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{...fi,flex:1}}/><input type="time" value={form.depart_time} onChange={e=>setForm(f=>({...f,depart_time:e.target.value}))} style={{...fi,flex:1}}/><input type="time" value={form.arrive_time} onChange={e=>setForm(f=>({...f,arrive_time:e.target.value}))} style={{...fi,flex:1}}/></div>
          <input value={form.confirmation} onChange={e=>setForm(f=>({...f,confirmation:e.target.value}))} placeholder="Confirmation #" style={{...fi,marginBottom:9}}/>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes..." rows={2} style={{...fi,resize:'none',marginBottom:12}}/>
          <div style={{ display:'flex', gap:9 }}><Btn onClick={save} color={C.accent}>Save Flight</Btn><Btn onClick={()=>setAdding(false)} variant="outline" color={C.textMd}>Cancel</Btn></div>
        </div>
      ):<button onClick={()=>setAdding(true)} style={{ width:'100%', padding:'12px 0', background:'transparent', border:`1.5px dashed ${C.accent}33`, borderRadius:12, color:C.accent, fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Add Flight</button>}
    </div>
  )
}

function LodgingSection({ lodging, onChange }) {
  const [adding,setAdding]=useState(false)
  const [form,setForm]=useState({name:'',address:'',check_in:'',check_out:'',confirmation:'',phone:'',notes:''})
  function save() { if(!form.name)return; onChange([...lodging,{id:genId(),...form}]); setAdding(false); setForm({name:'',address:'',check_in:'',check_out:'',confirmation:'',phone:'',notes:''}) }
  return (
    <div>
      {lodging.map(l=>(
        <div key={l.id} style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 15px', marginBottom:9, boxShadow:`0 2px 8px ${C.shadow}` }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:16, fontWeight:600, color:C.text, marginBottom:3 }}>{l.name}</div>
              {l.address&&<div style={{ fontSize:12, color:C.textMd, marginBottom:5 }}>📍 {l.address}</div>}
              <div style={{ display:'flex', gap:14, fontSize:12, color:C.textMd }}>
                {l.check_in&&<span>In: {formatDate(l.check_in)}</span>}
                {l.check_out&&<span>Out: {formatDate(l.check_out)}</span>}
              </div>
              {l.confirmation&&<div style={{ fontSize:11, color:C.textLt, marginTop:3 }}>Conf: {l.confirmation}</div>}
            </div>
            <button onClick={()=>onChange(lodging.filter(x=>x.id!==l.id))} style={{ background:'transparent', border:'none', color:C.textLt, fontSize:20, cursor:'pointer' }}>×</button>
          </div>
        </div>
      ))}
      {adding?(
        <div style={{ background:C.bgCard, border:`1.5px solid ${C.accentB}44`, borderRadius:14, padding:'14px' }}>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Hotel / Airbnb name" style={{...fi,marginBottom:9}}/>
          <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Address" style={{...fi,marginBottom:9}}/>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input type="date" value={form.check_in} onChange={e=>setForm(f=>({...f,check_in:e.target.value}))} style={{...fi,flex:1}}/><input type="date" value={form.check_out} onChange={e=>setForm(f=>({...f,check_out:e.target.value}))} style={{...fi,flex:1}}/></div>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input value={form.confirmation} onChange={e=>setForm(f=>({...f,confirmation:e.target.value}))} placeholder="Confirmation #" style={{...fi,flex:1}}/><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Phone" style={{...fi,flex:1}}/></div>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes..." rows={2} style={{...fi,resize:'none',marginBottom:12}}/>
          <div style={{ display:'flex', gap:9 }}><Btn onClick={save} color={C.accentB}>Save Lodging</Btn><Btn onClick={()=>setAdding(false)} variant="outline" color={C.textMd}>Cancel</Btn></div>
        </div>
      ):<button onClick={()=>setAdding(true)} style={{ width:'100%', padding:'12px 0', background:'transparent', border:`1.5px dashed ${C.accentB}33`, borderRadius:12, color:C.accentB, fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Add Lodging</button>}
    </div>
  )
}

function ItinerarySection({ trip, itinerary, onChange }) {
  const [sel,setSel]=useState(null), [adding,setAdding]=useState(false), [form,setForm]=useState({time:'',title:'',notes:''})
  const days=getDaysInRange(trip.start_date,trip.end_date)
  if(!days.length) return <div style={{ textAlign:'center', padding:'20px 0', color:C.textLt, fontSize:13, fontStyle:'italic' }}>Add trip dates to plan your itinerary</div>
  function addEv() {
    if(!form.title||!sel)return
    onChange({...itinerary,[sel]:[...(itinerary[sel]||[]),{id:genId(),...form}]})
    setForm({time:'',title:'',notes:''}); setAdding(false)
  }
  return (
    <div>
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:14 }}>
        {days.map(day=>{
          const d=new Date(day+'T00:00:00'), has=(itinerary[day]||[]).length>0, isSel=sel===day
          return <div key={day} onClick={()=>setSel(isSel?null:day)} style={{ flexShrink:0, width:50, textAlign:'center', cursor:'pointer', padding:'8px 3px', borderRadius:12, background:isSel?`${trip.color||C.accent}15`:C.bgCard, border:`1.5px solid ${isSel?trip.color||C.accent:C.border}`, boxShadow:`0 1px 4px ${C.shadow}`, transition:'all 0.15s' }}>
            <div style={{ fontSize:9, fontWeight:600, color:isSel?trip.color||C.accent:C.textLt, textTransform:'uppercase', letterSpacing:0.3 }}>{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:17, fontWeight:700, color:isSel?trip.color||C.accent:C.text, marginTop:1 }}>{d.getDate()}</div>
            {has&&<div style={{ width:5, height:5, borderRadius:'50%', background:trip.color||C.accent, margin:'3px auto 0' }}/>}
          </div>
        })}
      </div>
      {sel&&<div style={{ animation:'fadeUp 0.2s ease' }}>
        <div style={{ fontSize:12, fontWeight:500, color:C.textMd, marginBottom:12, fontStyle:'italic', fontFamily:"'Lora',serif" }}>{new Date(sel+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        {(itinerary[sel]||[]).sort((a,b)=>a.time.localeCompare(b.time)).map(ev=>(
          <div key={ev.id} style={{ display:'flex', gap:12, marginBottom:12, paddingLeft:10, borderLeft:`2.5px solid ${trip.color||C.accent}55` }}>
            <div style={{ minWidth:44, fontSize:11, color:C.textLt, paddingTop:2 }}>{ev.time||'—'}</div>
            <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:500, color:C.text, marginBottom:1 }}>{ev.title}</div>{ev.notes&&<div style={{ fontSize:12, color:C.textMd }}>{ev.notes}</div>}</div>
            <button onClick={()=>onChange({...itinerary,[sel]:(itinerary[sel]||[]).filter(e=>e.id!==ev.id)})} style={{ background:'transparent', border:'none', color:C.textLt, fontSize:17, cursor:'pointer' }}>×</button>
          </div>
        ))}
        {adding?<div style={{ background:C.bgCard, border:`1.5px solid ${trip.color||C.accent}44`, borderRadius:12, padding:'13px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:9 }}><input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{...fi,width:105,flexShrink:0}}/><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Activity" style={{...fi,flex:1}} autoFocus/></div>
          <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes (optional)" style={{...fi,marginBottom:11}}/>
          <div style={{ display:'flex', gap:8 }}><Btn onClick={addEv} color={trip.color||C.accent} small>Add</Btn><Btn onClick={()=>setAdding(false)} variant="outline" color={C.textMd} small>Cancel</Btn></div>
        </div>:<button onClick={()=>setAdding(true)} style={{ width:'100%', padding:'10px 0', background:'transparent', border:`1.5px dashed ${trip.color||C.accent}33`, borderRadius:10, color:trip.color||C.accent, fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Add Activity</button>}
      </div>}
      {!sel&&<div style={{ textAlign:'center', padding:'12px 0', color:C.textLt, fontSize:12, fontStyle:'italic' }}>Tap a day to add activities</div>}
    </div>
  )
}

function PackingSection({ packing, onChange, tripColor }) {
  const [text,setText]=useState(''), [cat,setCat]=useState('Essentials')
  const cats=['Essentials','Clothing','Toiletries','Electronics','Documents','Other']
  function add() { if(!text.trim())return; onChange([...packing,{id:genId(),text:text.trim(),category:cat,done:false}]); setText('') }
  const grouped=cats.reduce((acc,c)=>{ const items=packing.filter(p=>p.category===c); if(items.length)acc[c]=items; return acc },{})
  const tot=packing.length, done=packing.filter(p=>p.done).length
  return (
    <div>
      {tot>0&&<div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:C.textMd, marginBottom:5 }}><span>{done}/{tot} packed</span><span>{tot-done} left</span></div>
        <div style={{ height:5, borderRadius:3, background:C.bgAlt, overflow:'hidden' }}><div style={{ height:'100%', width:`${tot?Math.round(done/tot*100):0}%`, background:`linear-gradient(90deg,${tripColor||C.accent},${tripColor||C.accent}88)`, borderRadius:3 }}/></div>
      </div>}
      {Object.entries(grouped).map(([c,items])=>(
        <div key={c} style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:C.textLt, marginBottom:7, textTransform:'uppercase' }}>{c}</div>
          {items.map(p=><div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:11, marginBottom:5, boxShadow:`0 1px 4px ${C.shadow}` }}>
            <div onClick={()=>onChange(packing.map(x=>x.id!==p.id?x:{...x,done:!x.done}))} style={{ width:20, height:20, borderRadius:6, flexShrink:0, cursor:'pointer', background:p.done?`${tripColor||C.accent}20`:'transparent', border:`1.5px solid ${p.done?tripColor||C.accent:C.borderMd}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
              {p.done&&<svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke={tripColor||C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ flex:1, fontSize:13, color:p.done?C.textLt:C.text, textDecoration:p.done?'line-through':'none' }}>{p.text}</span>
            <button onClick={()=>onChange(packing.filter(x=>x.id!==p.id))} style={{ background:'transparent', border:'none', color:C.textLt, fontSize:16, cursor:'pointer' }}>×</button>
          </div>)}
        </div>
      ))}
      <div style={{ display:'flex', gap:7 }}>
        <select value={cat} onChange={e=>setCat(e.target.value)} style={{...fi,width:125,flexShrink:0}}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Add item..." style={{...fi,flex:1}}/>
        <button onClick={add} style={{ padding:'0 15px', background:`linear-gradient(135deg,${tripColor||C.accent},${tripColor||C.accent}dd)`, border:'none', borderRadius:11, color:'#fff', fontSize:18, cursor:'pointer', flexShrink:0, boxShadow:`0 3px 10px ${tripColor||C.accent}33` }}>+</button>
      </div>
    </div>
  )
}

function BudgetSection({ budget, onChange, tripColor }) {
  const [desc,setDesc]=useState(''), [amount,setAmount]=useState(''), [cat,setCat]=useState('Food')
  const cats=['Food','Transport','Lodging','Activities','Shopping','Other']
  function addItem() { if(!desc||!amount)return; onChange({...budget,items:[...(budget.items||[]),{id:genId(),desc:desc.trim(),amount:parseFloat(amount)||0,category:cat}]}); setDesc(''); setAmount('') }
  const tot=(budget.items||[]).reduce((a,i)=>a+i.amount,0), bTot=parseFloat(budget.total)||0, rem=bTot-tot
  const grouped=cats.reduce((acc,c)=>{ const items=(budget.items||[]).filter(i=>i.category===c); if(items.length)acc[c]=items; return acc },{})
  return (
    <div>
      <div style={{ background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:16, boxShadow:`0 2px 10px ${C.shadow}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:C.textLt, textTransform:'uppercase', marginBottom:4 }}>Trip Budget</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontFamily:"'Lora',serif", fontSize:20, color:C.textMd }}>$</span>
              <input type="number" value={budget.total} onChange={e=>onChange({...budget,total:e.target.value})} placeholder="0" style={{ background:'transparent', border:'none', outline:'none', fontFamily:"'Lora',serif", fontSize:28, fontWeight:700, color:C.text, width:120 }}/>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:10, color:C.textLt, marginBottom:4 }}>SPENT</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, color:rem<0?C.accent:tripColor||C.accent }}>${tot.toFixed(2)}</div>
            {bTot>0&&<div style={{ fontSize:11, color:C.textMd }}>${Math.abs(rem).toFixed(2)} {rem>=0?'left':'over'}</div>}
          </div>
        </div>
        {bTot>0&&<div style={{ height:6, borderRadius:3, background:C.bgAlt, overflow:'hidden' }}><div style={{ height:'100%', width:`${Math.min(100,bTot?Math.round(tot/bTot*100):0)}%`, background:`linear-gradient(90deg,${tripColor||C.accent},${rem<0?C.accent:tripColor||C.accent})`, borderRadius:3 }}/></div>}
      </div>
      {Object.entries(grouped).map(([c,items])=>(
        <div key={c} style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:C.textLt, marginBottom:5, textTransform:'uppercase', display:'flex', justifyContent:'space-between' }}><span>{c}</span><span>${items.reduce((a,i)=>a+i.amount,0).toFixed(2)}</span></div>
          {items.map(item=><div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:10, marginBottom:4 }}>
            <span style={{ fontSize:13, color:C.textMd }}>{item.desc}</span>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:C.text }}>${item.amount.toFixed(2)}</span><button onClick={()=>onChange({...budget,items:(budget.items||[]).filter(i=>i.id!==item.id)})} style={{ background:'transparent', border:'none', color:C.textLt, fontSize:16, cursor:'pointer' }}>×</button></div>
          </div>)}
        </div>
      ))}
      <div style={{ display:'flex', gap:7 }}>
        <select value={cat} onChange={e=>setCat(e.target.value)} style={{...fi,width:115,flexShrink:0}}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" style={{...fi,flex:1}}/>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addItem()} placeholder="$" style={{...fi,width:65,flexShrink:0}}/>
        <button onClick={addItem} style={{ padding:'0 14px', background:`linear-gradient(135deg,${tripColor||C.accent},${tripColor||C.accent}dd)`, border:'none', borderRadius:11, color:'#fff', fontSize:18, cursor:'pointer', flexShrink:0 }}>+</button>
      </div>
    </div>
  )
}

function ShareModal({ trip, onShare, onClose }) {
  const [email,setEmail]=useState(''), [shared,setShared]=useState([]), [status,setStatus]=useState(''), [loading,setLoading]=useState(false)
  useEffect(()=>{ supabase.from('trip_members').select('invited_email').eq('trip_id',trip.id).then(({data})=>setShared((data||[]).map(r=>r.invited_email))) },[trip.id])
  async function invite() {
    if(!email.trim())return; setLoading(true); setStatus('')
    const result=await onShare(trip.id,email.trim())
    if(result.error) setStatus('Error: '+result.error)
    else { setShared(s=>[...s.filter(e=>e!==email.toLowerCase()),email.toLowerCase()]); setStatus('Saved! They\'ll see this trip when they sign in.'); setEmail('') }
    setLoading(false)
  }
  return (
    <Modal title={`Share "${trip.title}"`} onClose={onClose}>
      <div style={{ fontSize:13, color:C.textMd, marginBottom:18, lineHeight:1.6 }}>Enter your wife's email. When she signs in with that email this trip will appear in her app automatically.</div>
      <div style={{ display:'flex', gap:9, marginBottom:14 }}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&invite()} placeholder="Email address" style={{...fi,flex:1}} autoFocus/><Btn onClick={invite} disabled={loading} color={C.accentB}>{loading?'...':'Invite'}</Btn></div>
      {status&&<div style={{ fontSize:13, color:status.includes('Error')?C.accent:C.accentG, marginBottom:14, padding:'10px 13px', background:status.includes('Error')?`${C.accent}08`:`${C.accentG}08`, borderRadius:10, border:`1px solid ${status.includes('Error')?`${C.accent}25`:`${C.accentG}25`}` }}>{status}</div>}
      {shared.length>0&&<div>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:C.textLt, marginBottom:9, textTransform:'uppercase' }}>Shared With</div>
        {shared.map(e=><div key={e} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:11, marginBottom:5 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:`${C.accentB}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:C.accentB, fontWeight:600, fontFamily:"'Lora',serif" }}>{e[0].toUpperCase()}</div>
          <span style={{ flex:1, fontSize:13, color:C.textMd }}>{e}</span>
          <span style={{ fontSize:11, color:C.accentG, fontWeight:500 }}>✓ invited</span>
        </div>)}
      </div>}
    </Modal>
  )
}

function TripDetail({ trip, onUpdate, onBack, onDelete, onShare, isOwner }) {
  const [tab,setTab]=useState('flights'), [editNotes,setEditNotes]=useState(false), [notes,setNotes]=useState(trip.notes||''), [showShare,setShowShare]=useState(false)
  const tabs=[{id:'flights',icon:'✈️',lbl:'Flights'},{id:'lodging',icon:'🏨',lbl:'Lodging'},{id:'itinerary',icon:'📅',lbl:'Days'},{id:'packing',icon:'🧳',lbl:'Packing'},{id:'budget',icon:'💰',lbl:'Budget'},{id:'notes',icon:'📝',lbl:'Notes'}]
  function upd(field,val) { onUpdate({...trip,[field]:val}) }
  const until=daysUntil(trip.start_date)
  return (
    <div style={{ minHeight:'100%', background:C.bg }}>
      {/* Trip header */}
      <div style={{ padding:'16px 16px 0', background:`linear-gradient(180deg, ${trip.color||C.accent}18 0%, ${C.bg} 100%)`, paddingBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button onClick={onBack} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, width:34, height:34, color:C.textMd, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 1px 4px ${C.shadow}` }}>←</button>
          <div style={{ flex:1 }}/>
          {isOwner&&<button onClick={()=>setShowShare(true)} style={{ background:`${C.accentB}12`, border:`1px solid ${C.accentB}33`, borderRadius:9, padding:'6px 13px', color:C.accentB, fontSize:12, cursor:'pointer', fontWeight:500, marginRight:6 }}>Share</button>}
          {!isOwner&&<div style={{ background:`${C.accentG}12`, border:`1px solid ${C.accentG}33`, borderRadius:9, padding:'6px 13px', fontSize:12, color:C.accentG, marginRight:6, fontWeight:500 }}>Shared</div>}
          {isOwner&&<button onClick={onDelete} style={{ background:`${C.accent}10`, border:`1px solid ${C.accent}33`, borderRadius:9, padding:'6px 13px', color:C.accent, fontSize:12, cursor:'pointer', fontWeight:500 }}>Delete</button>}
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:10 }}>
          <div style={{ fontSize:44 }}>{trip.emoji||'✈️'}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, color:C.text, lineHeight:1.2, marginBottom:3 }}>{trip.title}</div>
            {trip.destination&&<div style={{ fontSize:12, color:C.textMd }}>📍 {trip.destination}</div>}
          </div>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {trip.start_date&&<div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:8, padding:'5px 11px', fontSize:11, color:C.textMd, boxShadow:`0 1px 3px ${C.shadow}` }}>📅 {formatDate(trip.start_date)}{trip.end_date?` – ${formatDate(trip.end_date)}`:''}</div>}
          {trip.start_date&&trip.end_date&&<div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:8, padding:'5px 11px', fontSize:11, color:C.textMd, boxShadow:`0 1px 3px ${C.shadow}` }}>{tripDuration(trip.start_date,trip.end_date)}</div>}
          {until!==null&&until>=0&&<div style={{ background:`${trip.color||C.accent}15`, border:`1px solid ${trip.color||C.accent}33`, borderRadius:8, padding:'5px 11px', fontSize:11, fontWeight:500, color:trip.color||C.accent }}>{until===0?'🎉 Today!':`${until} days away`}</div>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', overflowX:'auto', gap:4, padding:'0 12px 10px', borderBottom:`1px solid ${C.border}`, background:C.bg }}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{ flexShrink:0, padding:'7px 13px', background:tab===t.id?`${trip.color||C.accent}15`:C.bgCard, border:`1.5px solid ${tab===t.id?trip.color||C.accent:C.border}`, borderRadius:20, color:tab===t.id?trip.color||C.accent:C.textMd, fontSize:11, fontWeight:tab===t.id?600:400, cursor:'pointer', whiteSpace:'nowrap', boxShadow:`0 1px 3px ${C.shadow}` }}>{t.icon} {t.lbl}</button>)}
      </div>

      <div style={{ padding:'14px 14px 40px' }}>
        {tab==='flights'&&<FlightsSection flights={trip.flights||[]} onChange={v=>upd('flights',v)}/>}
        {tab==='lodging'&&<LodgingSection lodging={trip.lodging||[]} onChange={v=>upd('lodging',v)}/>}
        {tab==='itinerary'&&<ItinerarySection trip={trip} itinerary={trip.itinerary||{}} onChange={v=>upd('itinerary',v)}/>}
        {tab==='packing'&&<PackingSection packing={trip.packing||[]} onChange={v=>upd('packing',v)} tripColor={trip.color}/>}
        {tab==='budget'&&<BudgetSection budget={trip.budget||{total:'',items:[]}} onChange={v=>upd('budget',v)} tripColor={trip.color}/>}
        {tab==='notes'&&<div>{editNotes?<><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={12} autoFocus placeholder="Notes about this trip..." style={{...fi,resize:'none',marginBottom:12,lineHeight:1.7}}/><div style={{ display:'flex', gap:9 }}><Btn onClick={()=>{upd('notes',notes);setEditNotes(false)}} color={trip.color||C.accent}>Save</Btn><Btn onClick={()=>{setNotes(trip.notes||'');setEditNotes(false)}} variant="outline" color={C.textMd}>Cancel</Btn></div></>:<div onClick={()=>setEditNotes(true)} style={{ minHeight:100, background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'14px', cursor:'text', lineHeight:1.7, fontSize:14, color:trip.notes?C.textMd:C.textLt, whiteSpace:'pre-wrap', fontStyle:trip.notes?'normal':'italic', boxShadow:`0 2px 8px ${C.shadow}` }}>{trip.notes||'Tap to add notes...'}</div>}</div>}
      </div>
      {showShare&&<ShareModal trip={trip} onShare={onShare} onClose={()=>setShowShare(false)}/>}
    </div>
  )
}

function TripsTab({ trips, setTrips, user, saveTrip, deleteTrip, shareTrip }) {
  const [activeTrip,setActiveTrip]=useState(null), [showNew,setShowNew]=useState(false)
  const nextTrip=trips.filter(t=>t.start_date&&daysUntil(t.start_date)>=0).sort((a,b)=>a.start_date.localeCompare(b.start_date))[0]

  function addTrip(trip) { const t={...trip,_owner:user.id}; setTrips(ts=>[...ts,t]); saveTrip(t); setShowNew(false) }
  function updateTrip(updated) { setTrips(ts=>ts.map(t=>t.id!==updated.id?t:updated)); setActiveTrip(updated); saveTrip(updated) }

  if (activeTrip) return <TripDetail trip={activeTrip} onUpdate={updateTrip} onBack={()=>setActiveTrip(null)} onDelete={()=>{deleteTrip(activeTrip.id);setActiveTrip(null)}} onShare={shareTrip} isOwner={activeTrip._owner===user.id}/>

  return (
    <div style={{ flex:1, overflowY:'auto', background:C.bg, padding:'20px 14px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, color:C.text }}>Trips</div>
        <button onClick={()=>setShowNew(true)} style={{ background:`linear-gradient(135deg,${C.accent},#C84E2A)`, border:'none', borderRadius:12, padding:'9px 16px', color:'#fff', fontSize:12, fontWeight:500, cursor:'pointer', boxShadow:`0 3px 12px ${C.accent}33` }}>+ Trip</button>
      </div>

      {nextTrip&&<div onClick={()=>setActiveTrip(nextTrip)} style={{ background:`linear-gradient(135deg,${nextTrip.color||C.accent}18,${nextTrip.color||C.accent}08)`, border:`1.5px solid ${nextTrip.color||C.accent}33`, borderRadius:18, padding:'14px 16px', marginBottom:20, cursor:'pointer', display:'flex', alignItems:'center', gap:12, boxShadow:`0 3px 14px ${nextTrip.color||C.accent}18` }}>
        <div style={{ fontSize:28 }}>{nextTrip.emoji||'✈️'}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:`${nextTrip.color||C.accent}99`, marginBottom:2, textTransform:'uppercase' }}>Next Up</div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:15, fontWeight:600, color:C.text }}>{nextTrip.title}</div>
          <div style={{ fontSize:11, color:C.textMd, marginTop:1 }}>{formatDate(nextTrip.start_date)}</div>
        </div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, color:nextTrip.color||C.accent, textAlign:'center' }}>
          {daysUntil(nextTrip.start_date)===0?'🎉':daysUntil(nextTrip.start_date)}
          {daysUntil(nextTrip.start_date)>0&&<div style={{ fontSize:9, color:C.textLt, letterSpacing:0.8, fontFamily:'Inter', fontWeight:400 }}>days</div>}
        </div>
      </div>}

      {trips.length===0?<div style={{ textAlign:'center', padding:'50px 0', animation:'fadeUp 0.4s ease' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🌍</div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:600, color:C.textMd, marginBottom:6 }}>No trips yet</div>
        <div style={{ fontSize:13, color:C.textLt, marginBottom:24, fontStyle:'italic' }}>Tap + Trip to plan your first adventure</div>
        <button onClick={()=>setShowNew(true)} style={{ background:`linear-gradient(135deg,${C.accent},#C84E2A)`, border:'none', borderRadius:14, padding:'13px 28px', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', boxShadow:`0 4px 14px ${C.accent}33` }}>Plan a Trip</button>
      </div>:(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {trips.filter(t=>t.start_date&&daysUntil(t.start_date)>=0).length>0&&<>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.2, color:C.textLt, textTransform:'uppercase', paddingTop:2 }}>Upcoming</div>
            {trips.filter(t=>t.start_date&&daysUntil(t.start_date)>=0).sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(t=><TripCard key={t.id} trip={t} onClick={()=>setActiveTrip(t)}/>)}
          </>}
          {trips.filter(t=>!t.start_date||daysUntil(t.start_date)<0).length>0&&<>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.2, color:C.textLt, textTransform:'uppercase', paddingTop:8 }}>Past Trips</div>
            {trips.filter(t=>!t.start_date||daysUntil(t.start_date)<0).sort((a,b)=>(b.start_date||'').localeCompare(a.start_date||'')).map(t=><TripCard key={t.id} trip={t} onClick={()=>setActiveTrip(t)}/>)}
          </>}
        </div>
      )}
      {showNew&&<NewTripModal onSave={addTrip} onClose={()=>setShowNew(false)}/>}
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarTab({ trips }) {
  const today=new Date()
  const [year,setYear]=useState(today.getFullYear()), [month,setMonth]=useState(today.getMonth())
  const first=new Date(year,month,1), pad=first.getDay(), dim=new Date(year,month+1,0).getDate()
  const months=['January','February','March','April','May','June','July','August','September','October','November','December']
  function tripsForDay(d) {
    const s=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return trips.filter(t=>t.start_date&&t.end_date&&s>=t.start_date&&s<=t.end_date)
  }
  function prev() { if(month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1) }
  function next() { if(month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1) }

  return (
    <div style={{ flex:1, overflowY:'auto', background:C.bg, padding:'20px 14px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <button onClick={prev} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, width:36, height:36, color:C.textMd, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 1px 4px ${C.shadow}` }}>‹</button>
        <div style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:600, color:C.text }}>{months[month]} {year}</div>
        <button onClick={next} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, width:36, height:36, color:C.textMd, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 1px 4px ${C.shadow}` }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:C.textLt, padding:'3px 0', letterSpacing:0.5 }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:24 }}>
        {Array.from({length:pad}).map((_,i)=><div key={`p${i}`}/>)}
        {Array.from({length:dim}).map((_,i)=>{
          const d=i+1, ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, isToday=ds===today.toISOString().slice(0,10), trs=tripsForDay(d), has=trs.length>0
          return <div key={d} style={{ aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:10, background:isToday?`${C.accent}18`:has?`${C.bgCard}`:C.bg, border:isToday?`1.5px solid ${C.accent}55`:has?`1px solid ${C.border}`:'1px solid transparent', boxShadow:has?`0 1px 4px ${C.shadow}`:'none', padding:2 }}>
            <div style={{ fontFamily:isToday?"'Lora',serif":'Inter', fontSize:13, fontWeight:isToday?700:400, color:isToday?C.accent:C.text }}>{d}</div>
            {has&&<div style={{ display:'flex', gap:2, marginTop:1 }}>{[...new Set(trs.map(t=>t.color||C.accent))].slice(0,3).map((c,i)=><div key={i} style={{ width:5, height:5, borderRadius:'50%', background:c }}/>)}</div>}
          </div>
        })}
      </div>
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.2, color:C.textLt, marginBottom:12, textTransform:'uppercase' }}>Upcoming Trips</div>
      {trips.filter(t=>t.start_date&&daysUntil(t.start_date)>=0).sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0,6).map(t=>(
        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:C.bgCard, border:`1.5px solid ${C.border}`, borderRadius:14, marginBottom:8, boxShadow:`0 2px 8px ${C.shadow}` }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${t.color||C.accent}15`, border:`1.5px solid ${t.color||C.accent}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{t.emoji||'✈️'}</div>
          <div style={{ flex:1 }}><div style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:C.text }}>{t.title}</div><div style={{ fontSize:11, color:C.textMd, marginTop:1 }}>{formatDate(t.start_date)}</div></div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, color:t.color||C.accent }}>{daysUntil(t.start_date)===0?'Today!':`${daysUntil(t.start_date)}d`}</div>
        </div>
      ))}
      {trips.filter(t=>t.start_date&&daysUntil(t.start_date)>=0).length===0&&<div style={{ textAlign:'center', padding:'16px 0', color:C.textLt, fontSize:13, fontStyle:'italic' }}>No upcoming trips</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]       = useState(null)
  const [lists,setLists]     = useState([])
  const [trips,setTrips]     = useState([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving]   = useState(false)
  const [tab,setTab]         = useState('board')

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){setUser(session.user);loadAll(session.user)}
      else setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user){setUser(session.user);loadAll(session.user)}
      else{setUser(null);setLists([]);setTrips([]);setLoading(false)}
    })
    return ()=>subscription.unsubscribe()
  },[])

  async function loadAll(u) {
    setLoading(true)
    const {data:bd}=await supabase.from('boards').select('data').eq('id',WORKSPACE_ID).single()
    if(bd) setLists(bd.data)
    else setLists([
      {id:'shopping',title:'Shopping',icon:'◈',color:'#3BA89A',cards:[{id:'s1',text:'Add your first item',done:false,priority:'medium'}]},
      {id:'todo',title:'To-Do',icon:'◉',color:'#D95F3B',cards:[{id:'t1',text:'Get things done',done:false,priority:'high'}]},
    ])
    const {data:owned}=await supabase.from('trips').select('*').eq('user_id',u.id)
    const {data:memberships}=await supabase.from('trip_members').select('trip_id').eq('user_id',u.id)
    let shared=[]
    if(memberships?.length){
      const {data:st}=await supabase.from('trips').select('*').in('id',memberships.map(m=>m.trip_id))
      shared=st||[]
    }
    const all=[...(owned||[]),...shared].filter((t,i,a)=>a.findIndex(x=>x.id===t.id)===i)
    setTrips(all.map(r=>({...r.data,_owner:r.user_id})))
    setLoading(false)
  }

  useEffect(()=>{
    if(loading||!user) return
    setSaving(true)
    const t=setTimeout(async()=>{
      await supabase.from('boards').upsert({id:WORKSPACE_ID,data:lists},{onConflict:'id'})
      setSaving(false)
    },800)
    return ()=>clearTimeout(t)
  },[lists])

  async function saveTrip(trip) {
    await supabase.from('trips').upsert({id:trip.id,user_id:trip._owner||user.id,data:trip},{onConflict:'id'})
  }
  async function deleteTrip(id) {
    await supabase.from('trips').delete().eq('id',id)
    await supabase.from('trip_members').delete().eq('trip_id',id)
    setTrips(ts=>ts.filter(t=>t.id!==id))
  }
  async function shareTrip(tripId,email) {
    const {error}=await supabase.from('trip_members').upsert({trip_id:tripId,invited_email:email.toLowerCase(),user_id:null},{onConflict:'trip_id,invited_email'})
    if(error) return {error:error.message}
    const {data:profile}=await supabase.from('profiles').select('id').eq('email',email.toLowerCase()).single()
    if(profile) await supabase.from('trip_members').upsert({trip_id:tripId,user_id:profile.id,invited_email:email.toLowerCase()},{onConflict:'trip_id,invited_email'})
    return {success:true}
  }

  const initial = (user?.user_metadata?.full_name||user?.email||'?')[0].toUpperCase()

  if(loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{G}</style>
      <div style={{ textAlign:'center', animation:'shimmer 1.5s infinite' }}>
        <div style={{ fontSize:44, marginBottom:10 }}>🧭</div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:13, color:C.textLt, letterSpacing:1 }}>Loading...</div>
      </div>
    </div>
  )

  if(!user) return <AuthScreen onAuth={u=>{setUser(u);loadAll(u)}}/>

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:C.bg, overflow:'hidden' }}>
      <style>{G}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', flexShrink:0, background:C.bgCard, borderBottom:`1px solid ${C.border}`, boxShadow:`0 1px 6px ${C.shadow}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          {/* Avatar — shows first letter of name */}
          <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${C.accent},#C84E2A)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Lora',serif", fontSize:17, fontWeight:700, color:'#fff', boxShadow:`0 2px 8px ${C.accent}33`, flexShrink:0 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:700, color:C.text, letterSpacing:-0.3, lineHeight:1 }}>Compass</div>
            <div style={{ fontSize:10, color:C.textLt, marginTop:2 }}>
              {user.user_metadata?.full_name||user.email}
              {saving&&<span style={{ color:C.accentG, marginLeft:6 }}>saving...</span>}
            </div>
          </div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:9, padding:'7px 12px', color:C.textMd, fontSize:11, cursor:'pointer', fontWeight:500 }}>Sign out</button>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='board'    && <BoardTab lists={lists} setLists={setLists}/>}
        {tab==='trips'    && <TripsTab trips={trips} setTrips={setTrips} user={user} saveTrip={saveTrip} deleteTrip={deleteTrip} shareTrip={shareTrip}/>}
        {tab==='calendar' && <CalendarTab trips={trips}/>}
      </div>

      {/* Bottom nav — warm light style */}
      <div style={{ display:'flex', background:C.bgCard, borderTop:`1px solid ${C.border}`, padding:`10px 0 max(10px, env(safe-area-inset-bottom))`, flexShrink:0, boxShadow:`0 -2px 12px ${C.shadow}` }}>
        {[
          {id:'board',    emoji:'◈',  label:'Board'},
          {id:'trips',    emoji:'✈️', label:'Trips'},
          {id:'calendar', emoji:'📅', label:'Calendar'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'transparent', border:'none', cursor:'pointer', padding:'4px 0' }}>
            <div style={{ fontSize:t.id==='board'?17:20, lineHeight:1, color:tab===t.id?C.accent:C.textLt, transition:'color 0.15s' }}>
              {t.emoji}
            </div>
            <div style={{ fontSize:9, fontWeight:tab===t.id?600:400, color:tab===t.id?C.accent:C.textLt, letterSpacing:0.5, textTransform:'uppercase', transition:'color 0.15s' }}>{t.label}</div>
            {tab===t.id&&<div style={{ width:20, height:2, borderRadius:1, background:C.accent, marginTop:1 }}/>}
          </button>
        ))}
      </div>
    </div>
  )
}
