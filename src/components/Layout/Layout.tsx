import { Header } from './Header';
import { NewSidebar } from './NewSidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <Header />
      <NewSidebar />
      <main className="pt-16 pl-[72px] transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
