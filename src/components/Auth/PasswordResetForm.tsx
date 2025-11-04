import { useState } from 'react';
import { authService } from '../../lib/auth';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

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
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sign In
      </button>

      <h2 className="text-3xl font-bold mb-2 text-gray-900">Reset Password</h2>
      <p className="text-gray-600 mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
};
