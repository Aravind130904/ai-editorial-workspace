import React, { useMemo, useState } from 'react';
import { BookOpen, Search, PenLine, Sparkles, FileText, ArrowUpRight, Check, X, RefreshCw, Link2, AlertCircle, ChevronRight, Copy, Clock3, WandSparkles } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const demoSources = [
  {title:'AI models are becoming more capable and more accessible', url:'https://example.com/model-access', text:'Illustrative sample source: AI model providers are making increasingly capable systems available through APIs and developer platforms. The practical effect for product teams depends on latency, reliability, price, and the quality of the surrounding product experience. Teams should evaluate model performance on their own tasks rather than relying only on benchmark claims.'},
  {title:'Developers are building workflows around AI agents', url:'https://example.com/agent-workflows', text:'Illustrative sample source: AI agents combine language models with tools and multi-step workflows. They can help with bounded tasks such as research, coding assistance, and customer support triage. Reliability remains a challenge when a workflow requires many sequential decisions, and human review is important for consequential actions.'},
  {title:'Businesses are testing AI in everyday operations', url:'https://example.com/enterprise-adoption', text:'Illustrative sample source: Businesses are experimenting with AI to reduce repetitive work and improve access to internal knowledge. Successful deployments typically begin with a narrow workflow, clear evaluation criteria, and a process for handling incorrect outputs. Adoption is not the same as measurable business value.'}
];

