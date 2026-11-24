import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CameraView } from './CameraView';
import { Button, Icon } from './ui';

interface FaceSectionProps {
  faceFile: File | null;
  onFaceSelected: (file: File | null) => void;
}

export function FaceSection({ faceFile, onFaceSelected }: FaceSectionProps) {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When captured via CameraView (which outputs an HTMLCanvasElement after all checks pass)
  const handleCameraCapture = (canvas: HTMLCanvasElement) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-face-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onFaceSelected(file);
      },
      'image/jpeg',
      0.95
    );
  };

  // When uploading a photo file
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10 MB limit.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });

      const result = await response.json();
      if (!response.ok || !result.accepted) {
        throw new Error(result.flaws || result.detail || 'The photo does not meet clarity and enrollment requirements.');
      }

      onFaceSelected(file);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Face verification failed.';
      setUploadError(message);
      onFaceSelected(null);
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="card border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage/20 text-xs font-bold text-sage">
              ✓
            </span>
            <h2 className="font-display text-lg font-bold text-ink-strong">
              Face Verification Photo
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            The photo must pass our facial quality checks for member recognition.
          </p>
        </div>

        {/* Tab switch only if no face is verified yet */}
        {!faceFile && (
          <div className="flex rounded-xl bg-frame p-1 border border-line">
            <button
              type="button"
              onClick={() => setMode('camera')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === 'camera'
                  ? 'bg-surface text-ink-strong shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Icon name="camera" className="h-3.5 w-3.5" />
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === 'upload'
                  ? 'bg-surface text-ink-strong shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Photo
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {faceFile ? (
          /* Preview of accepted face photo */
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-sage/30 bg-sage-soft/30 p-4"
          >
            <div className="relative h-32 w-32 flex-none overflow-hidden rounded-2xl border-2 border-sage shadow-md">
              <img
                src={URL.createObjectURL(faceFile)}
                alt="Verified face"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 rounded-full bg-sage px-1.5 py-0.5 text-[10px] font-bold text-bg">
                ✓ VERIFIED
              </span>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sage/20 px-3 py-1 text-xs font-bold text-sage mb-1.5">
                <Icon name="check" className="h-3.5 w-3.5" />
                Quality Checks Passed
              </div>
              <p className="text-sm font-semibold text-ink-strong">{faceFile.name}</p>
              <p className="text-xs text-muted mt-0.5">
                Ready for biometric member enrollment.
              </p>
              <div className="mt-3">
                <Button
                  variant="quiet"
                  type="button"
                  onClick={() => onFaceSelected(null)}
                  className="text-xs text-ochre hover:text-ochre/80"
                >
                  <Icon name="retry" className="h-3 w-3" />
                  Retake / Change Photo
                </Button>
              </div>
            </div>
          </motion.div>
        ) : mode === 'camera' ? (
          /* Live Camera View with MediaPipe Checks */
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CameraView onCapture={handleCameraCapture} />
          </motion.div>
        ) : (
          /* Upload Check Tab */
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-frame/50 p-8 text-center transition-colors hover:border-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileUpload(f);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />

            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-raised text-muted">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>

            <p className="text-sm font-semibold text-ink-strong">
              Choose your face photo
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              JPG, PNG, or WEBP up to 10 MB. Must be clear, front-facing, and well lit.
            </p>

            <Button
              variant="ghost"
              type="button"
              disabled={uploadLoading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 text-xs font-semibold"
            >
              {uploadLoading ? 'Verifying photo…' : 'Browse files'}
            </Button>

            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 max-w-sm rounded-xl border border-ochre/30 bg-ochre-soft/80 p-3 text-xs font-medium text-ochre text-left"
              >
                <strong>Verification issue: </strong>
                {uploadError}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
