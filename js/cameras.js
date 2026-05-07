if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

const activeStreams = {};

// ========== БАЗА ИЗВЕСТНЫХ КАМЕР ==========
const knownCameras = {
    '60:7e:a4:15:ad:eb': { ip: '10.1.30.60', name: 'Xiaomi Chuangmi', location: 'Главный вход', ports: [80, 8080, 554, 8000, 8554] },
    '60:7e:a4:15:c2:5c': { ip: '10.1.30.37', name: 'Xiaomi Chuangmi', location: 'Серверная', ports: [80, 8080, 554, 8000, 8554] },
};

// ========== АВТОПОДКЛЮЧЕНИЕ (без порта) ==========
async function connectCamera(cameraId) {
    const ipInput = document.getElementById('cam' + cameraId + '-ip');
    const ip = ipInput.value.trim();
    
    if (!ip) { setStatus(cameraId, '❌ Введите IP', '#ff4757'); return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { setStatus(cameraId, '❌ Неверный IP', '#ff4757'); return; }
    
    disconnectCamera(cameraId, true);
    setStatus(cameraId, '🔍 Автопоиск...', '#ffa502');
    setLED(cameraId, 'offline');
    addLog('CAM-0' + cameraId, 'Сканирование ' + ip);
    
    // Все возможные порты камер
    const ports = [80, 8080, 554, 8000, 8081, 8554, 88, 34567, 8800, 8899, 9000, 37777, 55432, 35000, 30001, 1024, 2000, 3000, 4000, 5000, 6000, 7000, 7070, 8001, 8002, 8082, 8083, 8084, 8085, 9090, 10000, 10080, 10554, 18080];
    
    // Все возможные пути видеопотоков
    const paths = ['/', '/video', '/stream', '/live', '/mjpeg', '/video.mjpg', '/stream.mjpg',
        '/cgi-bin/mjpg/video.cgi', '/videostream.cgi', '/webcam.mjpeg', '/snapshot.jpg',
        '/tcp/av0_0', '/tcp/av0_1', '/h264', '/h264.sdp', '/onvif/device_service',
        '/ISAPI/Streaming/channels/101/httpPreview', '/Streaming/Channels/1/httppreview',
        '/mjpg/video.mjpg', '/ipcam/mjpeg.cgi', '/goform/video', '/api/video/stream',
        '/live/0', '/live/1', '/play1.m3u8', '/img/snapshot.cgi', '/img/video.mjpeg'];
    
    let connected = false;
    
    for (const port of ports) {
        if (connected) break;
        setStatus(cameraId, '🔍 Порт ' + port + '...', '#ffa502');
        
        for (const path of paths) {
            if (connected) break;
            const url = 'http://' + ip + ':' + port + path;
            const ok = await tryConnect(cameraId, url);
            if (ok) {
                connected = true;
                setStatus(cameraId, '✅ Порт ' + port, '#2ed573');
                setLED(cameraId, 'live');
                addLog('CAM-0' + cameraId, 'Подключено: ' + url);
            }
        }
    }
    
    if (!connected) {
        setStatus(cameraId, '❌ Нет сигнала', '#ff4757');
        setLED(cameraId, 'offline');
        addLog('CAM-0' + cameraId, 'Не удалось подключиться');
    }
    updateActiveCount();
}

function tryConnect(cameraId, url) {
    return new Promise((resolve) => {
        const img = new Image();
        let done = false;
        const t = setTimeout(() => { if(!done){ done=true; img.src=''; resolve(false); } }, 2000);
        img.onload = function() {
            if(!done && img.naturalWidth > 16) {
                done = true; clearTimeout(t);
                const c = document.getElementById('cam'+cameraId); c.innerHTML = '';
                img.style.cssText = 'width:100%;height:100%;object-fit:contain';
                c.appendChild(img); addTS(c, cameraId);
                activeStreams[cameraId] = { type:'mjpeg', url };
                resolve(true);
            }
        };
        img.onerror = function() { if(!done){ done=true; clearTimeout(t); resolve(false); } };
        img.src = url;
    });
}

function disconnectCamera(cameraId, silent) {
    if(activeStreams[cameraId]) { activeStreams[cameraId] = null; }
    const c = document.getElementById('cam'+cameraId);
    c.innerHTML = '<span class="camera-placeholder"><span class="icon">🎥</span>Введите IP</span>';
    addTS(c, cameraId);
    setLED(cameraId, 'offline'); setStatus(cameraId, 'Отключено', '#888');
    updateActiveCount();
    if(!silent) addLog('CAM-0'+cameraId, 'Отключена');
}

async function useWebcam(cameraId) {
    try {
        disconnectCamera(cameraId, true);
        const s = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}}});
        const v = document.createElement('video'); v.srcObject = s; v.autoplay = v.muted = v.playsInline = true;
        v.style.cssText = 'width:100%;height:100%;object-fit:contain';
        const c = document.getElementById('cam'+cameraId); c.innerHTML = ''; c.appendChild(v);
        addTS(c, cameraId);
        activeStreams[cameraId] = { type:'webcam', stream:s };
        setLED(cameraId, 'live'); setStatus(cameraId, '✅ Веб-камера', '#2ed573');
        updateActiveCount(); addLog('CAM-0'+cameraId, 'Веб-камера');
    } catch(e) { alert('Нет доступа: '+e.message); }
}

