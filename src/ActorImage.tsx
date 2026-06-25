import {motion, Variants, easeOut, easeIn, AnimatePresence, useMotionValue, useSpring} from "framer-motion";
import {FC, useState, useEffect, useMemo, memo} from "react";

const IDLE_HEIGHT: number = 80;

interface ActorImageProps {
    id: string;
    resolveImageUrl: () => string;
    xPosition: number;
    yPosition: number;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    // 'isAudioPlaying' indicates whether audio is currently playing for this character
    isAudioPlaying?: boolean;
    // Optional Web Audio AnalyserNode for waveform-driven squish/stretch animation.
    // When provided, replaces the interval-based fallback with real-time amplitude analysis.
    audioAnalyser?: AnalyserNode | null;
}

const ActorImage: FC<ActorImageProps> = ({
    id,
    resolveImageUrl,
    xPosition,
    yPosition,
    onMouseEnter,
    onMouseLeave,
    isAudioPlaying = false,
    audioAnalyser = null
}) => {
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [displayedImageUrl, setDisplayedImageUrl] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<string>('9 / 16');
    const imageUrl = resolveImageUrl();

    // Preload the next image and only swap once it is ready.
    useEffect(() => {
        if (!imageUrl) {
            setIsLoaded(false);
            setDisplayedImageUrl('');
            return;
        }

        if (imageUrl === displayedImageUrl && isLoaded) {
            return;
        }

        let isCancelled = false;
        const img = new Image();
        img.onload = () => {
            if (isCancelled) {
                return;
            }
            if (img.naturalWidth && img.naturalHeight) {
                setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
            }
            setDisplayedImageUrl(imageUrl);
            setIsLoaded(true);
        };
        img.src = imageUrl;

        return () => {
            isCancelled = true;
        };
    }, [displayedImageUrl, imageUrl, isLoaded]);

    // Calculate final parallax position
    const baseX = xPosition;
    const baseY = yPosition;

    const variants: Variants = useMemo(() => {
        return {
            absent: {
                opacity: 0,
                x: `150vw`,
                bottom: `${baseY}vh`,
                height: `${IDLE_HEIGHT}vh`,
                filter: 'brightness(0.8)',
                transition: { x: { ease: easeIn, duration: 0.5 }, bottom: { duration: 0.5 }, opacity: { ease: easeOut, duration: 0.5 } }
            },
            idle: {
                opacity: 1,
                x: `${baseX}vw`,
                bottom: `${baseY}vh`,
                height: `${(IDLE_HEIGHT)}vh`,
                filter: 'brightness(0.8)',
                transition: { x: { ease: easeIn, duration: 0.3 }, bottom: { duration: 0.3 }, opacity: { ease: easeOut, duration: 0.3 } }
            }
        };
    }, [baseX, baseY, yPosition]);

    // Motion value for scaleY – driven by the audio analyser (RAF loop) when available,
    // or left at 1 when using the fallback interval approach (scaleY goes into animate then).
    const scaleYMotionValue = useMotionValue(1);
    // Keep damping close to critical so speech motion is smooth, but settles quickly
    // when audio stops.
    const springScaleY = useSpring(scaleYMotionValue, { stiffness: 360, damping: 40 });

    // Dynamic animation parameters that vary over time
    const [animationParams, setAnimationParams] = useState(() => {
        const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const random1 = Math.abs((Math.sin(seed) * 10000) % 1);
        const random2 = Math.abs((Math.sin(seed + 1) * 10000) % 1);
        
        // Initial randomized extremity: base range 0.995-1.005
        const squish = 0.995 + (random1 * 0.004);
        const stretch = 1.005 - (random2 * 0.004);
        
        // Initial randomized duration: 0.2-0.6s
        const duration = 0.2 + (random1 * 0.4);
        
        return { squish, stretch, duration };
    });

    // Web Audio analyser-driven animation: RAF loop reads waveform amplitude and maps it
    // to a real-time scaleY oscillation. Silence → no movement; louder speech → larger and
    // slightly faster squish/stretch. The spring smooths abrupt amplitude changes.
    useEffect(() => {
        if (!audioAnalyser || !isAudioPlaying) {
            scaleYMotionValue.set(1);
            return;
        }

        const bufferLength = audioAnalyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        let rafId: number;
        const startTime = performance.now();

        // Below this RMS level the audio is considered silent and the character stays still.
        // Keep this low enough so quieter speech still animates.
        const SILENCE_THRESHOLD = 0.01;
        // Expected upper bound for spoken RMS in this pipeline.
        // Lowering this increases sensitivity for quieter voices.
        const MAX_EXPECTED_RMS = 0.16;

        const analyse = () => {
            audioAnalyser.getFloatTimeDomainData(dataArray);

            // RMS amplitude – values are in [-1, 1] for float time-domain data.
            let sumSquares = 0;
            for (let i = 0; i < bufferLength; i++) {
                sumSquares += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sumSquares / bufferLength);

            if (rms < SILENCE_THRESHOLD) {
                // Treat as silence – snap target to rest so the (now critically-damped)
                // spring settles without oscillating.
                scaleYMotionValue.set(1);
            } else {
                // Remove the silence floor, then normalize so very quiet audio does not
                // permanently animate the actor. This avoids a "baseline springiness"
                // and preserves headroom for stronger speech peaks.
                const normalized = Math.min(
                    Math.max((rms - SILENCE_THRESHOLD) / (MAX_EXPECTED_RMS - SILENCE_THRESHOLD), 0),
                    1
                );

                // Non-linear response biased toward quieter speech so lower-energy
                // lines are still visibly animated.
                const magnitude = Math.pow(normalized, 0.9) * 0.1;

                // Oscillation frequency scales with loudness: quiet speech ~7 Hz, loud ~22 Hz.
                const frequency = 7 + normalized * 15;

                const elapsed = (performance.now() - startTime) / 1000;
                const oscillation = Math.sin(elapsed * frequency * Math.PI * 2);

                scaleYMotionValue.set(1 + magnitude * oscillation);
            }

            rafId = requestAnimationFrame(analyse);
        };

        rafId = requestAnimationFrame(analyse);
        return () => {
            cancelAnimationFrame(rafId);
            scaleYMotionValue.set(1);
        };
    }, [audioAnalyser, isAudioPlaying, scaleYMotionValue]);

    // Fallback: continuously vary animation parameters via interval when no analyser is
    // available but isAudioPlaying is true. Ignored when audioAnalyser is provided.
    useEffect(() => {
        if (!isAudioPlaying || audioAnalyser) {
            return;
        }

        // Update animation parameters every 0.5-2.5 seconds for natural variation
        const updateInterval = 500 + Math.random() * 2000;
        
        const intervalId = setInterval(() => {
            setAnimationParams(prev => {
                // Generate new random values with more variation
                const random1 = Math.random();
                const random2 = Math.random();
                const random3 = Math.random();
                
                // Wider range for squish: 0.992-0.998 (more compressed)
                const squish = 0.992 + (random1 * 0.006);
                
                // Wider range for stretch: 1.002-1.008 (more extended)
                const stretch = 1.002 + (random2 * 0.006);
                
                // Vary duration: 0.2-0.4s for different pacing
                const duration = 0.2 + (random3 * 0.2);
                
                return { squish, stretch, duration };
            });
        }, updateInterval);

        return () => clearInterval(intervalId);
    }, [isAudioPlaying, audioAnalyser]);

    // Build animate props based on speaker and audio state.
    // When an audioAnalyser is provided, scaleY is driven by the RAF motion value (in style)
    // and must NOT appear here. The fallback interval approach still injects scaleY into
    // animate when no analyser is available.
    const animateProps = useMemo(() => {
        if (isAudioPlaying && !audioAnalyser) {
            // Fallback: no analyser – use randomly-varied keyframe loop.
            const baseTransition = { x: { ease: easeIn, duration: 0.3 }, bottom: { duration: 0.3 }, opacity: { ease: easeOut, duration: 0.3 } };
            
            return {
                scaleY: [1, animationParams.squish, animationParams.stretch, 1],
                transition: {
                    ...baseTransition,
                    scaleY: {
                        duration: animationParams.duration,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }
                }
            };
        }
        return 'idle';
    }, [isAudioPlaying, audioAnalyser, variants, animationParams]);

    // Use a hard rest scale when audio is inactive so there is no residual spring motion.
    const scaleYStyle = isAudioPlaying ? springScaleY : 1;

    const tintFilterId = `tint-${id}`;
    const backingOpacity = 1;
    const mainOpacity = 0.75;
    
    return displayedImageUrl ? (
        <>
            {/* SVG filter: multiply image by highlightColor, preserving transparency */}
            <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <defs>
                    <filter id={tintFilterId} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                        <feFlood floodColor="#ffffff" result="flood" />
                        <feComposite in="flood" in2="SourceGraphic" operator="in" result="masked" />
                        <feBlend in="SourceGraphic" in2="masked" mode="multiply" />
                    </filter>
                </defs>
            </svg>
        <motion.div
            key={`actor_motion_div_${id}`}
            variants={variants}
            // Prevent automatic initial animation on remounts/refreshes; rely on animate to move between states
            initial={'absent'}
            exit='absent'
            animate={animateProps}
            transformTemplate={(_, generatedTransform) => {
                const baseTransform = generatedTransform?.trim() || '';
                return baseTransform
                    ? `${baseTransform} translateX(-50%)`
                    : 'translateX(-50%)';
            }}
            style={{position: 'absolute', width: 'auto', aspectRatio, overflow: 'visible', zIndex: 100, transformOrigin: 'bottom center', scaleY: scaleYStyle}}>
            <AnimatePresence>
                {/* Backing image layer - solid but blurry. */}
                {displayedImageUrl && (
                    <motion.img
                        key={`${id}_${displayedImageUrl}_bg`}
                        src={displayedImageUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: backingOpacity }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            width: '100%',
                            height: '100%',
                            opacity: backingOpacity,
                            filter: `url(#${tintFilterId}) blur(2.5px)`,
                            zIndex: 4,
                            pointerEvents: 'none'
                        }}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {/* Main image layer - semi transparent, but crisp. */}
                {displayedImageUrl && (
                    <motion.img
                        key={`${id}_${displayedImageUrl}_main`}
                        src={displayedImageUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: mainOpacity }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            width: '100%',
                            height: '100%',
                            filter: `url(#${tintFilterId})`,
                            zIndex: 6,
                        }}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                )}
            </AnimatePresence>
        </motion.div>
        </>
    ) : <></>;
};

export default memo(ActorImage);