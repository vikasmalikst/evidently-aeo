import { useState, useEffect } from 'react';
import { authService } from '../../lib/auth';
import { Mail, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, Lock, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
// Import motion for animation
import { motion, type Variants } from 'framer-motion';

// Animation variants
const formVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' as const } }
};

interface PasswordResetFormProps {
  onBack?: () => void;
}

type Step = 'email' | 'otp' | 'password' | 'success';

interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export const PasswordResetForm = ({ onBack }: PasswordResetFormProps) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [requirements, setRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false
  });

  useEffect(() => {
    setRequirements({
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    });
  }, [password]);

  const isPasswordValid = Object.values(requirements).every(Boolean);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authService.resetPassword(email);

    if (result.success) {
      setStep('otp');
      setSuccess('OTP sent to your email');
    } else {
      setError(result.error || 'Failed to send OTP');
    }

    setIsLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authService.verifyOTP(email, otp);

    if (result.success) {
      setStep('password');
      setSuccess('');
    } else {
      setError(result.error || 'Invalid OTP');
    }

    setIsLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please meet all password requirements');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);

    const result = await authService.confirmPasswordReset(email, otp, password);

    if (result.success) {
      setStep('success');
      setSuccess('Password reset successfully!');
    } else {
      setError(result.error || 'Failed to reset password');
    }

    setIsLoading(false);
  };

  const renderRequirement = (met: boolean, text: string) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-slate-400'}`}>
      <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${met ? 'bg-green-100 border-green-200' : 'border-slate-200'}`}>
        {met && <CheckCircle className="w-3 h-3" />}
      </div>
      <span>{text}</span>
    </div>
  );

  // Common input classes for consistent styling
  const inputClasses = "w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 outline-none";
  const iconClasses = "absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400";

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm group font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Sign In
      </button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-2">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {step === 'email' && 'Reset Password'}
          {step === 'otp' && 'Enter OTP'}
          {step === 'password' && 'New Password'}
          {step === 'success' && 'Success!'}
        </h2>
        <p className="text-slate-500 text-sm">
          {step === 'email' && 'Enter your email to receive a verification code'}
          {step === 'otp' && `We sent a 6-digit code to ${email}`}
          {step === 'password' && 'Create a strong password for your account'}
          {step === 'success' && 'Your password has been updated successfully'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
          <div className="p-1 bg-red-100 rounded-lg flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-sm text-red-700 font-medium pt-0.5">{error}</p>
        </div>
      )}

      {success && step !== 'success' && (
        <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
          <div className="p-1 bg-green-100 rounded-lg flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-sm text-green-700 font-medium pt-0.5">{success}</p>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <div className="relative group">
              <Mail className={iconClasses} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClasses}
                placeholder="Email address"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
            active:scale-[0.98] hover:-translate-y-0.5"
          >
            {isLoading ? 'Sending...' : 'Send OTP'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <div className="relative group">
              <KeyRound className={iconClasses} />
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className={`${inputClasses} tracking-[0.5em] font-mono text-center text-lg`}
                placeholder="000000"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">Code expires in 10 minutes</p>
          </div>
          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full py-3.5 px-4 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
            active:scale-[0.98] hover:-translate-y-0.5"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleEmailSubmit}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline underline-offset-2 transition-colors"
          >
            Resend Code
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <Lock className={iconClasses} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputClasses} pr-12`}
                placeholder="New Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative group">
              <Lock className={iconClasses} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`${inputClasses} pr-12`}
                placeholder="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-500 mb-2">Password must contain:</p>
            <div className="grid grid-cols-2 gap-2">
              {renderRequirement(requirements.minLength, '8+ characters')}
              {renderRequirement(requirements.hasUpper, 'Uppercase letter')}
              {renderRequirement(requirements.hasLower, 'Lowercase letter')}
              {renderRequirement(requirements.hasNumber, 'Number')}
              {renderRequirement(requirements.hasSpecial, 'Special character')}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isPasswordValid || password !== confirmPassword}
            className="w-full py-3.5 px-4 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
            active:scale-[0.98] hover:-translate-y-0.5"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/10">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <button
            onClick={onBack}
            className="w-full py-3.5 px-4 text-white font-semibold rounded-xl transition-all duration-200
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
            active:scale-[0.98] hover:-translate-y-0.5"
          >
            Return to Sign In
          </button>
        </div>
      )}
    </motion.div>
  );
};