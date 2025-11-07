interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  hoverable?: boolean;
}

export const Card = ({
  children,
  className = '',
  onClick,
  selected = false,
  hoverable = false
}: CardProps) => {
  return (
    <div
      className={`onboarding-card ${selected ? 'onboarding-card--selected' : ''} ${hoverable ? 'onboarding-card--hoverable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
};
