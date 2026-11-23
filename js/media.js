/* InviteX media handling: validation, compression, crop/reposition/rotate. window.IXMedia */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc;
  const ASPECTS = { free: 0, '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '16:9': 16 / 9, '3:2': 3 / 2 };

  // Crop UI. Returns Promise<Blob|null>
  async function crop(src, { aspect = '4:5', maxDim = 1600, keepAlpha = false } = {}) {
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    let img;
    try { img = await IX.loadImage(url); } catch (e) { IX.toast('Could not open this image', 'bad'); return null; }
    let rot = 0, work = rotated(img, 0);
    let asp = aspect, scale = 1, ox = 0, oy = 0, W = 0, Hh = 0, minScale = 1;
    let result = null;
    await H.modal({
      title: 'Crop & reposition',
      wide: true,
      body: `<div class="stack">
        <div class="row"><span class="small muted">Shape</span><div class="seg" id="asp">${Object.keys(ASPECTS).map((k) => `<button type="button" data-a="${k}" class="${k === asp ? 'on' : ''}">${k === 'free' ? 'Original' : k}</button>`).join('')}</div>
          <button type="button" class="btn sm" id="rot">⟳ Rotate</button></div>
        <div class="crop-stage" id="stage"><canvas id="cv"></canvas></div>
        <div class="row"><label for="zoom" class="small muted">Zoom</label><input type="range" id="zoom" min="1" max="4" step="0.01" value="1" class="grow"></div>
        <p class="tiny muted">Drag the photo to reposition. Use the slider or pinch/scroll to zoom.</p></div>`,
      actions: [{ label: 'Cancel', value: null }, {
        label: 'Apply', cls: 'primary', onClick: async () => {
          const sx = -ox / scale, sy = -oy / scale, sw = W / scale, sh = Hh / scale;
          const outScale = Math.min(1, maxDim / Math.max(sw, sh));
          const c = document.createElement('canvas');
          c.width = Math.round(sw * outScale); c.height = Math.round(sh * outScale);
          const ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(work, sx, sy, sw, sh, 0, 0, c.width, c.height);
          result = await IX.canvasToBlob(c, 0.84, keepAlpha);
          return result;
        },
      }],
      onOpen: (m) => {
        const stage = m.querySelector('#stage'), cv = m.querySelector('#cv'), zoom = m.querySelector('#zoom');
        const layout = () => {
          const a = ASPECTS[asp] || work.width / work.height;
          W = Math.min(stage.parentNode.clientWidth, 560);
          Hh = W / a;
          if (Hh > 440) { Hh = 440; W = Hh * a; }
          stage.style.width = W + 'px'; stage.style.height = Hh + 'px';
          cv.width = W * devicePixelRatio; cv.height = Hh * devicePixelRatio;
          minScale = Math.max(W / work.width, Hh / work.height);
          scale = minScale * +zoom.value;
          ox = (W - work.width * scale) / 2; oy = (Hh - work.height * scale) / 2;
          draw();
        };
        const clampO = () => { ox = Math.min(0, Math.max(W - work.width * scale, ox)); oy = Math.min(0, Math.max(Hh - work.height * scale, oy)); };
        const draw = () => {
          clampO();
          const ctx = cv.getContext('2d');
          ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
          ctx.clearRect(0, 0, W, Hh);
          ctx.drawImage(work, ox, oy, work.width * scale, work.height * scale);
        };
        const setZoom = (z, cx = W / 2, cy = Hh / 2) => {
          const ns = minScale * z;
          ox = cx - ((cx - ox) * ns) / scale; oy = cy - ((cy - oy) * ns) / scale;
          scale = ns; zoom.value = z; draw();
        };
        zoom.oninput = () => setZoom(+zoom.value);
        stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(IX.clamp(+zoom.value * (e.deltaY < 0 ? 1.06 : 0.94), 1, 4)); }, { passive: false });
        const pts = new Map();
        let last = null, pinch = 0;
        stage.onpointerdown = (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; };
        stage.onpointermove = (e) => {
          if (!pts.has(e.pointerId)) return;
          pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            if (pinch) setZoom(IX.clamp((+zoom.value * d) / pinch, 1, 4));
            pinch = d; return;
          }
          ox += e.clientX - last[0]; oy += e.clientY - last[1]; last = [e.clientX, e.clientY]; draw();
        };
        stage.onpointerup = stage.onpointercancel = (e) => { pts.delete(e.pointerId); pinch = 0; if (pts.size === 1) last = [...pts.values()][0]; };
        stage.tabIndex = 0;
        stage.setAttribute('aria-label', 'Crop area. Use arrow keys to move the photo, plus and minus to zoom.');
        stage.onkeydown = (e) => {
          const step = 10;
          if (e.key === 'ArrowLeft') ox += step; else if (e.key === 'ArrowRight') ox -= step; else if (e.key === 'ArrowUp') oy += step; else if (e.key === 'ArrowDown') oy -= step;
          else if (e.key === '+' || e.key === '=') return setZoom(IX.clamp(+zoom.value + 0.1, 1, 4)); else if (e.key === '-') return setZoom(IX.clamp(+zoom.value - 0.1, 1, 4)); else return;
          e.preventDefault(); draw();
        };
        m.querySelectorAll('#asp [data-a]').forEach((b) => (b.onclick = () => { asp = b.dataset.a; m.querySelectorAll('#asp button').forEach((x) => x.classList.toggle('on', x === b)); zoom.value = 1; layout(); }));
        m.querySelector('#rot').onclick = () => { rot = (rot + 90) % 360; work = rotated(img, rot); zoom.value = 1; layout(); };
        requestAnimationFrame(layout);
      },
    });
    if (src instanceof Blob) URL.revokeObjectURL(url);
    return result;
  }
  function rotated(img, deg) {
    const c = document.createElement('canvas');
    const side = deg === 90 || deg === 270;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    c.width = side ? h : w; c.height = side ? w : h;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2);
    return c;
  }

  // Validate, (optionally crop), compress, store. Returns ref or null.
  async function addImage(file, { invId, aspect = null, maxDim = 1600, keepAlpha = false, askCrop = false } = {}) {
    const v = await IX.validateFile(file, 'image');
    if (!v.ok) { IX.toast(v.error, 'bad', 5000); return null; }
    let blob;
    if (askCrop) { blob = await crop(file, { aspect: aspect || '4:5', maxDim, keepAlpha }); if (!blob) return null; }
    else blob = (await IX.compressImage(file, { maxDim, keepAlpha })).blob;
    if (blob.size > file.size && !askCrop && v.mime !== 'image/png') blob = file; // never make it bigger
    const ref = await H.store.putMedia(blob, { name: file.name, invitationId: invId });
    IX.toast(`Uploaded ${file.name} (${IX.fmtBytes(file.size)} → ${IX.fmtBytes(blob.size)})`, 'ok');
    return ref;
  }
  async function addFile(file, kind, invId) {
    const v = await IX.validateFile(file, kind);
    if (!v.ok) { IX.toast(v.error, 'bad', 5000); return null; }
    const blob = file.type ? file : new Blob([file], { type: v.mime });
    const ref = await H.store.putMedia(blob, { name: file.name, invitationId: invId });
    IX.toast(`Uploaded ${file.name} (${IX.fmtBytes(file.size)})`, 'ok');
    return ref;
  }
  async function recrop(ref, opts) {
    const u = await H.store.resolveMedia(ref);
    if (!u) return null;
    const blob = await (await fetch(u)).blob();
    const out = await crop(blob, opts);
    if (!out) return null;
    const nref = await H.store.putMedia(out, { invitationId: opts.invId });
    await H.store.deleteMedia(ref).catch(() => {});
    return nref;
  }
  // Wire a drop zone element. onFiles(FileList)
  function dropzone(el, input, onFiles) {
    el.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach((t) => el.addEventListener(t, (e) => { e.preventDefault(); el.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => el.addEventListener(t, (e) => { e.preventDefault(); el.classList.remove('over'); }));
    el.addEventListener('drop', (e) => e.dataTransfer.files.length && onFiles([...e.dataTransfer.files]));
    input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  }
  window.IXMedia = { crop, addImage, addFile, recrop, dropzone, ASPECTS, esc };
})();
