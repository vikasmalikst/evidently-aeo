import { useState } from 'react';
import { authService } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react';
// Import motion for animation
import { motion, type Variants } from 'framer-motion';

// Define animation variants for smooth transitions
const formVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' as const } }
};

interface LoginFormProps {
  onSuccess?: () => void | Promise<void>;
  onSwitchToRegister?: () => void;
  onForgotPassword?: () => void;
}

export const LoginForm = ({ onSuccess, onSwitchToRegister, onForgotPassword }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authService.login(email, password);

    if (result.success && result.user) {
      setUser(result.user);
      if (onSuccess) {
        await onSuccess();
      }
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  // Common input classes for consistent styling
  const inputClasses = "w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 outline-none";
  const iconClasses = "absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400";

  return (
    // Wrap content in motion.div for animation
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-2">
          <LogIn className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h2>
        <p className="text-slate-500 text-sm">Enter your credentials to access your account</p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
          <div className="p-1 bg-red-100 rounded-lg flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-sm text-red-700 font-medium pt-0.5">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <div className="relative group">
            <Mail className={iconClasses} />
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
              placeholder="Password"
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
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline underline-offset-2 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2
          bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
          shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 
          active:scale-[0.98] hover:-translate-y-0.5"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            <>
              Sign In
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
        <span className="text-sm text-slate-600">Don't have an account? </span>
        <button
          onClick={onSwitchToRegister}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline underline-offset-2 transition-colors"
        >
          Create an account
        </button>
      </div>
    </motion.div>
  );
};