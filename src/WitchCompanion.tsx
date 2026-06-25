import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {Box} from "@mui/material";
import {alpha} from "@mui/material/styles";
import ActorImage, { IDLE_HEIGHT } from "./ActorImage";

export type WitchSpeechItem = {
	id?: string;
	text: string;
	speechUrl?: string;
};

export type WitchCompanionHandle = {
	enqueueSpeech: (speechItem: WitchSpeechItem) => void;
	enqueueSpeechBatch: (speechItems: WitchSpeechItem[]) => void;
	clearSpeechQueue: () => void;
};

type WitchCompanionProps = {
	incomingSpeechItem?: WitchSpeechItem | null;
	resolveImageUrl?: () => string;
	xPosition?: number;
	yPosition?: number;
	initialSpeechQueue?: WitchSpeechItem[];
	defaultIdleText?: string;
};

const DEFAULT_WITCH_IMAGE = `https://media.charhub.io/d304e613-f5e9-41ab-8440-241b62826e82/d915b1dc-faa7-4216-8ef3-e70c65354542.png`;
const MIN_DIALOGUE_HOLD_MS = 15000;
const IDLE_DIALOGUE_HOLD_MS = 60000;

type QueueSpeechItem = {
	id: string;
	text: string;
	speechUrl?: string;
};

