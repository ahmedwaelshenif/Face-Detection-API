const VERIFY_URL = '/face-api/api/verify';
const REQUEST_URL = '/registrationRequest';

const form = document.querySelector('#request-form');
const faceInput = document.querySelector('#face-image');
const idInput = document.querySelector('#id-image');
const faceMessage = document.querySelector('#face-message');
const formMessage = document.querySelector('#form-message');
const preview = document.querySelector('#face-preview');
const previewImg = document.querySelector('#face-preview-img');
const tabs = [...document.querySelectorAll('.tab')];
const video = document.querySelector('#camera-video');
const canvas = document.querySelector('#camera-canvas');
let faceFile = null;
let cameraStream = null;
let cameraVerified = false;
let busy = false;

function setFaceMessage(message, kind = '') {
  faceMessage.className = `status-line ${kind}`;
  faceMessage.innerHTML = `<span class="status-icon">${kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i'}</span><span>${escapeHtml(message)}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function setBusy(value) {
  busy = value;
  document.querySelector('#submit-button').disabled = value;
  document.querySelector('#camera-check').disabled = value;
  document.querySelector('#camera-capture').disabled = value || !cameraVerified;
}

async function readFaceAnalysis(file) {
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error(`Face verification failed (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(result.flaws || result.detail || result.error || `Face verification failed (HTTP ${response.status}).`);
  return result;
}

async function verifyImage(file) {
  const result = await readFaceAnalysis(file);
  if (result.accepted !== true || result.flaws) throw new Error(result.flaws || 'The face image was not accepted.');
  return result;
}

function showFace(file, source = 'upload') {
  faceFile = file;
  cameraVerified = source === 'camera';
  previewImg.src = URL.createObjectURL(file);
  document.querySelector('#face-file-label').textContent = file.name;
  document.querySelector('#face-status').textContent = source === 'camera' ? 'Camera frame verified' : 'Ready to verify';
  preview.classList.remove('hidden');
  document.querySelector('#upload-panel').classList.add('hidden');
  document.querySelector('#camera-panel').classList.add('hidden');
  stopCamera();
  if (source === 'camera') setFaceMessage('Camera frame passed verification. You can submit the request.', 'success');
  else setFaceMessage('Checking your photo with the face verification service…');
}

faceInput.addEventListener('change', async () => {
  const file = faceInput.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { setFaceMessage('Image must be 10 MB or smaller.', 'error'); faceInput.value = ''; return; }
  showFace(file);
  setBusy(true);
  try {
    await verifyImage(file);
    document.querySelector('#face-status').textContent = 'Face verified';
    setFaceMessage('Face photo accepted. It is ready to submit.', 'success');
  } catch (error) {
    faceFile = null;
    document.querySelector('#face-status').textContent = 'Not accepted';
    setFaceMessage(error.message, 'error');
  } finally { setBusy(false); }
});

idInput.addEventListener('change', () => {
  document.querySelector('#id-file-label').textContent = idInput.files?.[0]?.name || 'Choose an image';
});

document.querySelector('#remove-face').addEventListener('click', () => {
  faceFile = null; cameraVerified = false; faceInput.value = '';
  preview.classList.add('hidden');
  document.querySelector('#upload-panel').classList.remove('hidden');
  setFaceMessage('Select a photo to check that the face is clear and fully visible.');
});

tabs.forEach(tab => tab.addEventListener('click', async () => {
  tabs.forEach(item => item.classList.toggle('active', item === tab));
  preview.classList.add('hidden');
  faceFile = null; cameraVerified = false; faceInput.value = '';
  const cameraMode = tab.dataset.mode === 'camera';
  document.querySelector('#upload-panel').classList.toggle('hidden', cameraMode);
  document.querySelector('#camera-panel').classList.toggle('hidden', !cameraMode);
  setFaceMessage(cameraMode ? 'Enable your camera, then check your framing before capture.' : 'Select a photo to check that the face is clear and fully visible.');
  if (!cameraMode) stopCamera();
}));

document.querySelector('#camera-start').addEventListener('click', async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = cameraStream;
    document.querySelector('#camera-start').classList.add('hidden');
    const checkButton = document.querySelector('#camera-check');
    checkButton.disabled = false;
    checkButton.classList.remove('hidden');
    document.querySelector('#camera-hint').textContent = 'Center your face inside the guide, then check framing.';
    setFaceMessage('Camera is on. Center your face inside the oval and check framing.');
  } catch {
    setFaceMessage('Camera access is unavailable. Allow camera permission or upload an image instead.', 'error');
  }
});

