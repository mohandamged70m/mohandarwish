"use client";

import React, { useState, useEffect, useRef } from 'react';
import { sanitizeSvg } from '@/lib/sanitize';
import { createPortal } from 'react-dom';
import { X, Upload, Plus, Image as ImageIcon, ExternalLink, Trash2, Search } from 'lucide-react';
import { Github } from '@/components/dash/icons';
import { doc, collection, onSnapshot } from '@/lib/dash-db';
import { db } from '@/lib/dash-db';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from '@/lib/motion';

import { ProjectData, TagData, ContributorData } from '@/types';
import FileImage from '@/components/dash/FileImage';
import { useObjectURL } from '@/hooks/useObjectURL';

interface ProjectFormData extends Omit<ProjectData, 'images' | 'icon'> {
    images: (File | string)[];
    icon?: File | string;
}

interface MProjectFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ProjectFormData) => void;
    initialData?: ProjectFormData | null;
}

interface RawFirestoreTag {
    Name?: string;
    Color?: string;
    Icon?: string;
}

interface RawFirestoreContributor {
    Name?: string;
    Role?: string;
    Image?: string;
    'Social Accounts'?: {
        Github?: string;
        Linkedin?: string;
        Facebook?: string;
        Instagram?: string;
        Portfolio?: string;
    };
}

/** Small helper that revokes its blob URL on unmount - used for video previews
 *  (FileImage handles the same job for <img> tags). */
const GalleryVideoPreview = ({ file }: { file: string | File }) => {
    const url = useObjectURL(file);
    if (!url) return null;
    return <video src={url} className="w-full h-full object-cover" />;
};

/** LivePreviewCard image/video slot - handles blob URL cleanup automatically. */
const LivePreviewItem = ({
    img,
    isVid,
    alt,
    style,
}: {
    img: string | File;
    isVid: boolean;
    alt: string;
    style: React.CSSProperties;
}) => {
    const url = useObjectURL(img);
    if (!url) return null;
    if (isVid) {
        return <video src={url} muted autoPlay loop playsInline style={style} />;
    }
    return <img src={url} alt={alt} style={style} />;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Mono section header — brutalist rule, no colored bubbles. */
const SectionHead = ({ index, title, hint }: { index: string; title: string; hint?: string }) => (
    <div className="flex items-baseline justify-between gap-3 border-b pb-3"
        style={{ borderColor: 'var(--border)' }}>
        <p className="m-0 text-[12px] font-medium uppercase"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--accent-text)' }}>{index}</span>
            <span style={{ color: 'var(--text-muted)' }}> / </span>
            {title}
        </p>
        {hint && (
            <p className="m-0 hidden text-[12px] sm:block"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>
                {hint}
            </p>
        )}
    </div>
);

/** Mono field label with required marker + optional hint. */
const FieldLabel = ({
    htmlFor,
    children,
    required,
    hint,
}: {
    htmlFor: string;
    children: React.ReactNode;
    required?: boolean;
    hint?: string;
}) => (
    <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor}
            className="text-[12px] font-medium uppercase"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {children}
            {required && <span aria-hidden="true" style={{ color: 'var(--accent-text)' }}> *</span>}
        </label>
        {hint && (
            <span className="text-[11px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>
                {hint}
            </span>
        )}
    </div>
);

