import React, { useEffect, useState, useRef } from 'react';
import { ArrowRight, X, Sparkles, Navigation } from 'lucide-react';

export interface TourStep {
    target: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onComplete: () => void;
    onSkip: () => void;
}

export function OnboardingTour({ steps, isOpen, onComplete, onSkip }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && steps[currentStep]) {
            const updatePosition = () => {
                const target = document.querySelector(steps[currentStep].target);
                if (target) {
                    const rect = target.getBoundingClientRect();
                    setTargetRect(rect);

                    // Calculate card position
                    const spacing = 20;
                    let top = 0;
                    let left = 0;
                    const pos = steps[currentStep].position || 'bottom';

                    // Rough positioning logic - in a real app, use floating-ui
                    switch (pos) {
                        case 'bottom':
                            top = rect.bottom + spacing;
                            left = rect.left + rect.width / 2 - 160; // Center horizontally (card width ~320px)
                            break;
                        case 'top':
                            top = rect.top - spacing - 200; // Approx card height
                            left = rect.left + rect.width / 2 - 160;
                            break;
                        case 'left':
                            top = rect.top + rect.height / 2 - 100;
                            left = rect.left - spacing - 340;
                            break;
                        case 'right':
                            top = rect.top + rect.height / 2 - 100;
                            left = rect.right + spacing;
                            break;
                        case 'center':
                            top = window.innerHeight / 2 - 100;
                            left = window.innerWidth / 2 - 160;
                            break;
                    }

                    // Safety bounds
                    if (left < 20) left = 20;
                    if (left + 320 > window.innerWidth - 20) left = window.innerWidth - 340;
                    if (top < 20) top = 20;

                    setPositionStyle({ top, left });
                } else {
                    // If target not found, default to center
                    setTargetRect(null);
                    setPositionStyle({
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)'
                    });
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition);
            };
        }
    }, [isOpen, currentStep, steps]);

    if (!isOpen) return null;

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-auto">
            {/* Dark Overlay with Cutout */}
            {targetRect && (
                <div
                    className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-[2px] transition-all duration-500 ease-in-out"
                    style={{
                        clipPath: `polygon(
               0% 0%, 
               0% 100%, 
               100% 100%, 
               100% 0%, 
               ${targetRect.left}px 0%, 
               ${targetRect.left}px ${targetRect.top}px, 
               ${targetRect.right}px ${targetRect.top}px, 
               ${targetRect.right}px ${targetRect.bottom}px, 
               ${targetRect.left}px ${targetRect.bottom}px, 
               ${targetRect.left}px 0%
             )`
                    }}
                />
            )}

            {/* Fallback overlay if no target */}
            {!targetRect && (
                <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-[2px]" />
            )}

            {/* Spotlight Glow Ring */}
            {targetRect && (
                <div
                    className="absolute rounded-xl border-2 border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.2)] animate-pulse-ring pointer-events-none transition-all duration-500 ease-in-out"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                />
            )}

            {/* Guide Card */}
            <div
                ref={containerRef}
                className="absolute w-[320px] transition-all duration-500 ease-in-out animate-float-card"
                style={positionStyle}
            >
                <div className="relative bg-[#0a0a0b]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
                    {/* Decorative gradients */}
                    <div className="absolute -top-[1px] -left-[1px] w-12 h-12 bg-gradient-to-br from-amber-400/40 to-transparent rounded-tl-2xl pointer-events-none" />
                    <div className="absolute -bottom-[1px] -right-[1px] w-12 h-12 bg-gradient-to-tl from-amber-400/10 to-transparent rounded-br-2xl pointer-events-none" />

                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 border border-amber-400/20">
                            <Sparkles size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1 tracking-tight">
                                {step.title}
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                {step.content}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                        <div className="flex gap-1">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/10'}`}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={onSkip}
                                className="text-xs font-medium text-gray-500 hover:text-white transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-amber-400 transition-all shadow-lg hover:shadow-amber-400/20 active:scale-95"
                            >
                                {isLastStep ? 'Get Started' : 'Next'}
                                {!isLastStep && <ArrowRight size={12} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
