import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type ResumeLeaveModalProps = {
    open: boolean;
    isSaving?: boolean;
    onSaveAndLeave: () => void | Promise<void>;
    onDiscardAndLeave: () => void | Promise<void>;
    onStay: () => void;
};

export default function ResumeLeaveModal({
    open,
    isSaving = false,
    onSaveAndLeave,
    onDiscardAndLeave,
    onStay,
}: ResumeLeaveModalProps) {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="resume-leave-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(15, 15, 25, 0.72)', backdropFilter: 'blur(10px)' }}
                    onClick={() => onStay()}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 14 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-8 py-6 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed]">
                            <h3 className="text-xl font-black text-white">Unsaved changes</h3>
                            <p className="text-white/75 text-sm font-medium mt-1">
                                Your resume has updates that may not be fully saved.
                            </p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <div className="text-sm font-bold text-gray-800">What would you like to do?</div>
                                <div className="text-xs text-gray-500 font-medium">
                                    Choose an option below. If you leave without saving, your latest edits may be lost.
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={() => onSaveAndLeave()}
                                    disabled={isSaving}
                                    className="sm:flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-sm shadow-lg shadow-green-200/40 disabled:opacity-60 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Saving...' : 'Save & Leave'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onDiscardAndLeave()}
                                    disabled={isSaving}
                                    className="sm:flex-1 px-4 py-3 rounded-xl border-2 border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-60"
                                >
                                    Discard & Leave
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => onStay()}
                                disabled={isSaving}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-sm transition-all disabled:opacity-60"
                            >
                                Stay on Page
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

