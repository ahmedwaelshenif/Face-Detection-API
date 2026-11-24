import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Icon } from './ui';

interface EmailVerificationProps {
  onVerified: (email: string, token: string) => void;
}

export function EmailVerification({ onVerified }: EmailVerificationProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send verification code. Please try again.');
      }

      setStep('enter_otp');
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send verification code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit numeric code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: cleanOtp }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid verification code. Please check and try again.');
      }

      onVerified(data.email || email.trim().toLowerCase(), data.token || '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-6rem)] max-w-lg flex-col items-center justify-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="card relative w-full overflow-hidden border border-line bg-surface p-6 sm:p-8"
      >
        {/* Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(147,173,156,0.18), transparent)' }}
        />

        <div className="mb-6 flex items-center justify-between">
          <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold tracking-wider text-muted uppercase">
            Step 01 / 02 · Verification
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-sage">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Secure Access
          </span>
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-raised text-sage shadow-inner">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-strong sm:text-3xl">
            {step === 'enter_email' ? 'Verify your email' : 'Check your inbox'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {step === 'enter_email'
              ? 'Enter your email address to receive a one-time verification code before starting your registration.'
              : `We sent a 6-digit verification code to ${email}.`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'enter_email' ? (
            <motion.form
              key="email_form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleSendOtp}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full rounded-2xl border border-line bg-frame px-4 py-3.5 text-sm font-medium text-ink placeholder:text-muted/60 focus:border-sage focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-ochre/30 bg-ochre-soft/80 p-3 text-xs font-semibold text-ochre"
                >
                  {error}
                </motion.div>
              )}

              <Button
                variant="primary"
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-2 w-full py-3.5 text-base font-semibold"
              >
                {loading ? 'Sending code…' : 'Send verification code →'}
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="otp_form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleVerifyOtp}
              className="flex flex-col gap-4"
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold tracking-wider text-muted uppercase">
                    6-Digit Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('enter_email');
                      setError(null);
                    }}
                    className="text-xs font-semibold text-sage hover:underline"
                  >
                    Change email
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  required
                  autoFocus
                  disabled={loading}
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold rounded-2xl border border-line bg-frame px-4 py-3.5 text-sage placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-muted/50 focus:border-sage focus:outline-none"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-ochre/30 bg-ochre-soft/80 p-3 text-xs font-semibold text-ochre"
                >
                  {error}
                </motion.div>
              )}

              <Button
                variant="primary"
                type="submit"
                disabled={loading || otp.trim().length !== 6}
                className="mt-2 w-full py-3.5 text-base font-semibold"
              >
                {loading ? 'Verifying code…' : 'Verify & Continue →'}
              </Button>

              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Didn't get the code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-semibold text-muted">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSendOtp()}
                    className="cursor-pointer font-semibold text-sage hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
