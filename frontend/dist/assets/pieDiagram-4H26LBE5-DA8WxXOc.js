import{t as e}from"./arc-DKxQJp97.js";import{i as t,p as n}from"./chunk-5ZQYHXKU-r-DI-0nk.js";import{$ as r,Q as i,R as a,y as o}from"./index-BwTGRUzq.js";import{t as s}from"./mermaid-parser.core-kCu8RB9P.js";import{n as c,r as l}from"./src-Dh6WoYSh.js";import{H as u,K as d,U as f,a as p,c as m,f as h,v as g,w as _,x as v,y}from"./chunk-CSCIHK7Q-CxFkcrNr.js";import{t as b}from"./chunk-WU5MYG2G-DBDbPFBm.js";import{t as x}from"./chunk-4BX2VUAB-n8RIsJLY.js";function S(e,t){return t<e?-1:t>e?1:t>=e?0:NaN}function C(e){return e}function w(){var e=C,t=S,n=null,o=r(0),s=r(i),c=r(0);function l(r){var l,u=(r=a(r)).length,d,f,p=0,m=Array(u),h=Array(u),g=+o.apply(this,arguments),_=Math.min(i,Math.max(-i,s.apply(this,arguments)-g)),v,y=Math.min(Math.abs(_)/u,c.apply(this,arguments)),b=y*(_<0?-1:1),x;for(l=0;l<u;++l)(x=h[m[l]=l]=+e(r[l],l,r))>0&&(p+=x);for(t==null?n!=null&&m.sort(function(e,t){return n(r[e],r[t])}):m.sort(function(e,n){return t(h[e],h[n])}),l=0,f=p?(_-u*b)/p:0;l<u;++l,g=v)d=m[l],x=h[d],v=g+(x>0?x*f:0)+b,h[d]={data:r[d],index:l,value:x,startAngle:g,endAngle:v,padAngle:y};return h}return l.value=function(t){return arguments.length?(e=typeof t==`function`?t:r(+t),l):e},l.sortValues=function(e){return arguments.length?(t=e,n=null,l):t},l.sort=function(e){return arguments.length?(n=e,t=null,l):n},l.startAngle=function(e){return arguments.length?(o=typeof e==`function`?e:r(+e),l):o},l.endAngle=function(e){return arguments.length?(s=typeof e==`function`?e:r(+e),l):s},l.padAngle=function(e){return arguments.length?(c=typeof e==`function`?e:r(+e),l):c},l}var T=h.pie,E={sections:new Map,showData:!1,config:T},D=E.sections,O=E.showData,k=structuredClone(T),A={getConfig:c(()=>structuredClone(k),`getConfig`),clear:c(()=>{D=new Map,O=E.showData,p()},`clear`),setDiagramTitle:d,getDiagramTitle:_,setAccTitle:f,getAccTitle:y,setAccDescription:u,getAccDescription:g,addSection:c(({label:e,value:t})=>{if(t<0)throw Error(`"${e}" has invalid value: ${t}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);D.has(e)||(D.set(e,t),l.debug(`added new section: ${e}, with value: ${t}`))},`addSection`),getSections:c(()=>D,`getSections`),setShowData:c(e=>{O=e},`setShowData`),getShowData:c(()=>O,`getShowData`)},j=c((e,t)=>{x(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},`populateDb`),M={parse:c(async e=>{let t=await s(`pie`,e);l.debug(t),j(t,A)},`parse`)},N=c(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,`getStyles`),P=c(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),n=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return w().value(e=>e.value).sort(null)(n)},`createPieArcs`),F={parser:M,db:A,renderer:{draw:c((r,i,a,s)=>{l.debug(`rendering pie chart
`+r);let c=s.db,u=v(),d=t(c.getConfig(),u.pie),f=b(i),p=f.append(`g`);p.attr(`transform`,`translate(225,225)`);let{themeVariables:h}=u,[g]=n(h.pieOuterStrokeWidth);g??=2;let _=d.textPosition,y=e().innerRadius(0).outerRadius(185),x=e().innerRadius(185*_).outerRadius(185*_);p.append(`circle`).attr(`cx`,0).attr(`cy`,0).attr(`r`,185+g/2).attr(`class`,`pieOuterCircle`);let S=c.getSections(),C=P(S),w=[h.pie1,h.pie2,h.pie3,h.pie4,h.pie5,h.pie6,h.pie7,h.pie8,h.pie9,h.pie10,h.pie11,h.pie12],T=0;S.forEach(e=>{T+=e});let E=C.filter(e=>(e.data.value/T*100).toFixed(0)!==`0`),D=o(w).domain([...S.keys()]);p.selectAll(`mySlices`).data(E).enter().append(`path`).attr(`d`,y).attr(`fill`,e=>D(e.data.label)).attr(`class`,`pieCircle`),p.selectAll(`mySlices`).data(E).enter().append(`text`).text(e=>(e.data.value/T*100).toFixed(0)+`%`).attr(`transform`,e=>`translate(`+x.centroid(e)+`)`).style(`text-anchor`,`middle`).attr(`class`,`slice`);let O=p.append(`text`).text(c.getDiagramTitle()).attr(`x`,0).attr(`y`,-400/2).attr(`class`,`pieTitleText`),k=[...S.entries()].map(([e,t])=>({label:e,value:t})),A=p.selectAll(`.legend`).data(k).enter().append(`g`).attr(`class`,`legend`).attr(`transform`,(e,t)=>{let n=22*k.length/2;return`translate(216,`+(t*22-n)+`)`});A.append(`rect`).attr(`width`,18).attr(`height`,18).style(`fill`,e=>D(e.label)).style(`stroke`,e=>D(e.label)),A.append(`text`).attr(`x`,22).attr(`y`,14).text(e=>c.getShowData()?`${e.label} [${e.value}]`:e.label);let j=512+Math.max(...A.selectAll(`text`).nodes().map(e=>e?.getBoundingClientRect().width??0)),M=O.node()?.getBoundingClientRect().width??0,N=450/2-M/2,F=450/2+M/2,I=Math.min(0,N),L=Math.max(j,F)-I;f.attr(`viewBox`,`${I} 0 ${L} 450`),m(f,450,L,d.useMaxWidth)},`draw`)},styles:N};export{F as diagram};