(() => {
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const editor = $("#editor"), title = $("#title");
const STORAGE = "still.notes.v1";
const PREFS = "still.settings.v1";

const icons = {
  note:'<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="m16 3 5 5-4 1-4 4-1 5-3-3-5 5"/></svg>'
};
let docs = [], currentId = null, saveTimer = null, toastTimer = null;
let searchIndex = 0, searchMatches = [], slashRange = null;
let prefs = {theme:"light",width:720,size:17,count:true,date:true};
let lastSavedSignature = "";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function plainText(html) {
  const d=document.createElement("div");d.innerHTML=html;
  return d.innerText || d.textContent || "";
}
function activeDoc() { return docs.find(d=>d.id===currentId); }
function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function stamp(value) {
  return safeDate(value).toLocaleDateString(undefined,{
    month:"short",day:"numeric",year:"numeric"
  });
}
function getPrefs() {
  try { return {...prefs,...JSON.parse(localStorage.getItem(PREFS)||"{}")}; }
  catch { return prefs; }
}
function loadDocs() {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE)||"null");
    if(Array.isArray(parsed)) docs=parsed.filter(d=>d && d.id);
  } catch {}
  if(!docs.length) {
    const d={id:uid(),title:"",html:"",created:Date.now(),updated:Date.now(),pinned:false};
    docs=[d];currentId=d.id;
  } else {
    currentId=docs[0].id;
  }
  if(!docs.some(d=>d.id===currentId)) currentId=docs[0].id;
}
function persist() {
  try {
    localStorage.setItem(STORAGE,JSON.stringify(docs));
    $("#saveStatus").textContent="Saved locally";
    lastSavedSignature = signature();
  } catch(err) {
    $("#saveStatus").textContent="Storage full";
    toast("Couldn't save. Export a backup to keep your changes.");
  }
}
function signature() {
  const d=activeDoc();
  return d ? JSON.stringify([d.title,d.html,d.pinned,d.updated]) : "";
}
function queueSave() {
  $("#saveStatus").textContent="Saving…";
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveCurrent,180);
}
function saveCurrent() {
  const d=activeDoc(); if(!d) return;
  d.title=title.value;
  d.html=editor.innerHTML;
  d.updated=Date.now();
  persist();
  updateStats();
  updateHeader();
}
function toast(message) {
  const el=$("#toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),2400);
}
function updateHeader() {
  const d=activeDoc();if(!d)return;
  const name=d.title.trim()||"Untitled note";
  $("#topDocName").textContent=name;
  $("#dateLabel").textContent=prefs.date ? stamp(d.created) : "";
  $("#editedLabel").textContent=d.updated ? "Edited "+stamp(d.updated) : "Just for you";
  $("#subtitle").textContent=d.pinned?"Pinned note":"A little space to think.";
  $("#pinNote").style.color=d.pinned?"var(--accent)":"";
  $("#pinNote").title=d.pinned?"Unpin note":"Pin note";
  document.title=name+" — Still";
}
function updateStats() {
  const text=plainText(editor.innerHTML).trim();
  const words=text ? text.split(/\s+/u).filter(Boolean).length : 0;
  const chars=text.length;
  $("#wordCount").textContent=words+" "+(words===1?"word":"words");
  $("#charCount").textContent=chars+" "+(chars===1?"character":"characters");
  $("#readTime").textContent=Math.max(1,Math.ceil(words/220))+" min read";
  $(".bottom-bar").style.display=prefs.count?"flex":"none";
}
function setTheme(theme) {
  prefs.theme=theme;
  const dark=theme==="dark" ||
    (theme==="system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme=dark?"dark":"light";
  document.querySelector('meta[name="theme-color"]').content=dark?"#191a17":"#f8f8f5";
  $("#themeSetting").value=theme;
  localStorage.setItem(PREFS,JSON.stringify(prefs));
}
function applyPrefs() {
  prefs=getPrefs();
  setTheme(prefs.theme);
  const width=Number(prefs.width)||720;
  $(".editor-head").style.maxWidth=width+"px";
  $(".editor-wrap").style.maxWidth=width+"px";
  $(".bottom-bar").style.maxWidth=width+"px";
  editor.style.setProperty("--editor-size",(Number(prefs.size)||17)+"px");
  $("#widthSetting").value=String(width);
  $("#sizeSetting").value=String(prefs.size||17);
  $("#countSetting").checked=!!prefs.count;
  $("#dateSetting").checked=!!prefs.date;
  $("#focusSetting").checked=document.body.classList.contains("focus");
  updateHeader();updateStats();
}
function renderDoc(id) {
  if(currentId && activeDoc()) saveCurrent();
  const d=docs.find(x=>x.id===id);if(!d)return;
  currentId=id;
  title.value=d.title||"";
  editor.innerHTML=d.html||"";
  updateHeader();updateStats();
  $("#saveStatus").textContent="Saved locally";
  lastSavedSignature=signature();
  title.style.height="auto";
  title.style.height=title.scrollHeight+"px";
  closeMenus();
}
function createNote(content="") {
  saveCurrent();
  const d={id:uid(),title:"",html:content,created:Date.now(),updated:Date.now(),pinned:false};
  docs.unshift(d);currentId=d.id;persist();renderDoc(d.id);
  title.focus();toast("New note created");
}
function duplicateNote() {
  saveCurrent();const d=activeDoc();if(!d)return;
  const copy={...d,id:uid(),title:(d.title||"Untitled note")+" (copy)",
    created:Date.now(),updated:Date.now(),pinned:false};
  docs.unshift(copy);persist();renderDoc(copy.id);toast("Note duplicated");
}
function deleteNote() {
  const d=activeDoc();if(!d)return;
  if(!confirm('Delete "'+(d.title||"Untitled note")+'"? This cannot be undone.'))return;
  docs=docs.filter(x=>x.id!==d.id);
  if(!docs.length) {
    const fresh={id:uid(),title:"",html:"",created:Date.now(),updated:Date.now(),pinned:false};
    docs=[fresh];
  }
  currentId=docs[0].id;persist();renderDoc(currentId);toast("Note deleted");
}
function renameNote() {
  title.focus();title.select();toast("Edit the title at the top of the page");
}
function closeMenus() {
  $("#moreMenu").hidden=true;$("#slashMenu").hidden=true;
}
function showMenu(el,anchor) {
  closeMenus();
  const r=anchor.getBoundingClientRect();
  el.hidden=false;
  const w=el.offsetWidth,h=el.offsetHeight;
  let left=Math.min(r.left,innerWidth-w-10);
  let top=r.bottom+6;
  if(top+h>innerHeight-10)top=Math.max(10,r.top-h-6);
  el.style.left=Math.max(10,left)+"px";el.style.top=top+"px";
}
function insertHTML(html) {
  editor.focus();
  const sel=getSelection();
  if(sel && sel.rangeCount) {
    const range=sel.getRangeAt(0);
    range.deleteContents();
    const temp=document.createElement("div");temp.innerHTML=html;
    const frag=document.createDocumentFragment();
    let node,last;
    while((node=temp.firstChild)){last=frag.appendChild(node);}
    range.insertNode(frag);
    if(last) {
      const r=document.createRange();r.setStartAfter(last);r.collapse(true);
      sel.removeAllRanges();sel.addRange(r);
    }
  } else {
    editor.insertAdjacentHTML("beforeend",html);
  }
  queueSave();updateStats();
}
function command(cmd,value=null) {
  editor.focus();
  try {document.execCommand(cmd,false,value);} catch {}
  queueSave();updateStats();
}
function insertChecklist() {
  insertHTML('<ul class="checklist"><li class="check-item"><input class="task-check" type="checkbox" aria-label="Complete task"><div class="check-text" contenteditable="true">New task</div></li></ul><p><br></p>');
  const items=$$(".check-text");const last=items[items.length-1];
  if(last){const r=document.createRange();r.selectNodeContents(last);const s=getSelection();s.removeAllRanges();s.addRange(r);}
}
function insertBlock(type) {
  const blocks={
    p:"<p><br></p>",h1:"<h1>Heading</h1><p><br></p>",
    h2:"<h2>Heading</h2><p><br></p>",
    ul:"<ul><li>List item</li></ul><p><br></p>",
    ol:"<ol><li>List item</li></ol><p><br></p>",
    check:'<ul class="checklist"><li class="check-item"><input class="task-check" type="checkbox" aria-label="Complete task"><div class="check-text" contenteditable="true">New task</div></li></ul><p><br></p>',
    quote:"<blockquote>A thought worth keeping.</blockquote><p><br></p>",
    hr:"<hr><p><br></p>",code:"<pre><br></pre><p><br></p>"
  };
  insertHTML(blocks[type]||blocks.p);
  if(type==="check"){
    const el=$$(".check-text").at(-1);
    if(el){const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);}
  } else {
    const last=editor.lastElementChild;
    if(last && ["H1","H2","LI","BLOCKQUOTE","PRE"].includes(last.tagName)){
      const r=document.createRange();r.selectNodeContents(last);
      const s=getSelection();s.removeAllRanges();s.addRange(r);
    }
  }
  closeMenus();
}
function toMarkdown(root) {
  function convert(node) {
    if(node.nodeType===3)return node.nodeValue;
    if(node.nodeType!==1)return "";
    const tag=node.tagName, inner=()=>[...node.childNodes].map(convert).join("");
    if(tag==="BR")return "\n";
    if(tag==="HR")return "\n---\n\n";
    if(tag==="INPUT" && node.type==="checkbox")return node.checked?"[x] ":"[ ] ";
    let c=inner();
    if(tag==="STRONG"||tag==="B")return "**"+c+"**";
    if(tag==="EM"||tag==="I")return "*"+c+"*";
    if(tag==="S"||tag==="DEL")return "~~"+c+"~~";
    if(tag==="CODE")return "`"+c+"`";
    if(tag==="PRE")return "\n```\n"+node.innerText+"\n```\n\n";
    if(tag==="A")return "["+c+"]("+node.getAttribute("href")+")";
    if(tag==="H1")return "# "+c+"\n\n";
    if(tag==="H2")return "## "+c+"\n\n";
    if(tag==="H3")return "### "+c+"\n\n";
    if(tag==="BLOCKQUOTE")return c.split("\n").map(x=>x?"> "+x:x).join("\n")+"\n\n";
    if(tag==="LI") {
      const parent=node.parentElement;
      const prefix=parent?.classList.contains("checklist")?"- ":
        parent?.tagName==="OL"?"1. ":"- ";
      return prefix+c.trim()+"\n";
    }
    if(tag==="UL"||tag==="OL")return c+"\n";
    if(tag==="P"||tag==="DIV")return c+"\n\n";
    return c;
  }
  return [...root.childNodes].map(convert).join("").replace(/\n{3,}/g,"\n\n").trim();
}
function download(name,data,type) {
  const blob=new Blob([data],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function filename() {
  return (title.value.trim()||"untitled-note").replace(/[\\/:*?"<>|]/g,"-").slice(0,100);
}
function exportAs(format) {
  saveCurrent();const d=activeDoc();if(!d)return;
  let content,type,ext;
  if(format==="md"){content=(d.title?"# "+d.title+"\n\n":"")+toMarkdown(editor);type="text/markdown;charset=utf-8";ext="md";}
  else if(format==="txt"){content=(d.title?d.title+"\n\n":"")+plainText(editor.innerHTML);type="text/plain;charset=utf-8";ext="txt";}
  else {
    content='<!doctype html><html><head><meta charset="utf-8"><title>'+
      escapeHTML(d.title||"Untitled note")+'</title><style>body{max-width:720px;margin:60px auto;padding:0 24px;font:17px/1.8 Georgia,serif;color:#252722}h1,h2,h3{font-family:Arial,sans-serif}.checklist{list-style:none;padding:0}.check-item{display:flex;gap:10px;margin:.6em 0}.task-check{margin-top:.5em}</style></head><body><h1>'+
      escapeHTML(d.title||"Untitled note")+'</h1>'+editor.innerHTML+'</body></html>';
    type="text/html;charset=utf-8";ext="html";
  }
  download(filename()+"."+ext,content,type);toast("Exported "+ext.toUpperCase());
}
function openSearch() {
  closeMenus();$("#searchOverlay").hidden=false;
  $("#searchInput").value="";renderSearchResults("");$("#searchInput").focus();
}
function renderSearchResults(query) {
  const q=query.toLowerCase().trim();
  searchMatches=docs.filter(d=>(d.title+" "+plainText(d.html||"")).toLowerCase().includes(q))
    .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated);
  searchIndex=0;
  const box=$("#searchResults");box.innerHTML="";
  if(!searchMatches.length){box.innerHTML='<div class="empty">No notes found. Try another search.</div>';return;}
  searchMatches.forEach((d,i)=>{
    const btn=document.createElement("button");btn.className="result"+(i===0?" active":"");
    btn.innerHTML=icons.note+'<div class="result-copy"><div class="result-title">'+
      escapeHTML(d.title||"Untitled note")+'</div><div class="result-sub">'+
      escapeHTML(plainText(d.html||"").slice(0,85)||"Empty note")+
      ' · '+stamp(d.updated)+'</div></div>'+(d.pinned?icons.pin:"");
    btn.addEventListener("click",()=>openDocFromSearch(d.id));
    box.appendChild(btn);
  });
}
function openDocFromSearch(id) {
  $("#searchOverlay").hidden=true;renderDoc(id);editor.focus();
}
function moveSearch(direction) {
  if(!searchMatches.length)return;
  searchIndex=(searchIndex+direction+searchMatches.length)%searchMatches.length;
  $$(".result").forEach((el,i)=>el.classList.toggle("active",i===searchIndex));
  $$(".result")[searchIndex]?.scrollIntoView({block:"nearest"});
}
function openSettings() {
  $("#settingsOverlay").hidden=false;
  $("#themeSetting").value=prefs.theme;
  $("#widthSetting").value=String(prefs.width);
  $("#sizeSetting").value=String(prefs.size);
  $("#countSetting").checked=!!prefs.count;
  $("#dateSetting").checked=!!prefs.date;
  $("#focusSetting").checked=document.body.classList.contains("focus");
}
function importFile(file) {
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    const text=String(reader.result||"");
    const isMarkdown=/\.md(?:own)?$/i.test(file.name);
    const html=isMarkdown?markdownToHTML(text):"<p>"+text.split(/\n{2,}/).map(escapeHTML).join("</p><p>")+"</p>";
    createNote(html);
    const d=activeDoc();
    d.title=file.name.replace(/\.(txt|md|markdown)$/i,"");
    title.value=d.title;editor.innerHTML=html;
    saveCurrent();toast("Imported "+file.name);
  };
  reader.onerror=()=>toast("Couldn't read that file");
  reader.readAsText(file);
}
function markdownToHTML(md) {
  // A deliberately small Markdown importer. Raw HTML is always escaped.
  let text=escapeHTML(md.replace(/\r/g,""));
  const blocks=text.split(/\n{2,}/);
  return blocks.map(block=>{
    if(/^---+$/.test(block.trim()))return "<hr>";
    if(/^```/.test(block))return "<pre>"+block.replace(/^```[^\n]*\n?/,"").replace(/\n?```$/,"")+"</pre>";
    const h=block.match(/^(#{1,3})\s+([\s\S]*)$/);
    if(h)return "<h"+h[1].length+">"+inlineMD(h[2])+"</h"+h[1].length+">";
    if(/^>\s?/.test(block))return "<blockquote>"+inlineMD(block.replace(/^>\s?/gm,""))+"</blockquote>";
    if(/^(?:-|\*)\s/m.test(block)){
      return "<ul>"+block.split("\n").map(line=>line.match(/^(?:-|\*)\s(.*)$/))
        .filter(Boolean).map(m=>"<li>"+inlineMD(m[1])+"</li>").join("")+"</ul>";
    }
    if(/^\d+\.\s/m.test(block)){
      return "<ol>"+block.split("\n").map(line=>line.match(/^\d+\.\s(.*)$/))
        .filter(Boolean).map(m=>"<li>"+inlineMD(m[1])+"</li>").join("")+"</ol>";
    }
    return "<p>"+inlineMD(block.replace(/\n/g,"<br>"))+"</p>";
  }).join("");
}
function inlineMD(s) {
  return s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/~~(.+?)~~/g,"<s>$1</s>")
    .replace(/`(.+?)`/g,"<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Formatting controls
$$("[data-cmd]").forEach(btn=>btn.addEventListener("mousedown",e=>e.preventDefault()));
$$("[data-cmd]").forEach(btn=>btn.addEventListener("click",()=>command(btn.dataset.cmd)));
$("#blockFormat").addEventListener("change",e=>command("formatBlock",e.target.value));
$("#bulletList").addEventListener("click",()=>command("insertUnorderedList"));
$("#numberList").addEventListener("click",()=>command("insertOrderedList"));
$("#checkList").addEventListener("click",insertChecklist);
$("#quoteBtn").addEventListener("click",()=>command("formatBlock","blockquote"));
$("#linkBtn").addEventListener("click",()=>{
  const url=prompt("Enter a web address (https://…):");
  if(!url)return;
  try {
    const parsed=new URL(url);
    if(!["http:","https:","mailto:"].includes(parsed.protocol))throw Error();
    command("createLink",parsed.href);
    $$("#editor a").forEach(a=>{a.target="_blank";a.rel="noopener noreferrer";});
    queueSave();
  } catch {toast("Enter a valid http or https address");}
});
$("#newNote").addEventListener("click",()=>createNote());
$("#pinNote").addEventListener("click",()=>{
  const d=activeDoc();if(!d)return;d.pinned=!d.pinned;saveCurrent();
  updateHeader();persist();toast(d.pinned?"Note pinned":"Note unpinned");
});
$("#moreOpen").addEventListener("click",()=>{
  const menu=$("#moreMenu");
  if(!menu.hidden){menu.hidden=true;return;}
  showMenu(menu,$("#moreOpen"));
});
$("#moreMenu").addEventListener("click",e=>{
  const btn=e.target.closest("[data-action]");if(!btn)return;
  const action=btn.dataset.action;closeMenus();
  ({
    search:openSearch,new:()=>createNote(),duplicate:duplicateNote,
    rename:renameNote,export:()=>showMenu($("#exportMenu")||$("#moreMenu"),$("#exportBtn")),
    import:()=>$("#fileInput").click(),print:()=>window.print(),
    theme:()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"),
    settings:openSettings,delete:deleteNote
  })[action]?.();
});
$("#exportBtn").addEventListener("click",e=>showMenu($("#exportMenu")||$("#moreMenu"),e.currentTarget));
// Keep export options in the shared action menu without a second toolbar.
$("#moreMenu").insertAdjacentHTML("beforeend",
  '<div class="menu-sep"></div><button data-action="export-md">Export as Markdown (.md)</button><button data-action="export-txt">Export as text (.txt)</button><button data-action="export-html">Export as HTML (.html)</button>');
$("#moreMenu").addEventListener("click",e=>{
  const b=e.target.closest("[data-action]");if(!b)return;
  if(b.dataset.action==="export-md")exportAs("md");
  if(b.dataset.action==="export-txt")exportAs("txt");
  if(b.dataset.action==="export-html")exportAs("html");
});
$("#searchOpen").addEventListener("click",openSearch);
$("#searchInput").addEventListener("input",e=>renderSearchResults(e.target.value));
$("#searchInput").addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();moveSearch(1);}
  if(e.key==="ArrowUp"){e.preventDefault();moveSearch(-1);}
  if(e.key==="Enter"&&searchMatches[searchIndex])openDocFromSearch(searchMatches[searchIndex].id);
});
$("#searchOverlay").addEventListener("mousedown",e=>{
  if(e.target===$("#searchOverlay"))$("#searchOverlay").hidden=true;
});
$("#settingsOpen").addEventListener("click",openSettings);
$("#settingsClose").addEventListener("click",()=>$("#settingsOverlay").hidden=true);
$("#settingsOverlay").addEventListener("mousedown",e=>{
  if(e.target===$("#settingsOverlay"))$("#settingsOverlay").hidden=true;
});
$("#themeSetting").addEventListener("change",e=>{setTheme(e.target.value);});
$("#widthSetting").addEventListener("change",e=>{
  prefs.width=Number(e.target.value);applyPrefs();localStorage.setItem(PREFS,JSON.stringify(prefs));
});
$("#sizeSetting").addEventListener("change",e=>{
  prefs.size=Number(e.target.value);applyPrefs();localStorage.setItem(PREFS,JSON.stringify(prefs));
});
$("#countSetting").addEventListener("change",e=>{
  prefs.count=e.target.checked;applyPrefs();localStorage.setItem(PREFS,JSON.stringify(prefs));
});
$("#dateSetting").addEventListener("change",e=>{
  prefs.date=e.target.checked;applyPrefs();localStorage.setItem(PREFS,JSON.stringify(prefs));
});
$("#focusSetting").addEventListener("change",e=>{
  document.body.classList.toggle("focus",e.target.checked);
  localStorage.setItem(PREFS,JSON.stringify({...prefs,focus:e.target.checked}));
});
$("#focusBtn").addEventListener("click",()=>{
  document.body.classList.toggle("focus");
  $("#focusSetting").checked=document.body.classList.contains("focus");
  toast(document.body.classList.contains("focus")?"Focus mode on":"Focus mode off");
});
$("#fileInput").addEventListener("change",e=>{
  importFile(e.target.files?.[0]);e.target.value="";
});

// Title and document edits
title.addEventListener("input",()=>{
  title.style.height="auto";title.style.height=title.scrollHeight+"px";
  $("#topDocName").textContent=title.value||"Untitled note";
  queueSave();
});
editor.addEventListener("input",()=>{
  queueSave();updateStats();
  const sel=getSelection();
  if(!sel||!sel.rangeCount)return;
  const node=sel.anchorNode;
  if(!node||!editor.contains(node))return;
  const text=node.nodeType===3?node.nodeValue:"";
  const before=text.slice(0,sel.anchorOffset);
  if(before.endsWith("/") && !before.slice(0,-1).includes(" ")) {
    const range=sel.getRangeAt(0).cloneRange();range.setStart(range.startContainer,range.startOffset-1);
    slashRange=range.cloneRange();
    showMenu($("#slashMenu"),{getBoundingClientRect:()=> {
      const r=range.getBoundingClientRect();
      return {left:r.left,top:r.top,bottom:r.bottom,right:r.right,width:0,height:r.height};
    }});
  }
});
editor.addEventListener("change",queueSave);
editor.addEventListener("click",e=>{
  if(e.target.matches(".task-check")){queueSave();updateStats();}
});
editor.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeMenus();return;}
  if(e.key==="/" && !e.ctrlKey && !e.metaKey)return;
  if(e.key==="Enter" && !e.shiftKey) {
    const sel=getSelection();
    const node=sel?.anchorNode;
    if(node && editor.contains(node)) {
      const block=node.nodeType===1?node:node.parentElement;
      if(block?.closest(".check-text")) {
        e.preventDefault();
        const current=block.closest(".check-item");
        const text=current.querySelector(".check-text").innerText.trim();
        if(!text) {
          current.remove();
          if(!editor.querySelector(".check-item"))editor.querySelector(".checklist")?.remove();
          insertHTML("<p><br></p>");
        } else {
          const li=document.createElement("li");li.className="check-item";
          li.innerHTML='<input class="task-check" type="checkbox" aria-label="Complete task"><div class="check-text" contenteditable="true"><br></div>';
          current.after(li);
          const r=document.createRange();r.selectNodeContents(li.querySelector(".check-text"));
          const s=getSelection();s.removeAllRanges();s.addRange(r);
        }
        queueSave();return;
      }
    }
  }
});
$("#slashMenu").addEventListener("click",e=>{
  const btn=e.target.closest("[data-insert]");if(!btn)return;
  if(slashRange) {
    const sel=getSelection();sel.removeAllRanges();sel.addRange(slashRange);
    sel.getRangeAt(0).deleteContents();
  }
  insertBlock(btn.dataset.insert);slashRange=null;
});
document.addEventListener("mousedown",e=>{
  if(!e.target.closest("#moreMenu,#moreOpen,#slashMenu"))closeMenus();
});
document.addEventListener("keydown",e=>{
  const mod=e.metaKey||e.ctrlKey;
  if(e.key==="Escape") {
    $("#searchOverlay").hidden=true;$("#settingsOverlay").hidden=true;closeMenus();
  }
  if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();openSearch();}
  if(mod&&e.key.toLowerCase()==="n"){e.preventDefault();createNote();}
  if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();saveCurrent();toast("Saved locally");}
  if(mod&&e.key.toLowerCase()==="p"&&document.activeElement!==title) {
    // Preserve the browser's native print shortcut.
  }
  if(mod&&e.shiftKey&&e.key.toLowerCase()==="x"){e.preventDefault();insertChecklist();}
});
window.addEventListener("storage",e=>{
  if(e.key===STORAGE)toast("Notes changed in another tab. Reload to see updates.");
});
window.addEventListener("beforeunload",()=>{clearTimeout(saveTimer);saveCurrent();});

// Initialize
prefs=getPrefs();
loadDocs();
applyPrefs();
if(prefs.focus)document.body.classList.add("focus");
renderDoc(currentId);
})();
