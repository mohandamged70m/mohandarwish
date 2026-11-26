/* eslint-disable react/no-unescaped-entities -- ported copy uses natural-language labels */
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { sanitizeSvg } from '@/lib/sanitize';
import { createPortal } from 'react-dom';
import { X, Upload, Plus, Image as ImageIcon, ExternalLink, Trash2, Eye, Edit } from 'lucide-react';
import { Github } from '@/components/dashboard-v2/ui/BrandIcons';
import { doc, collection, onSnapshot } from '@/lib/dash-db';
import { db } from '@/lib/dash-db';
import { motion, AnimatePresence } from 'motion/react';

import { ProjectData, TagData, ContributorData } from '@/types';
import FileImage from '@/components/dashboard-v2/ui/FileImage';
import { useObjectURL } from '@/hooks/useObjectURL';
import useTheme from '@/hooks/useTheme';
import useMediaQuery from '@/hooks/useMediaQuery';
import { BELOW_LG_QUERY } from '../breakpoints';
import { LiveProjectCard } from './LiveProjectCard';

interface ProjectFormData extends Omit<ProjectData, 'images' | 'icon'> {
    images: (File | string)[];
    icon?: File | string;
    caseStudy?: string;
}

interface MProjectFormProps {
    isOpen: boolean;
    onClose: () => void;
    /** Resolves true once the project is stored; the form closes only then. */
    onSave: (data: ProjectFormData) => Promise<boolean>;
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

const MProjectForm = ({ isOpen, onClose, onSave, initialData }: Omit<MProjectFormProps, 'initialData'> & { initialData?: MProjectFormProps['initialData'] }) => {
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

    const isDark = useTheme();
    const belowLg = useMediaQuery(BELOW_LG_QUERY);
    const [saving, setSaving] = useState(false);
    const [selectTagOpen, setSelectTagOpen] = useState(false);
    const [selectContribOpen, setSelectContribOpen] = useState(false);
    const [availableTags, setAvailableTags] = useState<TagData[]>([]);
    const [availableContributors, setAvailableContributors] = useState<ContributorData[]>([]);
    const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');

    const iconInputRef = useRef<HTMLInputElement>(null);
    const imagesInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECTS ---
    // Fetch Tags and Contributors from Firebase
    useEffect(() => {
        const unsubTags = onSnapshot(doc(db, 'Tags', 'Tags'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const tagsData = Object.entries(data).map(([id, val]: [string, RawFirestoreTag]) => ({
                    id,
                    name: val.Name || 'Untitled',
                    color: val.Color || 'var(--dash-accent-text)',
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

    // Closes only after the save is stored. A failed save keeps the form open with the
    // draft as typed (the dashboard shows why), so nothing has to be entered again.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        const saved = await onSave(formData);
        setSaving(false);
        if (saved) onClose();
    };

    // Calculate completion percentage
    const completionFields = [
        !!formData.name,
        !!formData.description,
        formData.tags.length > 0,
        formData.contributors.length > 0,
        !!formData.repoLink || !!formData.liveLink,
        formData.images.length > 0 || !!formData.icon
    ];
    const completionPercentage = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 ${isDark ? 'bg-black/80' : 'bg-black/60'} backdrop-blur-sm`}
                >
                    {/* Main Modal Container */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className={`project-modal-container w-full max-w-[95vw] lg:max-w-[1200px] h-[95vh] rounded-sm overflow-hidden flex flex-row shadow-2xl ${isDark ? 'bg-dash-bg' : 'bg-dash-surface'} border ${isDark ? 'border-dash-border' : 'border-dash-border'}`}
                        style={{ transformOrigin: 'center' }}
                    >
                {/* LEFT PANEL - Form (Hidden on mobile when preview is active) */}
                <div className={`project-form-left ${activeView === 'preview' ? 'hidden-mobile' : ''} min-w-0 flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-[var(--dash-bg)]' : 'bg-dash-surface-2'}`}>
                    {/* Header */}
                    <div className={`px-4 lg:px-8 py-4 lg:py-6 border-b ${isDark ? 'border-dash-border' : 'border-dash-border'}`}
                        style={{ background: isDark ? 'linear-gradient(135deg, var(--dash-accent-soft) 0%, var(--dash-accent) 100%)' : 'linear-gradient(135deg, var(--dash-accent-soft) 0%, var(--dash-accent) 100%)' }}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 lg:gap-4 flex-1">
                                <div className="relative shrink-0">
                                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center shadow-lg`}
                                        style={{ background: 'linear-gradient(135deg, var(--dash-accent) 0%, var(--dash-accent) 100%)' }}>
                                        <Edit className="text-white" size={belowLg ? 20 : 24} />
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className={`text-lg lg:text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-dash-text'}`}>
                                        {initialData ? 'Edit Project' : 'Create Project'}
                                    </h2>
                                    <p className={`text-xs lg:text-sm font-semibold ${isDark ? 'text-dash-text-3' : 'text-dash-text-2'}`}>
                                        {completionPercentage}% Complete
                                    </p>
                                </div>

                                {/* Mobile View Toggle */}
                                <div className="project-mobile-toggle flex">
                                    <button
                                        onClick={() => setActiveView('preview')}
                                        className={`px-3 py-2 text-xs font-bold uppercase rounded-lg transition-all duration-300 flex items-center gap-2 ${isDark ? 'bg-dash-surface/10 text-dash-text-3 hover:bg-dash-surface/20' : 'bg-dash-surface-2 text-dash-text-2 hover:bg-dash-surface-3'}`}
                                    >
                                        <Eye size={14} />
                                        Preview
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className={`shrink-0 w-8 h-8 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center transition-all ${isDark ? 'hover:bg-dash-surface/10 text-dash-text-3 hover:text-white' : 'hover:bg-dash-surface-3 text-dash-text-3 hover:text-dash-text'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-dash-surface/5' : 'bg-dash-surface-3'}`}>
                            <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%`, background: 'linear-gradient(135deg, var(--dash-accent) 0%, var(--dash-accent) 100%)' }}
                            />
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 custom-scrollbar">
                        <form id="projectForm" onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {/* Basic Info Card */}
                            <div className="dashboard-card shadow-lg">
                                <div className="dashboard-section-header">
                                    <div className="dashboard-section-number" style={{ backgroundColor: isDark ? 'var(--dash-accent-soft)' : 'var(--dash-accent-soft)', color: 'var(--dash-accent-text)' }}>
                                        <span>1</span>
                                    </div>
                                    <h3 className={`text-base lg:text-lg font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Basic Information</h3>
                                </div>

                                <div className="flex flex-col gap-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="dashboard-label">Project Name *</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder="My Awesome Project"
                                                className="dashboard-input"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="dashboard-label">Description *</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Describe your project in a few sentences..."
                                            className="dashboard-textarea"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="dashboard-label">Case Study</label>
                                        <textarea
                                            name="caseStudy"
                                            value={formData.caseStudy || ''}
                                            onChange={handleInputChange}
                                            placeholder={'### The problem\nWhat it solves.\n\n### What I built\n- **A point.** Its detail.'}
                                            className="dashboard-textarea"
                                            rows={10}
                                        />
                                        <p className="text-xs text-dash-text-3 mt-2">Only on the project's own page, folded under &quot;The story behind it&quot;. ### starts a heading, - a bullet, **bold**, a blank line a new paragraph.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="dashboard-label">
                                                <Github size={14} className="inline mr-1" />
                                                Repository Link
                                            </label>
                                            <input
                                                type="url"
                                                name="repoLink"
                                                value={formData.repoLink}
                                                onChange={handleInputChange}
                                                placeholder="https://github.com/..."
                                                className="dashboard-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="dashboard-label">
                                                <ExternalLink size={14} className="inline mr-1" />
                                                Live Link
                                            </label>
                                            <input
                                                type="url"
                                                name="liveLink"
                                                value={formData.liveLink}
                                                onChange={handleInputChange}
                                                placeholder="https://..."
                                                className="dashboard-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="dashboard-label">
                                                <Upload size={14} className="inline mr-1" />
                                                Download Link
                                            </label>
                                            <input
                                                type="url"
                                                name="downloadLink"
                                                value={formData.downloadLink}
                                                onChange={handleInputChange}
                                                placeholder="https://..."
                                                className="dashboard-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Media Card */}
                            <div className="dashboard-card shadow-lg">
                                <div className="dashboard-section-header">
                                    <div className="dashboard-section-number" style={{ backgroundColor: 'var(--dash-accent)', color: 'var(--dash-accent-text)' }}>
                                        <span>2</span>
                                    </div>
                                    <h3 className={`text-base lg:text-lg font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Media & Assets</h3>
                                </div>

                                <div className="flex flex-col gap-6">
                                    {/* Icon Upload */}
                                    <div>
                                        <label className="dashboard-label">Project Icon</label>
                                        <div className="flex items-center gap-4">
                                            <div
                                                onClick={() => iconInputRef.current?.click()}
                                                className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer group relative border-2 border-dashed transition-all`}
                                                style={{ borderColor: 'var(--dash-border)', backgroundColor: 'var(--dash-surface-2)' }}
                                            >
                                                {formData.icon ? (
                                                    <FileImage
                                                        src={formData.icon}
                                                        className="w-full h-full object-cover"
                                                        alt="Icon"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Upload size={20} className={isDark ? 'text-dash-text-2' : 'text-dash-text-3'} />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Upload size={16} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-dash-text'}`}>Upload icon</p>
                                                <p className={`text-xs ${'text-dash-text-3'}`}>Square, min 400x400px</p>
                                            </div>
                                            <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                                        </div>
                                    </div>

                                    {/* Gallery Upload */}
                                    <div>
                                        <label className="dashboard-label">Project Gallery</label>
                                        {formData.images.length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {formData.images.map((file, idx) => (
                                                    <div key={idx} className={`aspect-video rounded-lg overflow-hidden relative group ${isDark ? 'bg-dash-surface/5' : 'bg-dash-surface-2'}`}>
                                                        {isVideo(file) ? (
                                                            <GalleryVideoPreview file={file} />
                                                        ) : (
                                                            <FileImage
                                                                src={file}
                                                                className="w-full h-full object-cover"
                                                                alt={`Gallery ${idx + 1}`}
                                                            />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFile(idx)}
                                                                className="w-8 h-8 rounded-lg bg-dash-danger hover:bg-dash-danger flex items-center justify-center transition-colors"
                                                            >
                                                                <Trash2 size={16} className="text-white" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => imagesInputRef.current?.click()}
                                                    className={`aspect-video rounded-lg border-2 border-dashed flex items-center justify-center transition-all hover:border-[var(--dash-accent)]`}
                                                    style={{ borderColor: 'var(--dash-border)' }}
                                                >
                                                    <Plus size={24} className={isDark ? 'text-dash-text-3' : 'text-dash-text-3'} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => imagesInputRef.current?.click()}
                                                className={`w-full py-8 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-[var(--dash-accent)]`}
                                                style={{ borderColor: 'var(--dash-border)' }}
                                            >
                                                <ImageIcon size={28} className={isDark ? 'text-dash-text-2' : 'text-dash-text-3'} />
                                                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-dash-text'}`}>Click to upload</p>
                                                <p className={`text-xs ${'text-dash-text-3'}`}>PNG, JPG, GIF, MP4 up to 50MB</p>
                                            </button>
                                        )}
                                        <input ref={imagesInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                                    </div>
                                </div>
                            </div>

                            {/* Tech Stack Card */}
                            <div className="dashboard-card shadow-lg">
                                <div className="dashboard-section-header">
                                    <div className="dashboard-section-number" style={{ backgroundColor: 'var(--dash-success)', color: 'var(--text-on-accent)' }}>
                                        <span>3</span>
                                    </div>
                                    <h3 className={`text-base lg:text-lg font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Tech Stack</h3>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {formData.tags.map((tag, idx) => (
                                        <div
                                            key={idx}
                                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-dash-surface/10 border border-white/20' : 'bg-dash-surface-2 border border-dash-border'} group hover:scale-105 transition-all`}
                                        >
                                            {tag.iconSvg && (
                                                tag.iconSvg.startsWith('http') || tag.iconSvg.startsWith('data:image') ? (
                                                    <img src={tag.iconSvg} className="w-4 h-4 object-contain" alt={tag.name} />
                                                ) : (
                                                    <span className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: sanitizeSvg(tag.iconSvg) }} />
                                                )
                                            )}
                                            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-dash-text'}`}>{tag.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeTag(idx)}
                                                className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-dash-text-3 hover:text-dash-danger' : 'text-dash-text-3 hover:text-dash-danger'}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSelectTagOpen(true)}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed transition-all hover:border-[var(--dash-accent)]`}
                                        style={{ borderColor: 'var(--dash-border)' }}
                                    >
                                        <Plus size={16} />
                                        <span className="text-sm font-medium">Add Tech</span>
                                    </button>
                                </div>
                            </div>

                            {/* Team Card */}
                            <div className="dashboard-card shadow-lg">
                                <div className="dashboard-section-header">
                                    <div className="dashboard-section-number" style={{ backgroundColor: 'var(--dash-warning)', color: 'var(--dash-warning)' }}>
                                        <span>4</span>
                                    </div>
                                    <h3 className={`text-base lg:text-lg font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Team Members</h3>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {formData.contributors.map((contrib, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-dash-surface/5 border border-dash-border' : 'bg-dash-surface-2 border border-dash-border'} group`}
                                        >
                                            {contrib.image ? (
                                                <FileImage
                                                    src={contrib.image}
                                                    className="w-10 h-10 rounded-lg object-cover"
                                                    alt={contrib.name}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                                    style={{ background: 'linear-gradient(135deg, var(--dash-accent) 0%, var(--dash-accent) 100%)' }}>
                                                    {contrib.name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-dash-text'}`}>{contrib.name}</p>
                                                <input
                                                    type="text"
                                                    value={contrib.role}
                                                    onChange={(e) => updateContributorRole(idx, e.target.value)}
                                                    placeholder="Role in project..."
                                                    className="dashboard-input text-xs py-1 mt-1"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeContributor(idx)}
                                                className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-dash-text-3 hover:text-dash-danger' : 'text-dash-text-3 hover:text-dash-danger'}`}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSelectContribOpen(true)}
                                        className={`py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-all hover:border-[var(--dash-accent)]`}
                                        style={{ borderColor: 'var(--dash-border)' }}
                                    >
                                        <Plus size={18} />
                                        <span className="font-medium text-sm">Add Member</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className={`px-4 lg:px-8 py-4 border-t ${isDark ? 'border-dash-border bg-black/20' : 'border-dash-border bg-dash-surface-2'}`}>
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn btn-secondary px-4 py-2 text-sm font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="projectForm"
                                disabled={saving}
                                aria-busy={saving}
                                className="btn btn-primary px-6 py-2 shadow-lg hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 text-sm font-bold"
                                style={{ background: 'linear-gradient(135deg, var(--dash-accent) 0%, var(--dash-accent) 100%)' }}
                            >
                                {saving ? 'Saving...' : `${initialData ? 'Update' : 'Create'} Project`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL - Live Preview */}
                <div className={`project-form-right ${activeView === 'edit' ? 'hidden-mobile' : ''} flex-col border-l min-w-0 ${isDark ? 'border-dash-border bg-dash-surface-2' : 'border-dash-border bg-dash-surface-2'}`}>
                    <div className={`px-4 lg:px-6 py-4 border-b ${isDark ? 'border-dash-border' : 'border-dash-border'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center`}
                                style={{ background: 'linear-gradient(135deg, var(--dash-accent) 0%, var(--dash-accent) 100%)' }}>
                                <Eye className="text-white" size={16} />
                            </div>
                            <h3 className={`text-xs lg:text-sm font-bold uppercase tracking-wider ${isDark ? 'text-dash-text-3' : 'text-dash-text-2'}`}>
                                Live Preview
                            </h3>
                        </div>
                        {activeView === 'preview' && (
                            <div className="project-preview-edit-btn flex">
                                <button
                                    onClick={() => setActiveView('edit')}
                                    className="px-3 py-2 text-xs font-bold uppercase rounded-lg transition-all duration-300 flex items-center gap-2 bg-dash-accent text-white hover:scale-105"
                                >
                                    <Edit size={14} />
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex items-center justify-center bg-dots-pattern">
                        <div className="w-full max-w-sm transform scale-90 sm:scale-95 lg:scale-100">
                            <LiveProjectCard project={formData} isDark={isDark} />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Selection Modals */}
            <AnimatePresence>
                {selectTagOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectTagOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className={`w-full max-w-2xl rounded-lg p-6 ${isDark ? 'bg-[var(--dash-bg)] border border-dash-border' : 'bg-dash-surface border border-dash-border'} shadow-2xl`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Select Tech Stack</h3>
                                <button type="button" onClick={() => setSelectTagOpen(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-dash-surface/10' : 'hover:bg-dash-surface-2'}`}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                                {availableTags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => selectTag(tag)}
                                        className={`p-4 rounded-lg border text-left transition-all hover:border-[var(--dash-accent)]`}
                                        style={{ borderColor: 'var(--dash-border)' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {tag.iconSvg && (
                                                tag.iconSvg.startsWith('http') || tag.iconSvg.startsWith('data:image') ? (
                                                    <img src={tag.iconSvg} className="w-8 h-8 object-contain" alt={tag.name} />
                                                ) : (
                                                    <span className="w-8 h-8 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: sanitizeSvg(tag.iconSvg) }} />
                                                )
                                            )}
                                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-dash-text'}`}>{tag.name}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectContribOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectContribOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className={`w-full max-w-2xl rounded-lg p-6 ${isDark ? 'bg-[var(--dash-bg)] border border-dash-border' : 'bg-dash-surface border border-dash-border'} shadow-2xl`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-dash-text'}`}>Select Contributors</h3>
                                <button type="button" onClick={() => setSelectContribOpen(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-dash-surface/10' : 'hover:bg-dash-surface-2'}`}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                                {availableContributors.map((contrib) => (
                                    <button
                                        key={contrib.id}
                                        type="button"
                                        onClick={() => selectContributor(contrib)}
                                        className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all hover:border-[var(--dash-accent)]`}
                                        style={{ borderColor: 'var(--dash-border)' }}
                                    >
                                        <img src={contrib.image as string} className="w-12 h-12 rounded-lg object-cover" alt="" />
                                        <div>
                                            <p className={`font-semibold ${isDark ? 'text-white' : 'text-dash-text'}`}>{contrib.name}</p>
                                            <p className={`text-sm ${isDark ? 'text-dash-text-3' : 'text-dash-text-2'}`}>{contrib.role}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: ${'var(--dash-border)'};
                    border-radius: 20px;
                }
            `}</style>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default MProjectForm;