async function frameToFile(maxWidth = 1280, quality = 0.9) {
  if (!video.videoWidth) throw new Error('Wait for the camera preview to start.');
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not capture the camera frame.');
  return new File([blob], `face-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

document.querySelector('#camera-check').addEventListener('click', async () => {
  setBusy(true); cameraVerified = false;
  document.querySelector('#camera-hint').textContent = 'Checking face…';
  setFaceMessage('Checking the current camera frame…');
  try {
    const file = await frameToFile();
    await verifyImage(file);
    cameraVerified = true;
    document.querySelector('#camera-capture').classList.remove('hidden');
    document.querySelector('#camera-capture').disabled = false;
    document.querySelector('#camera-hint').textContent = 'Face passed the check — capture when ready';
    setFaceMessage('The camera image passed Check Image verification. Capture it to continue.', 'success');
  } catch (error) {
    document.querySelector('#camera-capture').disabled = true;
    document.querySelector('#camera-hint').textContent = 'Adjust your position and try again';
    setFaceMessage(error.message, 'error');
  } finally { setBusy(false); }
});

document.querySelector('#camera-capture').addEventListener('click', async () => {
  if (!cameraVerified) return;
  setBusy(true);
  try {
    const file = await frameToFile();
    await verifyImage(file);
    showFace(file, 'camera');
  } catch (error) {
    cameraVerified = false;
    document.querySelector('#camera-capture').disabled = true;
    document.querySelector('#camera-hint').textContent = 'Adjust your position and check again';
    setFaceMessage(error.message, 'error');
  } finally { setBusy(false); }
});

function stopCamera() {
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  video.srcObject = null;
  document.querySelector('#camera-start').classList.remove('hidden');
  document.querySelector('#camera-check').classList.add('hidden');
  document.querySelector('#camera-capture').classList.add('hidden');
  document.querySelector('#camera-capture').disabled = true;
  cameraVerified = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  formMessage.textContent = ''; formMessage.className = 'form-message';
  if (!form.reportValidity()) return;
  if (!faceFile) { setFaceMessage('Please choose a face image that passes verification.', 'error'); return; }
  if (!idInput.files?.[0]) return;
  setBusy(true);
  document.querySelector('#submit-button').textContent = 'Verifying photo…';
  try {
    // Verify again immediately before sending the registration request.
    await verifyImage(faceFile);
    const body = new FormData();
    body.append('MemberId', form.elements.MemberId.value);
    body.append('FullName', form.elements.FullName.value.trim());
    body.append('Email', form.elements.Email.value.trim());
    body.append('AcademicYear', form.elements.AcademicYear.value);
    body.append('FaceImage', faceFile, faceFile.name);
    body.append('IdImage', idInput.files[0], idInput.files[0].name);
    document.querySelector('#submit-button').textContent = 'Submitting…';
    const response = await fetch(REQUEST_URL, { method: 'POST', body });
    if (!response.ok) {
      let detail = await response.text();
      try { const parsed = JSON.parse(detail); detail = parsed.title || parsed.message || detail; } catch { /* plain text response */ }
      throw new Error(detail || `Request failed (HTTP ${response.status}).`);
    }
    formMessage.className = 'form-message success';
    formMessage.textContent = 'Your registration request has been submitted successfully.';
    form.reset(); faceFile = null; preview.classList.add('hidden');
    document.querySelector('#id-file-label').textContent = 'Choose an image';
    document.querySelector('#upload-panel').classList.remove('hidden');
    setFaceMessage('Select a photo to check that the face is clear and fully visible.');
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    setBusy(false);
    document.querySelector('#submit-button').innerHTML = 'Verify &amp; submit <span>↗</span>';
  }
});

window.addEventListener('pagehide', () => {
  stopCamera();
});
