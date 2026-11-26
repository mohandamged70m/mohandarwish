"use client";
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import useTheme from '@/hooks/useTheme';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

interface MConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmType;
    onConfirm: () => void;
    onClose: () => void;
}

const MConfirmModal = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'warning',
    onConfirm,
    onClose
}: MConfirmModalProps) => {
    const isDark = useTheme();

    const getTypeStyles = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: <AlertCircle className="text-dash-danger" size={28} />,
                    bg: 'var(--dash-danger)',
                    border: 'var(--dash-danger)',
                    text: 'text-white',
                    btn: 'bg-dash-danger hover:brightness-95 shadow-[0_8px_24px_var(--shadow-color)]'
                };
            case 'success':
                return {
                    icon: <AlertCircle className="text-dash-success" size={28} />,
                    bg: 'var(--dash-accent-soft)',
                    border: 'var(--dash-accent-soft)',
                    text: 'text-[var(--background)]',
                    btn: 'bg-dash-success hover:brightness-95 shadow-[0_8px_24px_var(--shadow-color)]'
                };
            case 'info':
                return {
                    icon: <Info className="text-dash-accent-text" size={28} />,
                    bg: 'var(--dash-accent-text)',
                    border: 'var(--dash-accent-text)',
                    text: 'text-white',
                    btn: 'bg-dash-accent hover:brightness-95 shadow-[0_8px_24px_var(--shadow-color)]'
                };
            default:
                return {
                    icon: <AlertTriangle className="text-dash-warning" size={28} />,
                    bg: 'var(--dash-warning)',
                    border: 'var(--dash-warning)',
                    text: 'text-[var(--background)]',
                    btn: 'bg-dash-warning hover:brightness-95 shadow-[0_8px_24px_var(--shadow-color)]'
                };
        }
    };

    const styles = getTypeStyles();

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[var(--scrim)] "
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        role="alertdialog"
                        aria-modal="true"
                        aria-label={title}
                        className={`w-full max-w-md overflow-hidden rounded-sm shadow-2xl border relative ${isDark ? 'bg-[var(--dash-bg)] border-dash-border' : 'bg-dash-surface border-dash-border'}`}
                        style={{ transformOrigin: 'center' }}
                    >
                        {/* Header/Banner Area */}
                        <div
                            className="p-6 flex flex-col items-center text-center gap-4"
                            style={{ background: `linear-gradient(to bottom, ${styles.bg}, transparent)` }}
                        >
                            <div
                                className="w-16 h-16 rounded-sm flex items-center justify-center border-2 mb-2"
                                style={{ backgroundColor: styles.bg, borderColor: styles.border }}
                            >
                                {styles.icon}
                            </div>
                            <div>
                                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-dash-text' : 'text-dash-text'}`}>{title}</h3>
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-dash-text-3' : 'text-dash-text-2'}`}>
                                    {message}
                                </p>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className={`p-4 flex gap-3 ${isDark ? 'bg-dash-surface/5' : 'bg-dash-surface-2'}`}>
                            <button
                                onClick={onClose}
                                className={`flex-1 px-4 py-2.5 rounded-sm font-semibold text-sm transition-all ${isDark ? 'hover:bg-dash-surface-3 text-dash-text-3' : 'hover:bg-dash-surface-3 text-dash-text-2'}`}
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`flex-1 px-4 py-2.5 rounded-sm font-bold text-sm transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${styles.text} ${styles.btn}`}
                            >
                                {confirmText}
                            </button>
                        </div>

                        {/* Close Button Top Right */}
                        <button
                            onClick={onClose}
                            aria-label="Close" data-dialog-close
                            className={`absolute top-4 right-4 p-2 rounded-sm transition-all ${isDark ? 'hover:bg-dash-surface-3 text-dash-text-3 hover:text-dash-text-3' : 'hover:bg-dash-surface-3 text-dash-text-3 hover:text-dash-text-2'}`}
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default MConfirmModal;