const MProjectForm = ({ isOpen, onClose, onSave, initialData }: Omit<MProjectFormProps, 'initialData'> & { initialData?: MProjectFormProps['initialData'] }) => {
    const prefersReducedMotion = useReducedMotion();
    // --- STATE ---
    const [formData, setFormData] = useState<ProjectFormData>(initialData || {
        name: '',
        description: '',
        tags: [],
        contributors: [],
        repoLink: '',
        liveLink: '',
        downloadLink: '',
        images: [],
        icon: undefined,
        listing: 0
    });

    const [selectTagOpen, setSelectTagOpen] = useState(false);
    const [selectContribOpen, setSelectContribOpen] = useState(false);
    const [tagQuery, setTagQuery] = useState('');
    const [contribQuery, setContribQuery] = useState('');
    const [availableTags, setAvailableTags] = useState<TagData[]>([]);
    const [availableContributors, setAvailableContributors] = useState<ContributorData[]>([]);
    const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');

    const iconInputRef = useRef<HTMLInputElement>(null);
    const imagesInputRef = useRef<HTMLInputElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const tagSearchRef = useRef<HTMLInputElement>(null);
    const contribSearchRef = useRef<HTMLInputElement>(null);

    // Fetch Tags and Contributors from Firebase
    useEffect(() => {
        const unsubTags = onSnapshot(doc(db, 'Tags', 'Tags'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const tagsData = Object.entries(data).map(([id, val]: [string, RawFirestoreTag]) => ({
                    id,
                    name: val.Name || 'Untitled',
                    color: val.Color || '#3b82f6',
                    iconSvg: val.Icon || ''
                }));
                tagsData.sort((a, b) => a.name.localeCompare(b.name));
                setAvailableTags(tagsData);
            }
        });

        const unsubContributorsDoc = onSnapshot(doc(db, 'Tags', 'Contributors'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const contribData = Object.entries(data)
                    .filter(([, val]) => val && typeof val === 'object' && (val as RawFirestoreContributor).Name)
                    .map(([id, val]: [string, RawFirestoreContributor]) => ({
                        id,
                        name: val.Name || 'Anonymous',
                        role: val.Role || '',
                        image: val.Image || '',
                        socials: {
                            github: val['Social Accounts']?.Github || '',
                            linkedin: val['Social Accounts']?.Linkedin || '',
                            facebook: val['Social Accounts']?.Facebook || '',
                            instagram: val['Social Accounts']?.Instagram || '',
                            portfolio: val['Social Accounts']?.Portfolio || ''
                        }
                    } as ContributorData));
                setAvailableContributors(prev => {
                    const filtered = prev.filter(c => !contribData.some(d => d.id === c.id));
                    const combined = [...filtered, ...contribData];
                    return combined.sort((a, b) => a.name.localeCompare(b.name));
                });
            }
        });

        const unsubContributorsCol = onSnapshot(collection(db, 'Tags', 'Contributors', 'Profiles'), (snapshot) => {
            const contribData = snapshot.docs.map(doc => {
                const val = doc.data();
                return {
                    id: doc.id,
                    name: val.Name || val.name || 'Anonymous',
                    role: val.Role || val.role || '',
                    image: val.Image || val.image || '',
                    socials: {
                        github: (val['Social Accounts']?.Github || val.socials?.github || ''),
                        linkedin: (val['Social Accounts']?.Linkedin || val.socials?.linkedin || ''),
                        facebook: (val['Social Accounts']?.Facebook || val.socials?.facebook || ''),
                        instagram: (val['Social Accounts']?.Instagram || val.socials?.instagram || ''),
                        portfolio: (val['Social Accounts']?.Portfolio || val.socials?.portfolio || '')
                    }
                };
            });
            setAvailableContributors(prev => {
                const filtered = prev.filter(c => !contribData.some(d => d.id === c.id));
                const combined = [...filtered, ...contribData];
                return combined.sort((a, b) => a.name.localeCompare(b.name));
            });
        });

        return () => {
            unsubTags();
            unsubContributorsDoc();
            unsubContributorsCol();
        };
    }, []);

    // Escape to close + scroll lock + initial focus (a11y: keyboard, focus)
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectTagOpen) setSelectTagOpen(false);
                else if (selectContribOpen) setSelectContribOpen(false);
                else onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const t = window.setTimeout(() => closeRef.current?.focus(), 60);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
            window.clearTimeout(t);
        };
    }, [isOpen, onClose, selectTagOpen, selectContribOpen]);

    useEffect(() => {
        if (selectTagOpen) {
            const t = window.setTimeout(() => tagSearchRef.current?.focus(), 60);
            return () => window.clearTimeout(t);
        }
    }, [selectTagOpen]);

    useEffect(() => {
        if (selectContribOpen) {
            const t = window.setTimeout(() => contribSearchRef.current?.focus(), 60);
            return () => window.clearTimeout(t);
        }
    }, [selectContribOpen]);

    // --- HANDLERS ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
    };

    const isVideo = (file: File | string) => {
        if (typeof file === 'string') {
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
            const url = file.split('?')[0].toLowerCase();
            return videoExtensions.some(ext => url.endsWith(ext)) || url.includes('/videos/');
        }
        return file.type.startsWith('video/');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFormData(prev => ({ ...prev, images: [...prev.images, ...newFiles] }));
        }
    };

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setFormData(prev => ({ ...prev, icon: file }));
    };

    const removeFile = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleAddTag = (tag: TagData) => {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    };

    const removeTag = (index: number) => setFormData(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== index) }));

    const handleAddContributor = (c: ContributorData) => {
        setFormData(prev => ({ ...prev, contributors: [...prev.contributors, c] }));
    };

    const removeContributor = (index: number) => setFormData(prev => ({ ...prev, contributors: prev.contributors.filter((_, i) => i !== index) }));

    const updateContributorRole = (index: number, role: string) => {
        setFormData(prev => ({
            ...prev,
            contributors: prev.contributors.map((c, i) => i === index ? { ...c, role } : c)
        }));
    };

    const selectTag = (tag: TagData) => {
        if (!formData.tags.some(t => t.id === tag.id || t.name === tag.name)) {
            handleAddTag(tag);
        }
        setSelectTagOpen(false);
    };

    const selectContributor = (c: ContributorData) => {
        if (!formData.contributors.some(existing => existing.id === c.id || existing.name === c.name)) {
            handleAddContributor(c);
        }
        setSelectContribOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    // Completion — 6 fields, tabular mono readout
    const completionFields = [
        !!formData.name.trim(),
        !!formData.description.trim(),
        formData.tags.length > 0,
        formData.contributors.length > 0,
        !!formData.repoLink || !!formData.liveLink,
        formData.images.length > 0 || !!formData.icon
    ];
    const doneCount = completionFields.filter(Boolean).length;
    const completionPercentage = Math.round((doneCount / completionFields.length) * 100);

    const filteredTags = tagQuery.trim()
        ? availableTags.filter(t => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase()))
        : availableTags;
    const filteredContribs = contribQuery.trim()
        ? availableContributors.filter(c =>
            c.name.toLowerCase().includes(contribQuery.trim().toLowerCase()) ||
            (c.role || '').toLowerCase().includes(contribQuery.trim().toLowerCase()))
        : availableContributors;

    const motionOff = !!prefersReducedMotion;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={motionOff ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={motionOff ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: motionOff ? 0.01 : 0.2 }}
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                    onClick={onClose}
                    aria-hidden={false}
                >
                    {/* Panel */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={initialData ? 'Edit project' : 'New project'}
                        initial={motionOff ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={motionOff ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.985 }}
                        transition={motionOff ? { duration: 0.01 } : { duration: 0.3, ease: [...EASE_OUT] }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex w-full flex-col overflow-hidden lg:flex-row"
                        style={{
                            maxWidth: 1180,
                            width: '100%',
                            height: 'min(92dvh, 860px)',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
                            fontFamily: 'var(--font-body)',
                            transformOrigin: 'center',
                        }}
                    >
                        {/* LEFT — form */}
                        <div className={`${activeView === 'preview' ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col overflow-hidden`}>
                            {/* Header */}
                            <div className="shrink-0 px-5 pt-5 sm:px-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="m-0 text-[11px] font-medium uppercase"
                                            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                                            Dashboard — Projects <span style={{ color: 'var(--accent-text)' }}>{initialData ? '// edit' : '// new'}</span>
                                        </p>
                                        <h2 className="mt-1.5 truncate text-[20px] font-semibold leading-tight"
                                            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                                            {initialData ? `Edit — ${initialData.name || 'project'}` : 'New project'}
                                        </h2>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="tnum text-[12px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }} aria-label={`${doneCount} of 6 fields complete`}>
                                            {doneCount}/6
                                        </span>
                                        <button
                                            ref={closeRef}
                                            type="button"
                                            onClick={onClose}
                                            aria-label="Close project form"
                                            className="inline-flex h-10 w-10 items-center justify-center cursor-pointer"
                                            style={{
                                                borderRadius: 4,
                                                border: '1px solid var(--border)',
                                                background: 'transparent',
                                                color: 'var(--text-secondary)',
                                                transition: 'border-color .18s ease, background .18s ease, color .18s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border-strong)';
                                                e.currentTarget.style.background = 'var(--bg-surface-hover)';
                                                e.currentTarget.style.color = 'var(--text-primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }}
                                        >
                                            <X size={17} />
                                        </button>
                                    </div>
                                </div>
                                {/* progress hairline */}
                                <div className="mt-4 h-[2px] w-full overflow-hidden" style={{ background: 'var(--bg-surface)' }} role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Form completion">
                                    <div className="h-full" style={{ width: `${completionPercentage}%`, background: 'var(--accent-primary)', transition: 'width .35s cubic-bezier(0.22,1,0.36,1)' }} />
                                </div>
                                {/* mobile preview switch */}
                                <div className="flex py-3 lg:hidden">
                                    <button
                                        type="button"
                                        onClick={() => setActiveView('preview')}
                                        className="text-[12px] font-medium uppercase cursor-pointer"
                                        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0 }}
                                    >
                                        Preview → 
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="mpf-scroll min-w-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6" data-lenis-prevent>
                                <form id="projectForm" onSubmit={handleSubmit} className="flex flex-col gap-8 pt-5">
                                    {/* 01 BASICS */}
                                    <section aria-label="Basics">
                                        <SectionHead index="01" title="Basics" hint="name + links" />
                                        <div className="mt-4 flex flex-col gap-4">
                                            <div>
                                                <FieldLabel htmlFor="mpf-name" required hint="keep it short">Project name</FieldLabel>
                                                <input
                                                    id="mpf-name"
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    placeholder="Atlas billing dashboard"
                                                    className="mpf-input"
                                                    required
                                                    aria-required="true"
                                                    autoComplete="off"
                                                    maxLength={80}
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="mpf-desc" required hint={`${formData.description.length}/240`}>Description</FieldLabel>
                                                <textarea
                                                    id="mpf-desc"
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleInputChange}
                                                    placeholder="What it does, who it's for — one or two lines."
                                                    className="mpf-input mpf-area"
                                                    required
                                                    aria-required="true"
                                                    maxLength={240}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div>
                                                    <FieldLabel htmlFor="mpf-repo">Repo link</FieldLabel>
                                                    <input id="mpf-repo" type="url" name="repoLink" value={formData.repoLink} onChange={handleInputChange} placeholder="https://github.com/…" className="mpf-input mpf-mono" inputMode="url" />
                                                </div>
                                                <div>
                                                    <FieldLabel htmlFor="mpf-live">Live link</FieldLabel>
                                                    <input id="mpf-live" type="url" name="liveLink" value={formData.liveLink} onChange={handleInputChange} placeholder="https://…" className="mpf-input mpf-mono" inputMode="url" />
                                                </div>
                                            </div>
                                            <div className="md:max-w-[50%] md:pr-2">
                                                <FieldLabel htmlFor="mpf-dl" hint="optional">Download link</FieldLabel>
                                                <input id="mpf-dl" type="url" name="downloadLink" value={formData.downloadLink || ''} onChange={handleInputChange} placeholder="https://… (.zip / store)" className="mpf-input mpf-mono" inputMode="url" />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 02 MEDIA */}
                                    <section aria-label="Media">
                                        <SectionHead index="02" title="Media" hint="icon + gallery" />
                                        <div className="mt-4 flex flex-col gap-5">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => iconInputRef.current?.click()}
                                                    aria-label={formData.icon ? 'Change project icon' : 'Upload project icon'}
                                                    className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden"
                                                    style={{ borderRadius: 4, border: '1px dashed var(--border-strong)', background: 'var(--bg-surface)' }}
                                                >
                                                    {formData.icon ? (
                                                        <FileImage src={formData.icon} className="h-full w-full object-cover" alt="Project icon" />
                                                    ) : (
                                                        <Upload size={18} style={{ color: 'var(--text-muted)' }} />
                                                    )}
                                                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'rgba(0,0,0,0.55)' }}>
                                                        <Upload size={15} color="#fff" />
                                                    </span>
                                                </button>
                                                <div className="min-w-0">
                                                    <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>Project icon</p>
                                                    <p className="m-0 mt-0.5 text-[12px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>Square works best — 512px+</p>
                                                </div>
                                                {formData.icon && (
                                                    <button type="button" onClick={() => setFormData(p => ({ ...p, icon: undefined }))} aria-label="Remove project icon"
                                                        className="ml-auto inline-flex h-8 items-center gap-1.5 px-2.5 text-[12px] cursor-pointer"
                                                        style={{ fontFamily: 'var(--font-heading)', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}>
                                                        <Trash2 size={13} /> Remove
                                                    </button>
                                                )}
                                                <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" aria-hidden tabIndex={-1} />
                                            </div>

                                            <div>
                                                <FieldLabel htmlFor="mpf-gallery" hint={`${formData.images.length} file${formData.images.length === 1 ? '' : 's'}`}>Gallery</FieldLabel>
                                                {formData.images.length > 0 ? (
                                                    <div id="mpf-gallery" className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                                                        {formData.images.map((file, idx) => (
                                                            <div key={idx} className="group relative aspect-video overflow-hidden" style={{ borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                                                {isVideo(file) ? (
                                                                    <GalleryVideoPreview file={file} />
                                                                ) : (
                                                                    <FileImage src={file} className="h-full w-full object-cover" alt={`Gallery frame ${idx + 1}`} />
                                                                )}
                                                                <span className="tnum absolute left-1.5 top-1.5 px-1.5 py-0.5 text-[10px]" style={{ fontFamily: 'var(--font-heading)', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 4 }}>
                                                                    {String(idx + 1).padStart(2, '0')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFile(idx)}
                                                                    aria-label={`Remove gallery frame ${idx + 1}`}
                                                                    className="absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 items-center justify-center cursor-pointer"
                                                                    style={{ borderRadius: 4, background: 'var(--accent-primary)', color: 'var(--text-on-accent)', border: 'none' }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => imagesInputRef.current?.click()}
                                                            aria-label="Add more gallery files"
                                                            className="flex aspect-video cursor-pointer items-center justify-center"
                                                            style={{ borderRadius: 4, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', transition: 'border-color .18s ease, color .18s ease' }}
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => imagesInputRef.current?.click()}
                                                        className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 px-4 py-8"
                                                        style={{ borderRadius: 4, border: '1px dashed var(--border-strong)', background: 'var(--bg-surface)' }}
                                                    >
                                                        <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
                                                        <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Add screenshots or a short clip</span>
                                                        <span className="text-[12px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>PNG · JPG · MP4 — first frame becomes the cover</span>
                                                    </button>
                                                )}
                                                <input ref={imagesInputRef} id="mpf-gallery" type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" aria-hidden tabIndex={-1} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 03 STACK */}
                                    <section aria-label="Tech stack">
                                        <SectionHead index="03" title="Stack" hint={`${formData.tags.length} selected`} />
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {formData.tags.map((tag, idx) => (
                                                <span key={`${tag.id ?? tag.name}-${idx}`}
                                                    className="inline-flex items-center gap-2 py-1.5 pl-2.5 pr-1.5 text-[12px] font-medium"
                                                    style={{
                                                        fontFamily: 'var(--font-heading)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        borderRadius: 4,
                                                        border: '1px solid var(--border)',
                                                        background: 'var(--accent-soft)',
                                                        color: 'var(--accent-soft-text)',
                                                    }}>
                                                    {tag.iconSvg && (
                                                        tag.iconSvg.startsWith('http') || tag.iconSvg.startsWith('data:image') ? (
                                                            <img src={tag.iconSvg} className="h-3.5 w-3.5 object-contain" alt="" aria-hidden />
                                                        ) : (
                                                            <span className="flex h-3.5 w-3.5 items-center justify-center" aria-hidden dangerouslySetInnerHTML={{ __html: sanitizeSvg(tag.iconSvg) }} />
                                                        )
                                                    )}
                                                    {tag.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTag(idx)}
                                                        aria-label={`Remove ${tag.name}`}
                                                        className="inline-flex h-6 w-6 items-center justify-center cursor-pointer"
                                                        style={{ borderRadius: 4, border: 'none', background: 'transparent', color: 'inherit', opacity: 0.75 }}
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </span>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { setTagQuery(''); setSelectTagOpen(true); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium uppercase cursor-pointer"
                                                style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', borderRadius: 4, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)' }}
                                            >
                                                <Plus size={13} /> Add tech
                                            </button>
                                        </div>
                                        {formData.tags.length === 0 && (
                                            <p className="m-0 mt-2.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>Pick from your tag library — colors and icons come along automatically.</p>
                                        )}
                                    </section>

                                    {/* 04 TEAM */}
                                    <section aria-label="Team">
                                        <SectionHead index="04" title="Team" hint={`${formData.contributors.length} member${formData.contributors.length === 1 ? '' : 's'}`} />
                                        <div className="mt-4 flex flex-col gap-2.5">
                                            {formData.contributors.map((contrib, idx) => (
                                                <div key={`${contrib.id ?? contrib.name}-${idx}`}
                                                    className="flex items-center gap-3 p-2.5"
                                                    style={{ borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                                    {contrib.image ? (
                                                        <FileImage src={contrib.image} className="h-9 w-9 shrink-0 object-cover" alt="" />
                                                    ) : (
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-semibold"
                                                            style={{ borderRadius: 4, background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
                                                            {contrib.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="m-0 truncate text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{contrib.name}</p>
                                                        <input
                                                            type="text"
                                                            value={contrib.role}
                                                            onChange={(e) => updateContributorRole(idx, e.target.value)}
                                                            placeholder="Role on this project…"
                                                            aria-label={`Role for ${contrib.name}`}
                                                            className="mpf-input mpf-small mt-1"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeContributor(idx)}
                                                        aria-label={`Remove ${contrib.name}`}
                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center cursor-pointer"
                                                        style={{ borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { setContribQuery(''); setSelectContribOpen(true); }}
                                                className="flex items-center justify-center gap-1.5 px-3 py-3 text-[12px] font-medium uppercase cursor-pointer"
                                                style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', borderRadius: 4, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)' }}
                                            >
                                                <Plus size={14} /> Add member
                                            </button>
                                        </div>
                                    </section>
                                </form>
                            </div>

                            {/* Footer */}
                            <div className="shrink-0 px-5 py-4 sm:px-6" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="tnum m-0 text-[11px] uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                        {initialData ? 'Unsaved changes stay here' : 'Draft — saves on create'} · {doneCount}/6
                                    </p>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 text-[13px] font-medium uppercase cursor-pointer"
                                            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', height: 40, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            form="projectForm"
                                            className="px-5 text-[13px] font-semibold uppercase cursor-pointer"
                                            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', height: 40, borderRadius: 4, border: '1px solid var(--accent-primary)', background: 'var(--accent-primary)', color: 'var(--text-on-accent)', boxShadow: 'var(--shadow-accent)' }}
                                        >
                                            {initialData ? 'Save changes' : 'Create project'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT — preview */}
                        <aside className={`${activeView === 'edit' ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col overflow-hidden`} style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)' }} aria-label="Live preview">
                            <div className="flex shrink-0 items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                <p className="m-0 text-[11px] font-medium uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                                    Preview <span style={{ color: 'var(--accent-text)' }}>● live</span>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setActiveView('edit')}
                                    className="px-3 text-[12px] font-medium uppercase cursor-pointer lg:hidden"
                                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', height: 36, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}
                                >
                                    ← Edit
                                </button>
                            </div>
                            <div className="flex flex-1 items-start justify-center overflow-y-auto px-5 py-6" data-lenis-prevent>
                                <div className="w-full" style={{ maxWidth: 340 }}>
                                    <LiveProjectCard project={formData} />
                                    <p className="m-0 mt-4 text-[12px] leading-relaxed" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>
                                        Updates as you type. Cover = first gallery frame.
                                    </p>
                                </div>
                            </div>
                        </aside>
                    </motion.div>

                    {/* TAG PICKER */}
                    <AnimatePresence>
                        {selectTagOpen && (
                            <motion.div
                                initial={motionOff ? { opacity: 1 } : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={motionOff ? { opacity: 1 } : { opacity: 0 }}
                                transition={{ duration: motionOff ? 0.01 : 0.16 }}
                                className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
                                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                                onClick={() => setSelectTagOpen(false)}
                            >
                                <motion.div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label="Choose tech stack"
                                    initial={motionOff ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={motionOff ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
                                    transition={motionOff ? { duration: 0.01 } : { duration: 0.24, ease: [...EASE_OUT] }}
                                    className="flex max-h-[82vh] w-full flex-col overflow-hidden"
                                    style={{ maxWidth: 560, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="shrink-0 px-5 pb-4 pt-5" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="m-0 text-[11px] font-medium uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Library — Tags</p>
                                                <h3 className="m-0 mt-1 text-[17px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Choose tech</h3>
                                            </div>
                                            <button type="button" onClick={() => setSelectTagOpen(false)} aria-label="Close tech picker"
                                                className="inline-flex h-9 w-9 items-center justify-center cursor-pointer"
                                                style={{ borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="relative mt-3.5">
                                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                            <input ref={tagSearchRef} type="text" value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="Filter tags…" aria-label="Filter tags"
                                                className="mpf-input" style={{ paddingLeft: 36 }} />
                                        </div>
                                    </div>
                                    <div className="mpf-scroll grid flex-1 grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2" data-lenis-prevent>
                                        {filteredTags.map((tag) => {
                                            const added = formData.tags.some(t => t.id === tag.id || t.name === tag.name);
                                            return (
                                                <button
                                                    key={tag.id ?? tag.name}
                                                    type="button"
                                                    onClick={() => selectTag(tag)}
                                                    disabled={added}
                                                    className="flex items-center gap-3 p-3 text-left cursor-pointer"
                                                    style={{
                                                        borderRadius: 4,
                                                        border: added ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                                                        background: added ? 'var(--accent-soft)' : 'var(--bg-surface)',
                                                        opacity: added ? 0.85 : 1,
                                                        cursor: added ? 'default' : 'pointer',
                                                    }}
                                                >
                                                    {tag.iconSvg && (
                                                        tag.iconSvg.startsWith('http') || tag.iconSvg.startsWith('data:image') ? (
                                                            <img src={tag.iconSvg} className="h-6 w-6 shrink-0 object-contain" alt="" aria-hidden />
                                                        ) : (
                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden dangerouslySetInnerHTML={{ __html: sanitizeSvg(tag.iconSvg) }} />
                                                        )
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{tag.name}</span>
                                                    {added && (
                                                        <span className="shrink-0 text-[10px] font-medium uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--accent-text)' }}>Added</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {filteredTags.length === 0 && (
                                            <p className="m-0 col-span-full px-1 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>No tags match “{tagQuery}”.</p>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CONTRIBUTOR PICKER */}
                    <AnimatePresence>
                        {selectContribOpen && (
                            <motion.div
                                initial={motionOff ? { opacity: 1 } : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={motionOff ? { opacity: 1 } : { opacity: 0 }}
                                transition={{ duration: motionOff ? 0.01 : 0.16 }}
                                className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
                                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                                onClick={() => setSelectContribOpen(false)}
                            >
                                <motion.div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label="Choose contributors"
                                    initial={motionOff ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={motionOff ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
                                    transition={motionOff ? { duration: 0.01 } : { duration: 0.24, ease: [...EASE_OUT] }}
                                    className="flex max-h-[82vh] w-full flex-col overflow-hidden"
                                    style={{ maxWidth: 560, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="shrink-0 px-5 pb-4 pt-5" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="m-0 text-[11px] font-medium uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Library — People</p>
                                                <h3 className="m-0 mt-1 text-[17px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Choose members</h3>
                                            </div>
                                            <button type="button" onClick={() => setSelectContribOpen(false)} aria-label="Close member picker"
                                                className="inline-flex h-9 w-9 items-center justify-center cursor-pointer"
                                                style={{ borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="relative mt-3.5">
                                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                            <input ref={contribSearchRef} type="text" value={contribQuery} onChange={(e) => setContribQuery(e.target.value)} placeholder="Filter people…" aria-label="Filter contributors"
                                                className="mpf-input" style={{ paddingLeft: 36 }} />
                                        </div>
                                    </div>
                                    <div className="mpf-scroll flex flex-1 flex-col gap-2 overflow-y-auto p-4" data-lenis-prevent>
                                        {filteredContribs.map((contrib) => {
                                            const added = formData.contributors.some(c => c.id === contrib.id || c.name === contrib.name);
                                            return (
                                                <button
                                                    key={contrib.id ?? contrib.name}
                                                    type="button"
                                                    onClick={() => selectContributor(contrib)}
                                                    disabled={added}
                                                    className="flex items-center gap-3 p-2.5 text-left cursor-pointer"
                                                    style={{
                                                        borderRadius: 4,
                                                        border: added ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                                                        background: added ? 'var(--accent-soft)' : 'var(--bg-surface)',
                                                        opacity: added ? 0.85 : 1,
                                                        cursor: added ? 'default' : 'pointer',
                                                    }}
                                                >
                                                    {contrib.image ? (
                                                        <FileImage src={contrib.image as string} className="h-9 w-9 shrink-0 object-cover" alt="" />
                                                    ) : (
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-semibold"
                                                            style={{ borderRadius: 4, background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
                                                            {(contrib.name || '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[13.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{contrib.name}</span>
                                                        {!!contrib.role && (
                                                            <span className="block truncate text-[12px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>{contrib.role}</span>
                                                        )}
                                                    </span>
                                                    {added && (
                                                        <span className="shrink-0 text-[10px] font-medium uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--accent-text)' }}>Added</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {filteredContribs.length === 0 && (
                                            <p className="m-0 px-1 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>Nobody matches “{contribQuery}”.</p>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <style>{`
                        .mpf-input {
                            width: 100%;
                            padding: 11px 13px;
                            border-radius: 4px;
                            border: 1px solid var(--input-border);
                            background: var(--input-bg);
                            color: var(--text-primary);
                            outline: none;
                            font-family: var(--font-body);
                            font-size: 14px;
                            line-height: 1.45;
                            transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
                        }
                        .mpf-input::placeholder { color: var(--text-muted); }
                        .mpf-input:hover { border-color: var(--border-strong); }
                        .mpf-input:focus {
                            border-color: var(--border-strong);
                            background: var(--bg-surface);
                            box-shadow: 0 0 0 3px var(--accent-ring);
                        }
                        .mpf-mono { font-family: var(--font-heading); font-size: 13px; }
                        .mpf-area { min-height: 96px; resize: vertical; }
                        .mpf-small { padding: 7px 10px; font-size: 13px; }
                        .mpf-scroll { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
                        .mpf-scroll::-webkit-scrollbar { width: 8px; }
                        .mpf-scroll::-webkit-scrollbar-track { background: transparent; }
                        .mpf-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
                        .mpf-scroll::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
                        @media (prefers-reduced-motion: reduce) {
                            .mpf-input { transition: none; }
                        }
                    `}</style>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

// Live Preview — flat card in the same system (no glass, no dots, no scale gimmick)
const LiveProjectCard = ({ project }: { project: ProjectFormData }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const sortedImages = [...project.images].sort((a, b) => {
        const isVidA = typeof a === 'string'
            ? (a.split('?')[0].toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || a.includes('/videos/'))
            : a.type.startsWith('video/');
        const isVidB = typeof b === 'string'
            ? (b.split('?')[0].toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || b.includes('/videos/'))
            : b.type.startsWith('video/');
        if (isVidA && !isVidB) return -1;
        if (!isVidA && isVidB) return 1;
        return 0;
    });

    const safeIndex = sortedImages.length ? currentImageIndex % sortedImages.length : 0;

    useEffect(() => {
        if (sortedImages.length < 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % sortedImages.length);
        }, 3600);
        return () => clearInterval(interval);
    }, [sortedImages.length]);

    return (
        <div className="flex w-full flex-col overflow-hidden"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
            }}
        >
            {/* cover */}
            <div style={{ position: 'relative', height: 190, overflow: 'hidden', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {sortedImages.length > 0 ? (
                    sortedImages.map((img, i) => {
                        const isVid = typeof img === 'string'
                            ? (img.split('?')[0].toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || img.includes('/videos/'))
                            : img.type.startsWith('video/');
                        return (
                            <LivePreviewItem
                                key={i}
                                img={img}
                                isVid={!!isVid}
                                alt={project.name || 'Project cover'}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    opacity: i === safeIndex ? 1 : 0,
                                    transition: 'opacity .5s ease',
                                }}
                            />
                        );
                    })
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon size={30} style={{ color: 'var(--border-strong)' }} />
                    </div>
                )}
                {/* stack chips */}
                {project.tags.length > 0 && (
                    <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
                        {project.tags.slice(0, 2).map((tech, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase"
                                style={{
                                    fontFamily: 'var(--font-heading)',
                                    letterSpacing: '0.05em',
                                    borderRadius: 4,
                                    background: 'rgba(10,10,10,0.72)',
                                    border: '1px solid var(--border-strong)',
                                    color: 'var(--accent-soft-text)',
                                    backdropFilter: 'blur(6px)',
                                }}>
                                {tech.iconSvg && (
                                    tech.iconSvg.startsWith('http') || tech.iconSvg.startsWith('data:image') ? (
                                        <img src={tech.iconSvg} className="h-3 w-3 object-contain" alt="" aria-hidden />
                                    ) : (
                                        <span className="flex h-3 w-3 items-center justify-center" aria-hidden
                                            style={{ filter: 'brightness(0) invert(1)' }}
                                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(tech.iconSvg) }} />
                                    )
                                )}
                                {tech.name}
                            </span>
                        ))}
                        {project.tags.length > 2 && (
                            <span className="tnum px-2 py-1 text-[10px] font-medium"
                                style={{ fontFamily: 'var(--font-heading)', borderRadius: 4, background: 'rgba(10,10,10,0.72)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                +{project.tags.length - 2}
                            </span>
                        )}
                    </div>
                )}
                {sortedImages.length > 1 && (
                    <span className="tnum absolute bottom-2.5 right-3 px-1.5 py-0.5 text-[10px]"
                        style={{ fontFamily: 'var(--font-heading)', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 4 }}>
                        {String(safeIndex + 1).padStart(2, '0')}/{String(sortedImages.length).padStart(2, '0')}
                    </span>
                )}
            </div>

            {/* body */}
            <div style={{ padding: '16px 16px 14px' }}>
                <div className="flex items-center gap-2.5">
                    {project.icon ? (
                        <span className="block h-8 w-8 shrink-0 overflow-hidden" style={{ borderRadius: 4, border: '1px solid var(--border)' }}>
                            <FileImage src={project.icon} className="h-full w-full object-cover" alt="" />
                        </span>
                    ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[13px] font-semibold"
                            style={{ borderRadius: 4, background: 'var(--accent-primary)', color: 'var(--text-on-accent)', fontFamily: 'var(--font-display)' }}>
                            {(project.name || '?').charAt(0).toUpperCase()}
                        </span>
                    )}
                    <h3 className="m-0 truncate text-[16px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                        {project.name || 'Untitled project'}
                    </h3>
                </div>
                <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {project.description || 'A line about what this project does will show up here.'}
                </p>
                <div className="mt-3.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div className="flex items-center gap-3 text-[12px] font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
                        {project.repoLink ? (
                            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Github size={13} /> Code</span>
                        ) : (
                            <span style={{ color: 'var(--text-muted)' }}>— code</span>
                        )}
                        {project.liveLink ? (
                            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}><ExternalLink size={13} /> Live</span>
                        ) : (
                            <span style={{ color: 'var(--text-muted)' }}>— live</span>
                        )}
                    </div>
                    {project.contributors.length > 0 && (
                        <div className="flex items-center" aria-label={`${project.contributors.length} contributors`}>
                            {project.contributors.slice(0, 3).map((c, i) => (
                                <span key={i} className="block h-6 w-6 overflow-hidden" title={c.name}
                                    style={{ borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', marginLeft: i === 0 ? 0 : -8 }}>
                                    {typeof c.image === 'string' && c.image ? (
                                        <img src={c.image} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-soft-text)' }}>
                                            {c.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </span>
                            ))}
                            {project.contributors.length > 3 && (
                                <span className="tnum ml-1.5 text-[11px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>
                                    +{project.contributors.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MProjectForm;
