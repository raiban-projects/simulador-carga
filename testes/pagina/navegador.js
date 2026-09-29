// monta a página num navegador simulado (jsdom) com workers e banco falsos
const fs=require('fs'); const vm=require('vm'); const {JSDOM}=require('jsdom');
// Abre o index.html num navegador simulado (jsdom), com workers e banco Supabase falsos.
module.exports=function(file){
  let html=fs.readFileSync(file,'utf8').replace(/<script src=[^>]+><\/script>/g,'');
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.github.io/'});
  const w=dom.window; const THREE=require('three');
  class FR{constructor(){this.domElement=w.document.createElement('canvas');} setSize(){} setPixelRatio(){} render(){} setClearColor(){}}
  w.THREE=Object.assign({},THREE,{WebGLRenderer:FR});
  w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({measureText:()=>({width:10})},{get:(t,k)=>k in t?t[k]:(()=>{}),set:()=>true});};
  const DB={modelos_carga:[],cargas:[],produtos:[],unidades:[]};
  function q(t){ const api={ select(){return api;}, order(){ return Promise.resolve({data:DB[t].slice(),error:null}); }, eq(){return Promise.resolve({data:[],error:null});}, ilike(){return {limit:()=>Promise.resolve({data:[],error:null})};},
    insert(o){ DB[t].push({id:DB[t].length+1,created_at:new Date().toISOString(),...JSON.parse(JSON.stringify(o))}); return Promise.resolve({error:null}); },
    delete(){ return {eq:(k,v)=>{ DB[t]=DB[t].filter(r=>r[k]!==v); return Promise.resolve({error:null}); }}; } }; return api; }
  w.supabase={createClient:()=>({from:q})};
  w.requestAnimationFrame=()=>0; w.alert=m=>console.log('   [aviso]',m); w.confirm=()=>true; w.performance=require('perf_hooks').performance;
  w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
  Object.defineProperty(w.navigator,'hardwareConcurrency',{value:4});
  const blobs=new Map(); let bid=0;
  w.URL.createObjectURL=(b)=>{ const id='blob:'+(++bid); blobs.set(id,b.__src); return id; };
  const RB=w.Blob; w.Blob=function(parts,opts){ const b=new RB(parts,opts); b.__src=parts.join(''); return b; };
  w.Worker=class{ constructor(url){ const me=this; this.dead=false;
      const ctx={ self:null, performance:w.performance, console, Math, JSON, Object, Array, Set, Map, Date };
      ctx.self={ postMessage:(d)=>{ const c=structuredClone(d); setTimeout(()=>{ if(!me.dead && me.onmessage) me.onmessage({data:c}); },0); } };
      vm.createContext(ctx); vm.runInContext(blobs.get(url)+'\n;self.__on=self.onmessage;', ctx); this.ctx=ctx; }
    postMessage(d){ const c=structuredClone(d); setTimeout(()=>{ try{ this.ctx.self.__on({data:c}); }catch(e){ console.log('WORKER ERR',e.message); } },5); }
    terminate(){ this.dead=true; } };
  const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
  w.eval(scripts.join('\n;\n')+"\n;window.__q=(c)=>eval(c);");
  const Q=w.__q, d=w.document;
  function cards(lista){ Q("cardsEl.innerHTML=''"); lista.forEach(([n,l,wd,h,qt,ent,modo,base])=>{ Q("addCard()"); const c=[...d.querySelectorAll('.card')].pop();
    const set=(k,v)=>{ c.querySelector(k).value=v; }; base = base==null?100:base; set('.f-name',n); set('.f-sl',l); set('.f-sw',wd); set('.f-st',1); set('.f-base',base); set('.f-spp',h-base); set('.f-qty',qt); set('.f-entrega',ent||1); set('.f-mode',modo||'auto'); }); }
  return { w, Q, d, DB, cards };
};
