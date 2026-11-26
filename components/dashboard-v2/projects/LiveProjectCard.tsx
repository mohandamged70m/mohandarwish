"use client";
/** The project form live preview card, drawn from the draft as it is typed. */
import { useState, useEffect } from 'react';
import { sanitizeSvg } from '@/lib/sanitize';
import { Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Github } from '@/components/dashboard-v2/ui/BrandIcons';
import type { ProjectFormData } from '@/types';
import { useObjectURL } from '@/hooks/useObjectURL';

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

// Live Preview Component
export const LiveProjectCard = ({ project, isDark }: { project: ProjectFormData; isDark: boolean }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showContributors, setShowContributors] = useState(false);

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

    useEffect(() => {
        if (sortedImages.length > 1) {
            const interval = setInterval(() => {
                setCurrentImageIndex((prev) => (prev + 1) % sortedImages.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [sortedImages.length]);

    useEffect(() => {
        const interval = setInterval(() => {
            setShowContributors(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const visibleStack = project.tags.slice(0, 2);
    const remainingStackCount = project.tags.length - 2;

    return (
        <div
            className="group flex flex-col w-full max-w-sm"
            style={{
                backgroundColor: 'var(--dash-surface)',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: 'var(--card-shadow)',
                border: `1px solid ${'var(--dash-border)'}`,
                transition: 'all 0.3s ease',
            }}
        >
            {/* Image Section */}
            <div style={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
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
                                alt={project.name}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    opacity: i === currentImageIndex ? 1 : 0,
                                    transition: 'opacity 0.5s ease, transform 0.5s ease',
                                }}
                            />
                        );
                    })
                ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-dash-surface/5' : 'bg-dash-surface-2'}`}>
                        <ImageIcon size={48} className={isDark ? 'text-dash-text-2' : 'text-dash-text-3'} />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

                <div className="absolute top-[15px] left-[15px] w-[calc(100%-30px)] h-[40px] overflow-hidden pointer-events-none">
                    {/* Stack Container */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: showContributors ? 0 : 1,
                            transform: showContributors ? 'translateY(-20px)' : 'translateY(0)',
                            transition: 'opacity 0.5s ease, transform 0.5s ease'
                        }}
                    >
                        {visibleStack.map((tech, i) => (
                            <span key={i} style={{
                                padding: '6px 14px',
                                backgroundColor: tech.color ? `color-mix(in srgb, tech.color 25%, transparent)` : 'var(--dash-accent-text)',
                                color: 'white',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                border: `1px solid ${tech.color ? tech.color : 'var(--dash-border)'}`,
                                boxShadow: '0 4px 6px var(--shadow-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                {tech.iconSvg && (
                                    tech.iconSvg.startsWith('http') || tech.iconSvg.startsWith('data:image') ? (
                                        <img src={tech.iconSvg} className="w-3.5 h-3.5 object-contain" alt={tech.name} />
                                    ) : (
                                        <span className="w-3.5 h-3.5 flex items-center justify-center"
                                            style={{ filter: 'brightness(0) invert(1)' }}
                                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(tech.iconSvg) }} />
                                    )
                                )}
                                {tech.name}
                            </span>
                        ))}
                        {remainingStackCount > 0 && (
                            <span style={{
                                padding: '6px 14px',
                                backgroundColor: 'var(--dash-surface-2)',
                                color: 'white',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                border: '1px solid var(--dash-border)'
                            }}>
                                +{remainingStackCount}
                            </span>
                        )}
                    </div>

                    {/* Contributors Container */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: showContributors ? 1 : 0,
                            transform: showContributors ? 'translateY(0)' : 'translateY(20px)',
                            transition: 'opacity 0.5s ease, transform 0.5s ease',
                            pointerEvents: 'auto'
                        }}
                    >
                        <span style={{
                            padding: '6px 14px',
                            backgroundColor: 'var(--dash-surface-2)',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid var(--dash-border)',
                            marginRight: '4px',
                            boxShadow: '0 4px 6px var(--shadow-color)'
                        }}>
                            Contributors
                        </span>
                        <div className="flex ml-1">
                            {project.contributors.slice(0, 3).map((contributor, i) => (
                                <div key={i} className={`w-8 h-8 rounded-full overflow-hidden border-2 border-dash-border/80 shadow-sm bg-dash-surface-3 ${i > 0 ? '-ml-4' : ''}`} style={{ transform: `translateX(${i * -12}px)` }}>
                                    {typeof contributor.image === 'string' ? (
                                        <img src={contributor.image} alt={contributor.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-dash-accent text-dash-text text-xs font-bold">
                                            {contributor.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {project.contributors.length > 3 && (
                                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-dash-border/80 shadow-sm bg-dash-surface-3 text-dash-text flex items-center justify-center text-[10px] font-bold -ml-4" style={{ transform: `translateX(-36px)` }}>
                                    +{project.contributors.length - 3}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 className="font-body font-bold text-2xl mb-2 text-[var(--dash-text)]">
                    {project.name || 'Untitled Project'}
                </h3>
                <p className="font-body text-base text-[var(--dash-text-2)] leading-relaxed flex-1 line-clamp-3">
                    {project.description || 'Project description will appear here...'}
                </p>

                {/* Links */}
                {(project.repoLink || project.liveLink) && (
                    <div className="mt-6 flex gap-3">
                        {project.repoLink && (
                            <div className="flex items-center gap-2 text-sm font-semibold text-dash-accent-text">
                                <Github size={16} /> Code
                            </div>
                        )}
                        {project.liveLink && (
                            <div className="flex items-center gap-2 text-sm font-semibold text-dash-success">
                                <ExternalLink size={16} /> Live
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
