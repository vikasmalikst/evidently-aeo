import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink, Globe } from 'lucide-react';
import { SourceData } from '../../types/citation-sources';

interface TopPagesModalProps {
    isOpen: boolean;
    onClose: () => void;
    source: SourceData | null;
}

export const TopPagesModal = ({ isOpen, onClose, source }: TopPagesModalProps) => {
    if (!source) return null;

    const topPages = source.topPages || [];
    const hasPages = topPages.length > 0;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 animate-in zoom-in-95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
                    <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                        <Dialog.Title className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                            <Globe className="h-5 w-5 text-slate-500" />
                            Top Cited Pages for {source.name}
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-slate-500">
                            Most frequently cited pages from this source domain.
                        </Dialog.Description>
                    </div>

                    <div className="py-4">
                        {!hasPages ? (
                            <div className="text-center py-8 text-slate-500">
                                No specific page data available for this source.
                            </div>
                        ) : (
                            <div className="rounded-md border border-slate-200 divide-y divide-slate-100">
                                <div className="grid grid-cols-[1fr_auto] gap-4 p-3 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <div>Page URL</div>
                                    <div>Citations</div>
                                </div>
                                {topPages.map((page, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_auto] gap-4 p-3 hover:bg-slate-50 transition-colors items-center">
                                        <div className="min-w-0">
                                            <a
                                                href={page.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block flex items-center gap-1.5"
                                                title={page.url}
                                            >
                                                <span className="truncate">{page.url}</span>
                                                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                                            </a>
                                        </div>
                                        <div className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full min-w-[2rem] text-center">
                                            {page.count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow transition-colors hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50"
                        >
                            Close
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button
                            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
