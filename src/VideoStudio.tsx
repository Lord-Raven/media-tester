import {useEffect, useMemo, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	Divider,
	IconButton,
	LinearProgress,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {alpha, createTheme, ThemeProvider} from "@mui/material/styles";
import {ImageHistoryEntry} from "./ArtStudio";

export type VideoHistoryEntry = {
	url: string;
	prompt: string;
	seconds: number;
	createdAt: number;
	mode: "text-to-video" | "image-to-video";
	sourceImageUrl?: string;
};

type VideoInputParameters = {
	prompt: string;
	seconds: number;
};

type ImageToVideoInputParameters = {
	image: string;
};

type MediaSelection =
	| {kind: "video"; url: string}
	| {kind: "image"; url: string}
	| null;

type CombinedHistoryEntry =
	| {kind: "video"; createdAt: number; data: VideoHistoryEntry}
	| {kind: "image"; createdAt: number; data: ImageHistoryEntry};

type VideoStudioProps = {
	onGenerateVideo: (inputParameters: VideoInputParameters) => Promise<string>;
	onGenerateVideoFromImage: (inputParameters: ImageToVideoInputParameters) => Promise<string>;
	videoHistory: VideoHistoryEntry[];
	imageHistory: ImageHistoryEntry[];
	onVideoGenerated: (entry: VideoHistoryEntry) => Promise<void>;
};

const MIN_SECONDS = 5;
const MAX_SECONDS = 60;

function clampSeconds(value: number): number {
	if (Number.isNaN(value)) {
		return 8;
	}

	if (value < MIN_SECONDS) {
		return MIN_SECONDS;
	}

	if (value > MAX_SECONDS) {
		return MAX_SECONDS;
	}

	return Math.floor(value);
}

export function VideoStudio({
	onGenerateVideo,
	onGenerateVideoFromImage,
	videoHistory,
	imageHistory,
	onVideoGenerated,
}: VideoStudioProps) {
	const theme = useMemo(
		() =>
			createTheme({
				palette: {
					mode: "dark",
					primary: {main: "#5ea8ff"},
					secondary: {main: "#7ce4cb"},
					background: {
						default: "#090f1d",
						paper: "#101b2f",
					},
					text: {
						primary: "#edf3ff",
						secondary: "#9fb2d3",
					},
				},
				shape: {
					borderRadius: 14,
				},
				components: {
					MuiPaper: {
						styleOverrides: {
							root: {
								backgroundImage: "none",
							},
						},
					},
					MuiOutlinedInput: {
						styleOverrides: {
							notchedOutline: {
								borderColor: "rgba(154, 178, 216, 0.28)",
							},
							root: {
								backgroundColor: "rgba(255, 255, 255, 0.02)",
								"&:hover .MuiOutlinedInput-notchedOutline": {
									borderColor: "rgba(154, 178, 216, 0.44)",
								},
								"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
									borderColor: "#5ea8ff",
								},
							},
						},
					},
				},
			}),
		[],
	);

	const [prompt, setPrompt] = useState("");
	const [secondsInput, setSecondsInput] = useState("8");
	const [isGenerating, setIsGenerating] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [videos, setVideos] = useState<VideoHistoryEntry[]>([]);
	const [images, setImages] = useState<ImageHistoryEntry[]>([]);
	const [selection, setSelection] = useState<MediaSelection>(null);

	useEffect(() => {
		const nextVideos = Array.isArray(videoHistory)
			? videoHistory.filter((entry) => entry?.url).slice(0, 12)
			: [];

		setVideos(nextVideos);
	}, [videoHistory]);

	useEffect(() => {
		const nextImages = Array.isArray(imageHistory)
			? imageHistory.filter((entry) => entry?.url).slice(0, 12)
			: [];

		setImages(nextImages);
	}, [imageHistory]);

	const combinedHistory = useMemo<CombinedHistoryEntry[]>(() => {
		const videoItems = videos.map((entry) => ({kind: "video" as const, createdAt: entry.createdAt, data: entry}));
		const imageItems = images.map((entry) => ({kind: "image" as const, createdAt: entry.createdAt, data: entry}));
		return [...videoItems, ...imageItems]
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 20);
	}, [images, videos]);

	const hasSelection = selection != null;
	const isImageToVideo = selection?.kind === "image";
	const selectedVideoUrl = selection?.kind === "video" ? selection.url : "";
	const selectedImageUrl = selection?.kind === "image" ? selection.url : "";

	useEffect(() => {
		if (!selection && combinedHistory.length > 0) {
			const first = combinedHistory[0];
			setSelection({kind: first.kind, url: first.data.url});
			return;
		}

		if (!selection) {
			return;
		}

		const stillExists = combinedHistory.some((entry) => entry.kind === selection.kind && entry.data.url === selection.url);
		if (!stillExists) {
			if (combinedHistory.length > 0) {
				const first = combinedHistory[0];
				setSelection({kind: first.kind, url: first.data.url});
			} else {
				setSelection(null);
			}
		}
	}, [combinedHistory, selection]);

	const canGenerate = useMemo(() => {
		if (isGenerating) {
			return false;
		}

		if (isImageToVideo) {
			return selectedImageUrl.trim().length > 0;
		}

		const secondsValue = clampSeconds(Number(secondsInput));
		return secondsValue >= MIN_SECONDS && secondsValue <= MAX_SECONDS;
	}, [isGenerating, isImageToVideo, secondsInput, selectedImageUrl]);

	async function handleGenerate() {
		setErrorMessage("");
		setIsGenerating(true);

		try {
			const seconds = clampSeconds(Number(secondsInput));
			const generatedUrl = isImageToVideo
				? await onGenerateVideoFromImage({image: selectedImageUrl})
				: await onGenerateVideo({
					prompt: prompt.trim(),
					seconds,
				});

			if (!generatedUrl) {
				throw new Error("No video URL was returned.");
			}

			setSelection({kind: "video", url: generatedUrl});

			const entry: VideoHistoryEntry = {
				url: generatedUrl,
				prompt: isImageToVideo ? "" : prompt.trim(),
				seconds,
				createdAt: Date.now(),
				mode: isImageToVideo ? "image-to-video" : "text-to-video",
				sourceImageUrl: isImageToVideo ? selectedImageUrl : undefined,
			};

			setVideos((currentHistory) => [entry, ...currentHistory.filter((item) => item.url !== generatedUrl)].slice(0, 12));

			try {
				await onVideoGenerated(entry);
			} catch {
				setErrorMessage("Video generated, but failed to save video history.");
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Video generation failed.");
		} finally {
			setIsGenerating(false);
		}
	}

	const selectedVideoEntry = selectedVideoUrl
		? videos.find((entry) => entry.url === selectedVideoUrl)
		: null;
	const selectedImageEntry = selectedImageUrl
		? images.find((entry) => entry.url === selectedImageUrl)
		: null;

	return (
		<ThemeProvider theme={theme}>
			<Box
				sx={{
					minHeight: "100vh",
					width: "100%",
					px: {xs: 2, md: 4},
					pb: {xs: 2, md: 4},
					pt: {xs: 1, md: 1.5},
					background: `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.26)}, transparent 34%), radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.2)}, transparent 30%), linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
					color: theme.palette.text.primary,
				}}
			>
				<Box
					sx={{
						maxWidth: 1200,
						mx: "auto",
						display: "grid",
						gap: 3,
						gridTemplateColumns: {xs: "1fr", lg: "1.15fr 0.85fr"},
						alignItems: "start",
					}}
				>
					<motion.div initial={{opacity: 0, y: 18}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, ease: "easeOut"}}>
						<Card
							elevation={0}
							sx={{
								borderRadius: 4,
								overflow: "hidden",
								border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
								backdropFilter: "blur(16px)",
								background: alpha(theme.palette.background.paper, 0.82),
								boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.18)}`,
							}}
						>
							{isGenerating ? <LinearProgress /> : <Box sx={{height: 4, background: alpha(theme.palette.primary.main, 0.08)}} />}
							<CardContent sx={{p: {xs: 2.2, md: 3}}}>
								<Stack spacing={2.5}>
									<Box>
										<Typography variant="overline" sx={{letterSpacing: 2, color: theme.palette.text.secondary}}>
											Video Studio
										</Typography>
										<Typography variant="h4" sx={{fontWeight: 800, lineHeight: 1.05, mt: 0.5}}>
											Generate a video from a prompt or from a selected image.
										</Typography>
										<Typography sx={{mt: 1, color: theme.palette.text.secondary}}>
											Pick an image in history for image-to-video mode, or use text-to-video controls below.
										</Typography>
									</Box>

									{isImageToVideo ? (
										<Alert severity="info">
											Image-to-video mode is active. Generation uses the selected image and ignores other inputs.
										</Alert>
									) : (
										<>
											<TextField
												label="Prompt"
												value={prompt}
												onChange={(event) => setPrompt(event.target.value)}
												disabled={isGenerating}
												fullWidth
												multiline
												minRows={5}
												placeholder="Sweeping drone shot over a storm-lit city at dawn"
											/>
											<TextField
												label="Length (seconds)"
												type="number"
												value={secondsInput}
												onChange={(event) => setSecondsInput(event.target.value)}
												disabled={isGenerating}
												inputProps={{min: MIN_SECONDS, max: MAX_SECONDS, step: 1}}
												helperText={`Allowed range: ${MIN_SECONDS}-${MAX_SECONDS} seconds`}
											/>
										</>
									)}

									<Button
										size="large"
										variant="contained"
										onClick={handleGenerate}
										disabled={!canGenerate}
										startIcon={<AutoAwesomeRoundedIcon />}
										sx={{
											alignSelf: "flex-start",
											px: 3,
											py: 1.4,
											borderRadius: 999,
											minWidth: 230,
											boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.35)}`,
										}}
									>
										{isGenerating ? "Generating..." : isImageToVideo ? "Animate Selected Image" : "Generate Video"}
									</Button>

									{errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
								</Stack>
							</CardContent>
						</Card>
					</motion.div>

					<Stack spacing={3}>
						<motion.div
							initial={{opacity: 0, y: 22}}
							animate={{opacity: 1, y: 0}}
							transition={{duration: 0.5, delay: 0.08, ease: "easeOut"}}
						>
							<Card
								elevation={0}
								sx={{
									borderRadius: 4,
									border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
									background: alpha(theme.palette.background.paper, 0.86),
								}}
							>
								<CardContent sx={{p: 3}}>
									<Stack spacing={2}>
										<Box>
											<Typography variant="overline" sx={{letterSpacing: 2, color: theme.palette.text.secondary}}>
												Selected Media
											</Typography>
											<Typography variant="h5" sx={{fontWeight: 800, mt: 0.5}}>
												{hasSelection ? "Ready for generation" : "Waiting for media"}
											</Typography>
										</Box>

										{selection?.kind === "video" && selectedVideoUrl ? (
											<>
												<Box
													sx={{
														borderRadius: 3,
														overflow: "hidden",
														border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
														background: alpha(theme.palette.common.black, 0.28),
													}}
												>
													<Box
														component="video"
														src={selectedVideoUrl}
														controls
														playsInline
														sx={{display: "block", width: "100%", maxHeight: 360}}
													/>
												</Box>
												<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
													<Chip size="small" label={selectedVideoEntry?.mode === "image-to-video" ? "Image to Video" : "Text to Video"} />
													{selectedVideoEntry?.seconds ? <Chip size="small" label={`${selectedVideoEntry.seconds}s`} /> : null}
												</Stack>
											</>
										) : selection?.kind === "image" && selectedImageUrl ? (
											<>
												<Box
													sx={{
														borderRadius: 3,
														overflow: "hidden",
														border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
														background: alpha(theme.palette.common.black, 0.28),
													}}
												>
													<Box component="img" src={selectedImageUrl} alt="Selected image" sx={{display: "block", width: "100%"}} />
												</Box>
												<Chip size="small" label={selectedImageEntry?.mode === "image-to-image" ? "Image source" : "Prompt image"} />
											</>
										) : (
											<Paper
												variant="outlined"
												sx={{
													p: 3,
													borderRadius: 3,
													borderStyle: "dashed",
													textAlign: "center",
													background: alpha(theme.palette.background.default, 0.5),
												}}
											>
												<Typography color="text.secondary">
													Select an image or video from history to preview it here.
												</Typography>
											</Paper>
										)}
									</Stack>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							initial={{opacity: 0, y: 22}}
							animate={{opacity: 1, y: 0}}
							transition={{duration: 0.5, delay: 0.16, ease: "easeOut"}}
						>
							<Card
								elevation={0}
								sx={{
									borderRadius: 4,
									border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
									background: alpha(theme.palette.background.paper, 0.86),
								}}
							>
								<CardContent sx={{p: 3}}>
									<Stack spacing={1.5}>
										<Typography variant="overline" sx={{letterSpacing: 2, color: theme.palette.text.secondary}}>
											History
										</Typography>
										<Typography variant="h6" sx={{fontWeight: 800}}>
											Image and video history
										</Typography>
										<Divider />
										{combinedHistory.length > 0 ? (
											<Stack spacing={1.25}>
												<AnimatePresence initial={false}>
													{combinedHistory.map((entry) => {
														const isSelected = selection?.kind === entry.kind && selection.url === entry.data.url;
														return (
															<motion.div key={`${entry.kind}-${entry.data.url}-${entry.createdAt}`} initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -8}}>
																<Paper
																	variant="outlined"
																	onClick={() => setSelection({kind: entry.kind, url: entry.data.url})}
																	sx={{
																		p: 1.25,
																		borderRadius: 3,
																		display: "grid",
																		gridTemplateColumns: "72px 1fr auto",
																		alignItems: "center",
																		gap: 1.25,
																		cursor: "pointer",
																		borderColor: isSelected ? alpha(theme.palette.primary.main, 0.8) : alpha(theme.palette.divider, 0.8),
																		background: alpha(theme.palette.background.default, 0.36),
																	}}
																>
																	{entry.kind === "video" ? (
																		<Box
																			component="video"
																			src={entry.data.url}
																			muted
																			playsInline
																			sx={{width: 72, height: 72, objectFit: "cover", borderRadius: 2, background: alpha(theme.palette.common.black, 0.35)}}
																		/>
																	) : (
																		<Box
																			component="img"
																			src={entry.data.url}
																			alt="History preview"
																			sx={{width: 72, height: 72, objectFit: "cover", borderRadius: 2}}
																		/>
																	)}
																	<Box sx={{minWidth: 0}}>
																		<Stack direction="row" spacing={1} alignItems="center" sx={{mb: 0.35}}>
																			{entry.kind === "video" ? <MovieRoundedIcon sx={{fontSize: 16}} /> : <ImageRoundedIcon sx={{fontSize: 16}} />}
																			<Typography variant="body2" sx={{fontWeight: 700}}>
																				{entry.kind === "video" ? "Video" : "Image"}
																			</Typography>
																		</Stack>
																		<Typography variant="body2" color="text.secondary" noWrap>
																			{entry.kind === "video"
																				? entry.data.mode === "image-to-video"
																					? "Generated from selected image"
																					: entry.data.prompt || "(No prompt)"
																				: entry.data.prompt || "(No prompt)"}
																		</Typography>
																	</Box>
																	<IconButton size="small" href={entry.data.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
																		<OpenInNewRoundedIcon fontSize="small" />
																	</IconButton>
																</Paper>
															</motion.div>
														);
													})}
												</AnimatePresence>
											</Stack>
										) : (
											<Typography color="text.secondary">
												No history yet. Generate media in Art Studio or Video Studio to populate this feed.
											</Typography>
										)}
									</Stack>
								</CardContent>
							</Card>
						</motion.div>
					</Stack>
				</Box>
			</Box>
		</ThemeProvider>
	);
}
