import { useState } from 'react';
import { authService } from '../../lib/auth';
import { Mail, AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
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

export const PasswordResetForm = ({ onBack }: PasswordResetFormProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    const result = await authService.resetPassword(email);

    if (result.success) {
      setSuccess('Password reset email sent! Please check your inbox.');
      setEmail('');
    } else {
      setError(result.error || 'Failed to send reset email');
    }

    setIsLoading(false);
  };

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
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-2 group font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Sign In
      </button>

      {/* New Header inside the box */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Reset Password</h2>
        <p className="text-slate-500">Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 font-medium">{success}</p>
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

        {/* Send Link Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 text-white font-bold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 flex items-center justify-center 
          bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sending...</span>
            </div>
          ) : (
            <>
              Send Reset Link <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
};