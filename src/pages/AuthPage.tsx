import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { PasswordResetForm } from '../components/Auth/PasswordResetForm';

type AuthView = 'login' | 'register' | 'reset';

export const AuthPage = () => {
  const [view, setView] = useState<AuthView>('login');
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      {view === 'login' && (
        <LoginForm
          onSuccess={handleSuccess}
          onSwitchToRegister={() => setView('register')}
          onForgotPassword={() => setView('reset')}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setView('login')}
        />
      )}
      {view === 'reset' && (
        <PasswordResetForm
          onBack={() => setView('login')}
        />
      )}
    </div>
  );
};
