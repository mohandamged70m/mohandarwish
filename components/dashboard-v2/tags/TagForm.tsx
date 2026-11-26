"use client";
import React, { useState, useEffect } from 'react';
import { sanitizeSvg } from '@/lib/sanitize';
import { createPortal } from 'react-dom';
import { X, HardDrive } from 'lucide-react';
import MFirebaseStorage from '../StoragePicker';
const firebaseIcon = '/svgs/firebase.svg'; // served from public/ (see StackItemForm note)
import { TagFormData } from '@/types';
import { motion, AnimatePresence } from 'motion/react';

interface MTagFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: TagFormData) => void;
    initialData?: TagFormData | null;
}

const MTagForm = ({ isOpen, onClose, onSave, initialData }: MTagFormProps) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('var(--dash-accent-text)');
    const [iconSvg, setIconSvg] = useState<string>('');
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [firebaseBrowserOpen, setFirebaseBrowserOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                if (initialData) {
                    setName(initialData.name);
                    setColor(initialData.color || 'var(--dash-accent-text)');
                    setIconSvg(initialData.iconSvg || '');
                    setIconFile(null);
                } else {
                    setName('');
                    setColor('var(--dash-accent-text)');
                    setIconSvg('');
                    setIconFile(null);
                }
            });
        }
    }, [isOpen, initialData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'image/svg+xml') {
            setIconFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setIconSvg(event.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: initialData?.id,
            name,
            color,
            iconSvg,
            iconFile: iconFile || undefined
        });
        onClose();
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
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 15 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="modal-content"
                    >
                {/* Header */}
                <div className="modal-header">
                    <h2 className="heading-sm m-0">
                        {initialData ? 'Edit Tag' : 'New Tag'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-icon p-2 hover:bg-input-bg rounded-lg transition-fast"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    {/* Preview Badge */}
                    <div className="flex justify-center p-3">
                        <div
                            className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold border shadow-sm transition-all duration-300"
                            style={{
                                backgroundColor: `color-mix(in srgb, color 8%, transparent)`,
                                color: color,
                                borderColor: `color-mix(in srgb, color 19%, transparent)`,
                                fontSize: '1rem'
                            }}
                        >
                            {iconSvg ? (
                                iconSvg.trim().startsWith('http') ? (
                                    <img src={iconSvg} alt="" className="w-[18px] h-[18px] object-contain" />
                                ) : (
                                    <div
                                        className="w-[18px] h-[18px] flex items-center justify-center overflow-hidden text-inherit"
                                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(iconSvg) }}
                                    />
                                )
                            ) : (
                                <span className="w-[18px] h-[18px] rounded bg-current opacity-40" />
                            )}
                            {name || 'Tag Name'}
                        </div>
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="input-label">Tag Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="e.g. React"
                            className="input-field"
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="input-label">Color Code</label>
                        <div className="relative">
                            {/* Prefix # */}
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-text-3 font-heading select-none z-10 text-lg">#</span>

                            {/* Main Input - Drastically increased padding-left to fix overlap */}
                            <input
                                type="text"
                                value={color.replace('#', '')}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                                    setColor(`#${val}`);
                                }}
                                placeholder="3B82F6"
                                className="input-field w-full pr-14 font-heading uppercase text-lg"
                                style={{ paddingLeft: '30px' }}
                            />

                            {/* Internal Color Swatch */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-10">
                                <input
                                    type="color"
                                    value={color.length === 7 ? color : 'var(--dash-accent-text)'}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div
                                    className="w-full h-full rounded-md shadow-sm border border-input-border transition-all hover:scale-105"
                                    style={{ backgroundColor: color.length === 7 ? color : 'var(--dash-accent-text)' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Icon Upload */}
                    <div>
                        <label className="input-label">Icon (SVG)</label>

                        {/* Preview Box */}
                        {iconSvg && (
                            <div className="flex justify-center mb-3">
                                <div className="w-16 h-16 rounded-sm bg-input-bg flex items-center justify-center overflow-hidden border border-input-border">
                                    {iconSvg.trim().startsWith('http') ? (
                                        <img src={iconSvg} alt="Preview" className="w-12 h-12 object-contain" />
                                    ) : (
                                        <div
                                            className="w-12 h-12 flex items-center justify-center overflow-hidden"
                                            style={{ color }}
                                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(iconSvg) }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Upload Buttons */}
                        <div className="flex gap-3">
                            {/* Local Upload */}
                            <div
                                onClick={() => document.getElementById('tagIconUpload')?.click()}
                                className="flex-1 border-2 border-dashed border-input-border rounded-sm p-4 text-center cursor-pointer bg-input-bg hover:bg-[var(--bg-secondary)] flex flex-col items-center gap-2 transition-all group"
                            >
                                <HardDrive size={24} className="text-dash-text-2 group-hover:text-dash-text transition-colors" />
                                <span className="text-xs text-dash-text-2 group-hover:text-dash-text transition-colors">Local File</span>
                                <input
                                    id="tagIconUpload"
                                    type="file"
                                    accept=".svg"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>

                            {/* Firebase Storage */}
                            <div
                                onClick={() => setFirebaseBrowserOpen(true)}
                                className="flex-1 border-2 border-dashed border-dash-warning/30 rounded-sm p-4 text-center cursor-pointer bg-dash-warning/5 hover:bg-dash-accent-soft flex flex-col items-center gap-2 transition-all group"
                            >
                                <img src={firebaseIcon} alt="Firebase" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" />
                                <span className="text-xs text-dash-warning group-hover:text-dash-warning transition-colors">Firebase Storage</span>
                            </div>
                        </div>
                    </div>

                    {/* Firebase Storage Browser */}
                    <MFirebaseStorage
                        isOpen={firebaseBrowserOpen}
                        onClose={() => setFirebaseBrowserOpen(false)}
                        onSelect={(url) => { setIconSvg(url); setIconFile(null); }}
                        fileTypes={['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp']}
                        title="Select Icon from Firebase"
                    />

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--dash-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary px-6"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn text-dash-text font-semibold shadow-lg transition-transform hover:-translate-y-0.5 px-6"
                            style={{
                                backgroundColor: color,
                                boxShadow: `0 4px 12px color-mix(in srgb, color 25%, transparent)`
                            }}
                        >
                            Save Tag
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
