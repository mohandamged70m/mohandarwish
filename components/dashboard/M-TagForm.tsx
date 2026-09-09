"use client";

import React, { useState, useEffect, useRef } from 'react';
import { sanitizeSvg } from '@/lib/sanitize';
import { createPortal } from 'react-dom';
import { X, HardDrive, Trash2, Link2 } from 'lucide-react';
import { TagFormData } from '@/types';
import { motion, AnimatePresence } from 'motion/react';

interface MTagFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: TagFormData) => void;
    initialData?: TagFormData | null;
}

const FALLBACK_COLOR = '#3b82f6';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

const normalizeColor = (raw: string | undefined): string =>
    raw && HEX_RE.test(raw.trim()) ? raw.trim() : FALLBACK_COLOR;

const MTagForm = ({ isOpen, onClose, onSave, initialData }: MTagFormProps) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState(FALLBACK_COLOR);
    const [hexTouched, setHexTouched] = useState(false);
    const [iconSvg, setIconSvg] = useState<string>('');
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                if (initialData) {
                    setName(initialData.name);
                    setColor(normalizeColor(initialData.color));
                    setIconSvg(initialData.iconSvg || '');
                    setIconFile(null);
                    const initial = (initialData.iconSvg || '').trim();
                    const isUrl = /^https?:\/\//i.test(initial);
                    setShowUrlInput(isUrl);
                    setUrlInput(isUrl ? initial : '');
                } else {
                    setName('');
                    setColor(FALLBACK_COLOR);
                    setIconSvg('');
                    setIconFile(null);
                    setShowUrlInput(false);
                    setUrlInput('');
                }
                setHexTouched(false);
                setFileError(null);
                setUrlError(null);
            });
        }
    }, [isOpen, initialData]);

    // ESC to close + lock body scroll while open
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // Autofocus the name field once the enter animation settles
        const t = setTimeout(() => nameInputRef.current?.focus(), 120);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            clearTimeout(t);
        };
    }, [isOpen, onClose]);

    const handleHexChange = (raw: string) => {
        const val = raw.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
        setColor(`#${val}`);
    };

    const isColorValid = HEX_RE.test(color);
    const showColorError = hexTouched && !isColorValid;
    const canSave = name.trim().length > 0 && isColorValid;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
        if (!isSvg) {
            setFileError('Only .svg files are supported for tag icons.');
            return;
        }
        setFileError(null);
        setUrlError(null);
        setShowUrlInput(false);
        setIconFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            setIconSvg(event.target?.result as string);
        };
        reader.readAsText(file);
    };

    const clearIcon = () => {
        setIconSvg('');
        setIconFile(null);
        setFileError(null);
        setUrlError(null);
        setUrlInput('');
        setShowUrlInput(false);
    };

    const applyUrl = () => {
        const url = urlInput.trim();
        if (!url) {
            setUrlError('Paste an SVG image URL first.');
            return;
        }
        if (!/^https?:\/\/.+/i.test(url)) {
            setUrlError('URL must start with http:// or https://');
            return;
        }
        setUrlError(null);
        setFileError(null);
        setIconFile(null);
        setIconSvg(url);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) {
            setHexTouched(true);
            return;
        }
        // Parent closes the modal on successful save so a failed
        // write keeps the form open instead of losing input.
        onSave({
            id: initialData?.id,
            name: name.trim(),
            color,
            iconSvg,
            iconFile: iconFile || undefined
        });
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="modal-backdrop open"
                    style={{ zIndex: 1100 }}
                    onClick={onClose}
                    role="presentation"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 15 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="modal-content"
                        role="dialog"
                        aria-modal="true"
                        aria-label={initialData ? 'Edit tag' : 'New tag'}
                        onClick={(e) => e.stopPropagation()}
                    >
                {/* Header */}
                <div className="modal-header">
                    <h2 className="heading-sm m-0">
                        {initialData ? 'Edit Tag' : 'New Tag'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="btn-icon p-2 hover:bg-input-bg rounded-lg transition-fast"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form" noValidate={false}>
                    {/* Preview Badge */}
                    <div className="flex justify-center p-3" aria-hidden="true">
                        <div
                            className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold border shadow-sm transition-all duration-300 max-w-full"
                            style={{
                                backgroundColor: isColorValid ? `${color}15` : undefined,
                                color: isColorValid ? color : undefined,
                                borderColor: isColorValid ? `${color}30` : undefined,
                                fontSize: '1rem'
                            }}
                        >
                            {iconSvg ? (
                                iconSvg.trim().startsWith('http') ? (
                                    <img src={iconSvg} alt="" className="w-[18px] h-[18px] object-contain" />
                                ) : (
                                    <div
                                        className="w-[18px] h-[18px] flex items-center justify-center overflow-hidden text-inherit [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current"
                                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(iconSvg) }}
                                    />
                                )
                            ) : (
                                <span className="w-[18px] h-[18px] rounded bg-current opacity-40" />
                            )}
                            <span className="truncate">{name.trim() || 'Tag Name'}</span>
                        </div>
                    </div>

                    {/* Name Input */}
                    <div>
                        <label htmlFor="tag-name" className="input-label">Tag Name *</label>
                        <input
                            id="tag-name"
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            maxLength={40}
                            autoComplete="off"
                            placeholder="e.g. React"
                            className="input-field"
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label htmlFor="tag-color-hex" className="input-label">Color Code *</label>
                        <div className="relative">
                            {/* Prefix # */}
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-mono select-none z-10 text-lg" aria-hidden="true">#</span>

                            <input
                                id="tag-color-hex"
                                type="text"
                                value={color.replace('#', '')}
                                onChange={(e) => handleHexChange(e.target.value)}
                                onBlur={() => setHexTouched(true)}
                                placeholder="3B82F6"
                                maxLength={6}
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={showColorError}
                                aria-describedby={showColorError ? 'tag-color-error' : undefined}
                                className="input-field w-full pr-14 font-mono uppercase text-lg"
                                style={{ paddingLeft: '30px' }}
                            />

                            {/* Internal Color Swatch */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-10">
                                <input
                                    type="color"
                                    aria-label="Pick tag color"
                                    value={isColorValid ? color : FALLBACK_COLOR}
                                    onChange={(e) => { setColor(e.target.value); setHexTouched(false); }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div
                                    aria-hidden="true"
                                    className="w-full h-full rounded-md shadow-sm border border-input-border transition-all hover:scale-105"
                                    style={{ backgroundColor: isColorValid ? color : FALLBACK_COLOR }}
                                />
                            </div>
                        </div>
                        {showColorError ? (
                            <p id="tag-color-error" role="alert" className="text-sm text-red-500 mt-2">
                                Enter a valid 6-digit hex code (e.g. 3B82F6).
                            </p>
                        ) : (
                            <div className="flex gap-2 mt-3 flex-wrap" role="group" aria-label="Preset colors">
                                {PRESET_COLORS.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        title={preset}
                                        aria-label={`Use color ${preset}`}
                                        aria-pressed={color.toLowerCase() === preset}
                                        onClick={() => { setColor(preset); setHexTouched(false); }}
                                        className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                                        style={{
                                            backgroundColor: preset,
                                            borderColor: color.toLowerCase() === preset ? 'var(--text-primary)' : 'transparent',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Icon Upload */}
                    <div>
                        <span id="tag-icon-label" className="input-label">Icon (SVG)</span>

                        {/* Preview Box */}
                        {iconSvg ? (
                            <div className="flex justify-center mb-3">
                                <div className="relative w-16 h-16 rounded-xl bg-input-bg flex items-center justify-center overflow-hidden border border-input-border">
                                    {iconSvg.trim().startsWith('http') ? (
                                        <img src={iconSvg} alt="Icon preview" className="w-12 h-12 object-contain" />
                                    ) : (
                                        <div
                                            className="w-12 h-12 flex items-center justify-center overflow-hidden [&>svg]:w-full [&>svg]:h-full"
                                            style={{ color: isColorValid ? color : undefined }}
                                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(iconSvg) }}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={clearIcon}
                                        aria-label="Remove icon"
                                        className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {/* Upload Buttons */}
                        <div className="flex gap-3" role="group" aria-labelledby="tag-icon-label">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 border-2 border-dashed border-input-border rounded-xl p-4 text-center cursor-pointer bg-input-bg hover:bg-[var(--bg-secondary)] flex flex-col items-center gap-2 transition-all group"
                            >
                                <HardDrive size={24} className="text-sec group-hover:text-primary transition-colors" aria-hidden="true" />
                                <span className="text-xs text-sec group-hover:text-primary transition-colors">Local SVG file</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".svg,image/svg+xml"
                                onChange={handleFileChange}
                                className="hidden"
                                aria-hidden="true"
                                tabIndex={-1}
                            />

                            <button
                                type="button"
                                onClick={() => setShowUrlInput((v) => !v)}
                                aria-expanded={showUrlInput}
                                className="flex-1 border-2 border-dashed border-sky-500/30 rounded-xl p-4 text-center cursor-pointer bg-sky-500/5 hover:bg-sky-500/10 flex flex-col items-center gap-2 transition-all group"
                            >
                                <Link2 size={24} className="text-sky-600/70 group-hover:text-sky-600 transition-colors" aria-hidden="true" />
                                <span className="text-xs text-sky-600/70 group-hover:text-sky-600 transition-colors">Online SVG URL</span>
                            </button>
                        </div>

                        {showUrlInput && (
                            <div className="mt-3 rounded-xl border border-input-border bg-input-bg p-3">
                                <label htmlFor="tag-icon-url" className="text-xs font-medium text-sec">
                                    Paste a public .svg URL (e.g. https://cdn.simpleicons.org/react)
                                </label>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        id="tag-icon-url"
                                        type="url"
                                        inputMode="url"
                                        value={urlInput}
                                        onChange={(e) => { setUrlInput(e.target.value); if (urlError) setUrlError(null); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } }}
                                        placeholder="https://..."
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="input-field flex-1 font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={applyUrl}
                                        className="btn btn-secondary px-4 shrink-0"
                                    >
                                        Apply
                                    </button>
                                </div>
                                {urlError && (
                                    <p role="alert" className="text-sm text-red-500 mt-2">{urlError}</p>
                                )}
                            </div>
                        )}
                        {fileError && (
                            <p role="alert" className="text-sm text-red-500 mt-2">{fileError}</p>
                        )}
                        {iconFile && !fileError && (
                            <p className="text-xs text-sec mt-2 truncate">Selected: {iconFile.name}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--card-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary px-6"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSave}
                            className="btn text-white font-semibold shadow-lg transition-transform hover:-translate-y-0.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            style={{
                                backgroundColor: isColorValid ? color : FALLBACK_COLOR,
                                boxShadow: `0 4px 12px ${isColorValid ? color : FALLBACK_COLOR}40`
                            }}
                        >
                            {initialData ? 'Save Tag' : 'Add Tag'}
                        </button>
                    </div>
                </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default MTagForm;