function snapshot(cameraId) {
    const c = document.getElementById('cam'+cameraId);
    const img = c.querySelector('img'), v = c.querySelector('video');
    if(img && activeStreams[cameraId]) { const a=document.createElement('a'); a.href=img.src; a.download='cam'+cameraId+'-'+Date.now()+'.jpg'; a.click(); addLog('CAM-0'+cameraId, 'Снимок'); }
    else if(v && v.videoWidth) { const cv=document.createElement('canvas'); cv.width=v.videoWidth; cv.height=v.videoHeight; cv.getContext('2d').drawImage(v,0,0); const a=document.createElement('a'); a.href=cv.toDataURL('image/jpeg'); a.download='cam'+cameraId+'-'+Date.now()+'.jpg'; a.click(); addLog('CAM-0'+cameraId, 'Снимок'); }
    else alert('Нет потока');
}

function setLED(id,s) { const e=document.getElementById('led'+id); if(e) e.className='camera-status status-'+s; }
function setStatus(id,t,c) { const e=document.getElementById('cam'+id+'-status'); if(e){ e.textContent=t; e.style.color=c; } }
function addTS(container,id) { const ts=document.createElement('div'); ts.className='timestamp-overlay'; ts.id='ts'+id; container.appendChild(ts); }
function updateActiveCount() { document.getElementById('active-cameras').textContent = Object.values(activeStreams).filter(Boolean).length; }

setInterval(() => { for(let i=1;i<=4;i++){ const e=document.getElementById('ts'+i); if(e) e.textContent=new Date().toLocaleString('ru-RU'); } }, 1000);

let logs = JSON.parse(localStorage.getItem('camera_logs')||'[]');
function addLog(cam,ev) { logs.unshift({time:new Date().toLocaleString('ru-RU'),camera:cam,event:ev,operator:'Купалов Д.К.'}); if(logs.length>50) logs.pop(); localStorage.setItem('camera_logs',JSON.stringify(logs));
    const t=document.getElementById('camera-log'); if(t) t.innerHTML=logs.slice(0,10).map(l=>`<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td><td>${l.operator}</td></tr>`).join(''); }
function logout() { for(let i=1;i<=4;i++) if(activeStreams[i]?.stream) activeStreams[i].stream.getTracks().forEach(t=>t.stop()); localStorage.removeItem('sec_token'); localStorage.removeItem('sec_role'); window.location.href='index.html'; }
(()=>{ const t=document.getElementById('camera-log'); if(t) t.innerHTML=logs.slice(0,10).map(l=>`<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td><td>${l.operator}</td></tr>`).join(''); updateActiveCount(); })();