function App() {
  const [tab,setTab] = useState('research');
  const [sources,setSources] = useState([{title:'',url:'',text:''},{title:'',url:'',text:''},{title:'',url:'',text:''}]);
  const [brief,setBrief] = useState(null);
  const [sourceErrors,setSourceErrors] = useState([]);
  const [researchBusy,setResearchBusy] = useState(false);
  const [draft,setDraft] = useState('');
  const [analysis,setAnalysis] = useState(null);
  const [writingBusy,setWritingBusy] = useState(false);
  const [aiSuggestions,setAiSuggestions] = useState([]);
  const [accepted,setAccepted] = useState([]);
  const [rejected,setRejected] = useState([]);
  const [notice,setNotice] = useState('');
  const [health,setHealth] = useState(null);

  React.useEffect(()=>{ fetch(`${API}/api/health`).then(r=>r.json()).then(setHealth).catch(()=>setHealth({ok:false})); },[]);
  const updateSource=(i,k,v)=>setSources(prev=>prev.map((s,n)=>n===i?{...s,[k]:v}:s));
  const addSource=()=>setSources(p=>[...p,{title:'',url:'',text:''}]);
  const runResearch=async()=>{
    setResearchBusy(true);setNotice('');setBrief(null);setSourceErrors([]);
    try{
      const r=await fetch(`${API}/api/research`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'Research request failed');
      setBrief(data.brief);setSourceErrors(data.source_errors||[]);
      setNotice(data.ai_enabled?'AI-assisted research brief generated. Verify each claim against its source.':'Brief generated in fallback mode. Add an API key for richer synthesis.');
    }catch(e){setNotice(e.message)}finally{setResearchBusy(false)}
  };
  const runAnalysis=async()=>{
    setWritingBusy(true);setNotice('');
    try{
      const r=await fetch(`${API}/api/writing/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Analysis failed');
      setAnalysis(d);setAccepted([]);setRejected([]);
    }catch(e){setNotice(e.message)}finally{setWritingBusy(false)}
  };
  const runAiSuggestions=async()=>{
    setWritingBusy(true);setNotice('');
    try{
      const r=await fetch(`${API}/api/writing/suggest`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Suggestions failed');
      setAiSuggestions(d.suggestions||[]);setNotice(d.message||'AI suggestions are ready. Review before accepting.');
    }catch(e){setNotice(e.message)}finally{setWritingBusy(false)}
  };
  const applySuggestion=(s,i)=>{
    if(!s.excerpt||!s.rewrite)return;
    const idx=draft.indexOf(s.excerpt);
    if(idx<0){setNotice('The original passage was not found in the current draft. Re-run suggestions after editing.');return}
    setDraft(draft.slice(0,idx)+s.rewrite+draft.slice(idx+s.excerpt.length));
    setAccepted(a=>[...a,i]);setNotice('Suggestion accepted. Your draft has been updated.');
  };
  const loadDemo=()=>{setSources(demoSources);setNotice('Loaded illustrative sample sources. These are mock examples, not real reporting.');};
  const useNewsletter=()=>{setDraft(sampleNewsletter);setTab('writing');setAnalysis(null);setAiSuggestions([]);setNotice('Sample newsletter loaded into the editor.');};
  const metrics=analysis?.metrics;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BookOpen size={19}/></div><div><b>Editorial AI</b></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className={`nav-item ${tab==='research'?'active':''}`} onClick={()=>setTab('research')}><Search size={17}/> Research Assistant <span className="nav-dot"/></button>
      <button className={`nav-item ${tab==='writing'?'active':''}`} onClick={()=>setTab('writing')}><PenLine size={17}/> Writing Assistant</button>
      <div className="sidebar-bottom"><div className="status-line"><span className={`status-dot ${health?.ok?'':'offline'}`}/>{health?.ok?'Backend connected':'Backend unavailable'}</div><p>Research with evidence.<br/>Write with intention.</p><small>EDITORIAL WORKSPACE · MVP</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <ChevronRight size={14}/><strong>{tab==='research'?'Research':'Writing'}</strong></div><div className="top-right"><span className="private-label"><span/> Local workspace</span><div className="avatar">E</div></div></header>
      <div className="content">
        {notice&&<div className="notice"><AlertCircle size={16}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {tab==='research'?<ResearchView {...{sources,updateSource,addSource,runResearch,researchBusy,brief,sourceErrors,loadDemo,useNewsletter}}/>:<WritingView {...{draft,setDraft,analysis,runAnalysis,runAiSuggestions,writingBusy,aiSuggestions,accepted,rejected,setRejected,applySuggestion,metrics}}/>}
      </div>
    </main>
  </div>
}

function ResearchView({sources,updateSource,addSource,runResearch,researchBusy,brief,sourceErrors,loadDemo,useNewsletter}){
  return <><div className="page-heading"><div><div className="eyebrow"><Sparkles size={13}/> RESEARCH DESK</div><h1>Find the story<br/><em>behind the signal.</em></h1><p>Bring together the developments shaping AI. Get past the headlines and find what matters to the people building with it.</p></div><div className="heading-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-core"><BookOpen size={27}/></div><span className="art-tag">SIGNAL / NOISE</span></div></div>
    <div className="section-row"><div><h2>Source collection</h2><p>Add at least three articles, posts, or research sources.</p></div><button className="text-button" onClick={loadDemo}><RefreshCw size={14}/> Load demo sources</button></div>
    <div className="source-list">{sources.map((s,i)=><div className="source-card" key={i}><div className="source-number">{String(i+1).padStart(2,'0')}</div><div className="source-fields"><input value={s.title} onChange={e=>updateSource(i,'title',e.target.value)} placeholder="Source title (optional)"/><div className="url-input"><Link2 size={15}/><input value={s.url} onChange={e=>updateSource(i,'url',e.target.value)} placeholder="Paste article URL"/></div><textarea value={s.text} onChange={e=>updateSource(i,'text',e.target.value)} placeholder="Or paste article text here (recommended for paywalled or inaccessible pages)…" rows="2"/></div><span className="source-type">{s.text?'TEXT ADDED':s.url?'URL':'EMPTY'}</span></div>)}</div>
    <div className="source-actions"><button className="text-button" onClick={addSource}>+ Add another source</button><button className="primary-button" onClick={runResearch} disabled={researchBusy}>{researchBusy?<><RefreshCw className="spin" size={16}/> Analyzing sources</>:<>Build research brief <ArrowUpRight size={16}/></>}</button></div>
    {sourceErrors.length>0&&<div className="error-list"><b>Sources needing attention</b>{sourceErrors.map((e,i)=><p key={i}>{e.url||e.id}: {e.error}</p>)}</div>}
    {brief&&<div className="brief">
      <div className="brief-top"><div><div className="eyebrow">EDITORIAL INTELLIGENCE · {brief.mode==='ai_assisted'?'AI ASSISTED':'FALLBACK MODE'}</div><h2>{brief.headline}</h2></div><span className="pill">BRIEF READY</span></div>
      <div className="brief-grid"><section className="brief-main"><h3>What happened</h3><p>{brief.what_happened}</p><h3>Why it matters</h3><p>{brief.why_it_matters}</p><h3>Story opportunity</h3><div className="angle-box"><Sparkles size={17}/><p>{brief.story_opportunity}</p></div><h3>Potential newsletter angles</h3><ol>{(brief.newsletter_angles||[]).map((a,i)=><li key={i}>{a}</li>)}</ol></section>
      <aside className="brief-side"><h3>Who should care</h3>{(brief.who_should_care||[]).map((x,i)=><div className="audience" key={i}><span>0{i+1}</span>{x}</div>)}<h3>Editorial caveats</h3>{(brief.editorial_caveats||[]).map((x,i)=><p className="caveat" key={i}>{x}</p>)}</aside></div>
      <h3 className="source-evidence-heading">Source evidence</h3><div className="evidence-list">{(brief.sources||[]).map((s,i)=><div className="evidence-card" key={i}><div className="evidence-head"><b>{s.id} · {s.title}</b>{s.url&&<a href={s.url} target="_blank" rel="noreferrer">Open original <ArrowUpRight size={13}/></a>}</div><p>{s.summary}</p><div className="fact-label">SOURCE NOTES</div>{(s.facts||[]).map((f,j)=><p className="fact" key={j}>• {f}</p>)}<div className="evidence-note"><b>{s.classification||'Editorial note'}:</b> {s.evidence}</div><p className="implication"><b>Why it matters:</b> {s.why_it_matters}</p></div>)}</div>
      <div className="brief-footer"><span>Source links are preserved for editorial verification. This is not independent fact-checking.</span><button className="primary-button" onClick={useNewsletter}>Open sample in Writing Assistant <ArrowUpRight size={15}/></button></div>
    </div>}
  </>
}

const sampleNewsletter = `The AI agent question is no longer whether a model can use tools. It is whether a business can trust the whole workflow.

The latest wave of AI products is pushing beyond chat interfaces. Systems can now combine a model with search, code execution, internal documents, and other tools to complete multi-step tasks. That shift matters because the value is not in a clever answer; it is in reliably moving work forward.

For founders, this creates a practical product opportunity. Instead of adding a generic chatbot, look for a narrow task with a clear starting point, a measurable finish line, and a human who can review the result. Customer-support triage, internal research, and first-pass data analysis are useful places to test.

But a demo that succeeds once is not an operational system. Each extra step creates another chance for an agent to misunderstand context, call the wrong tool, or confidently return an incomplete result. A workflow that saves five minutes but requires ten minutes of checking has not improved the business.

The sensible approach is to start with bounded autonomy. Let the system gather information, draft an answer, or prepare an action. Keep a person in the loop for decisions that affect customers, money, or access. Measure completion rate, correction rate, time saved, and the cost of review—not just how impressive the demo looks.

The opportunity is not to automate everything. It is to redesign one repetitive workflow so that software handles the tedious parts and people retain judgment where it matters.

The question for builders this week: which task in your product is predictable enough to delegate, but important enough that a human should still approve the outcome?`;

function WritingView({draft,setDraft,analysis,runAnalysis,runAiSuggestions,writingBusy,aiSuggestions,accepted,rejected,setRejected,applySuggestion,metrics}){
  const words=draft.trim()?draft.trim().split(/\s+/).length:0;
  return <><div className="page-heading writing-heading"><div><div className="eyebrow"><PenLine size={13}/> THE EDITOR'S ROOM</div><h1>Make every word<br/><em>earn its place.</em></h1><p>Get practical feedback on clarity and flow. Keep your voice, protect the meaning, and decide which edits make the cut.</p></div><div className="writing-stamp"><span>WRITE</span><PenLine size={32}/><span>REFINE</span></div></div>
    <div className="editor-toolbar"><div><h2>Draft editor</h2><p>Your original stays yours until you accept a change.</p></div><button className="text-button" onClick={()=>setDraft(sampleNewsletter)}>Load sample draft</button></div>
    <div className="editor-layout"><section className="draft-panel"><div className="panel-top"><span><FileText size={15}/> WORKING DRAFT</span><span>{words} WORDS</span></div><textarea className="draft-area" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Paste your newsletter draft here…"/><div className="draft-bottom"><span>Changes are local until you copy or save them.</span><div><button className="secondary-button" onClick={runAiSuggestions} disabled={writingBusy||!draft.trim()}><WandSparkles size={15}/> AI suggestions</button><button className="primary-button" onClick={runAnalysis} disabled={writingBusy||!draft.trim()}>{writingBusy?<RefreshCw className="spin" size={15}/>:<Sparkles size={15}/>} Analyze draft</button></div></div></section>
      <aside className="metrics-panel"><div className="panel-top"><span>WRITING SNAPSHOT</span><span className="live-tag">LIVE</span></div><div className="metric-big"><strong>{words}</strong><span>Words in draft</span></div><div className="metric-row"><div><strong>{metrics?.average_sentence_length??'—'}</strong><span>Avg. words / sentence</span></div><div><strong>{metrics?.reading_time_minutes!=null?`${metrics.reading_time_minutes}m`:'—'}</strong><span>Est. reading time</span></div></div><div className="metric-row"><div><strong>{metrics?.sentence_count??'—'}</strong><span>Sentences</span></div><div><strong>{metrics?.flesch_reading_ease??'—'}</strong><span>Reading ease*</span></div></div><p className="metric-note">*Flesch Reading Ease is a rough reading-effort estimate, not a quality score. Technical nuance can be worth the extra effort.</p></aside></div>
    {analysis&&<section className="feedback-section"><div className="section-row"><div><div className="eyebrow">EDITORIAL DIAGNOSTICS</div><h2>Feedback worth considering</h2><p>{analysis.issues.length} potential issue(s) found. Treat these as prompts for judgment, not rules.</p></div><span className="pill">{analysis.issues.length} FLAGS</span></div>
      {analysis.issues.length===0?<div className="empty-state"><Check size={20}/> No rule-based flags found. That does not guarantee the draft is clear or accurate.</div>:<div className="issue-list">{analysis.issues.map((issue,i)=><div className="issue-card" key={i}><div className="issue-icon"><AlertCircle size={16}/></div><div className="issue-content"><div className="issue-title"><b>{issue.type}</b><span className={`severity ${issue.severity}`}>{issue.severity}</span></div><blockquote>{issue.excerpt}</blockquote><p>{issue.reason}</p><div className="suggestion"><b>Try this:</b> {issue.suggestion}</div></div></div>)}</div>}
    </section>}
    {aiSuggestions.length>0&&<section className="feedback-section"><div className="section-row"><div><div className="eyebrow">AI EDITOR</div><h2>Suggested revisions</h2><p>Review each proposed change. Nothing is applied automatically.</p></div></div><div className="issue-list">{aiSuggestions.map((s,i)=><div className="ai-suggestion" key={i}><div className="suggestion-heading"><b>Suggestion {i+1}</b>{accepted.includes(i)?<span className="accepted"><Check size={13}/> Accepted</span>:rejected.includes(i)?<span className="rejected">Rejected</span>:<span className="pending">Needs review</span>}</div><div className="compare"><div><label>ORIGINAL</label><p>{s.excerpt}</p></div><div><label>PROPOSED</label><p>{s.rewrite}</p></div></div><p className="reason">{s.reason}</p>{!accepted.includes(i)&&!rejected.includes(i)&&<div className="suggestion-actions"><button className="secondary-button" onClick={()=>setRejected(p=>[...p,i])}><X size={14}/> Reject</button><button className="primary-button" onClick={()=>applySuggestion(s,i)}><Check size={14}/> Accept edit</button></div>}</div>)}</div></section>}
    {draft.trim()&&<div className="copy-row"><span>When you're happy with the draft, copy it for your publishing workflow.</span><button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(draft)}><Copy size={14}/> Copy revised draft</button></div>}
  </>
}

export default App;
