import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { saveAs } from 'file-saver';
import { encodeSharePayload } from '../engine/shareUtils';
import { buildShareUrl } from '../engine/projectIO';
import { trackEvent } from '../engine/analyticsService';

/**
 * Build a fully self-contained HTML file that renders the bead grid.
 * No server needed — just open the file in any browser.
 */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function safeHex(hex: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#000000';
}

function buildOfflineViewer(
  gridWidth: number,
  gridHeight: number,
  indices: number[],
  palette: { brand: string; colors: { name: string; code: string; hex: string }[] }
): string {
  const projectData = {
    gw: gridWidth,
    gh: gridHeight,
    pb: escapeHtml(palette.brand || '阿莉的图'),
    ph: palette.colors.map(c => safeHex(c.hex)),
    pn: palette.colors.map(c => escapeHtml(c.name || '')),
    pc: palette.colors.map(c => escapeHtml(c.code || '')),
    idx: indices,
  };

  const compressed = utf8ToBase64(JSON.stringify(projectData));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>拼豆图纸 — ${projectData.pb}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;background:#f0f2f5;min-height:100vh;display:flex;flex-direction:column}
.header{background:#fff;padding:12px 20px;border-bottom:1px solid #e2e5ea;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:16px;color:#6C5CE7}
.legend-toggle{font-size:13px;background:#6C5CE7;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer}
.main{flex:1;display:flex;gap:12px;padding:12px;overflow:hidden}
.canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;border:1px solid #e2e5ea;overflow:hidden}
canvas{max-width:100%;max-height:100%}
.legend{width:200px;background:#fff;border-radius:8px;border:1px solid #e2e5ea;overflow-y:auto;padding:10px;font-size:11px;display:none}
.legend.show{display:block}
.legend h3{font-size:11px;text-transform:uppercase;color:#666;margin-bottom:8px}
.legend-item{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f5f5f5}
.legend-swatch{width:16px;height:16px;border-radius:50%;border:1px solid #ddd;flex-shrink:0}
.legend-name{flex:1}.legend-code{color:#999;font-family:monospace;font-size:10px}.legend-count{color:#6C5CE7;font-weight:700}
.footer{background:#fff;padding:8px 20px;border-top:1px solid #e2e5ea;font-size:11px;color:#999;display:flex;justify-content:space-between}
@media(max-width:600px){.main{flex-direction:column}.legend{width:100%;max-height:150px}}
</style>
</head>
<body>
<div class="header">
  <h1>拼豆图纸 · ${projectData.pb}</h1>
  <button class="legend-toggle" onclick="document.querySelector('.legend').classList.toggle('show')">颜色图例</button>
</div>
<div class="main">
  <div class="canvas-wrap"><canvas id="c"></canvas></div>
  <div class="legend show" id="legend"></div>
</div>
<div class="footer">
  <span>${gridWidth}×${gridHeight} · ${indices.length} 颗珠子</span>
  <span>阿莉的图</span>
</div>
<script>
(function(){
var d=JSON.parse(atob('${compressed}'));
var canvas=document.getElementById('c');
var beadSize=Math.max(4,Math.floor(Math.min(window.innerWidth/d.gw,window.innerHeight/d.gh)*0.85));
canvas.width=d.gw*beadSize;canvas.height=d.gh*beadSize;
var ctx=canvas.getContext('2d');
ctx.fillStyle='#c8c8c8';ctx.fillRect(0,0,canvas.width,canvas.height);
var br=beadSize*0.42,hr=beadSize*0.15,ho=beadSize*0.14,glw=Math.max(1,beadSize/18);
ctx.strokeStyle='#a0a0a0';ctx.lineWidth=glw;
for(var gy=0;gy<=d.gh;gy++){var y=gy*beadSize;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
for(var gx=0;gx<=d.gw;gx++){var x=gx*beadSize;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
var counts=new Array(d.ph.length).fill(0);
for(var gy=0;gy<d.gh;gy++){for(var gx=0;gx<d.gw;gx++){
var idx=gy*d.gw+gx,ci=d.idx[idx];if(ci<0||ci>=d.ph.length)continue;
counts[ci]++;var cx=gx*beadSize+beadSize/2,cy=gy*beadSize+beadSize/2;
var h=d.ph[ci],rr=parseInt(h.slice(1,3),16),gg=parseInt(h.slice(3,5),16),bb=parseInt(h.slice(5,7),16);
ctx.beginPath();ctx.arc(cx,cy,br,0,Math.PI*2);ctx.fillStyle='rgb('+rr+','+gg+','+bb+')';ctx.fill();
if(beadSize>8){var g=ctx.createRadialGradient(cx,cy,br*0.65,cx,cy,br);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.15)');ctx.beginPath();ctx.arc(cx,cy,br,0,Math.PI*2);ctx.fillStyle=g;ctx.fill()}
if(beadSize>10){var hx=cx-ho,hy=cy-ho,hg=ctx.createRadialGradient(hx,hy,0,hx,hy,hr);hg.addColorStop(0,'rgba(255,255,255,0.55)');hg.addColorStop(0.6,'rgba(255,255,255,0.2)');hg.addColorStop(1,'rgba(255,255,255,0)');ctx.beginPath();ctx.arc(hx,hy,hr,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill()}
}}
var leg=document.getElementById('legend'),used=0;
leg.innerHTML='<h3>颜色图例</h3>';
for(var i=0;i<d.ph.length;i++){if(counts[i]>0){used++;
leg.innerHTML+='<div class="legend-item"><span class="legend-swatch" style="background:'+d.ph[i]+'"></span><span class="legend-name">'+d.pn[i]+'</span><span class="legend-code">'+d.pc[i]+'</span><span class="legend-count">'+counts[i]+'</span></div>';}}
document.querySelector('.legend-toggle').textContent='颜色图例 ('+used+')';
})();
</script>
</body>
</html>`;
}

const QRShareButton: React.FC = () => {
  const { beadGrid, palette, gridWidth, gridHeight } = useProjectStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateShare = useCallback(async () => {
    if (!beadGrid || !palette) return;

    // Build self-contained HTML viewer
    const html = buildOfflineViewer(
      beadGrid.gridWidth,
      beadGrid.gridHeight,
      Array.from(beadGrid.indices),
      { brand: palette.brand, colors: palette.colors }
    );

    // 二维码直接编码完整图纸数据，扫码后可还原项目。
    const code = encodeSharePayload(
      beadGrid.gridWidth,
      beadGrid.gridHeight,
      beadGrid.indices,
      palette.brand,
      palette.colors,
      useProjectStore.getState().ditherMode
    );
    setShareCode(code);
    setShareError(null);
    setCopied(false);

    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(`perler:${code}`, {
        width: 256,
        margin: 2,
        color: { dark: '#6C5CE7', light: '#FFFFFF' },
      });
      setQrDataUrl(dataUrl);
      setShowModal(true);
      trackEvent('share_qr_generated', { gridWidth, gridHeight, codeLength: code.length });
    } catch (err) {
      console.error('QR generation failed:', err);
      setQrDataUrl(null);
      setShareError('图纸数据过大，二维码放不下，请使用分享链接或离线查看器');
      setShowModal(true);
      trackEvent('share_qr_failed', { gridWidth, gridHeight });
    }
  }, [beadGrid, palette, gridWidth, gridHeight]);

  const copyShareLink = useCallback(async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(buildShareUrl(shareCode));
      setCopied(true);
      setShareError(null);
      trackEvent('share_link_copied', { gridWidth, gridHeight, codeLength: shareCode.length });
    } catch {
      setShareError('复制失败，请手动复制分享码');
    }
  }, [shareCode]);

  const saveViewer = useCallback(() => {
    if (!beadGrid || !palette) return;
    const html = buildOfflineViewer(
      beadGrid.gridWidth,
      beadGrid.gridHeight,
      Array.from(beadGrid.indices),
      { brand: palette.brand, colors: palette.colors }
    );
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    saveAs(blob, `bead-viewer-${gridWidth}x${gridHeight}.html`);
  }, [beadGrid, palette, gridWidth, gridHeight]);

  if (!beadGrid) return null;

  return (
    <div className="qr-share-section">
      <button className="btn" onClick={saveViewer}>
        📄 保存离线查看器
      </button>
      <button className="btn" onClick={generateShare}>
        📱 生成分享码
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>扫码分享图纸</h2>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="qr-image" />}
            {shareError && <p className="share-error">{shareError}</p>}
            {!shareError && <p className="hint">二维码内含完整图纸数据</p>}
            <p className="hint">{gridWidth}×{gridHeight} · {palette?.brand}</p>
            <div className="modal-actions">
              <button className="btn" onClick={copyShareLink}>
                {copied ? '已复制' : '复制分享链接'}
              </button>
              <button className="btn" onClick={() => {
                if (qrDataUrl) {
                  const link = document.createElement('a');
                  link.href = qrDataUrl;
                  link.download = `bead-qr-${gridWidth}x${gridHeight}.png`;
                  link.click();
                }
              }}>
                保存二维码
              </button>
              <button className="btn btn-primary" onClick={saveViewer}>
                保存离线查看器
              </button>
              <button className="btn" onClick={() => setShowModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRShareButton;
