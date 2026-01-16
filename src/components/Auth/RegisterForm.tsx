import { useState } from 'react';
import { authService } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { Mail, Lock, User, AlertCircle, CheckCircle, ArrowRight, Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react';
// 1. Import 'Variants' type specifically
import { motion, Variants } from 'framer-motion';

// 2. Explicitly type the constant as 'Variants'
const formVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" } }
};

interface RegisterFormProps {
  onSuccess?: () => void | Promise<void>;
  onSwitchToLogin?: () => void;
}

export const RegisterForm = ({ onSuccess, onSwitchToLogin }: RegisterFormProps) => {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  // ... (validatePassword function remains same)
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*]/.test(pwd)) return 'Password must contain at least one special character';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (step === 'details') {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setIsLoading(true);

      const result = await authService.sendSignupOTP(email);

      if (result.success) {
        setStep('otp');
        setSuccess('Verification code sent! Please check your email.');
      } else {
        setError(result.error || 'Failed to send verification code');
      }

      setIsLoading(false);
    } else {
      // Verify OTP and Register
      if (otp.length !== 6) {
        setError('Please enter a valid 6-digit code');
        return;
      }

      setIsLoading(true);

      const result = await authService.register(email, password, fullName, otp);

      if (result.success && result.user) {
        setSuccess('Account created successfully!');
        setUser(result.user);
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        setError(result.error || 'Registration failed');
      }

      setIsLoading(false);
    }
  };

  // Common input classes for consistent styling
  const inputClasses = "w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 outline-none";
  const iconClasses = "absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400";

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full space-y-5"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-2">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {step === 'details' ? 'Create an Account' : 'Verify Email'}
        </h2>
        <p className="text-slate-500 text-sm">
          {step === 'details' 
            ? 'Start your journey with intelligent decision making' 
            : `We sent a 6-digit code to ${email}`}
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

      {success && (
        <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
          <div className="p-1 bg-green-100 rounded-lg flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-sm text-green-700 font-medium pt-0.5">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {step === 'details' ? (
          <>
            {/* Full Name Input */}
            <div>
              <div className="relative group">
                <User className={iconClasses} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="Email address"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="relative group">
                <Lock className={iconClasses} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${inputClasses} pr-12`}
                  placeholder="Create Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 ml-1">
                Must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.
              </p>
            </div>

            {/* Confirm Password Input */}
            <div>
              <div className="relative group">
                <Lock className={iconClasses} />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="Confirm Password"
                />
              </div>
            </div>
          </>
        ) : (
          /* OTP Input Step */
          <div className="space-y-4">
            <div>
              <div className="relative group">
                <KeyRound className={iconClasses} />
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className={`${inputClasses} text-center tracking-[0.5em] font-mono text-lg`}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>
            
            <div className="text-center">
              <button 
                type="button" 
                onClick={() => setStep('details')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline underline-offset-2 transition-colors"
              >
                Change email address
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2
          bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
          shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
          active:scale-[0.98] hover:-translate-y-0.5 mt-2"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{step === 'details' ? 'Sending Code...' : 'Creating account...'}</span>
            </div>
          ) : (
            <>
              {step === 'details' ? 'Continue' : 'Verify & Create Account'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/80"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-white text-xs text-slate-400 font-medium">or</span>
        </div>
      </div>

      <div className="text-center">
        <span className="text-sm text-slate-600">Already have an account? </span>
        <button
          onClick={onSwitchToLogin}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline underline-offset-2 transition-colors"
        >
          Sign in
        </button>
      </div>
    </motion.div>
  );
};