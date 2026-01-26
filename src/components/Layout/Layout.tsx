import { motion } from 'framer-motion';
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
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`${!hideHeader ? 'pt-16' : ''} ${!hideSidebar ? 'pl-[72px]' : ''} transition-all duration-300`}
      >
        {children}
      </motion.main>
    </div>
  );
};
