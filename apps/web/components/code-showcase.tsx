'use client';
import Link from 'next/link';
import { useState } from 'react';
import { FaCopy, FaCheck, FaQrcode, FaKey, FaPaperPlane, FaArrowRight, FaTerminal } from 'react-icons/fa6';
import { LanguageIcon } from './marketing-sections';

const steps = [
  { icon: FaQrcode, title: 'Link your number', detail: 'Scan the QR from WhatsApp’s Linked devices.' },
  { icon: FaKey, title: 'Copy your session key', detail: 'Keep credentials scoped to a single number.' },
  { icon: FaPaperPlane, title: 'Send your first request', detail: 'Use your language. Receive replies through webhooks.' },
];
const extensions: Record<string,string> = { JavaScript:'send-message.js', TypeScript:'send-message.ts', Python:'send_message.py', PHP:'send-message.php', Laravel:'NotificationService.php', 'C#':'SendMessage.cs', Java:'SendMessage.java', cURL:'terminal.sh', Ruby:'send_message.rb', Go:'send_message.go', Swift:'SendMessage.swift', PowerShell:'SendMessage.ps1', Rust:'send_message.rs', n8n:'HTTP Request node' };
function Highlight({ source }: { source: string }) {
  return <>{source.split(/("[^"\n]*"|'[^'\n]*'|\b(?:const|await|new|import|using|var|return|from)\b)/g).map((part,index)=><span key={index} className={/^["']/.test(part)?'rw-token-string':/^(const|await|new|import|using|var|return|from)$/.test(part)?'rw-token-keyword':undefined}>{part}</span>)}</>;
}
export default function CodeShowcase({ examples }: { examples: Record<string,string> }) {
  const [language,setLanguage]=useState('JavaScript');
  const [copied,setCopied]=useState(false);
  const [copyError,setCopyError]=useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(examples[language]); setCopied(true);setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <section className="rw-site-section rw-code-showcase" id="code-examples">
    <div className="rw-code-intro"><p className="rw-kicker">YOUR NEXT INTEGRATION STARTS HERE</p><h2>A few lines of code.<br/><em>A new connection.</em></h2><p>Bring WhatsApp into your application with a straightforward HTTP request.</p>
      <div className="rw-code-steps">{steps.map(({icon:Icon,title,detail},index)=><article key={title}><span className="rw-code-step-icon"><Icon/></span><div><small>STEP 0{index+1}</small><h3>{title}</h3><p>{detail}</p></div></article>)}</div>
      <Link className="rw-code-doc-link" href="/api-docs#quickstart">Read the quickstart <FaArrowRight/></Link>
    </div>
    <div className="rw-editor"><header className="rw-editor-top"><span className="rw-editor-dots"><i/><i/><i/></span><span><FaTerminal/> API playground</span><span className="rw-editor-label">REST API</span></header>
      <div className="rw-editor-languages" role="tablist" aria-label="Example language" onKeyDown={event=>{
        if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
        const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const current=tabs.indexOf(document.activeElement as HTMLButtonElement);
        if (current===-1) return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          (current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        setLanguage(Object.keys(examples)[next]);
        setCopied(false);setCopyError(false);
        tabs[next]?.focus();
      }}>{Object.keys(examples).map(name=><button role="tab" aria-selected={language===name} tabIndex={language===name?0:-1} aria-controls="rw-example-code" key={name} className={language===name?'active':''} onClick={()=>{setLanguage(name);setCopied(false);setCopyError(false);}}><LanguageIcon name={name}/>{name}</button>)}</div>
      <div className="rw-editor-file"><span>{extensions[language] ?? 'HTTP example'}</span><button onClick={()=>void copy()} aria-label="Copy code">{copied?<FaCheck/>:<FaCopy/>}{copied?'Copied':'Copy'}</button></div>
      <pre className="rw-editor-code" id="rw-example-code" role="tabpanel" aria-label={language+' example'}><code>{examples[language].split('\n').map((line,index)=><span className="rw-editor-line" key={index}><span className="rw-line-number" aria-hidden="true">{index+1}</span><span><Highlight source={line}/>{!line&&' '}</span></span>)}</code></pre>
      <footer><span className="rw-editor-status"><i/> Session-scoped authentication</span><span>{copyError?'Select the code to copy manually.':'Local example · use your deployment URL'}</span></footer>
    </div>
  </section>;
}
