import { useState } from 'react';
import { authService } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
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

  return (
    // Wrap content in motion.div for animation
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full space-y-6"
    >
      {/* New Header inside the box */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Sign In</h2>
        <p className="text-slate-500">Enter your credentials to access your account</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
              placeholder="Email"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none rounded-md hover:bg-slate-100 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end text-sm">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 text-white font-bold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 flex items-center justify-center 
          bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            <>
              Sign In <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        <span className="text-slate-600">Don't have an account? </span>
        <button
          onClick={onSwitchToRegister}
          className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
        >
          Sign up
        </button>
      </div>
    </motion.div>
  );
};