var GestureRecognizerClass = null;
var FilesetResolverClass = null;
var DrawingUtilsClass = null;
var recognizer = null;
var isCameraRunning = false;
var webcamStream = null;
var lastVideoTime = -1;
var handDistHistory = [];
var clapCooldown = false;

async function initMediaPipe() {
  if (recognizer) return;
  try {
    const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    GestureRecognizerClass = visionModule.GestureRecognizer;
    FilesetResolverClass = visionModule.FilesetResolver;
    DrawingUtilsClass = visionModule.DrawingUtils;

    const vision = await FilesetResolverClass.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    try {
      recognizer = await GestureRecognizerClass.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });
    } catch (gpuErr) {
      recognizer = await GestureRecognizerClass.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });
    }
  } catch (err) {}
}

async function initCamera() {
  if (isCameraRunning) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 }
    });
    webcamStream = stream;
    if (webcamVideo) {
      webcamVideo.srcObject = stream;
      await webcamVideo.play();
      isCameraRunning = true;
      if (camContainer) camContainer.style.display = 'block';
      requestAnimationFrame(predictWebcam);
    }
  } catch (err) {
    isCameraRunning = false;
    if (camContainer) camContainer.style.display = 'none';
  }
}

function handleCmrCommand() {
  if (isScrollAnimationActive) return;
  if (isCameraRunning) {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
    isCameraRunning = false;
    if (camContainer) camContainer.style.display = 'none';
  } else {
    initCamera();
  }
}

window.triggerMediaPipeClap = function () {
  if (!isScrollAnimationActive && !hasAnimationFinished && !clapCooldown) {
    clapCooldown = true;
    if (camContainer) {
      camContainer.classList.add('clap-flash');
      setTimeout(() => {
        if (camContainer) camContainer.classList.remove('clap-flash');
      }, 400);
    }
    triggerScrollAnimation();
    setTimeout(() => { clapCooldown = false; }, 2000);
  }
};

window.triggerMediaPipeGesture = window.triggerMediaPipeClap;

function predictWebcam() {
  if (!isCameraRunning) return;
  if (!webcamVideo || !gestureCanvas) return;

  const ctx = gestureCanvas.getContext('2d');
  if (gestureCanvas.width !== webcamVideo.videoWidth || gestureCanvas.height !== webcamVideo.videoHeight) {
    gestureCanvas.width = webcamVideo.videoWidth || 320;
    gestureCanvas.height = webcamVideo.videoHeight || 240;
  }

  if (recognizer && webcamVideo.readyState >= 2 && webcamVideo.currentTime !== lastVideoTime) {
    lastVideoTime = webcamVideo.currentTime;
    const now = performance.now();
    const results = recognizer.recognizeForVideo(webcamVideo, now);

    ctx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);

    if (results && results.landmarks && results.landmarks.length > 0) {
      if (DrawingUtilsClass) {
        const du = new DrawingUtilsClass(ctx);
        for (const handLandmarks of results.landmarks) {
          du.drawConnectors(handLandmarks, GestureRecognizerClass.HAND_CONNECTIONS, { color: '#ff2233', lineWidth: 2 });
          du.drawLandmarks(handLandmarks, { color: '#ff5566', lineWidth: 1, radius: 2 });
        }
      }

      const nowTime = Date.now();
      let isClap = false;

      if (results.landmarks.length >= 2) {
        const h1 = results.landmarks[0];
        const h2 = results.landmarks[1];

        const p1x = (h1[0].x + h1[9].x) / 2;
        const p1y = (h1[0].y + h1[9].y) / 2;
        const p2x = (h2[0].x + h2[9].x) / 2;
        const p2y = (h2[0].y + h2[9].y) / 2;
        const palmDist = Math.hypot(p1x - p2x, p1y - p2y);

        const wristDist = Math.hypot(h1[0].x - h2[0].x, h1[0].y - h2[0].y);
        const tipDist = Math.hypot(h1[8].x - h2[8].x, h1[8].y - h2[8].y);
        const minDist = Math.min(palmDist, wristDist, tipDist);

        const span1 = Math.hypot(h1[0].x - h1[9].x, h1[0].y - h1[9].y);
        const span2 = Math.hypot(h2[0].x - h2[9].x, h2[0].y - h2[9].y);
        const handSpan = Math.max(0.06, (span1 + span2) / 2);
        const normDist = palmDist / handSpan;

        handDistHistory.push({ time: nowTime, dist: palmDist, minDist: minDist, normDist: normDist });
        handDistHistory = handDistHistory.filter(item => nowTime - item.time <= 550);

        const isClose = (palmDist < 0.16 || minDist < 0.10 || normDist < 1.15);
        const wasApart = handDistHistory.some(item => (nowTime - item.time >= 80) && (item.dist >= 0.22 || item.normDist >= 1.5));
        const maxPast = handDistHistory.reduce((max, item) => (nowTime - item.time >= 80 && item.dist > max) ? item.dist : max, 0);
        const approachDelta = maxPast - palmDist;
        const isFastApproach = approachDelta >= 0.08;

        if (isClose && wasApart && isFastApproach) {
          isClap = true;
        }
      } else if (results.landmarks.length === 1) {
        if (handDistHistory.length > 0) {
          const recentApart = handDistHistory.some(item => (nowTime - item.time >= 80) && item.dist >= 0.20);
          const lastEntry = handDistHistory[handDistHistory.length - 1];
          if (recentApart && lastEntry.dist <= 0.18 && (nowTime - lastEntry.time <= 180)) {
            isClap = true;
          }
        }
        handDistHistory = [];
      }

      if (isClap && !clapCooldown && !isScrollAnimationActive && !hasAnimationFinished) {
        clapCooldown = true;
        if (camContainer) {
          camContainer.classList.add('clap-flash');
          setTimeout(() => {
            if (camContainer) camContainer.classList.remove('clap-flash');
          }, 400);
        }
        triggerScrollAnimation();
        setTimeout(() => { clapCooldown = false; }, 2000);
      }
    } else {
      handDistHistory = [];
    }
  }
  requestAnimationFrame(predictWebcam);
}

