"use client";
import { Save } from 'lucide-react';

interface Props {
    show: boolean;
    onApply: () => void;
    onCancel: () => void;
    isDark: boolean;
    applyLabel?: string;
    cancelLabel?: string;
    saving?: boolean;
}

/**
 * Shared floating "Apply / Cancel" pill for staged-changes screens (SettingsTab,
 * Treasury Settings). One component, reused - centered above content and offset
 * for the dashboard sidebar.
 */
const SaveBar = ({ show, onApply, onCancel, isDark, applyLabel = 'Apply Settings', cancelLabel = 'Cancel', saving = false }: Props) => {
    if (!show) return null;
    return (
        <div
            className="fixed bottom-10 z-[5000] flex animate-scale-in pointer-events-none"
            style={{ left: '50%', transform: 'translateX(calc(-50% + (var(--sidebar-width, 0px) / 2)))' }}
        >
            <div
                className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-4 rounded-full shadow-2xl border pointer-events-auto"
                style={{
                    background: 'var(--dash-surface)',
                    borderColor: 'var(--dash-border)',
                }}
            >
                <button
                    onClick={onApply}
                    disabled={saving}
                    className="btn-primary px-5 sm:px-8 py-2.5 sm:py-3 rounded-full shadow-2xl shadow-[0_8px_24px_var(--shadow-color)] text-[13px] sm:text-[15px] font-bold flex items-center gap-2 hover:brightness-105 transition-all whitespace-nowrap disabled:opacity-80"
                >
                    <Save size={18} className="sm:w-5 sm:h-5" /> {saving ? 'Saving…' : applyLabel}
                </button>
                <button
                    onClick={onCancel}
                    className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border transition-all font-semibold text-[13px] sm:text-[14px] whitespace-nowrap ${isDark
                        ? 'bg-dash-surface/5 hover:bg-dash-surface-3 text-dash-text border-dash-border'
                        : 'bg-dash-surface-2 hover:bg-black/10 text-black border-black/10'}`}
                >
                    {cancelLabel}
                </button>
            </div>
        </div>
    );
};

export default SaveBar;
