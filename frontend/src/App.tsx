import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EmailVerification } from './components/EmailVerification';
import { RegistrationPortal } from './components/RegistrationPortal';
import { useModelStatus } from './hooks/useModelStatus';
import { Icon } from './components/ui';

export default function App() {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const model = useModelStatus();

  const handleVerified = (email: string, token: string) => {
    setVerifiedEmail(email);
    setVerificationToken(token);
  };

  const handleResetEmail = () => {
    setVerifiedEmail(null);
    setVerificationToken(null);
    setVerificationStep('enter_email');
  };

  return (
    <div className="camera-wallpaper relative isolate min-h-screen text-ink selection:bg-sage/30">
      <div className="camera-particle-stage" aria-hidden="true">
        <div className="camera-flash" />
        {Array.from({ length: 100 }, (_, i) => (
          <div
            className="camera-particle"
            key={i}
            style={{
              left: `${(i * 37 + 8) % 100}%`,
              animationDuration: `${6 + (i % 9) * 0.55}s`,
              animationDelay: `-${((i * 43) % 100) / 10}s`,
            }}
          >
            <span
              className="camera-particle-dot"
              style={{
                width: `${2.5 + ((i * 7) % 5)}px`,
                height: `${2.5 + ((i * 7) % 5)}px`,
                animationDuration: `${2.3 + (i % 7) * 0.27}s`,
              } as CSSProperties}
            />
          </div>
        ))}
      </div>
      {/* Persistent Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 border-b border-[#333] bg-black text-white pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-4 px-[max(1.25rem,env(safe-area-inset-left))] min-[820px]:h-16">
          <div className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-white min-[820px]:text-[22px]">
            <LogoMark />
            <span>Face Registration</span>
            <span className="hidden text-xs font-semibold text-white sm:inline">
              · Monitoring System
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(verifiedEmail || verificationStep === 'enter_otp') && (
              <button
                type="button"
                onClick={verifiedEmail ? handleResetEmail : () => setVerificationStep('enter_email')}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                title="Log out and verify another email"
              >
                Change email
              </button>
            )}

            <p className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white border border-white/20">
              <Icon name="lock" className="h-3.5 w-3.5 text-white" />
              <span className="hidden min-[400px]:inline">Encrypted &amp; Secure</span>
              <span className="min-[400px]:hidden">Secure</span>
            </p>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto max-w-[1080px] px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {!verifiedEmail ? (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <EmailVerification
                onVerified={handleVerified}
                step={verificationStep}
                onStepChange={setVerificationStep}
              />
            </motion.div>
          ) : (
            <motion.div
              key="portal"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <RegistrationPortal
                verifiedEmail={verifiedEmail}
                verificationToken={verificationToken || ''}
                onResetEmail={handleResetEmail}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {model === 'error' && (
          <p className="mt-4 text-center text-[13px] text-ochre">
            Face landmark model could not be initialized. Please check network connection.
          </p>
        )}
      </main>

      <footer className="relative z-10 border-t border-line py-6 text-center text-xs text-faint">
        MONITORING SYSTEM <span>·</span> BIOMETRIC FACE REGISTRATION PORTAL
      </footer>
    </div>
  );
}

/** Tiny logo mark */
function LogoMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface border border-line">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" strokeLinecap="round">
        <ellipse cx="12" cy="12.5" rx="7.5" ry="9.5" stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" />
        <circle cx="9" cy="11.5" r="1" fill="rgba(0,0,0,0.8)" />
        <circle cx="15" cy="11.5" r="1" fill="rgba(0,0,0,0.8)" />
        <path d="M10 16c1 .6 3 .6 4 0" stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
