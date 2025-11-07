interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export const Spinner = ({ size = 'medium', message }: SpinnerProps) => {
  return (
    <div className="onboarding-spinner-container">
      <div className={`onboarding-spinner onboarding-spinner--${size}`} />
      {message && <p className="onboarding-spinner-message">{message}</p>}
    </div>
  );
};
