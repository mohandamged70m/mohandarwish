"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, X, Save, Upload, User, Sliders, Code, Clock, HardDrive, ZoomIn, Link, Sun, Moon, Plug, Mail, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
const DEFAULT_HERO_URL = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";
import Cropper from 'react-easy-crop';
import MFirebaseStorage from '../StoragePicker';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, getDoc } from '@/lib/dash-db';
import { ref, uploadBytes, getDownloadURL, getMetadata, getStorage, deleteObject } from '@/lib/dash-storage';
import app, { db } from '@/lib/dash-db';
// Local Storage handle (lazy Dashboard chunk) - keeps firebase/storage out of eager.
const storage = getStorage(app);
import Alert, { AlertType } from '@/components/dashboard-v2/ui/Alert';
import { timeZoneOptions } from '@/lib/timezones';
import { offsetAt } from '@/lib/bookingRules';
import MStackItem, { StackItemData } from './StackItemForm';
import DMcpPanel from './McpSettings';
import DCalendarPanel from './CalendarSettings';
import { parkCalendarReturn } from '@/lib/calendarReturn';
import Select from '@/components/dashboard-v2/ui/Select';
import SaveBar from '../SaveBar';
import LoadingCurtain from '@/components/dashboard-v2/ui/LoadingCurtain';
import MConfirmModal from '../ConfirmModal';
import { createImage, getCroppedImg, readFileAsDataUrl, type CropArea } from '@/lib/cropImage';
import useTheme from '@/hooks/useTheme';
import { summarizeApply, staleHeroPath, type SaveOutcome } from './apply';
import { initialZone, zoneLabel } from './zone';
// Replaced failing ui-avatars.com with a local icon-based placeholder logic


/** The browser's own zone, "UTC" when it can't say. */
const browserZone = (): string => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

const isValidContactEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

interface StackItem {
    id: string;
    name: string;
    icon: string;
}

/* "Projects Being Handled" is managed in the Treasury page (TreasuryTab); a backend
   trigger keeps its public subset in Settings/HandledProjects. */


type SettingsTabId = 'availability' | 'stack' | 'account' | 'calendar' | 'mcp';

