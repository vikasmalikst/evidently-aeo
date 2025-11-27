interface EmptyStateProps {
  message: string;
}

export const EmptyState = ({ message }: EmptyStateProps) => (
  <div className="py-6 text-center text-[13px] text-[#64748b] bg-white border border-dashed border-[#e8e9ed] rounded-lg">
    {message}
  </div>
);

