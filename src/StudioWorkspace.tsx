import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Box, Tab, Tabs} from "@mui/material";
import {AnimatePresence, motion} from "framer-motion";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import {alpha, createTheme, ThemeProvider} from "@mui/material/styles";
import {MusicStudio} from "./MusicStudio";
import {ArtStudio, ImageHistoryEntry} from "./ArtStudio";
import {VideoHistoryEntry, VideoStudio} from "./VideoStudio";
import ActorImage from "./ActorImage";

type WitchSpeechItem = {
	text: string;
	speechUrl?: string;
};

const DEFAULT_WITCH_IMAGE = `https://media.charhub.io/d304e613-f5e9-41ab-8440-241b62826e82/d915b1dc-faa7-4216-8ef3-e70c65354542.png`;

type WitchCompanionProps = {
	incomingSpeechItem?: WitchSpeechItem | null;
};

function WitchCompanion({incomingSpeechItem}: WitchCompanionProps) {
	const [isAudioPlaying, setIsAudioPlaying] = useState(false);
	const [currentSpeechText, setCurrentSpeechText] = useState("Need a hint? I can read the runes.");
	const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);

	const queueRef = useRef<WitchSpeechItem[]>([]);
	const isProcessingRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const activeAudioRef = useRef<HTMLAudioElement | null>(null);
	const activeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
	const activeAnalyserRef = useRef<AnalyserNode | null>(null);
	const textTimeoutRef = useRef<number | null>(null);

	const clearPlayback = useCallback(() => {
		if (textTimeoutRef.current != null) {
			window.clearTimeout(textTimeoutRef.current);
			textTimeoutRef.current = null;
		}

		if (activeAudioRef.current) {
			activeAudioRef.current.pause();
			activeAudioRef.current.onended = null;
			activeAudioRef.current.onerror = null;
		}

		activeSourceRef.current?.disconnect();
		activeAnalyserRef.current?.disconnect();
		activeAudioRef.current = null;
		activeSourceRef.current = null;
		activeAnalyserRef.current = null;
		setAudioAnalyser(null);
		setIsAudioPlaying(false);
	}, []);

	const runQueue = useCallback(async () => {
		if (isProcessingRef.current) {
			return;
		}

		const next = queueRef.current.shift();
		if (!next) {
			setCurrentSpeechText("Need a hint? I can read the runes.");
			setAudioAnalyser(null);
			setIsAudioPlaying(false);
			return;
		}

		isProcessingRef.current = true;
		setCurrentSpeechText(next.text);

		if (!next.speechUrl) {
			setAudioAnalyser(null);
			setIsAudioPlaying(false);
			textTimeoutRef.current = window.setTimeout(() => {
				isProcessingRef.current = false;
				void runQueue();
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

			const audio = new Audio(next.speechUrl);
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
				clearPlayback();
				isProcessingRef.current = false;
				void runQueue();
			};

			audio.onerror = () => {
				clearPlayback();
				isProcessingRef.current = false;
				void runQueue();
			};

			await audio.play();
		} catch {
			clearPlayback();
			isProcessingRef.current = false;
			void runQueue();
		}
	}, [clearPlayback]);

	const enqueueSpeech = useCallback((speechItem: WitchSpeechItem) => {
		if (!speechItem.text?.trim()) {
			return;
		}

		queueRef.current.push({
			text: speechItem.text.trim(),
			speechUrl: speechItem.speechUrl?.trim() || undefined,
		});

		void runQueue();
	}, [runQueue]);

	useEffect(() => {
		if (!incomingSpeechItem) {
			return;
		}

		enqueueSpeech(incomingSpeechItem);
	}, [enqueueSpeech, incomingSpeechItem]);

	useEffect(() => {
		return () => {
			clearPlayback();
			if (audioContextRef.current) {
				void audioContextRef.current.close();
				audioContextRef.current = null;
			}
		};
	}, [clearPlayback]);

	return (
		<Box sx={{position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", overflow: "hidden"}}>
			<motion.div
				style={{position: "absolute", inset: 0}}
				animate={{y: [0, -8, 0]}}
				transition={{duration: 6.8, repeat: Infinity, ease: "easeInOut"}}
			>
				<ActorImage
					id="studio-witch-helper"
					resolveImageUrl={() => DEFAULT_WITCH_IMAGE}
					xPosition={87}
					yPosition={-7}
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
}

type MusicInputParameters = {
	title: string;
	prompt: string;
	lyrics: string | null;
	lyrics_prompt: string | null;
	instrumental: boolean;
	tags: string[];
};

type TrackEntry = {
	title: string;
	url: string;
	createdAt: number;
};

type AspectRatio = "1:1" | "16:9" | "9:16" | "21:9" | "9:21" | "2:3" | "3:2" | "4:3" | "3:4";
type TransferType = "edit" | "canny" | "face";

type ImageInputParameters = {
	aspect_ratio: AspectRatio;
	prompt: string;
	remove_background: boolean;
};

type ImageToImageInputParameters = {
	image: string;
	prompt: string;
	remove_background: boolean;
	transfer_type: TransferType;
};

type VideoInputParameters = {
	prompt: string;
	seconds: number;
};

type ImageToVideoInputParameters = {
	image: string;
};

type StudioWorkspaceProps = {
	onGenerateMusic: (inputParameters: MusicInputParameters) => Promise<string>;
	trackHistory: TrackEntry[];
	onTrackGenerated: (trackEntry: TrackEntry) => Promise<void>;
	onTrackDeleted: (url: string) => Promise<void>;
	onGenerateImage: (inputParameters: ImageInputParameters) => Promise<string>;
	onGenerateImageFromImage: (inputParameters: ImageToImageInputParameters) => Promise<string>;
	imageHistory: ImageHistoryEntry[];
	onImageGenerated: (entry: ImageHistoryEntry) => Promise<void>;
	onImageDeleted: (url: string) => Promise<void>;
	onGenerateVideo: (inputParameters: VideoInputParameters) => Promise<string>;
	onGenerateVideoFromImage: (inputParameters: ImageToVideoInputParameters) => Promise<string>;
	videoHistory: VideoHistoryEntry[];
	onVideoGenerated: (entry: VideoHistoryEntry) => Promise<void>;
	onVideoDeleted: (url: string) => Promise<void>;
};

export function StudioWorkspace({
	onGenerateMusic,
	trackHistory,
	onTrackGenerated,
	onTrackDeleted,
	onGenerateImage,
	onGenerateImageFromImage,
	imageHistory,
	onImageGenerated,
	onImageDeleted,
	onGenerateVideo,
	onGenerateVideoFromImage,
	videoHistory,
	onVideoGenerated,
	onVideoDeleted,
}: StudioWorkspaceProps) {
	const [tab, setTab] = useState<"music" | "art" | "video">("music");
	const [witchSpeechItem, setWitchSpeechItem] = useState<WitchSpeechItem | null>(null);

	const theme = useMemo(
		() =>
			createTheme({
				palette: {
					mode: "dark",
					background: {
						default: "#090f1d",
						paper: "#101b2f",
					},
					text: {
						primary: "#edf3ff",
						secondary: "#9fb2d3",
					},
					primary: {main: "#5ea8ff"},
				},
				shape: {borderRadius: 14},
			}),
		[],
	);

	useEffect(() => {
		setWitchSpeechItem({
			text:
				tab === "music"
					? "Melodies first. I can hear rhythm hiding in your prompts."
					: tab === "art"
						? "Brushstrokes of moonlight await. Try vivid style words."
						: "Frame the moment. Motion loves strong visual anchors.",
		});
	}, [tab]);

	return (
		<ThemeProvider theme={theme}>
			<WitchCompanion incomingSpeechItem={witchSpeechItem} />
			<Box
				sx={{
					borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
					backgroundColor: alpha(theme.palette.background.paper, 0.96),
					pr: {xs: 0, lg: "clamp(220px, 16vw, 300px)"},
				}}
			>
				<Box sx={{maxWidth: 1200, ml: {xs: "auto", lg: 0}, mr: "auto", px: {xs: 2, md: 4}}}>
						<Tabs
							value={tab}
							onChange={(_event, value: "music" | "art" | "video") => setTab(value)}
							variant="fullWidth"
							textColor="inherit"
							indicatorColor="primary"
							sx={{
								minHeight: 52,
								"& .MuiTabs-indicator": {
									height: 3,
								},
								"& .MuiTab-root": {
									color: alpha(theme.palette.text.primary, 0.72),
									fontWeight: 600,
									letterSpacing: 0.2,
									minHeight: 52,
									textTransform: "none",
								},
								"& .MuiTab-root.Mui-selected": {
									color: theme.palette.text.primary,
								},
							}}
						>
							<Tab icon={<MusicNoteRoundedIcon fontSize="small" />} iconPosition="start" label="Music Studio" value="music" />
							<Tab icon={<BrushRoundedIcon fontSize="small" />} iconPosition="start" label="Art Studio" value="art" />
							<Tab icon={<MovieRoundedIcon fontSize="small" />} iconPosition="start" label="Video Studio" value="video" />
						</Tabs>
				</Box>
			</Box>

			<Box sx={{pr: {xs: 0, lg: "clamp(220px, 16vw, 300px)"}}}>
				{tab === "music" ? (
					<MusicStudio onGenerate={onGenerateMusic} trackHistory={trackHistory} onTrackGenerated={onTrackGenerated} onTrackDeleted={onTrackDeleted} />
				) : tab === "art" ? (
					<ArtStudio
						onGenerateImage={onGenerateImage}
						onGenerateImageFromImage={onGenerateImageFromImage}
						imageHistory={imageHistory}
						onImageGenerated={onImageGenerated}
						onImageDeleted={onImageDeleted}
					/>
				) : (
					<VideoStudio
						onGenerateVideo={onGenerateVideo}
						onGenerateVideoFromImage={onGenerateVideoFromImage}
						videoHistory={videoHistory}
						imageHistory={imageHistory}
						onVideoGenerated={onVideoGenerated}
						onVideoDeleted={onVideoDeleted}
						onImageDeleted={onImageDeleted}
					/>
				)}
			</Box>
		</ThemeProvider>
	);
}
