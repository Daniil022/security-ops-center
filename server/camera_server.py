"""
Камера-сервер для VR House
Конвертирует RTSP/HTTP потоки в MJPEG для браузера
Запуск: python camera_server.py
"""

from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import subprocess
import threading
import time
import requests
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)

# Конфигурация камер
CAMERAS = {
    1: {
        'name': 'Главный вход',
        'ip': '10.1.30.60',
        'mac': '60:7e:a4:15:ad:eb',
        'rtsp': 'rtsp://10.1.30.60:554/live',
        'http': 'http://10.1.30.60:8080',
        'ports': [80, 8080, 554, 8000, 8554]
    },
    2: {
        'name': 'Серверная',
        'ip': '10.1.30.37',
        'mac': '60:7e:a4:15:c2:5c',
        'rtsp': 'rtsp://10.1.30.37:554/live',
        'http': 'http://10.1.30.37:8080',
        'ports': [80, 8080, 554, 8000, 8554]
    },
    3: {
        'name': 'Периметр',
        'ip': '',
        'mac': '',
        'rtsp': '',
        'http': '',
        'ports': [80, 8080, 554, 8000, 8554, 34567, 37777]
    },
    4: {
        'name': 'Склад',
        'ip': '',
        'mac': '',
        'rtsp': '',
        'http': '',
        'ports': [80, 8080, 554, 8000, 8554, 34567, 37777]
    }
}

# Хранилище активных стримов
active_streams = {}

# ========== MJPEG ПОТОК (для браузера) ==========
def generate_mjpeg(camera_id):
    """Генерирует MJPEG поток из RTSP камеры"""
    cam = CAMERAS.get(camera_id)
    if not cam or not cam['rtsp']:
        return
    
    # Пробуем разные способы получения видео
    rtsp_url = cam['rtsp']
    
    # Способ 1: ffmpeg для RTSP -> MJPEG
    cmd = [
        'ffmpeg',
        '-rtsp_transport', 'tcp',  # TCP более надёжен
        '-i', rtsp_url,
        '-f', 'mjpeg',
        '-r', '5',  # 5 кадров в секунду
        '-s', '640x480',
        '-q:v', '10',
        '-an',  # без аудио
        'pipe:1'
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
        active_streams[camera_id] = process
        
        while True:
            frame = process.stdout.read(1024 * 100)  # читаем кадр
            if not frame:
                break
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    except:
        pass
    finally:
        if camera_id in active_streams:
            del active_streams[camera_id]

def generate_snapshot_mjpeg(camera_id):
    """Генерирует MJPEG через периодический запрос snapshot.jpg"""
    cam = CAMERAS.get(camera_id)
    if not cam:
        return
    
    # Возможные URL для снапшотов
    snapshot_urls = [
        f"http://{cam['ip']}:8080/snapshot.jpg",
        f"http://{cam['ip']}:8080/cgi-bin/snapshot.cgi",
        f"http://{cam['ip']}:80/snapshot.jpg",
        f"http://{cam['ip']}:80/cgi-bin/snapshot.cgi",
        f"http://{cam['ip']}:8000/snapshot.jpg",
    ]
    
    working_url = None
    
    # Находим рабочий URL
    for url in snapshot_urls:
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200 and len(r.content) > 1000:
                working_url = url
                break
        except:
            continue
    
    if not working_url:
        # Возвращаем заглушку
        placeholder = Image.new('RGB', (640, 480), color=(20, 20, 30))
        buffer = BytesIO()
        placeholder.save(buffer, 'JPEG')
        frame = buffer.getvalue()
        
        while True:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(1)
        return
    
    # Отдаём живые кадры
    while True:
        try:
            r = requests.get(working_url, timeout=2)
            if r.status_code == 200 and len(r.content) > 1000:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + r.content + b'\r\n')
            time.sleep(0.5)  # 2 кадра в секунду
        except:
            time.sleep(1)

# ========== API РОУТЫ ==========
@app.route('/camera/<int:camera_id>/stream')
def camera_stream(camera_id):
    """MJPEG поток камеры"""
    if camera_id not in CAMERAS:
        return 'Камера не найдена', 404
    
    # Пробуем RTSP
    try:
        return Response(
            generate_mjpeg(camera_id),
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )
    except:
        pass
    
    # Фолбэк: snapshot режим
    return Response(
        generate_snapshot_mjpeg(camera_id),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/camera/<int:camera_id>/snapshot')
def camera_snapshot(camera_id):
    """Одиночный снапшот"""
    cam = CAMERAS.get(camera_id)
    if not cam:
        return 'Камера не найдена', 404
    
    urls = [
        f"http://{cam['ip']}:8080/snapshot.jpg",
        f"http://{cam['ip']}:8080/cgi-bin/snapshot.cgi",
        f"http://{cam['ip']}:80/snapshot.jpg",
    ]
    
    for url in urls:
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                return Response(r.content, mimetype='image/jpeg')
        except:
            continue
    
    return 'Нет сигнала', 404

@app.route('/camera/<int:camera_id>/scan')
def camera_scan(camera_id):
    """Сканирует порты камеры"""
    cam = CAMERAS.get(camera_id)
    if not cam:
        return jsonify({'error': 'Камера не найдена'}), 404
    
    results = []
    for port in cam['ports']:
        try:
            r = requests.get(f"http://{cam['ip']}:{port}", timeout=1)
            results.append({'port': port, 'status': 'open', 'code': r.status_code})
        except:
            results.append({'port': port, 'status': 'closed'})
    
    return jsonify({'ip': cam['ip'], 'results': results})

@app.route('/cameras')
def list_cameras():
    """Список всех камер"""
    return jsonify(CAMERAS)

@app.route('/health')
def health():
    """Проверка сервера"""
    return jsonify({'status': 'ok', 'cameras': len(CAMERAS), 'streams': len(active_streams)})

@app.route('/')
def index():
    return '''
    <h1>VR House Camera Server</h1>
    <p>Камера 1: <a href="/camera/1/stream">/camera/1/stream</a></p>
    <p>Камера 2: <a href="/camera/2/stream">/camera/2/stream</a></p>
    <p>Снапшот 1: <a href="/camera/1/snapshot">/camera/1/snapshot</a></p>
    <p>Снапшот 2: <a href="/camera/2/snapshot">/camera/2/snapshot</a></p>
    '''

if __name__ == '__main__':
    print('=' * 50)
    print('VR House Camera Server')
    print('=' * 50)
    print('Камера 1: http://localhost:5000/camera/1/stream')
    print('Камера 2: http://localhost:5000/camera/2/stream')
    print('=' * 50)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
