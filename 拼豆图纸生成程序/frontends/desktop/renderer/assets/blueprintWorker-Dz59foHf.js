function L(t,o){return t?.code?.trim()||`#${o+1}`}function F(t,o,f,m,l,p){const r=Math.max(8,l-2);let x=Math.min(l*.42,Math.max(6,l*.34));const c=()=>`${x.toFixed(2)}px 'SF Mono','Consolas',monospace`;for(t.fillStyle=p,t.textAlign="center",t.textBaseline="middle",t.font=c();x>5&&t.measureText(o).width>r;)x-=.25,t.font=c();t.measureText(o).width>r+1||t.fillText(o,f,m)}function U(t){return[parseInt(t.slice(1,3),16),parseInt(t.slice(3,5),16),parseInt(t.slice(5,7),16)]}function W(t,o){if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(t,o);const f=document.createElement("canvas");return f.width=t,f.height=o,f}function j(t,o,f){return"convertToBlob"in t?t.convertToBlob({type:o,quality:f}):new Promise((m,l)=>{t.toBlob(p=>p?m(p):l(new Error("toBlob failed")),o,f)})}async function X(t){const o=await j(t,"image/jpeg",.92),f=new Uint8Array(await o.arrayBuffer()),m=Math.max(1,Math.round(t.width*72/150)),l=Math.max(1,Math.round(t.height*72/150)),p=new TextEncoder,r=[],x=new Array(6).fill(0),c=i=>{r.push(typeof i=="string"?p.encode(i):i)},s=()=>r.reduce((i,P)=>i+P.length,0),u=i=>{x[i]=s(),c(`${i} 0 obj
`)};c(`%PDF-1.4
%âãÏÓ
`),u(1),c(`<< /Type /Catalog /Pages 2 0 R >>
endobj
`),u(2),c(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
`),u(3),c(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${m} ${l}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>
endobj
`),u(4),c(`<< /Type /XObject /Subtype /Image /Width ${t.width} /Height ${t.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${f.length} >>
stream
`),c(f),c(`
endstream
endobj
`);const g=`q
${m} 0 0 ${l} 0 0 cm
/Im1 Do
Q
`;u(5),c(`<< /Length ${p.encode(g).length} >>
stream
${g}endstream
endobj
`);const h=s();c(`xref
0 6
0000000000 65535 f 
`);for(let i=1;i<=5;i++)c(`${String(x[i]).padStart(10,"0")} 00000 n 
`);c(`trailer
<< /Size 6 /Root 1 0 R >>
startxref
${h}
%%EOF
`);const y=new Uint8Array(s());let M=0;for(const i of r)y.set(i,M),M+=i.length;return new Blob([y],{type:"application/pdf"})}function G(t,o,f,m,l,p,r){const g=t*r,h=o*r,y=g+28+16*2,M=m.map((e,a)=>({...e,count:l[a]||0})).filter(e=>e.count>0).sort((e,a)=>{const d=parseInt((e.code||"0").replace(/\D/g,""))||0,$=parseInt((a.code||"0").replace(/\D/g,""))||0;return d-$||e.code.localeCompare(a.code)}),i=Math.max(1,Math.floor((y-16*2)/160)),P=30+Math.ceil(M.length/i)*18+8,b=h+18+30+P+16*2,k=W(y,b),n=k.getContext("2d");if(!n)throw new Error("无法创建画布");n.fillStyle="#fff",n.fillRect(0,0,y,b);const C=44,T=64;n.fillStyle="#e8e8e8",n.fillRect(C-2,T-2,g+4,h+4),n.fillStyle="#333",n.font="bold 13px sans-serif",n.textAlign="center",n.fillText("Perler Bead Blueprint",y/2,30),n.fillStyle="#888",n.font="10px sans-serif",n.fillText(`${t}×${o}  |  ${p}  |  ${f.length} beads`,y/2,42);function A(e){let a="";for(;e>=0;)a=String.fromCharCode(65+e%26)+a,e=Math.floor(e/26)-1;return a}n.fillStyle="#666",n.font="9px sans-serif",n.textAlign="center";for(let e=0;e<t;e++)n.fillText(A(e),C+e*r+r/2,T-5);n.textAlign="right";for(let e=0;e<o;e++)n.fillText(String(e+1),C-5,T+e*r+r/2+3);const R=Math.max(1,Math.floor(r/12));for(let e=0;e<o;e++)for(let a=0;a<t;a++){const d=f[e*t+a];if(d<0||d>=m.length)continue;const $=C+a*r,w=T+e*r,B=m[d].hex;if(n.fillStyle=B,n.fillRect($+R,w+R,r-R*2,r-R*2),r>=14){const[E,I,O]=U(B),D=.299*E+.587*I+.114*O>140?"#000":"#fff";F(n,L(m[d],d),$+r/2,w+r/2,r,D)}}n.strokeStyle="#c0c0c0",n.lineWidth=.5;for(let e=0;e<=o;e++){const a=T+e*r;n.beginPath(),n.moveTo(C,a),n.lineTo(C+g,a),n.stroke()}for(let e=0;e<=t;e++){const a=C+e*r;n.beginPath(),n.moveTo(a,T),n.lineTo(a,T+h),n.stroke()}const H=T+h+16;return n.fillStyle="#333",n.font="bold 11px sans-serif",n.textAlign="left",n.fillText("Color Legend",16,H),M.forEach((e,a)=>{const d=a%i,$=Math.floor(a/i),w=16+d*160,B=H+14+$*18;n.fillStyle=e.hex,n.fillRect(w,B+1,14,14),n.strokeStyle="#999",n.lineWidth=1,n.strokeRect(w,B+1,14,14),n.fillStyle="#333",n.font="10px sans-serif",n.textAlign="left",n.fillText(`${e.code} x${e.count}`,w+18,B+11)}),k}function K(t,o,f,m,l){const r=t*l+32,x=o*l+16*2,c=W(r,x),s=c.getContext("2d");if(!s)throw new Error("无法创建画布");s.fillStyle="#fff",s.fillRect(0,0,r,x),s.fillStyle="#e8e8e8",s.fillRect(14,14,t*l+4,o*l+4);const u=Math.max(1,Math.floor(l/12));for(let g=0;g<o;g++)for(let h=0;h<t;h++){const y=f[g*t+h];if(y<0||y>=m.length)continue;const M=16+h*l,i=16+g*l;s.fillStyle=m[y].hex,s.fillRect(M+u,i+u,l-u*2,l-u*2)}s.strokeStyle="#c0c0c0",s.lineWidth=.5;for(let g=0;g<=o;g++){const h=16+g*l;s.beginPath(),s.moveTo(16,h),s.lineTo(16+t*l,h),s.stroke()}for(let g=0;g<=t;g++){const h=16+g*l;s.beginPath(),s.moveTo(h,16),s.lineTo(h,16+o*l),s.stroke()}return c}async function Q(t){const{format:o,gw:f,gh:m,indices:l,colors:p,counts:r,paletteBrand:x,beadSize:c}=t;if(o==="sub"){const u=K(f,m,l,p,c);return j(u,"image/png")}const s=G(f,m,l,p,r,x,c);return o==="pdf"?X(s):j(s,"image/png")}const v=self;v.onmessage=async t=>{try{const o=await Q(t.data);v.postMessage({ok:!0,blob:o})}catch(o){v.postMessage({ok:!1,error:o instanceof Error?o.message:String(o)})}};
//# sourceMappingURL=blueprintWorker-Dz59foHf.js.map
