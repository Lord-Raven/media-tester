import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {Box} from "@mui/material";
import {alpha} from "@mui/material/styles";
import ActorImage from "./ActorImage";

export type WitchSpeechItem = {
	text: string;
	speechUrl?: string;
};

export type WitchCompanionHandle = {
	enqueueSpeech: (speechItem: WitchSpeechItem) => void;
	enqueueSpeechBatch: (speechItems: WitchSpeechItem[]) => void;
	clearSpeechQueue: () => void;
};

type WitchCompanionProps = {
	resolveImageUrl?: () => string;
	xPosition?: number;
	yPosition?: number;
	initialSpeechQueue?: WitchSpeechItem[];
	defaultIdleText?: string;
};

const DEFAULT_WITCH_IMAGE = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 980">
		<defs>
			<linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#cce9ff"/>
				<stop offset="100%" stop-color="#8db9d6"/>
			</linearGradient>
			<linearGradient id="hat" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#e9f7ff"/>
				<stop offset="100%" stop-color="#99c4dc"/>
			</linearGradient>
		</defs>
		<path d="M70 955L130 520L292 520L350 955Z" fill="url(#robe)" opacity="0.96"/>
		<path d="M122 520C122 462 159 416 210 416C261 416 298 462 298 520Z" fill="#dbf2ff" opacity="0.9"/>
		<ellipse cx="210" cy="346" rx="84" ry="98" fill="#eff9ff"/>
		<path d="M210 94L122 312H298Z" fill="url(#hat)"/>
		<rect x="128" y="300" width="165" height="24" rx="12" fill="#b9def2"/>
		<circle cx="176" cy="338" r="8" fill="#7ca4ba"/>
		<circle cx="244" cy="338" r="8" fill="#7ca4ba"/>
		<path d="M176 385C195 405 225 405 244 385" stroke="#7ca4ba" stroke-width="8" fill="none" stroke-linecap="round"/>
	</svg>`,
)} `;

