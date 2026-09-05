"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Globe, ZoomIn, HardDrive, Trash2 } from 'lucide-react';
import { Github, Linkedin, Facebook, Instagram } from '@/components/dash/icons';
import Cropper from 'react-easy-crop';
import MFirebaseStorage from './M-FirebaseStorage';
const firebaseIcon = '/svgs/firebase.svg'; // served from public/ (see M-StackItem note)
import { motion, AnimatePresence } from 'motion/react';

import { ContributorData } from '@/types';

interface MContributorFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ContributorData) => void;
    initialData?: ContributorData | null;
}

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Helper to create the cropped image
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.src = url;
    });

const getCroppedImg = (imageSrc: string, pixelCrop: CropArea): Promise<File> => {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                const image = await createImage(imageSrc);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('No 2d context'));
                    return;
                }

                if (!pixelCrop || pixelCrop.width <= 0 || pixelCrop.height <= 0) {
                    reject(new Error(`Invalid crop dimensions`));
                    return;
                }

                canvas.width = pixelCrop.width;
                canvas.height = pixelCrop.height;

                ctx.drawImage(
                    image,
                    pixelCrop.x,
                    pixelCrop.y,
                    pixelCrop.width,
                    pixelCrop.height,
                    0,
                    0,
                    pixelCrop.width,
                    pixelCrop.height
                );

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas is empty'));
                        return;
                    }
                    const file = new File([blob], 'cropped_image.webp', { type: 'image/webp' });
                    resolve(file);
                }, 'image/webp');
            } catch (e) {
                reject(e);
            }
        })();
    });
};

/** Normalize a social link: empty stays empty, bare domains get https:// so
 *  saved links are always clickable. Runs on save, not while typing. */
const normalizeUrl = (raw: string): string => {
    const v = raw.trim();
    if (!v) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v;
    return `https://${v}`;
};

