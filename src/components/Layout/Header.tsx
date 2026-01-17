import logo from '../../assets/logo.png';
import { NotificationBell } from '../Notifications/NotificationBell';
import { BrandSelector } from '../Header/BrandSelector';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[var(--border-default)] z-40 shadow-sm">
      <div className="h-full flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <img src={logo} alt="EvidentlyAEO Logo" className="h-8 w-8 object-contain" />
          <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">
            EvidentlyAEO
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <BrandSelector />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};