const WitchCompanion = forwardRef<WitchCompanionHandle, WitchCompanionProps>(function WitchCompanion(
	{
		resolveImageUrl,
		xPosition = 87,
		yPosition = -7,
		initialSpeechQueue = [],
		defaultIdleText = "Need a hint? I can read the runes.",
	},
	ref,
) {
	const [isAudioPlaying, setIsAudioPlaying] = useState(false);
	const [currentSpeechText, setCurrentSpeechText] = useState<string>(defaultIdleText);
	const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);

	const queueRef = useRef<WitchSpeechItem[]>([]);
	const isProcessingRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const activeAudioRef = useRef<HTMLAudioElement | null>(null);
	const activeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
	const activeAnalyserRef = useRef<AnalyserNode | null>(null);
	const textOnlyTimeoutRef = useRef<number | null>(null);

	const characterImageResolver = useMemo(() => {
		return resolveImageUrl ?? (() => DEFAULT_WITCH_IMAGE);
	}, [resolveImageUrl]);

	const tearDownActivePlayback = useCallback(() => {
		if (textOnlyTimeoutRef.current != null) {
			window.clearTimeout(textOnlyTimeoutRef.current);
			textOnlyTimeoutRef.current = null;
		}

		const activeAudio = activeAudioRef.current;
		if (activeAudio) {
			activeAudio.pause();
			activeAudio.onended = null;
			activeAudio.onerror = null;
		}

		activeSourceRef.current?.disconnect();
		activeAnalyserRef.current?.disconnect();

		activeAudioRef.current = null;
		activeSourceRef.current = null;
		activeAnalyserRef.current = null;
		setAudioAnalyser(null);
		setIsAudioPlaying(false);
	}, []);

	const processQueue = useCallback(async () => {
		if (isProcessingRef.current) {
			return;
		}

		const nextSpeech = queueRef.current.shift();
		if (!nextSpeech) {
			isProcessingRef.current = false;
			setCurrentSpeechText(defaultIdleText);
			setIsAudioPlaying(false);
			setAudioAnalyser(null);
			return;
		}

		isProcessingRef.current = true;
		setCurrentSpeechText(nextSpeech.text);

		if (!nextSpeech.speechUrl) {
			setIsAudioPlaying(false);
			setAudioAnalyser(null);
			textOnlyTimeoutRef.current = window.setTimeout(() => {
				isProcessingRef.current = false;
				void processQueue();
			}, 3200);
			return;
		}

		try {
			if (!audioContextRef.current) {
				audioContextRef.current = new AudioContext();
			}

			if (audioContextRef.current.state === "suspended") {
				await audioContextRef.current.resume();
			}

			const audio = new Audio(nextSpeech.speechUrl);
			audio.crossOrigin = "anonymous";
			audio.preload = "auto";

			const source = audioContextRef.current.createMediaElementSource(audio);
			const analyser = audioContextRef.current.createAnalyser();
			analyser.fftSize = 1024;
			analyser.smoothingTimeConstant = 0.8;

			source.connect(analyser);
			analyser.connect(audioContextRef.current.destination);

			activeAudioRef.current = audio;
			activeSourceRef.current = source;
			activeAnalyserRef.current = analyser;
			setAudioAnalyser(analyser);
			setIsAudioPlaying(true);

			audio.onended = () => {
				tearDownActivePlayback();
				isProcessingRef.current = false;
				void processQueue();
			};

			audio.onerror = () => {
				tearDownActivePlayback();
				isProcessingRef.current = false;
				void processQueue();
			};

			await audio.play();
		} catch {
			tearDownActivePlayback();
			isProcessingRef.current = false;
			void processQueue();
		}
	}, [defaultIdleText, tearDownActivePlayback]);

	const enqueueSpeech = useCallback((speechItem: WitchSpeechItem) => {
		if (!speechItem.text?.trim()) {
			return;
		}

		queueRef.current.push({
			text: speechItem.text.trim(),
			speechUrl: speechItem.speechUrl?.trim() || undefined,
		});

		void processQueue();
	}, [processQueue]);

	const enqueueSpeechBatch = useCallback((speechItems: WitchSpeechItem[]) => {
		for (const item of speechItems) {
			if (!item.text?.trim()) {
				continue;
			}

			queueRef.current.push({
				text: item.text.trim(),
				speechUrl: item.speechUrl?.trim() || undefined,
			});
		}

		void processQueue();
	}, [processQueue]);

	const clearSpeechQueue = useCallback(() => {
		queueRef.current = [];
		isProcessingRef.current = false;
		tearDownActivePlayback();
		setCurrentSpeechText(defaultIdleText);
	}, [defaultIdleText, tearDownActivePlayback]);

	useImperativeHandle(ref, () => ({
		enqueueSpeech,
		enqueueSpeechBatch,
		clearSpeechQueue,
	}), [clearSpeechQueue, enqueueSpeech, enqueueSpeechBatch]);

	useEffect(() => {
		if (initialSpeechQueue.length > 0) {
			enqueueSpeechBatch(initialSpeechQueue);
		}
	}, [enqueueSpeechBatch, initialSpeechQueue]);

	useEffect(() => {
		return () => {
			tearDownActivePlayback();
			if (audioContextRef.current) {
				void audioContextRef.current.close();
				audioContextRef.current = null;
			}
		};
	}, [tearDownActivePlayback]);

	return (
		<Box
			sx={{
				position: "fixed",
				inset: 0,
				pointerEvents: "none",
				overflow: "hidden",
				zIndex: 3,
			}}
		>
			<motion.div
				style={{position: "absolute", inset: 0}}
				animate={{y: [0, -8, 0]}}
				transition={{duration: 6.8, repeat: Infinity, ease: "easeInOut"}}
			>
				<ActorImage
					id="studio-witch-helper"
					resolveImageUrl={characterImageResolver}
					xPosition={xPosition}
					yPosition={yPosition}
					isAudioPlaying={isAudioPlaying}
					audioAnalyser={audioAnalyser}
				/>
			</motion.div>

			<AnimatePresence mode="wait">
				<motion.div
					key={currentSpeechText}
					initial={{opacity: 0, y: 8}}
					animate={{opacity: 1, y: 0}}
					exit={{opacity: 0, y: -6}}
					transition={{duration: 0.26, ease: "easeOut"}}
					style={{
						position: "absolute",
						right: "clamp(162px, 20vw, 305px)",
						bottom: "clamp(255px, 38vh, 430px)",
						maxWidth: "min(350px, 44vw)",
						padding: "10px 14px",
						borderRadius: 16,
						border: `1px solid ${alpha("#dbecff", 0.45)}`,
						background: `linear-gradient(140deg, ${alpha("#f4faff", 0.86)} 0%, ${alpha("#d2e7f7", 0.82)} 100%)`,
						boxShadow: `0 16px 28px ${alpha("#000000", 0.2)}`,
						color: "#10253a",
						fontSize: "0.86rem",
						lineHeight: 1.45,
					}}
				>
					{currentSpeechText}
				</motion.div>
			</AnimatePresence>
		</Box>
	);
});

export {WitchCompanion};
export default WitchCompanion;