const SOCIAL_FIELDS = [
    { key: 'github', label: 'GitHub', Icon: Github },
    { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
    { key: 'facebook', label: 'Facebook', Icon: Facebook },
    { key: 'instagram', label: 'Instagram', Icon: Instagram },
] as const;

const MContributorForm = ({ isOpen, onClose, onSave, initialData }: MContributorFormProps) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [image, setImage] = useState<File | string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const previewUrlRef = useRef<string | null>(null);
    const setPreview = useCallback((url: string | null) => {
        const prev = previewUrlRef.current;
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        previewUrlRef.current = url;
        setPreviewUrl(url);
    }, []);

    // Revoke any blob: previewUrl on unmount
    useEffect(() => {
        return () => {
            if (previewUrlRef.current?.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);
    const [socials, setSocials] = useState({
        github: '', linkedin: '', facebook: '', instagram: '', portfolio: ''
    });
    // Cropper State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
    const [cropError, setCropError] = useState<string | null>(null);
    const [firebaseBrowserOpen, setFirebaseBrowserOpen] = useState(false);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Using requestAnimationFrame to move state updates out of the immediate effect execution
            // avoiding the react-hooks/set-state-in-effect warning.
            requestAnimationFrame(() => {
                if (initialData) {
                    setName(initialData.name);
                    setRole(initialData.role || '');
                    setImage(initialData.image || null);
                    setPreview(typeof initialData.image === 'string' ? initialData.image : null);
                    setSocials({
                        github: initialData.socials?.github || '',
                        linkedin: initialData.socials?.linkedin || '',
                        facebook: initialData.socials?.facebook || '',
                        instagram: initialData.socials?.instagram || '',
                        portfolio: initialData.socials?.portfolio || ''
                    });
                } else {
                    setName('');
                    setRole('');
                    setImage(null);
                    setPreview(null);
                    setSocials({ github: '', linkedin: '', facebook: '', instagram: '', portfolio: '' });
                }
                setZoom(1);
                setCrop({ x: 0, y: 0 });
                setIsCropping(false);
                setOriginalImageSrc(null);
                setCropError(null);
            });
        }
    }, [isOpen, initialData, setPreview]);

    // ESC handling: while cropping, ESC exits crop mode first; otherwise closes dialog.
    // Also locks body scroll and autofocuses the name field.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || firebaseBrowserOpen) return;
            if (isCropping) {
                setIsCropping(false);
                setOriginalImageSrc(null);
            } else {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const t = setTimeout(() => {
            if (!isCropping) nameInputRef.current?.focus();
        }, 120);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            clearTimeout(t);
        };
    }, [isOpen, isCropping, firebaseBrowserOpen, onClose]);

    const onCropComplete = useCallback((_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const readFile = (file: File) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result), false);
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const imageDataUrl = await readFile(file);
            setOriginalImageSrc(imageDataUrl as string);
            setCropError(null);
            setIsCropping(true);
            e.target.value = '';
        }
    };

    const cancelCrop = () => {
        setIsCropping(false);
        setOriginalImageSrc(null);
        setCropError(null);
    };

    /** Remote (Firebase) images are used as-is: drawing a cross-origin URL
     *  into a canvas would taint it and make cropping fail. */
    const handleFirebaseSelect = (url: string) => {
        setImage(url);
        setPreview(url);
        setIsCropping(false);
        setOriginalImageSrc(null);
    };

    const clearImage = () => {
        setImage(null);
        setPreview(null);
    };

    const handleCropSave = async () => {
        if (originalImageSrc && croppedAreaPixels) {
            try {
                const croppedFile = await getCroppedImg(originalImageSrc, croppedAreaPixels);
                if (croppedFile) {
                    setImage(croppedFile);
                    setPreview(URL.createObjectURL(croppedFile));
                }
            } catch (e) {
                console.warn("Crop failed", e);
                setCropError('Could not crop this image — using the original instead.');
                setImage(originalImageSrc);
                setPreview(originalImageSrc);
            }
            setIsCropping(false);
            setOriginalImageSrc(null);
        }
    };

    const canSave = name.trim().length > 0 && !isCropping;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        // Parent closes the modal on successful save so a failed
        // write keeps the form open instead of losing input.
        onSave({
            id: initialData?.id,
            name: name.trim(),
            role: role.trim(),
            image: image || undefined,
            socials: {
                github: normalizeUrl(socials.github),
                linkedin: normalizeUrl(socials.linkedin),
                facebook: normalizeUrl(socials.facebook),
                instagram: normalizeUrl(socials.instagram),
                portfolio: normalizeUrl(socials.portfolio),
            },
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
                        className="modal-content glass-panel"
                        style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
                        role="dialog"
                        aria-modal="true"
                        aria-label={initialData ? 'Edit contributor' : 'New contributor'}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                    <h2 className="heading-md text-base sm:text-lg m-0">{initialData ? 'Edit Contributor' : 'New Contributor'}</h2>
                    <button type="button" onClick={onClose} aria-label="Close dialog" className="btn-icon">
                        <X size={24} />
                    </button>
                </div>

                {isCropping && originalImageSrc ? (
                    <div className="p-6 flex flex-col gap-6">
                        <div className="relative h-80 bg-black/20 rounded-xl overflow-hidden">
                            <Cropper
                                image={originalImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        {cropError && (
                            <p role="alert" className="text-sm text-red-500">{cropError}</p>
                        )}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <ZoomIn size={20} className="text-sec" aria-hidden="true" />
                                <label htmlFor="contrib-zoom" className="sr-only">Zoom</label>
                                <input
                                    id="contrib-zoom"
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={cancelCrop} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="button" onClick={handleCropSave} className="btn btn-primary">
                                    Apply Crop
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-accent/20 bg-accent/5 flex items-center justify-center group">
                                {previewUrl ? (
                                    <img src={previewUrl} alt={name.trim() ? `${name.trim()} profile preview` : 'Profile preview'} className="w-full h-full object-cover" />
                                ) : (
                                    <Upload size={32} className="text-accent/40" aria-hidden="true" />
                                )}
                            </div>
                            {previewUrl && (
                                <button type="button" onClick={clearImage} className="btn btn-secondary py-1.5 px-3 text-xs">
                                    <Trash2 size={14} aria-hidden="true" /> Remove photo
                                </button>
                            )}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary py-2 text-sm">
                                    <HardDrive size={16} className="mr-2" aria-hidden="true" /> Local
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" aria-hidden="true" tabIndex={-1} />
                                <button type="button" onClick={() => setFirebaseBrowserOpen(true)} className="btn btn-secondary py-2 text-sm border-orange-500/30 text-orange-500">
                                    <img src={firebaseIcon} alt="" aria-hidden="true" className="w-4 h-4 mr-2" /> Firebase
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label htmlFor="contrib-name" className="input-label">Full Name *</label>
                                <input id="contrib-name" ref={nameInputRef} type="text" required maxLength={60} autoComplete="name" placeholder="e.g. Jane Doe" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label htmlFor="contrib-role" className="input-label">Role</label>
                                <input id="contrib-role" type="text" maxLength={60} autoComplete="organization-title" placeholder="e.g. UI Designer" value={role} onChange={(e) => setRole(e.target.value)} className="input-field" />
                            </div>

                            <fieldset className="m-0 p-0 border-0">
                                <legend className="input-label">Social links</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {SOCIAL_FIELDS.map(({ key, label, Icon }) => (
                                        <div key={key}>
                                            <label htmlFor={`contrib-${key}`} className="sr-only">{label}</label>
                                            <div className="input-container">
                                                <Icon size={18} className="input-icon" aria-hidden="true" />
                                                <input
                                                    id={`contrib-${key}`}
                                                    type="text"
                                                    inputMode="url"
                                                    autoComplete="url"
                                                    spellCheck={false}
                                                    placeholder={label}
                                                    value={socials[key]}
                                                    onChange={(e) => setSocials(prev => ({ ...prev, [key]: e.target.value }))}
                                                    className="input-with-icon"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="col-span-full">
                                        <label htmlFor="contrib-portfolio" className="sr-only">Portfolio</label>
                                        <div className="input-container">
                                            <Globe size={18} className="input-icon" aria-hidden="true" />
                                            <input id="contrib-portfolio" type="text" inputMode="url" autoComplete="url" spellCheck={false} placeholder="Portfolio / website" value={socials.portfolio} onChange={(e) => setSocials(prev => ({ ...prev, portfolio: e.target.value }))} className="input-with-icon" />
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                            <button type="submit" disabled={!canSave} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                {initialData ? 'Save Contributor' : 'Add Contributor'}
                            </button>
                        </div>
                    </form>
                )}
                    </motion.div>

                    <MFirebaseStorage
                        isOpen={firebaseBrowserOpen}
                        onClose={() => setFirebaseBrowserOpen(false)}
                        onSelect={(url) => { handleFirebaseSelect(url); }}
                        fileTypes={['png', 'jpg', 'jpeg', 'webp']}
                        title="Select Profile Image"
                    />
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default MContributorForm;
