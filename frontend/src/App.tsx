import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EmailVerification } from './components/EmailVerification';
import { RegistrationPortal } from './components/RegistrationPortal';
import { useModelStatus } from './hooks/useModelStatus';
import { Icon } from './components/ui';

export default function App() {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const model = useModelStatus();

  const handleVerified = (email: string, token: string) => {
    setVerifiedEmail(email);
    setVerificationToken(token);
  };

  const handleResetEmail = () => {
    setVerifiedEmail(null);
    setVerificationToken(null);
  };

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-sage/30">
      {/* Persistent Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-4 px-[max(1.25rem,env(safe-area-inset-left))] min-[820px]:h-16">
          <div className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-ink-strong min-[820px]:text-[22px]">
            <LogoMark />
            <span>Face Registration</span>
            <span className="hidden text-xs font-semibold text-muted sm:inline">
              · Monitoring System
            </span>
          </div>

          <div className="flex items-center gap-2">
            {verifiedEmail && (
              <button
                type="button"
                onClick={handleResetEmail}
                className="hidden rounded-full bg-raised px-3 py-1 text-xs font-semibold text-muted hover:text-ink sm:block"
                title="Log out and verify another email"
              >
                Change Email
              </button>
            )}

            <p className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted border border-line">
              <Icon name="lock" className="h-3.5 w-3.5 text-sage" />
              <span className="hidden min-[400px]:inline">Encrypted &amp; Secure</span>
              <span className="min-[400px]:hidden">Secure</span>
            </p>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1080px] px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {!verifiedEmail ? (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <EmailVerification onVerified={handleVerified} />
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

      <footer className="border-t border-line py-6 text-center text-xs text-faint">
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
        <ellipse cx="12" cy="12.5" rx="7.5" ry="9.5" stroke="rgba(147,173,156,0.9)" strokeWidth="1.5" />
        <circle cx="9" cy="11.5" r="1" fill="rgba(147,173,156,0.9)" />
        <circle cx="15" cy="11.5" r="1" fill="rgba(147,173,156,0.9)" />
        <path d="M10 16c1 .6 3 .6 4 0" stroke="rgba(147,173,156,0.9)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