export default function DSettings() {
    const [isLoading, setIsLoading] = useState(false);

    // Back from connecting Google Calendar: open on that panel to show how it went.
    const [activeTab, setActiveTab] = useState<SettingsTabId>(() => (parkCalendarReturn() ? 'calendar' : 'availability'));
    const [availability, setAvailability] = useState(75);
    // The owner's clock as an IANA zone name (see settings/zone.ts).
    const [selectedZone, setSelectedZone] = useState(browserZone);
    const [currentTime, setCurrentTime] = useState('');

    // Stack state
    const [stackItems, setStackItems] = useState<StackItem[]>([]);
    const [stackModalOpen, setStackModalOpen] = useState(false);
    const [editingStack, setEditingStack] = useState<StackItem | null>(null);
    const [firebaseBrowserOpen, setFirebaseBrowserOpen] = useState(false);
    const [firebaseSelectTarget, setFirebaseSelectTarget] = useState<'hero' | 'heroDark' | 'profile' | null>(null);

    // Confirmation Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const [heroImagePreview, setHeroImagePreview] = useState<string>(DEFAULT_HERO_URL);
    const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
    const [heroImageDirty, setHeroImageDirty] = useState(false);
    const heroImageInputRef = useRef<HTMLInputElement>(null);

    // Dark mode hero image
    const [heroImagePreviewDark, setHeroImagePreviewDark] = useState<string>('');
    const [heroImageFileDark, setHeroImageFileDark] = useState<File | null>(null);
    const [heroImageDirtyDark, setHeroImageDirtyDark] = useState(false);
    const heroImageInputRefDark = useRef<HTMLInputElement>(null);

    // Which hero image the single uploader is currently editing (light / dark)
    const [heroImageMode, setHeroImageMode] = useState<'light' | 'dark'>('light');

    // Max upload size for hero images (matches "Max 2MB" helper text)
    const HERO_MAX_BYTES = 2 * 1024 * 1024;

    const [profileImagePreview, setProfileImagePreview] = useState<string>('');
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const profileImageInputRef = useRef<HTMLInputElement>(null);

    // Profile info state (editable)
    const [profileName, setProfileName] = useState<string>('Your Name');
    const [profileTitle, setProfileTitle] = useState<string>('Job Title');
    const [socialLinks, setSocialLinks] = useState<{ name: string; url: string }[]>([]);
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    // Public contact email (Settings/Account.Email): shown first among the links on /book
    // and used by the CV.
    const [contactEmail, setContactEmail] = useState('');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // For immediate revert on Cancel
    const [profileBackup, setProfileBackup] = useState<{ name: string; title: string } | null>(null);

    // Profile image resolution & size display (same behavior as hero)
    const [profileImageResolution, setProfileImageResolution] = useState<string>('');
    const [profileImageSize, setProfileImageSize] = useState<string>('');
    const [profileImageSizeLoading, setProfileImageSizeLoading] = useState(false);

    // Backup & upload state for profile image (supports immediate revert / save)
    const [profileImageBackupPreview, setProfileImageBackupPreview] = useState<string | null>(null);
    const [profileImageBackupFile, setProfileImageBackupFile] = useState<File | null>(null);
    const [profileImageDirty, setProfileImageDirty] = useState(false);
    const [profileInfoDirty, setProfileInfoDirty] = useState(false);
    const [profileImageUploading, setProfileImageUploading] = useState(false);

    // Hero image resolution & size display
    const [heroImageResolution, setHeroImageResolution] = useState<string>('');
    const [heroImageSize, setHeroImageSize] = useState<string>('');
    const [heroImageSizeLoading, setHeroImageSizeLoading] = useState(false);

    // Dark hero image resolution & size display
    const [heroImageResolutionDark, setHeroImageResolutionDark] = useState<string>('');
    const [heroImageSizeDark, setHeroImageSizeDark] = useState<string>('');
    const [heroImageSizeLoadingDark, setHeroImageSizeLoadingDark] = useState(false);

    const handleTabChange = (newTab: SettingsTabId) => {
        setActiveTab(newTab);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const sizeFromDataUrl = (dataUrl: string) => {
        // data:[<mediatype>][;base64],<data>
        const base64 = dataUrl.split(',')[1] || '';
        const padding = (base64.match(/=+$/) || [''])[0].length;
        const base64Length = base64.length;
        const bytes = Math.round((base64Length * 3) / 4) - padding;
        return bytes;
    };

    // Clear the measured values the moment the preview changes (including to none), during
    // render rather than in the effect below - that way stale numbers from the previous
    // image never show while the new one is being measured asynchronously.
    const [measuredHeroPreview, setMeasuredHeroPreview] = useState(heroImagePreview);
    if (measuredHeroPreview !== heroImagePreview) {
        setMeasuredHeroPreview(heroImagePreview);
        setHeroImageResolution('');
        setHeroImageSize('');
    }

    useEffect(() => {
        if (!heroImagePreview) return;

        // resolution check (try without crossOrigin first to avoid noise)
        const checkRes = async () => {
            try {
                const img = await createImage(heroImagePreview, false);
                setHeroImageResolution(`${img.naturalWidth}×${img.naturalHeight}`);
            } catch {
                setHeroImageResolution('');
            }
        };
        checkRes();

        // size
        (async () => {
            setHeroImageSizeLoading(true);
            try {
                if (heroImageFile) {
                    setHeroImageSize(formatBytes(heroImageFile.size));
                } else if (heroImagePreview.startsWith('data:')) {
                    const bytes = sizeFromDataUrl(heroImagePreview);
                    setHeroImageSize(formatBytes(bytes));
                } else if (heroImagePreview.startsWith('http')) {
                    // try to get metadata which is safer than fetch() for CORS
                    try {
                        // Only try getMetadata if it looks like a Firebase URL
                        if (heroImagePreview.includes('firebasestorage.googleapis.com')) {
                            const fileRef = ref(storage, heroImagePreview);
                            const metadata = await getMetadata(fileRef);
                            setHeroImageSize(formatBytes(metadata.size));
                        } else {
                            // Fallback to fetch for non-firebase URLs
                            throw new Error('Not a firebase URL');
                        }
                    } catch {
                        // Only try fetch if getMetadata failed and it's not a local file
                        try {
                            const res = await fetch(heroImagePreview, { method: 'GET' });
                            if (res.ok) {
                                const blob = await res.blob();
                                setHeroImageSize(formatBytes(blob.size));
                            }
                        } catch {
                            setHeroImageSize('');
                        }
                    }
                } else {
                    setHeroImageSize('');
                }
            } catch {
                // ignore errors, just don't show size
                setHeroImageSize('');
            } finally {
                setHeroImageSizeLoading(false);
            }
        })();

        return () => {
        };
    }, [heroImagePreview, heroImageFile]);

    // Dark hero: resolution & size display (cleared during render, measured in the effect)
    const [measuredHeroPreviewDark, setMeasuredHeroPreviewDark] = useState(heroImagePreviewDark);
    if (measuredHeroPreviewDark !== heroImagePreviewDark) {
        setMeasuredHeroPreviewDark(heroImagePreviewDark);
        setHeroImageResolutionDark('');
        setHeroImageSizeDark('');
    }

    useEffect(() => {
        if (!heroImagePreviewDark) return;

        const checkRes = async () => {
            try {
                const img = await createImage(heroImagePreviewDark, false);
                setHeroImageResolutionDark(`${img.naturalWidth}×${img.naturalHeight}`);
            } catch {
                setHeroImageResolutionDark('');
            }
        };
        checkRes();

        (async () => {
            setHeroImageSizeLoadingDark(true);
            try {
                if (heroImageFileDark) {
                    setHeroImageSizeDark(formatBytes(heroImageFileDark.size));
                } else if (heroImagePreviewDark.startsWith('data:')) {
                    const bytes = sizeFromDataUrl(heroImagePreviewDark);
                    setHeroImageSizeDark(formatBytes(bytes));
                } else if (heroImagePreviewDark.startsWith('http')) {
                    try {
                        if (heroImagePreviewDark.includes('firebasestorage.googleapis.com')) {
                            const fileRef = ref(storage, heroImagePreviewDark);
                            const metadata = await getMetadata(fileRef);
                            setHeroImageSizeDark(formatBytes(metadata.size));
                        } else {
                            throw new Error('Not a firebase URL');
                        }
                    } catch {
                        try {
                            const res = await fetch(heroImagePreviewDark, { method: 'GET' });
                            if (res.ok) {
                                const blob = await res.blob();
                                setHeroImageSizeDark(formatBytes(blob.size));
                            }
                        } catch {
                            setHeroImageSizeDark('');
                        }
                    }
                } else {
                    setHeroImageSizeDark('');
                }
            } catch {
                setHeroImageSizeDark('');
            } finally {
                setHeroImageSizeLoadingDark(false);
            }
        })();
    }, [heroImagePreviewDark, heroImageFileDark]);

    // profile image resolution & size (cleared during render, measured in the effect)
    const [measuredProfilePreview, setMeasuredProfilePreview] = useState(profileImagePreview);
    if (measuredProfilePreview !== profileImagePreview) {
        setMeasuredProfilePreview(profileImagePreview);
        setProfileImageResolution('');
        setProfileImageSize('');
    }

    useEffect(() => {
        if (!profileImagePreview) return;

        // resolution check (try without crossOrigin first to avoid noise)
        const checkRes = async () => {
            try {
                const img = await createImage(profileImagePreview, false);
                setProfileImageResolution(`${img.naturalWidth}×${img.naturalHeight}`);
            } catch {
                setProfileImageResolution('');
            }
        };
        checkRes();

        (async () => {
            setProfileImageSizeLoading(true);
            try {
                if (profileImageFile) {
                    setProfileImageSize(formatBytes(profileImageFile.size));
                } else if (profileImagePreview.startsWith('data:')) {
                    const bytes = sizeFromDataUrl(profileImagePreview);
                    setProfileImageSize(formatBytes(bytes));
                } else if (profileImagePreview.startsWith('http')) {
                    // try to get metadata which is safer than fetch() for CORS
                    try {
                        // Only try getMetadata if it looks like a Firebase URL
                        if (profileImagePreview.includes('firebasestorage.googleapis.com')) {
                            const fileRef = ref(storage, profileImagePreview);
                            const metadata = await getMetadata(fileRef);
                            setProfileImageSize(formatBytes(metadata.size));
                        } else {
                            // Fallback to fetch for non-firebase URLs
                            throw new Error('Not a firebase URL');
                        }
                    } catch {
                        try {
                            const res = await fetch(profileImagePreview, { method: 'GET' });
                            if (res.ok) {
                                const blob = await res.blob();
                                setProfileImageSize(formatBytes(blob.size));
                            }
                        } catch {
                            setProfileImageSize('');
                        }
                    }
                } else {
                    setProfileImageSize('');
                }
            } catch {
                setProfileImageSize('');
            } finally {
                setProfileImageSizeLoading(false);
            }
        })();

        return () => {
        };
    }, [profileImagePreview, profileImageFile]);

    // Load profile and hero info from Firestore.
    // Dirty flags (heroImageDirty / heroImageDirtyDark) prevent the snapshot from
    // clobbering unsaved local changes - including changes made via the Firebase browser
    // (where heroImageFile is null but a new URL was selected).
    const dirtyRef = useRef({ profileImageDirty, heroImageDirty, heroImageDirtyDark, isEditingProfile, profileInfoDirty });
    useEffect(() => {
        dirtyRef.current = { profileImageDirty, heroImageDirty, heroImageDirtyDark, isEditingProfile, profileInfoDirty };
    }, [profileImageDirty, heroImageDirty, heroImageDirtyDark, isEditingProfile, profileInfoDirty]);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'Settings', 'Account'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const flags = dirtyRef.current;
                if (data.imageUrl && !flags.profileImageDirty) setProfileImagePreview(data.imageUrl);
                if (data.heroImageUrl && !flags.heroImageDirty) setHeroImagePreview(data.heroImageUrl);
                if (data.heroImageUrlDark !== undefined && !flags.heroImageDirtyDark) {
                    setHeroImagePreviewDark(data.heroImageUrlDark || '');
                }
                if (data.name && !flags.isEditingProfile && !flags.profileInfoDirty) setProfileName(data.name);
                if (data.title && !flags.isEditingProfile && !flags.profileInfoDirty) setProfileTitle(data.title);
                if (!flags.isEditingProfile && !flags.profileInfoDirty) setContactEmail(typeof data.Email === 'string' ? data.Email : '');
                if (data['Social Links'] && !flags.isEditingProfile && !flags.profileInfoDirty) {
                    const links = Object.entries(data['Social Links']).map(([name, url]) => ({
                        name,
                        url: url as string
                    }));
                    setSocialLinks(links);
                }
            }
        }, (err) => {
            console.error('Error fetching account settings', err);
        });
        return () => unsubscribe();
    }, []);

    // Cropper State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);

    // Detect dark mode to adjust cropper background
    const isDark = useTheme();

    // Custom Alert State
    const [alert, setAlert] = useState<{ show: boolean; type: AlertType; message: string }>({
        show: false,
        type: 'success',
        message: ''
    });

    // Guard to prevent duplicate alerts from rapidly repeating
    const lastAlertRef = useRef<{ message: string; type: AlertType; t: number } | null>(null);
    const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // `force` replaces an alert already on screen instead of being dropped for it - used
    // for Apply's outcome, which the owner must always see.
    const safeSetAlert = (next: { show: boolean; type: AlertType; message: string; duration?: number; force?: boolean }) => {
        const duration = typeof next.duration === 'number' ? next.duration : 4000; // default 4s
        if (next.show) {
            // If an alert is already visible, suppress new alerts to ensure only one is shown
            if (alert.show && !next.force) return;

            const last = lastAlertRef.current;
            if (last && last.message === next.message && last.type === next.type && (Date.now() - last.t) < duration) {
                return; // duplicate within cooldown, ignore
            }
            lastAlertRef.current = { message: next.message, type: next.type, t: Date.now() };
            setAlert({ show: true, type: next.type, message: next.message });
            if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
            alertTimerRef.current = null;
            if (duration > 0) {
                alertTimerRef.current = setTimeout(() => {
                    setAlert(prev => ({ ...prev, show: false }));
                    lastAlertRef.current = null;
                }, duration);
            }
        } else {
            // explicit hide - clear ref and state
            lastAlertRef.current = null;
            setAlert({ show: false, type: next.type, message: next.message });
        }
    };

    // Track unsaved changes
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Every named zone, labelled with today's offset. A saved zone this browser doesn't
    // list (an alias) is still shown, so the picker never opens blank.
    const [openedAt] = useState(() => Date.now());
    const zoneOptions = useMemo(() => timeZoneOptions(), []);
    const zoneNames = useMemo(() => zoneOptions.map(o => o.value), [zoneOptions]);
    const zonePickerOptions = zoneOptions.some(o => o.value === selectedZone)
        ? zoneOptions
        : [{ value: selectedZone, label: zoneLabel(selectedZone, openedAt) }, ...zoneOptions];

    // Every save below reports how it went ('saved' / 'skipped' / 'failed') rather than
    // swallowing a failure, so Apply can tell the owner exactly what was stored. With
    // `silent` (Apply) they leave the alert to Apply's summary.
    const handleSaveAvailability = async (silent = false): Promise<SaveOutcome> => {
        try {
            const payload = {
                'Current Availability': `${availability}%`,
                // The zone name is what booking, Canary and the MCP follow (it keeps up
                // with daylight saving); "Current Time" keeps today's offset for anything
                // that still reads the label.
                'timeZone': selectedZone,
                'Current Time': zoneLabel(selectedZone, Date.now()),
                'availabilityPercent': availability,
                // Nothing reads the old numeric offset any more; removed so it can't disagree.
                'timezoneOffset': deleteField()
            };

            // merge:true so the working days/hours stored on the same doc survive.
            await setDoc(doc(db, 'Settings', 'Availability'), payload, { merge: true });
            return 'saved';
        } catch (error) {
            console.error("Error saving availability:", error);
            if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to save availability settings' });
            return 'failed';
        }
    };

    /** "png" from "photo.PNG"; a name without an extension gets "img". */
    const extOf = (file: File) => /\.([A-Za-z0-9]+)$/.exec(file.name)?.[1].toLowerCase() || 'img';

    // A hero upload is stored as Hero.image.<ext>, so a new type lands at a new path; the
    // file it replaces is deleted once the new URL is saved (best effort - a leftover is
    // only clutter, never shown).
    const removeStaleHero = (previous: unknown, current: string | null, variant: 'light' | 'dark') => {
        const stale = staleHeroPath(typeof previous === 'string' ? previous : null, current, variant);
        if (stale) deleteObject(ref(storage, stale)).catch(e => console.warn('Could not delete the replaced hero image', stale, e));
    };

    const handleSaveHeroImage = async (silent = false): Promise<SaveOutcome> => {
        // Only save if the user actually changed it
        if (!heroImageDirty) return 'skipped';
        if (!heroImageFile && !heroImagePreview) return 'skipped';

        try {
            setIsLoading(true);
            const accountRef = doc(db, 'Settings', 'Account');

            let url: string;
            if (heroImageFile) {
                const storageRef = ref(storage, `src/imgs/Settings/Hero.image.${extOf(heroImageFile)}`);
                await uploadBytes(storageRef, heroImageFile);
                url = await getDownloadURL(storageRef);
            } else if (heroImagePreview && heroImagePreview.startsWith('http')) {
                // Selected from Firebase / remote URL - just persist the URL
                url = heroImagePreview;
            } else {
                // Local data URL without a file - nothing to upload to storage
                return 'skipped';
            }

            const previous = (await getDoc(accountRef)).data()?.heroImageUrl;
            await setDoc(accountRef, { heroImageUrl: url }, { merge: true });
            removeStaleHero(previous, url, 'light');
            setHeroImageFile(null);
            setHeroImageDirty(false);
            if (!silent) safeSetAlert({ show: true, type: 'success', message: 'Hero image updated!', duration: 3000 });
            return 'saved';
        } catch (error) {
            console.error("Error updating hero image:", error);
            if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to update hero image.' });
            return 'failed';
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveHeroImageDark = async (silent = false): Promise<SaveOutcome> => {
        if (!heroImageDirtyDark) return 'skipped';
        const accountRef = doc(db, 'Settings', 'Account');

        // Allow saving even if empty (user wants to clear the dark variant)
        if (!heroImageFileDark && !heroImagePreviewDark) {
            try {
                const previous = (await getDoc(accountRef)).data()?.heroImageUrlDark;
                // setDoc + merge is safer than updateDoc - works even if the field
                // or doc didn't exist before. deleteField() removes the value.
                await setDoc(accountRef, { heroImageUrlDark: deleteField() }, { merge: true });
                removeStaleHero(previous, null, 'dark');
                setHeroImageDirtyDark(false);
                if (!silent) safeSetAlert({ show: true, type: 'success', message: 'Dark hero image cleared.', duration: 3000 });
                return 'saved';
            } catch (error) {
                console.error('Error clearing dark hero image:', error);
                if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to clear dark hero image.' });
                return 'failed';
            }
        }

        try {
            setIsLoading(true);

            let url: string;
            if (heroImageFileDark) {
                const storageRef = ref(storage, `src/imgs/Settings/Hero.image.dark.${extOf(heroImageFileDark)}`);
                await uploadBytes(storageRef, heroImageFileDark);
                url = await getDownloadURL(storageRef);
            } else if (heroImagePreviewDark && heroImagePreviewDark.startsWith('http')) {
                url = heroImagePreviewDark;
            } else {
                return 'skipped';
            }

            const previous = (await getDoc(accountRef)).data()?.heroImageUrlDark;
            await setDoc(accountRef, { heroImageUrlDark: url }, { merge: true });
            removeStaleHero(previous, url, 'dark');
            setHeroImageFileDark(null);
            setHeroImageDirtyDark(false);
            if (!silent) safeSetAlert({ show: true, type: 'success', message: 'Dark hero image updated!', duration: 3000 });
            return 'saved';
        } catch (error) {
            console.error("Error updating dark hero image:", error);
            if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to update dark hero image.' });
            return 'failed';
        } finally {
            setIsLoading(false);
        }
    };

    // Saves every staged section and reports exactly what stored. A section that failed
    // keeps its staged changes, and Apply stays available to retry it.
    const handleApplyAll = async () => {
        setIsLoading(true);
        try {
            // If user is still cropping, finalize the crop first
            if (isCropping) {
                await handleCropSave();
            }

            const [availabilityR, heroR, heroDarkR, profileImageR, profileInfoR] = await Promise.all([
                handleSaveAvailability(true),
                handleSaveHeroImage(true),
                handleSaveHeroImageDark(true),
                handleSaveProfileImage(true),
                handleSaveProfileInfo(true)
            ]);
            const summary = summarizeApply([
                ['availability', availabilityR],
                ['hero image', heroR],
                ['dark hero image', heroDarkR],
                ['profile image', profileImageR],
                ['profile details', profileInfoR],
            ]);

            if (profileInfoR === 'saved') setProfileInfoDirty(false);
            setHasUnsavedChanges(!summary.ok);
            safeSetAlert({ show: true, force: true, type: summary.ok ? 'success' : 'error', message: summary.message, duration: summary.ok ? 3000 : 8000 });
        } catch (error) {
            console.error("Error applying all settings:", error);
            safeSetAlert({ show: true, force: true, type: 'error', message: 'Could not apply the changes. They are still staged - try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelAll = async () => {
        // Close any open cropper
        if (isCropping) {
            setIsCropping(false);
            setOriginalImageSrc(null);
        }

        setIsLoading(true);
        try {
            const profileSnap = await getDoc(doc(db, 'Settings', 'Account'));
            if (profileSnap.exists()) {
                const data = profileSnap.data();
                setProfileName(data.name ?? 'Your Name');
                setProfileTitle(data.title ?? 'Job Title');
                setProfileImagePreview(data.imageUrl ?? '');
                setProfileImageFile(null);
                setProfileImageBackupPreview(null);
                setProfileImageBackupFile(null);
                setProfileImageDirty(false);
                setProfileInfoDirty(false);
            }

            const heroSnap = await getDoc(doc(db, 'Settings', 'Account'));
            if (heroSnap.exists()) {
                const heroData = heroSnap.data();
                setHeroImagePreview(heroData.heroImageUrl ?? DEFAULT_HERO_URL);
                setHeroImageFile(null);
                setHeroImageDirty(false);
                setHeroImagePreviewDark(heroData.heroImageUrlDark ?? '');
                setHeroImageFileDark(null);
                setHeroImageDirtyDark(false);
            } else {
                // Even if doc fetch failed, reset dirty flags so user isn't stuck thinking changes still apply
                setHeroImageDirty(false);
                setHeroImageDirtyDark(false);
            }

            const availSnap = await getDoc(doc(db, 'Settings', 'Availability'));
            if (availSnap.exists()) {
                const availData = availSnap.data();
                if (availData.availabilityPercent !== undefined) {
                    setAvailability(availData.availabilityPercent);
                } else if (availData['Current Availability']) {
                    const percentage = parseInt(availData['Current Availability'].replace('%', ''));
                    if (!isNaN(percentage)) setAvailability(percentage);
                }

                setSelectedZone(initialZone(availData, browserZone(), zoneNames, Date.now()));
            }

            setHasUnsavedChanges(false);
            safeSetAlert({ show: true, type: 'info', message: 'All staged changes canceled.' });
        } catch (err) {
            console.error('Error cancelling changes', err);
            // Even on Firestore failure, clear dirty flags + uploads so the user
            // isn't left in a stuck "unsaved" state. The UI will sync next snapshot.
            setHeroImageDirty(false);
            setHeroImageDirtyDark(false);
            setHeroImageFile(null);
            setHeroImageFileDark(null);
            setProfileImageDirty(false);
            setProfileInfoDirty(false);
            setHasUnsavedChanges(false);
            safeSetAlert({ show: true, type: 'error', message: 'Cancel failed to reach Firestore. Local edits cleared.' });
        } finally {
            setIsLoading(false);
        }
    };





    // Update current time based on selected timezone
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
            const localTime = new Date(utcTime + offsetAt(selectedZone, now.getTime()) * 3600000);
            setCurrentTime(localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [selectedZone]);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'Settings', 'Availability'), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();

                // Parse and set availability
                if (data.availabilityPercent !== undefined) {
                    setAvailability(data.availabilityPercent);
                } else {
                    const availabilityString = data['Current Availability'] as string;
                    if (availabilityString) {
                        const percentage = parseInt(availabilityString.replace('%', ''));
                        if (!isNaN(percentage)) {
                            setAvailability(percentage);
                        }
                    }
                }

                // Parse and set timezone
                setSelectedZone(initialZone(data, browserZone(), zoneNames, Date.now()));
            }
        }, (err) => {
            const status = navigator.onLine ? "Service Blocked (ISP/Firewall)" : "Offline";
            console.warn(`[Connection] Settings sync: ${status}. Check diagnostic in lib/firebase.ts`, err);
        });
        return () => unsubscribe();
    }, [zoneNames]);

    // Fetch Stack Data
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'Settings', 'Tech Stack'), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const items: StackItem[] = [];
                Object.entries(data).forEach(([key, value]: [string, unknown]) => {
                    const v = value as Record<string, unknown>;
                    items.push({
                        id: key,
                        name: typeof v.Name === 'string' ? v.Name : (v.name as string) || 'Untitled',
                        icon: typeof v.Icon === 'string' ? v.Icon : (v.icon as string) || ''
                    });
                });
                // Sort by ID (assuming numeric IDs)
                items.sort((a, b) => parseInt(a.id) - parseInt(b.id));
                setStackItems(items);
            }
        }, (err) => {
            const status = navigator.onLine ? "Service Blocked (ISP/Firewall)" : "Offline";
            console.warn(`[Connection] Tech Stack sync: ${status}. Check diagnostic in lib/firebase.ts`, err);
        });
        return () => unsubscribe();
    }, []);

    const getAvailabilityColor = (value: number) => {
        if (value < 40) return 'var(--danger)';
        if (value < 70) return 'var(--warning)';
        return 'var(--success)';
    };

    const handleSaveStack = async (data: StackItemData) => {
        if (!data.name.trim() || !data.icon) return;
        setIsLoading(true);

        try {
            let id = data.id || '';
            if (!id) {
                const ids = stackItems.map(i => parseInt(i.id)).filter(n => !isNaN(n));
                const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
                id = nextId.toString();
            }

            let iconUrl = data.icon;
            if (data.iconFile) {
                // Prefixed with the item id so two items with the same file name never share a file;
                // "stack_" keeps them apart from tag icons, which use `${id}_` in the same folder.
                const storageRef = ref(storage, `src/svgs/stack_${id}_${data.iconFile.name}`);
                await uploadBytes(storageRef, data.iconFile);
                iconUrl = await getDownloadURL(storageRef);
            }

            const payload = {
                Name: data.name,
                Icon: iconUrl
            };

            await setDoc(doc(db, 'Settings', 'Tech Stack'), { [id]: payload }, { merge: true });

            setStackModalOpen(false);
            setEditingStack(null);
            safeSetAlert({ show: true, type: 'success', message: 'Stack item saved!', duration: 3000 });
        } catch (error) {
            console.error("Error saving stack:", error);
            safeSetAlert({ show: true, type: 'error', message: 'Failed to save stack item' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteStack = (id: string) => {
        const item = stackItems.find(i => i.id === id);
        setConfirmConfig({
            isOpen: true,
            title: 'Delete Stack Item',
            message: `Are you sure you want to delete "${item?.name || id}" from your tech stack?`,
            type: 'danger',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    await updateDoc(doc(db, 'Settings', 'Tech Stack'), { [id]: deleteField() });
                    safeSetAlert({ show: true, type: 'success', message: 'Stack item deleted', duration: 3000 });
                } catch (error) {
                    console.error("Error deleting stack:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const closeStackModal = () => {
        setStackModalOpen(false);
        setEditingStack(null);
    };

    // Account handlers
    const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Always reset so the user can re-pick the same file later
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            safeSetAlert({ show: true, type: 'error', message: 'Please pick an image file.' });
            return;
        }
        if (file.size > HERO_MAX_BYTES) {
            safeSetAlert({ show: true, type: 'error', message: `Image too large (${formatBytes(file.size)}). Max ${formatBytes(HERO_MAX_BYTES)}.` });
            return;
        }
        setHeroImageFile(file);
        setHeroImageDirty(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            setHeroImagePreview(event.target?.result as string);
            setHasUnsavedChanges(true);
        };
        reader.readAsDataURL(file);
    };

    const handleHeroImageUploadDark = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            safeSetAlert({ show: true, type: 'error', message: 'Please pick an image file.' });
            return;
        }
        if (file.size > HERO_MAX_BYTES) {
            safeSetAlert({ show: true, type: 'error', message: `Image too large (${formatBytes(file.size)}). Max ${formatBytes(HERO_MAX_BYTES)}.` });
            return;
        }
        setHeroImageFileDark(file);
        setHeroImageDirtyDark(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            setHeroImagePreviewDark(event.target?.result as string);
            setHasUnsavedChanges(true);
        };
        reader.readAsDataURL(file);
    };

    const handleClearHeroImageDark = () => {
        setHeroImagePreviewDark('');
        setHeroImageFileDark(null);
        setHeroImageDirtyDark(true);
        setHasUnsavedChanges(true);
    };

    const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            // keep a backup so Cancel can restore instantly
            if (!profileImageBackupPreview) {
                setProfileImageBackupPreview(profileImagePreview);
                setProfileImageBackupFile(profileImageFile);
            }

            const file = e.target.files[0];
            setOriginalImageSrc(await readFileAsDataUrl(file));
            setIsCropping(true);
            e.target.value = '';
        }
    };

    const onCropComplete = useCallback((_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropSave = async () => {
        if (originalImageSrc && croppedAreaPixels) {
            try {
                setIsLoading(true);
                const croppedFile = await getCroppedImg(originalImageSrc, croppedAreaPixels);
                if (croppedFile) {
                    // Perform immediate upload to Firebase
                    const storageRef = ref(storage, `src/imgs/Settings/Profile_${Date.now()}_cropped.webp`);
                    await uploadBytes(storageRef, croppedFile);
                    const downloadURL = await getDownloadURL(storageRef);

                    // Update Firestore immediately
                    await setDoc(doc(db, 'Settings', 'Account'), { imageUrl: downloadURL }, { merge: true });

                    setProfileImagePreview(downloadURL);
                    setProfileImageFile(null);
                    setProfileImageDirty(false);

                    safeSetAlert({ show: true, type: 'success', message: 'Profile image cropped and saved!', duration: 3000 });
                }
            } catch (e) {
                console.error("Crop/Save failed", e);
                safeSetAlert({ show: true, type: 'error', message: 'Failed to save cropped image.' });
            } finally {
                setIsLoading(false);
                setIsCropping(false);
                setOriginalImageSrc(null);
            }
        }
    };

    const handleSkipCrop = () => {
        if (originalImageSrc) {
            setProfileImagePreview(originalImageSrc);
            setProfileImageFile(null); // It's a remote URL, no local file to upload
            setProfileImageDirty(true);
            setHasUnsavedChanges(true);
            setIsCropping(false);
            setOriginalImageSrc(null);
        }
    };

    const handleCropCancel = () => {
        setIsCropping(false);
        setOriginalImageSrc(null);
    };

    const handleCancelProfileImageChange = () => {
        if (profileImageBackupPreview) {
            setProfileImagePreview(profileImageBackupPreview);
            setProfileImageFile(profileImageBackupFile);
        }
        setProfileImageBackupPreview(null);
        setProfileImageBackupFile(null);
        setProfileImageDirty(false);
        setHasUnsavedChanges(false);
    };

    const addSocialLink = () => {
        const name = newLinkName.trim(), url = newLinkUrl.trim();
        if (socialLinks.length >= 5 || !name || !url) return;
        setSocialLinks([...socialLinks, { name, url }]);
        setNewLinkName('');
        setNewLinkUrl('');
        setProfileInfoDirty(true);
        setHasUnsavedChanges(true);
    };

    // Persist profile name/title/links to Firestore (used by Apply All)
    const handleSaveProfileInfo = async (silent = false): Promise<SaveOutcome> => {
        try {
            const linksMap = socialLinks.reduce((acc, link) => {
                acc[link.name] = link.url;
                return acc;
            }, {} as Record<string, string>);

            await setDoc(doc(db, 'Settings', 'Account'), {
                name: profileName,
                title: profileTitle,
                Email: contactEmail.trim(),
                'Social Links': linksMap
            // mergeFields replaces each field whole; a plain merge deep-merges the links
            // map, so a removed link would never leave Firestore.
            }, { mergeFields: ['name', 'title', 'Email', 'Social Links'] });

            if (!silent) safeSetAlert({ show: true, type: 'success', message: 'Profile updated!', duration: 3000 });
            return 'saved';
        } catch (err) {
            console.error('Error saving profile info', err);
            if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to update profile.' });
            return 'failed';
        }
    };

    const handleSaveProfileImage = async (silent = false): Promise<SaveOutcome> => {
        // The preview always holds the stored image, so only a staged change is saved.
        if (!profileImageDirty && !profileImageFile) return 'skipped';
        if (!profileImageFile && !profileImagePreview) return 'skipped';

        try {
            setProfileImageUploading(true);
            setIsLoading(true);

            if (profileImageFile) {
                const storageRef = ref(storage, `src/imgs/Settings/Profile_${Date.now()}_cropped.webp`);
                await uploadBytes(storageRef, profileImageFile);
                const downloadURL = await getDownloadURL(storageRef);

                await setDoc(doc(db, 'Settings', 'Account'), { imageUrl: downloadURL }, { merge: true });
            } else if (profileImagePreview && profileImagePreview.startsWith('http')) {
                // Selected from Firebase / remote URL - just persist the URL
                await setDoc(doc(db, 'Settings', 'Account'), { imageUrl: profileImagePreview }, { merge: true });
            } else {
                // Local data URL without a file - nothing to upload to storage
                return 'skipped';
            }

            if (!silent) safeSetAlert({ show: true, type: 'success', message: 'Profile image updated!', duration: 3000 });

            // clear temporary states (whether anything else is still unsaved is Apply's call)
            setProfileImageDirty(false);
            setProfileImageBackupPreview(null);
            setProfileImageBackupFile(null);
            setProfileImageFile(null);
            return 'saved';
        } catch (error) {
            console.error("Error updating profile image:", error);
            if (!silent) safeSetAlert({ show: true, type: 'error', message: 'Failed to update profile image.' });
            return 'failed';
        } finally {
            setProfileImageUploading(false);
            setIsLoading(false);
        }
    };

    // Tabs definition
    const tabs = [
        { id: 'availability', label: 'Availability', icon: Sliders },
        { id: 'stack', label: 'Tech Stack', icon: Code },
        { id: 'account', label: 'Account', icon: User },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'mcp', label: 'MCP', icon: Plug },
    ] as const;

    if (isCropping && originalImageSrc) {
        return createPortal(
            <div className="fixed inset-0 bg-[var(--scrim)] z-[3000] flex items-center justify-center p-4 animate-fade-in">
                <div className="w-full max-w-lg">
                    <div className={`glass-panel overflow-hidden rounded-sm border ${isDark ? 'border-dash-border bg-dash-surface' : 'border-dash-border bg-dash-surface'}`}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-dash-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-sm bg-dash-accent/10 text-dash-accent-text">
                                    <ZoomIn size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-none">Crop Photo</h3>
                                    <p className="text-xs text-dash-text-3 mt-1 uppercase tracking-wider font-medium opacity-80">Adjust your profile image</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCropCancel}
                                className="p-2 rounded-full hover:bg-dash-surface/5 text-dash-text-3 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div className="relative h-[400px] w-full bg-black/20">
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
                                style={{
                                    containerStyle: { background: 'transparent' },
                                    cropAreaStyle: {
                                        border: '2px solid white',
                                        boxShadow: '0 0 0 9999px var(--shadow-color)'
                                    }
                                }}
                            />
                        </div>

                        {/* Controls */}
                        <div className="p-6 flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-semibold text-dash-text-3 w-10">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-dash-surface-hover rounded-sm appearance-none cursor-pointer accent-dash-accent"
                                />
                                <span className="text-xs font-heading text-dash-accent-text w-10 text-right font-bold">
                                    {Math.round(zoom * 100)}%
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="text-xs text-dash-text-3 max-w-[200px]">
                                    <span className="opacity-80">Drag to move. Scroll or use slider to zoom.</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCropCancel}
                                        className="btn btn-secondary text-xs px-4 py-2"
                                    >
                                        Cancel
                                    </button>

                                    {originalImageSrc.startsWith('http') && (
                                        <button
                                            type="button"
                                            onClick={handleSkipCrop}
                                            className="btn btn-secondary text-xs px-4 py-2 bg-dash-accent/5 border-dash-accent/10 text-dash-accent-text hover:bg-dash-accent/10"
                                        >
                                            Skip
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleCropSave}
                                        className="btn btn-primary text-xs px-6 py-2 shadow-lg shadow-[0_8px_24px_var(--shadow-color)]"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div className="h-[85vh] flex flex-col gap-6 relative">
            <LoadingCurtain open={isLoading} portal />
            {/* Custom Alert */}
            {alert.show && (
                <Alert
                    type={alert.type}
                    message={alert.message}
                    onClose={() => safeSetAlert({ show: false, type: alert.type, message: alert.message })}
                />
            )}

            {/* Tabs */}
            <div className="glass-surface p-1.5 rounded-sm flex gap-2 overflow-x-auto shrink-0">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            aria-label={tab.label}
                            aria-current={isActive ? 'page' : undefined}
                            className={`
                                settings-tab-btn flex items-center gap-2 px-5 py-3 rounded-sm border-none cursor-pointer font-sans font-semibold text-sm whitespace-nowrap transition-all
                                ${isActive ? 'tab-active bg-dash-accent/15 text-dash-accent-text' : 'bg-transparent text-dash-text-3 hover:bg-dash-accent/10 hover:text-dash-accent-text dark:text-dash-text-3 dark:hover:text-dash-accent-text'}
                            `}
                        >
                            <Icon size={18} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Container with overflow-x-hidden for clean transitions */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-6 p-4 custom-scrollbar">
                {/* initial={false}: the dashboard fades the whole tab in once, so the first
                    section is already in place; a section only enters on a switch. */}
                <AnimatePresence mode="wait" initial={false}>
                    {activeTab === 'availability' && (
                        <motion.div
                            key="availability"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: 'easeInOut' }}
                            className="settings-section flex flex-col gap-6"
                        >
                            {/* Availability Settings */}
                            <div className="settings-panel glass-panel p-6 flex flex-col gap-6 relative z-10">
                            <h3 className="heading-md text-base sm:text-lg md:text-xl">Availability Settings</h3>
                            <div className="flex flex-col gap-6">
                                {/* Current Availability Slider */}
                                <div>
                                    <div className="flex-row-between">
                                        <label className="text-dash-text-2 text-sm">Current Availability</label>
                                        <span className="font-bold text-sm" style={{ color: getAvailabilityColor(availability) }}>{availability}%</span>
                                    </div>
                                    <div className="h-2 bg-dash-surface-3 overflow-hidden relative">
                                        <div className="absolute left-0 top-0 h-full" style={{ width: `${availability}%`, background: 'linear-gradient(to right, var(--dash-danger), var(--dash-warning), var(--dash-success))' }} />
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={availability}
                                        onChange={(e) => { setAvailability(Number(e.target.value)); setHasUnsavedChanges(true); }}
                                        className="w-full cursor-pointer"
                                        style={{ accentColor: getAvailabilityColor(availability) }}
                                    />
                                    <div className="flex justify-between text-xs sm:text-sm">
                                        <span className="text-dash-danger">Not Available</span>
                                        <span className="text-dash-success">Available</span>
                                    </div>
                                </div>

                                {/* Current Time / Timezone */}
                                <div>
                                    <div className="flex-row-between stack-on-small">
                                        <label className="text-dash-text-2 text-sm sm:text-base md:text-lg flex items-center gap-2">
                                            <Clock size={16} />
                                            Current Time
                                        </label>
                                        <div className="text-right">
                                            <span className="text-lg sm:text-xl md:text-2xl font-bold text-dash-accent-text font-heading">{currentTime}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* Timezone (reusable blurry Select) */}
                                        <div className="flex-1 min-w-[140px]">
                                            <Select
                                                value={selectedZone}
                                                options={zonePickerOptions}
                                                onChange={(v) => { setSelectedZone(v); setHasUnsavedChanges(true); }}
                                                isDark={isDark}
                                                searchable
                                                aria-label="Timezone"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}

                    {activeTab === 'stack' && (
                        <motion.div
                            key="stack"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: 'easeInOut' }}
                            className="settings-section flex flex-col gap-6"
                        >
                            <div className="settings-panel glass-panel p-3 sm:p-4 md:p-6 flex-1 flex flex-col gap-3 sm:gap-4 md:gap-6">
                            <div className="flex-row-between">
                                <h3 className="heading-md text-base sm:text-lg md:text-xl">Tech Stack</h3>
                                <button onClick={() => setStackModalOpen(true)} className="btn btn-primary" aria-label="Add stack">
                                    <Plus size={18} /> <span className="hidden sm:inline">Add Stack</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 content-start">
                                {stackItems.length === 0 ? (
                                    <div className="col-span-full text-center p-12 text-dash-text-2">No stack items. Add your tech stack!</div>
                                ) : stackItems.map(item => (
                                    <div key={item.id} className="p-3 sm:p-4 md:p-6 rounded-sm sm:rounded-sm bg-dash-surface-20/5 border border-dash-border flex flex-col gap-2 sm:gap-3 md:gap-3.5 relative min-w-0">
                                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 flex gap-0.5 sm:gap-1">
                                            <button onClick={() => { setEditingStack(item); setStackModalOpen(true); }} className="btn-icon p-1 sm:p-1.5"><Edit2 size={14} className="sm:w-4 sm:h-4" /></button>
                                            <button onClick={() => handleDeleteStack(item.id)} className="btn-icon p-1 sm:p-1.5 text-dash-danger hover:bg-dash-accent-soft"><Trash2 size={14} className="sm:w-4 sm:h-4" /></button>
                                        </div>
                                        {item.icon ? <img src={item.icon} alt={item.name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 opacity-90 object-contain" /> : <Code size={40} className="text-dash-text-3 sm:w-12 sm:h-12 md:w-[60px] md:h-[60px]" />}
                                        <h4 className="heading-sm text-xs sm:text-sm md:text-base truncate">{item.name}</h4>

                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                    {activeTab === 'account' && (
                        <motion.div
                            key="account"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: 'easeInOut' }}
                            className="settings-section grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                        >
                            <div className="settings-panel md:col-span-4 glass-panel p-6 flex flex-col gap-5">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="heading-md text-base sm:text-lg md:text-xl flex items-center mb-0">
                                    <User size={22} className="mr-3" />
                                    Hero Section Images
                                </h3>
                                {heroImageMode === 'dark' && heroImagePreviewDark && (
                                    <button
                                        onClick={handleClearHeroImageDark}
                                        className="text-xs uppercase tracking-wider text-dash-danger hover:text-dash-danger transition shrink-0"
                                        title="Clear dark hero image"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Light / Dark toggle - one uploader, switch which image you're editing */}
                            <div
                                role="tablist"
                                aria-label="Hero image mode"
                                className="grid grid-cols-2 gap-1 p-1 rounded-sm"
                                style={{ background: 'var(--dash-surface-2)', border: '1px solid var(--dash-border)' }}
                            >
                                {(['light', 'dark'] as const).map((mode) => {
                                    const active = heroImageMode === mode;
                                    const isLight = mode === 'light';
                                    const missing = !isLight && !heroImagePreviewDark;
                                    return (
                                        <button
                                            key={mode}
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setHeroImageMode(mode)}
                                            className="flex items-center justify-center gap-2 py-2 rounded-sm text-sm font-semibold transition-colors cursor-pointer"
                                            style={active
                                                ? { background: 'var(--dash-accent)', color: 'var(--on-primary)', boxShadow: '0 1px 4px var(--shadow-color)' }
                                                : { background: 'transparent', color: 'var(--dash-text-3)' }}
                                        >
                                            {isLight ? <Sun size={15} /> : <Moon size={15} />}
                                            {isLight ? 'Light' : 'Dark'}
                                            {missing && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ background: 'currentColor', opacity: 0.45 }}
                                                    title="No dark image set"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Active uploader, bound to the selected mode */}
                            {(() => {
                                const isLight = heroImageMode === 'light';
                                const preview = isLight ? heroImagePreview : heroImagePreviewDark;
                                const resolution = isLight ? heroImageResolution : heroImageResolutionDark;
                                const fileSize = isLight ? heroImageSize : heroImageSizeDark;
                                const sizeLoading = isLight ? heroImageSizeLoading : heroImageSizeLoadingDark;
                                const onUpload = () => (isLight ? heroImageInputRef : heroImageInputRefDark).current?.click();
                                const onBrowse = () => { setFirebaseSelectTarget(isLight ? 'hero' : 'heroDark'); setFirebaseBrowserOpen(true); };
                                return (
                                    <div className="flex flex-col gap-2">
                                        <div className="group relative overflow-hidden w-full max-w-full mx-auto md:mx-0 rounded-sm bg-[var(--dash-surface-2)] flex items-center justify-center border border-[var(--dash-border)]" style={{ paddingTop: '133%' }}>
                                            {preview ? (
                                                <img src={preview} alt={isLight ? 'Hero Light Preview' : 'Hero Dark Preview'} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-dash-text-3 gap-2">
                                                    {isLight ? <User size={48} className="opacity-20" /> : <Moon size={40} className="opacity-20" />}
                                                    <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{isLight ? 'No Image' : 'No Dark Image'}</span>
                                                    {!isLight && <span className="text-xs text-dash-text-3 opacity-70 px-4 text-center">Falls back to light image if empty</span>}
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-dash-surface-2 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm">
                                                <button
                                                    onClick={onUpload}
                                                    aria-label={isLight ? 'Upload light hero image' : 'Upload dark hero image'}
                                                    className="inline-flex items-center gap-3 px-4 py-2 rounded-sm bg-dash-accent/10 border border-dash-accent/20 text-dash-accent-text font-semibold hover:bg-dash-accent/20 transition"
                                                >
                                                    <span className="p-1.5 rounded-full bg-dash-accent/10 flex items-center justify-center border border-dash-accent/10">
                                                        <Upload size={16} className="text-dash-accent-text" />
                                                    </span>
                                                    <span className="hidden sm:inline text-dash-accent-text tracking-wide font-semibold">Upload</span>
                                                </button>

                                                <button
                                                    onClick={onBrowse}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-dash-warning-soft border border-dash-warning/30 text-dash-warning font-semibold hover:bg-dash-warning-soft transition"
                                                >
                                                    <HardDrive size={16} className="text-dash-warning" />
                                                    <span className="text-dash-warning">Browse</span>
                                                </button>
                                            </div>
                                        </div>
                                        {resolution ? (
                                            <p className="text-dash-text-3 text-xs">
                                                Resolution: <span className="font-heading text-xs">{resolution}</span>
                                                {fileSize && <span className="text-dash-text-3"> &nbsp;•&nbsp; <span className="font-heading text-xs">{fileSize}</span></span>}
                                                {sizeLoading && <span className="text-dash-text-3"> &nbsp;•&nbsp; <span className="text-xs">checking...</span></span>}
                                            </p>
                                        ) : (
                                            <p className="text-dash-text-3 text-xs">{isLight ? 'JPG, PNG or WebP. Max 2MB' : 'Optional · shown only in dark mode'}</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Hidden file inputs kept always-mounted so the refs never detach */}
                            <input ref={heroImageInputRef} type="file" accept="image/*" onChange={handleHeroImageUpload} style={{ display: 'none' }} />
                            <input ref={heroImageInputRefDark} type="file" accept="image/*" onChange={handleHeroImageUploadDark} style={{ display: 'none' }} />
                        </div>

                        <div className="md:col-span-8 flex flex-col gap-6">
                            {/* Profile */}
                            <div className="settings-panel glass-panel p-6 flex flex-col gap-4">
                                <h3 className="heading-md text-base sm:text-lg md:text-xl flex items-center mb-2">
                                    <User size={22} className="mr-3" />
                                    Profile
                                </h3>
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                    <div className="group relative flex-shrink-0">
                                        <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-dash-accent p-0.5 flex-shrink-0 mx-auto sm:mx-0 bg-[var(--dash-surface-2)] flex items-center justify-center">
                                            {profileImagePreview ? (
                                                <img src={profileImagePreview} alt="Profile Preview" className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <User size={40} className="text-dash-text-3 opacity-80" />
                                            )}
                                        </div>

                                        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-dash-surface-2 rounded-full">
                                            <button
                                                aria-label="Upload profile image"
                                                onClick={() => profileImageInputRef.current?.click()}
                                                className="w-10 h-10 rounded-full bg-dash-accent/10 border border-dash-accent/20 text-dash-accent-text flex items-center justify-center hover:bg-dash-accent/20 transition"
                                            >
                                                <Upload size={16} />
                                            </button>

                                            <button
                                                aria-label="Browse profile image"
                                                onClick={() => { setFirebaseSelectTarget('profile'); setFirebaseBrowserOpen(true); }}
                                                className="w-10 h-10 rounded-full bg-dash-warning-soft border border-dash-warning/30 text-dash-warning flex items-center justify-center hover:bg-dash-warning-soft transition"
                                            >
                                                <HardDrive size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full flex-1">
                                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                                            <div className="sm:text-left flex-1">
                                                {!isEditingProfile ? (
                                                    <>
                                                        <div className="font-bold">{profileName}</div>
                                                        <div className="text-dash-text-2 text-sm opacity-70">{profileTitle}</div>
                                                        {profileImageResolution ? (
                                                            <p className="text-dash-text-3 text-xs mt-1">
                                                                Resolution: <span className="font-heading text-xs">{profileImageResolution}</span>
                                                                {profileImageSize && <span className="text-dash-text-3"> &nbsp;•&nbsp; <span className="font-heading text-xs">{profileImageSize}</span></span>}
                                                                {profileImageSizeLoading && <span className="text-dash-text-3"> &nbsp;•&nbsp; <span className="text-xs">checking...</span></span>}
                                                            </p>
                                                        ) : null}
                                                        <p className="text-dash-text-3 text-xs mt-2">Profile image is used across the site</p>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <input className="input-field" value={profileName} onChange={(e) => { setProfileName(e.target.value); setHasUnsavedChanges(true); }} placeholder="Full name" />
                                                        <input className="input-field" value={profileTitle} onChange={(e) => { setProfileTitle(e.target.value); setHasUnsavedChanges(true); }} placeholder="Job title" />
                                                    </div>
                                                )}

                                            </div>

                                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                                {!isEditingProfile ? (
                                                    <button onClick={() => { setProfileBackup({ name: profileName, title: profileTitle }); setIsEditingProfile(true); }} className="btn btn-secondary px-3 py-2">
                                                        <Edit2 size={16} />
                                                        <span className="hidden sm:inline ml-2">Edit</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button onClick={() => {
                                                            // Stage changes locally; Apply Changes will persist to Firebase
                                                            setHasUnsavedChanges(true);
                                                            setProfileInfoDirty(true);
                                                            setIsEditingProfile(false);
                                                            setProfileBackup(null);
                                                            safeSetAlert({ show: true, type: 'success', message: 'Profile changes staged. Click Apply Changes at the bottom of the page to save permanently.', duration: 3000 });
                                                        }} className="btn btn-primary px-3 py-2"><Save size={16} /><span className="hidden sm:inline ml-2">Save</span>
                                                        </button>
                                                        <button onClick={() => {
                                                            if (profileBackup) {
                                                                setProfileName(profileBackup.name);
                                                                setProfileTitle(profileBackup.title);
                                                                setProfileBackup(null);
                                                            }
                                                            setIsEditingProfile(false);
                                                        }} className="btn btn-secondary px-3 py-2"><X size={16} /><span className="hidden sm:inline ml-2">Cancel</span></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex gap-2 items-center">
                                                {profileImageDirty ? (
                                                    <>
                                                        <button onClick={() => {
                                                            // Stage upload - actual upload will happen when Apply Changes is clicked
                                                            setHasUnsavedChanges(true);
                                                            safeSetAlert({ show: true, type: 'success', message: 'Profile image staged. Click Apply Changes to save to Firebase.', duration: 3000 });
                                                        }} className="btn btn-primary px-3 py-2" disabled={profileImageUploading}>{profileImageUploading ? 'Saving...' : (<><Save size={16} /><span className="hidden sm:inline ml-2">Save Image</span></>)}</button>
                                                        <button onClick={handleCancelProfileImageChange} className="btn btn-secondary px-3 py-2"><X size={16} /><span className="hidden sm:inline ml-2">Cancel</span></button>
                                                    </>
                                                ) : null}
                                            </div>

                                            <input ref={profileImageInputRef} type="file" accept="image/*" onChange={handleProfileImageUpload} style={{ display: 'none' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Social Links Editor */}
                            <div className="settings-panel glass-panel p-6 flex flex-col gap-5">
                                <h3 className="heading-md text-base sm:text-lg md:text-xl flex items-center m-0">
                                    <Link size={22} className="mr-3" />
                                    Social Links
                                </h3>

                                {/* Email */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="settings-contact-email" className="text-xs font-semibold text-dash-text-3">Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-text-3 pointer-events-none" />
                                        <input
                                            id="settings-contact-email"
                                            type="email"
                                            autoComplete="email"
                                            className="input-field w-full !h-11 !py-0 !pl-10 !text-sm"
                                            style={contactEmail.trim() && !isValidContactEmail(contactEmail) ? { borderColor: 'var(--dash-danger)' } : undefined}
                                            aria-invalid={!!contactEmail.trim() && !isValidContactEmail(contactEmail)}
                                            aria-describedby="settings-contact-email-error"
                                            placeholder="hello@example.com"
                                            value={contactEmail}
                                            onChange={(e) => { setContactEmail(e.target.value); setProfileInfoDirty(true); setHasUnsavedChanges(true); }}
                                        />
                                    </div>
                                    {contactEmail.trim() && !isValidContactEmail(contactEmail) && (
                                        <p id="settings-contact-email-error" role="alert" className="m-0 text-xs text-dash-danger">Enter a valid email address, or leave it empty.</p>
                                    )}
                                    <span className="text-xs text-dash-text-3">Shown first on the book page and on the CV. Leave empty to hide it.</span>
                                </div>

                                {/* Links */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-dash-text-3">Links</span>
                                        <span className="text-xs text-dash-text-3 tabular-nums">{socialLinks.length}/5</span>
                                    </div>
                                    {socialLinks.length > 0 ? (
                                        <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
                                            {socialLinks.map((link, index) => (
                                                <li key={index} className="flex items-center gap-3 h-12 pl-3 pr-1.5 rounded-sm bg-dash-surface-2 dark:bg-dash-surface-2">
                                                    <span className="w-7 h-7 rounded-sm bg-dash-accent/10 text-dash-accent-text grid place-items-center shrink-0">
                                                        <Link size={14} />
                                                    </span>
                                                    <span className="font-bold text-sm truncate shrink-0 max-w-[40%]">{link.name}</span>
                                                    <span className="text-xs text-dash-text-3 truncate min-w-0 flex-1">{link.url}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove ${link.name}`}
                                                        className="w-9 h-9 grid place-items-center shrink-0 text-dash-danger hover:bg-dash-accent-soft rounded-sm transition-colors"
                                                        onClick={() => {
                                                            const newLinks = [...socialLinks];
                                                            newLinks.splice(index, 1);
                                                            setSocialLinks(newLinks);
                                                            setProfileInfoDirty(true);
                                                            setHasUnsavedChanges(true);
                                                        }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="empty-state text-center p-5 text-sm">
                                            No links yet. Add up to 5.
                                        </div>
                                    )}
                                </div>

                                {/* Add a link */}
                                {socialLinks.length < 5 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-2 items-end">
                                        <div className="flex flex-col gap-1.5">
                                            <label htmlFor="settings-link-name" className="text-xs font-semibold text-dash-text-3">Name</label>
                                            <input
                                                id="settings-link-name"
                                                className="input-field w-full !h-11 !py-0 !text-sm"
                                                placeholder="GitHub"
                                                value={newLinkName}
                                                onChange={(e) => setNewLinkName(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label htmlFor="settings-link-url" className="text-xs font-semibold text-dash-text-3">Address</label>
                                            <input
                                                id="settings-link-url"
                                                className="input-field w-full !h-11 !py-0 !text-sm"
                                                placeholder="https://..."
                                                value={newLinkUrl}
                                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') addSocialLink(); }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-primary h-11 !py-0 px-5 justify-center"
                                            disabled={!newLinkName.trim() || !newLinkUrl.trim()}
                                            onClick={addSocialLink}
                                        >
                                            <Plus size={18} /> Add
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                    )}

                    {activeTab === 'calendar' && (
                        <motion.div
                            key="calendar"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: 'easeInOut' }}
                            className="settings-section"
                        >
                            <DCalendarPanel isDark={isDark} />
                        </motion.div>
                    )}

                    {activeTab === 'mcp' && (
                        <motion.div
                            key="mcp"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: 'easeInOut' }}
                            className="settings-section"
                        >
                            <DMcpPanel isDark={isDark} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Stack Modal */}
            <MStackItem
                isOpen={stackModalOpen}
                onClose={closeStackModal}
                onSave={handleSaveStack}
                initialData={editingStack}
            />

            {/* Sticky Action Bar (shared component) */}
            <SaveBar show={hasUnsavedChanges} onApply={handleApplyAll} onCancel={handleCancelAll} isDark={isDark} />

            {/* Firebase Browser */}
            <MFirebaseStorage
                isOpen={firebaseBrowserOpen}
                onClose={() => { setFirebaseBrowserOpen(false); setFirebaseSelectTarget(null); }}
                onSelect={(url) => {
                    if (firebaseSelectTarget === 'hero') {
                        setHeroImagePreview(url);
                        setHeroImageFile(null);
                        setHeroImageDirty(true);
                        setHasUnsavedChanges(true);
                    } else if (firebaseSelectTarget === 'heroDark') {
                        setHeroImagePreviewDark(url);
                        setHeroImageFileDark(null);
                        setHeroImageDirtyDark(true);
                        setHasUnsavedChanges(true);
                    } else if (firebaseSelectTarget === 'profile') {
                        // Backup current profile if not already backed up
                        if (!profileImageBackupPreview) {
                            setProfileImageBackupPreview(profileImagePreview);
                            setProfileImageBackupFile(profileImageFile);
                        }
                        setOriginalImageSrc(url);
                        setIsCropping(true);
                    }
                    setFirebaseSelectTarget(null);
                    setFirebaseBrowserOpen(false);
                }}
                fileTypes={['svg', 'png', 'jpg', 'jpeg', 'webp']}
                title={
                    firebaseSelectTarget === 'hero' ? 'Select Light Hero Image' :
                    firebaseSelectTarget === 'heroDark' ? 'Select Dark Hero Image' :
                    firebaseSelectTarget === 'profile' ? 'Select Profile Image' :
                    'Select File'
                }
            />

            <MConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
                onConfirm={confirmConfig.onConfirm}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                confirmText="Confirm"
            />

        </div >
    );
};

