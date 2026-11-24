import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FaceSection } from './FaceSection';
import { Button, Icon } from './ui';

interface RegistrationPortalProps {
  verifiedEmail: string;
  verificationToken: string;
  onResetEmail: () => void;
}

export function RegistrationPortal({
  verifiedEmail,
  verificationToken,
  onResetEmail,
}: RegistrationPortalProps) {
  const [memberId, setMemberId] = useState('');
  const [fullName, setFullName] = useState('');
  const [academicYear, setAcademicYear] = useState('1');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const idInputRef = useRef<HTMLInputElement>(null);

  const isFormValid =
    Boolean(memberId.trim()) &&
    Boolean(fullName.trim()) &&
    Boolean(academicYear) &&
    Boolean(idFile) &&
    Boolean(faceFile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !faceFile || !idFile) {
      setError('Please fill all required fields and complete face and ID verification.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('MemberId', memberId.trim());
      formData.append('FullName', fullName.trim());
      formData.append('Email', verifiedEmail.trim());
      formData.append('AcademicYear', academicYear);
      formData.append('FaceImage', faceFile, faceFile.name);
      formData.append('IdImage', idFile, idFile.name);

      const response = await fetch('/registrationRequest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = await response.text();
        try {
          const json = JSON.parse(errorDetail);
          errorDetail = json.title || json.message || errorDetail;
        } catch {
          // plain text error
        }
        throw new Error(errorDetail || `Registration submission failed (HTTP ${response.status}).`);
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit registration request.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center p-6 text-center"
      >
        <div className="card w-full border border-line bg-surface p-8">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-sage/20 text-sage shadow-inner">
            <Icon name="check" className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-strong sm:text-3xl">
            Application Submitted!
          </h2>
          <p className="mt-3 text-sm text-muted">
            Your registration request for <strong className="text-ink">{fullName}</strong> ({verifiedEmail}) has been received and is queued for verification and approval.
          </p>
          <div className="mt-6 rounded-2xl bg-frame p-4 text-xs text-muted text-left border border-line flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span>Member ID:</span>
              <strong className="text-ink">{memberId}</strong>
            </div>
            <div className="flex justify-between">
              <span>Academic Year:</span>
              <strong className="text-ink">Year {academicYear}</strong>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-semibold text-ochre">Pending Approval</span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setSubmitted(false);
              setFaceFile(null);
              setIdFile(null);
              setMemberId('');
              setFullName('');
              onResetEmail();
            }}
            className="mt-6 w-full py-3"
          >
            Submit Another Request
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4"
      >
        <div>
          <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold tracking-wider text-muted uppercase">
            Step 02 / 02 · Member Registration
          </span>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
            Registration Details
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-sage/30 bg-sage-soft/40 px-3.5 py-1.5 text-xs">
          <span className="h-2 w-2 rounded-full bg-sage" />
          <span className="text-muted">Verified:</span>
          <span className="font-semibold text-ink-strong">{verifiedEmail}</span>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Face Photo & Verification */}
        <FaceSection faceFile={faceFile} onFaceSelected={setFaceFile} />

        {/* Section 2: Student Details & ID */}
        <div className="card border border-line bg-surface p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage/20 text-xs font-bold text-sage">
              2
            </span>
            <h2 className="font-display text-lg font-bold text-ink-strong">
              Personal Information & ID Card
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Member ID */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">
                Member / Student ID *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="e.g. 20241028"
                required
                className="w-full rounded-2xl border border-line bg-frame px-4 py-3 text-sm font-medium text-ink placeholder:text-muted/50 focus:border-sage focus:outline-none"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">
                Full Name (As on ID) *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ahmed Hashem"
                required
                className="w-full rounded-2xl border border-line bg-frame px-4 py-3 text-sm font-medium text-ink placeholder:text-muted/50 focus:border-sage focus:outline-none"
              />
            </div>

            {/* Verified Email (Readonly) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold tracking-wider text-muted uppercase">
                  Verified Email
                </label>
                <span className="text-[11px] font-semibold text-sage flex items-center gap-1">
                  <Icon name="check" className="h-3 w-3" /> Verified
                </span>
              </div>
              <input
                type="email"
                value={verifiedEmail}
                readOnly
                disabled
                className="w-full rounded-2xl border border-line bg-frame/60 px-4 py-3 text-sm font-medium text-muted cursor-not-allowed"
              />
            </div>

            {/* Academic Year */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">
                Academic Year *
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                className="w-full rounded-2xl border border-line bg-frame px-4 py-3 text-sm font-medium text-ink focus:border-sage focus:outline-none"
              >
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
            </div>

            {/* Student ID Card Upload */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">
                Student ID Card Photo *
              </label>
              <input
                ref={idInputRef}
                type="file"
                accept="image/*"
                required
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setIdFile(f);
                }}
              />

              <div
                onClick={() => idInputRef.current?.click()}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-line bg-frame p-4 transition-colors hover:border-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-raised text-muted">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-strong">
                      {idFile ? idFile.name : 'Choose Student ID photo'}
                    </p>
                    <p className="text-xs text-muted">
                      {idFile ? `${(idFile.size / 1024 / 1024).toFixed(2)} MB · Click to change` : 'PNG, JPG or WEBP'}
                    </p>
                  </div>
                </div>

                <span className="rounded-xl bg-raised px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line">
                  {idFile ? 'Change' : 'Browse'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-ochre/30 bg-ochre-soft/80 p-4 text-xs font-medium text-ochre"
          >
            <strong>Submission issue: </strong>
            {error}
          </motion.div>
        )}

        {/* Submit Bar */}
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon name="lock" className="h-4 w-4 text-sage" />
            <span>Encrypted transmission to Monitoring System</span>
          </div>

          <Button
            variant="primary"
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full sm:w-auto px-8 py-3.5 text-base font-bold"
          >
            {loading ? 'Submitting…' : 'Submit Registration Request →'}
          </Button>
        </div>
      </form>
    </div>
  );
}