const WitchCompanion = forwardRef<WitchCompanionHandle, WitchCompanionProps>(function WitchCompanion(
	{
		incomingSpeechItem,
		resolveImageUrl,
		xPosition = 87,
		yPosition = -7,
		initialSpeechQueue = [],
		defaultIdleText = "What are we brewing today?",
	},
	ref,
) {
	const [isAudioPlaying, setIsAudioPlaying] = useState(false);
	const [currentSpeechText, setCurrentSpeechText] = useState<string>(defaultIdleText);
	const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);

	const queueRef = useRef<QueueSpeechItem[]>([]);
	const isProcessingRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const activeAudioRef = useRef<HTMLAudioElement | null>(null);
	const activeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
	const activeAnalyserRef = useRef<AnalyserNode | null>(null);
	const textOnlyTimeoutRef = useRef<number | null>(null);
	const currentSpeechRef = useRef<QueueSpeechItem | null>(null);
	const currentSpeechStartedAtRef = useRef<number>(0);
	const currentSpeechHoldUntilRef = useRef<number>(0);

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

	const normalizeSpeechItem = useCallback((speechItem: WitchSpeechItem): QueueSpeechItem | null => {
		const text = speechItem.text?.trim();
		if (!text) {
			return null;
		}

		return {
			id: speechItem.id?.trim() || text,
			text,
			speechUrl: speechItem.speechUrl?.trim() || undefined,
		};
	}, []);

	const scheduleNextSpeech = useCallback((targetHoldMs: number, processQueue: () => Promise<void>) => {
		const holdUntil = currentSpeechStartedAtRef.current + targetHoldMs;
		currentSpeechHoldUntilRef.current = holdUntil;
		const delayMs = Math.max(holdUntil - Date.now(), 0);

		textOnlyTimeoutRef.current = window.setTimeout(() => {
			isProcessingRef.current = false;
			void processQueue();
		}, delayMs);
	}, []);

	const processQueue = useCallback(async () => {
		if (isProcessingRef.current) {
			return;
		}

		const nextSpeech = queueRef.current.shift();
		if (!nextSpeech) {
			isProcessingRef.current = false;
			currentSpeechRef.current = null;
			currentSpeechStartedAtRef.current = 0;
			currentSpeechHoldUntilRef.current = 0;
			setCurrentSpeechText(defaultIdleText);
			setIsAudioPlaying(false);
			setAudioAnalyser(null);
			return;
		}

		isProcessingRef.current = true;
		currentSpeechRef.current = nextSpeech;
		currentSpeechStartedAtRef.current = Date.now();
		currentSpeechHoldUntilRef.current = 0;
		setCurrentSpeechText(nextSpeech.text);

		if (!nextSpeech.speechUrl) {
			setIsAudioPlaying(false);
			setAudioAnalyser(null);
			scheduleNextSpeech(queueRef.current.length === 0 ? IDLE_DIALOGUE_HOLD_MS : MIN_DIALOGUE_HOLD_MS, processQueue);
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
				scheduleNextSpeech(queueRef.current.length === 0 ? IDLE_DIALOGUE_HOLD_MS : MIN_DIALOGUE_HOLD_MS, processQueue);
			};

			audio.onerror = () => {
				tearDownActivePlayback();
				scheduleNextSpeech(queueRef.current.length === 0 ? IDLE_DIALOGUE_HOLD_MS : MIN_DIALOGUE_HOLD_MS, processQueue);
			};

			await audio.play();
		} catch {
			tearDownActivePlayback();
			scheduleNextSpeech(queueRef.current.length === 0 ? IDLE_DIALOGUE_HOLD_MS : MIN_DIALOGUE_HOLD_MS, processQueue);
		}
	}, [defaultIdleText, scheduleNextSpeech, tearDownActivePlayback]);

	const enqueueSpeech = useCallback((speechItem: WitchSpeechItem) => {
		const normalizedItem = normalizeSpeechItem(speechItem);
		if (!normalizedItem) {
			return;
		}

		if (normalizedItem.speechUrl) {
			const currentSpeech = currentSpeechRef.current;
			if (currentSpeech && currentSpeech.id === normalizedItem.id && !currentSpeech.speechUrl) {
				currentSpeech.speechUrl = normalizedItem.speechUrl;

				if (!activeAudioRef.current) {
					if (textOnlyTimeoutRef.current != null) {
						window.clearTimeout(textOnlyTimeoutRef.current);
						textOnlyTimeoutRef.current = null;
					}
					isProcessingRef.current = false;
					queueRef.current.unshift(currentSpeech);
					currentSpeechRef.current = null;
					void processQueue();
				}

				return;
			}

			const queuedSpeech = queueRef.current.find((item) => item.id === normalizedItem.id && !item.speechUrl);
			if (queuedSpeech) {
				queuedSpeech.speechUrl = normalizedItem.speechUrl;
				return;
			}
		}

		queueRef.current.push(normalizedItem);

		if (
			currentSpeechHoldUntilRef.current > 0
			&& currentSpeechStartedAtRef.current > 0
			&& !activeAudioRef.current
			&& currentSpeechHoldUntilRef.current > currentSpeechStartedAtRef.current + MIN_DIALOGUE_HOLD_MS
		) {
			const minHoldUntil = currentSpeechStartedAtRef.current + MIN_DIALOGUE_HOLD_MS;
			currentSpeechHoldUntilRef.current = minHoldUntil;
			if (textOnlyTimeoutRef.current != null) {
				window.clearTimeout(textOnlyTimeoutRef.current);
				textOnlyTimeoutRef.current = window.setTimeout(() => {
					isProcessingRef.current = false;
					void processQueue();
				}, Math.max(minHoldUntil - Date.now(), 0));
			}
		}

		void processQueue();
	}, [normalizeSpeechItem, processQueue]);

	const enqueueSpeechBatch = useCallback((speechItems: WitchSpeechItem[]) => {
		for (const item of speechItems) {
			const normalizedItem = normalizeSpeechItem(item);
			if (!normalizedItem) {
				continue;
			}

			queueRef.current.push(normalizedItem);
		}

		void processQueue();
	}, [normalizeSpeechItem, processQueue]);

	const clearSpeechQueue = useCallback(() => {
		queueRef.current = [];
		isProcessingRef.current = false;
		currentSpeechRef.current = null;
		currentSpeechStartedAtRef.current = 0;
		currentSpeechHoldUntilRef.current = 0;
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
		if (!incomingSpeechItem) {
			return;
		}

		enqueueSpeech(incomingSpeechItem);
	}, [enqueueSpeech, incomingSpeechItem]);

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
						right: `5vw`,
						bottom: `${yPosition + IDLE_HEIGHT}vh`,
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
