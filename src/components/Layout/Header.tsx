export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[var(--border-default)] z-40 shadow-sm">
      <div className="h-full flex items-center px-8">
        <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">
          Evidently
        </h1>
      </div>
    </header>
  );
};
