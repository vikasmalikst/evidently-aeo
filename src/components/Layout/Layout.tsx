import { Header } from './Header';
import { NewSidebar } from './NewSidebar';

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideHeader?: boolean;
}

export const Layout = ({ children, hideSidebar = false, hideHeader = false }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {!hideHeader && <Header />}
      {!hideSidebar && <NewSidebar />}
      <main className={`${!hideHeader ? 'pt-16' : ''} ${!hideSidebar ? 'pl-[72px]' : ''} transition-all duration-300`}>
        {children}
      </main>
    </div>
  );
};
