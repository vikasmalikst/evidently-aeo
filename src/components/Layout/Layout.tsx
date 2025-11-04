import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <Header />
      <Sidebar />
      <main className="pt-16 pl-[72px] transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
