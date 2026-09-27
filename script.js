(function(){
  const audioInput=document.getElementById('audioInput');
  const imageInput=document.getElementById('imageInput');
  const audioLabel=document.getElementById('audioLabel');
  const imageLabel=document.getElementById('imageLabel');
  const canvas=document.getElementById('canvas');
  const ctx=canvas.getContext('2d');
  const audioEl=document.getElementById('audioEl');
  const previewBtn=document.getElementById('previewBtn');
  const recordBtn=document.getElementById('recordBtn');
  const progressBar=document.getElementById('progressBar');
  const status=document.getElementById('status');
  const styleSelect=document.getElementById('styleSelect');
  const titleInput=document.getElementById('titleInput');
  const downloadArea=document.getElementById('downloadArea');

  let img=null, audioFile=null, audioReady=false;
  let audioCtx=null, analyser=null, srcNode=null;
  let freqLive=null, timeLive=null;
  let rafId=null;

  const RICKSHAW=['#ec4899','#fbbf24','#22c55e','#f97316','#3b82f6','#ef4444'];
  const MEDIABUNNY_CDN='https://cdn.jsdelivr.net/npm/mediabunny@1.59.0/+esm';

  // WebCodecs is what lets us render the video WITHOUT playing the full song in real time
  const canExport = !!(window.VideoEncoder && window.AudioEncoder);
  let mediabunnyPromise=null;
  function loadMediabunny(){
    if(!mediabunnyPromise) mediabunnyPromise=import(MEDIABUNNY_CDN);
    return mediabunnyPromise;
  }

  if(!canExport){
    setStatus('Video export needs Chrome or Edge (WebCodecs not available here).');
  }

  function setStatus(t){ status.textContent=t; }
  function checkReady(){
    const ready = !!img && audioReady;
    previewBtn.disabled = !ready;
    recordBtn.disabled = !ready || !canExport;
    if(ready && canExport) setStatus('Ready. Preview it, then create the video.');
  }

  imageInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const im=new Image();
    im.onload=()=>{
      img=im;
      imageLabel.classList.add('filled');
      imageLabel.querySelector('.upload-text').textContent='🖼️ '+f.name;
      checkReady();
      paintCanvas(new Uint8Array(128), new Uint8Array(128), 0, styleSelect.value, titleInput.value.trim());
    };
    im.src=url;
  });

  audioInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    audioFile=f;
    audioReady=false;
    const url=URL.createObjectURL(f);
    audioEl.src=url;
    audioEl.load();
    audioEl.oncanplaythrough=()=>{
      audioReady=true;
      audioLabel.classList.add('filled');
      audioLabel.querySelector('.upload-text').textContent='🎵 '+f.name;
      checkReady();
    };
  });

  // ---------- shared drawing (used by both live preview and offline export) ----------
  function drawBackground(bass){
    const w=canvas.width,h=canvas.height;
    if(img){
      const scale=1+(bass||0)*0.06;
      const ir=img.width/img.height, cr=w/h;
      let dw,dh;
      if(ir>cr){ dh=h*scale; dw=dh*ir; } else { dw=w*scale; dh=dw/ir; }
      const dx=(w-dw)/2, dy=(h-dh)/2;
      ctx.drawImage(img,dx,dy,dw,dh);
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,w,h);
    } else { ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h); }
  }

  function drawTitle(text){
    if(!text) return;
    const w=canvas.width,h=canvas.height;
    ctx.font='bold 34px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const tw=ctx.measureText(text).width;
    const bx=w/2-tw/2-24, by=h-78, bw=tw+48, bh=52;
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(bx,by,bw,bh,26); else ctx.rect(bx,by,bw,bh);
    ctx.fill();
    ctx.fillStyle='#ffffff';
    ctx.fillText(text, w/2, by+bh/2);
  }

  function drawRickshawBorder(){
    const w=canvas.width,h=canvas.height,r=14,step=r*2;
    for(let x=0,i=0;x<w;x+=step,i++){
      ctx.fillStyle=RICKSHAW[i%RICKSHAW.length];
      ctx.beginPath(); ctx.arc(x+r,h-r,r,Math.PI,0); ctx.fill();
    }
  }

  function paintCanvas(freqBytes, timeBytes, bass, style, title){
    drawBackground(bass);
    const w=canvas.width,h=canvas.height;
    if(style==='wave'){
      ctx.lineWidth=4; ctx.strokeStyle='#7dd3fc'; ctx.beginPath();
      const slice=w/timeBytes.length; let x=0;
      for(let i=0;i<timeBytes.length;i++){
        const v=timeBytes[i]/128.0; const y=(v*h)/2;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        x+=slice;
      }
      ctx.stroke();
    } else if(style==='circle'){
      const cx=w/2,cy=h/2;
      const baseR=Math.min(w,h)*0.18*(1+bass*0.15), n=freqBytes.length;
      for(let i=0;i<n;i++){
        const v=freqBytes[i]/255; const ang=(i/n)*Math.PI*2;
        const r1=baseR+bass*20; const r2=r1+v*Math.min(w,h)*0.25;
        const x1=cx+Math.cos(ang)*r1, y1=cy+Math.sin(ang)*r1;
        const x2=cx+Math.cos(ang)*r2, y2=cy+Math.sin(ang)*r2;
        ctx.strokeStyle=`hsl(${200+(i/n)*160},85%,65%)`; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx,cy,baseR,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=2; ctx.stroke();
    } else if(style==='rickshaw'){
      const n=freqBytes.length; const bw=w/n*1.6; let x=0;
      for(let i=0;i<n;i++){
        const v=freqBytes[i]/255; const bh=v*h*0.55*(1+bass*0.3);
        ctx.fillStyle=RICKSHAW[i%RICKSHAW.length];
        ctx.fillRect(x,h-bh,bw*0.75,bh);
        x+=bw;
      }
      drawRickshawBorder();
    } else {
      const n=freqBytes.length; const bw=w/n*1.6; let x=0;
      for(let i=0;i<n;i++){
        const v=freqBytes[i]/255; const bh=v*h*0.6*(1+bass*0.2);
        const grad=ctx.createLinearGradient(0,h-bh,0,h);
        grad.addColorStop(0,'#7dd3fc'); grad.addColorStop(1,'#f472b6');
        ctx.fillStyle=grad;
        ctx.fillRect(x,h-bh,bw*0.8,bh);
        x+=bw;
      }
    }
    drawTitle(title);
  }

  // ---------- live preview (uses AnalyserNode, real-time playback) ----------
  function setupAudioGraph(){
    if(audioCtx) return;
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    srcNode=audioCtx.createMediaElementSource(audioEl);
    analyser=audioCtx.createAnalyser();
    analyser.fftSize=256;
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    freqLive=new Uint8Array(analyser.frequencyBinCount);
    timeLive=new Uint8Array(analyser.frequencyBinCount);
  }

  function liveLoop(){
    analyser.getByteFrequencyData(freqLive);
    analyser.getByteTimeDomainData(timeLive);
    let bsum=0; for(let i=0;i<8;i++) bsum+=freqLive[i];
    const bass=(bsum/8)/255;
    paintCanvas(freqLive, timeLive, bass, styleSelect.value, titleInput.value.trim());
    if(audioEl.duration){
      progressBar.style.width=((audioEl.currentTime/audioEl.duration)*100)+'%';
    }
    if(!audioEl.paused && !audioEl.ended){ rafId=requestAnimationFrame(liveLoop); }
    else { rafId=null; }
  }

  previewBtn.addEventListener('click', async ()=>{
    setupAudioGraph();
    if(audioCtx.state==='suspended') await audioCtx.resume();
    if(audioEl.paused){
      if(audioEl.ended) audioEl.currentTime=0;
      audioEl.play();
      previewBtn.textContent='⏸ Pause';
      setStatus('Previewing…');
      if(!rafId) liveLoop();
    } else {
      audioEl.pause();
      previewBtn.textContent='▶ Preview';
    }
  });

  audioEl.addEventListener('ended', ()=>{
    setStatus('Preview finished.');
    progressBar.style.width='0%';
    previewBtn.textContent='▶ Preview';
  });

  // ---------- offline export (no real-time wait, WebCodecs + Mediabunny) ----------
  const FFT_SIZE=256;
  const HANN=(()=>{ const w=new Float32Array(FFT_SIZE); for(let i=0;i<FFT_SIZE;i++) w[i]=0.5*(1-Math.cos(2*Math.PI*i/(FFT_SIZE-1))); return w; })();

  function fft(re, im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){
      let bit=n>>1;
      for(;j&bit;bit>>=1) j^=bit;
      j^=bit;
      if(i<j){ let t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; }
    }
    for(let len=2;len<=n;len<<=1){
      const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
      for(let i=0;i<n;i+=len){
        let curWr=1,curWi=0;
        for(let j=0;j<len/2;j++){
          const ur=re[i+j], ui=im[i+j];
          const vr=re[i+j+len/2]*curWr-im[i+j+len/2]*curWi;
          const vi=re[i+j+len/2]*curWi+im[i+j+len/2]*curWr;
          re[i+j]=ur+vr; im[i+j]=ui+vi;
          re[i+j+len/2]=ur-vr; im[i+j+len/2]=ui-vi;
          const nWr=curWr*wr-curWi*wi, nWi=curWr*wi+curWi*wr;
          curWr=nWr; curWi=nWi;
        }
      }
    }
  }

  function computeFrameData(mono, sr, t, smoothed){
    const N=FFT_SIZE, half=N/2;
    const center=Math.round(t*sr);
    const re=new Float32Array(N), im=new Float32Array(N);
    for(let i=0;i<N;i++){
      const idx=center-half+i;
      const s=(idx>=0 && idx<mono.length) ? mono[idx] : 0;
      re[i]=s*HANN[i];
    }
    fft(re,im);
    const freqBytes=new Uint8Array(128);
    const minDb=-100, maxDb=-30;
    for(let k=0;k<128;k++){
      const mag=Math.sqrt(re[k]*re[k]+im[k]*im[k])/N;
      const db= mag>0 ? 20*Math.log10(mag) : minDb;
      let v=((db-minDb)/(maxDb-minDb))*255;
      v=Math.max(0,Math.min(255,v));
      smoothed[k]=smoothed[k]*0.5+v*0.5;
      freqBytes[k]=smoothed[k];
    }
    const timeBytes=new Uint8Array(128);
    for(let k=0;k<128;k++){
      const idx=center-half+k*2;
      const s=(idx>=0 && idx<mono.length) ? mono[idx] : 0;
      timeBytes[k]=Math.max(0,Math.min(255, Math.round((s*0.5+0.5)*255)));
    }
    let bsum=0; for(let i=0;i<8;i++) bsum+=freqBytes[i];
    const bass=(bsum/8)/255;
    return {freqBytes, timeBytes, bass};
  }

  function finishUI(){
    recordBtn.disabled=!canExport; previewBtn.disabled=false;
    recordBtn.textContent='⏺ Create Video';
  }

  recordBtn.addEventListener('click', async ()=>{
    if(!canExport){ setStatus('Video export needs Chrome or Edge.'); return; }
    downloadArea.innerHTML='';
    recordBtn.disabled=true; previewBtn.disabled=true;
    recordBtn.textContent='⏳ Working…';
    if(!audioEl.paused) audioEl.pause();

    try{
      setStatus('Decoding audio…');
      const arrayBuf=await audioFile.arrayBuffer();
      const decodeCtx=new (window.AudioContext||window.webkitAudioContext)();
      const audioBuffer=await decodeCtx.decodeAudioData(arrayBuf.slice(0));
      const duration=audioBuffer.duration, sr=audioBuffer.sampleRate;
      const chans=[]; for(let c=0;c<audioBuffer.numberOfChannels;c++) chans.push(audioBuffer.getChannelData(c));
      const mono=new Float32Array(audioBuffer.length);
      for(let i=0;i<mono.length;i++){ let s=0; for(let c=0;c<chans.length;c++) s+=chans[c][i]; mono[i]=s/chans.length; }

      // Ask where to save BEFORE the heavy work, if the browser supports it
      let writableStream=null, useFS=false;
      if(window.showSaveFilePicker){
        try{
          const handle=await window.showSaveFilePicker({
            suggestedName:'talkify-video.webm',
            types:[{ description:'WebM Video', accept:{'video/webm':['.webm']} }]
          });
          writableStream=await handle.createWritable();
          useFS=true;
        }catch(err){
          if(err && err.name==='AbortError'){ setStatus('Export cancelled.'); finishUI(); return; }
          console.warn('Save picker unavailable, will download instead', err);
        }
      }

      setStatus('Loading video engine…');
      const { Output, WebMOutputFormat, BufferTarget, StreamTarget, CanvasSource, AudioBufferSource, Quality } = await loadMediabunny();

      const target = useFS ? new StreamTarget(writableStream, {chunked:true}) : new BufferTarget();
      const output = new Output({ format: new WebMOutputFormat(), target });

      const videoSource = new CanvasSource(canvas, { codec:'vp9', quality:new Quality({ bitrate:5_000_000 }) });
      const audioSource = new AudioBufferSource({ codec:'opus', quality:new Quality({ bitrate:128_000 }) });
      output.addVideoTrack(videoSource, { frameRate:30 });
      output.addAudioTrack(audioSource);

      await output.start();

      setStatus('Encoding audio…');
      await audioSource.add(audioBuffer);
      audioSource.close();

      const fps=30;
      const totalFrames=Math.max(1, Math.ceil(duration*fps));
      const smoothed=new Uint8Array(128);
      const title=titleInput.value.trim();
      const style=styleSelect.value;

      for(let f=0; f<totalFrames; f++){
        const t=f/fps;
        const {freqBytes, timeBytes, bass}=computeFrameData(mono, sr, t, smoothed);
        paintCanvas(freqBytes, timeBytes, bass, style, title);
        await videoSource.add(t, 1/fps);
        const pct=Math.round(((f+1)/totalFrames)*100);
        progressBar.style.width=pct+'%';
        setStatus('Rendering video… '+pct+'%');
      }
      videoSource.close();

      setStatus('Finishing up…');
      await output.finalize();

      if(useFS){
        setStatus('Saved! ✅');
        progressBar.style.width='0%';
      } else {
        const buf=output.target.buffer;
        const blob=new Blob([buf], {type:'video/webm'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download='talkify-video.webm';
        document.body.appendChild(a); a.click(); a.remove();
        const link=document.createElement('a');
        link.href=url; link.download='talkify-video.webm'; link.className='dl-btn';
        link.textContent='⬇ Download Video ('+(blob.size/1024/1024).toFixed(1)+' MB)';
        downloadArea.appendChild(link);
        setStatus('Video ready! If it didn\'t auto-download, tap the button below.');
        progressBar.style.width='0%';
      }
      finishUI();
    }catch(err){
      console.error('Export failed', err);
      setStatus('Export failed: '+(err && err.message ? err.message : err)+'. Try Chrome or Edge.');
      progressBar.style.width='0%';
      finishUI();
    }
  });
})();
