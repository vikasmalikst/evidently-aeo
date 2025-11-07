import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, className = '', ...props }, ref) => {
    return (
      <div className="onboarding-input-wrapper">
        {label && (
          <label className="onboarding-input-label" htmlFor={props.id}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`onboarding-input ${error ? 'onboarding-input--error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="onboarding-input-error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
