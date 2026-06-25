import {ChangeEvent, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Divider,
	FormControl,
	FormControlLabel,
	IconButton,
	InputLabel,
	LinearProgress,
	MenuItem,
	Paper,
	Select,
	Stack,
	Switch,
	TextField,
	Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import {alpha, createTheme, ThemeProvider} from "@mui/material/styles";

type AspectRatio = "1:1" | "16:9" | "9:16" | "21:9" | "9:21" | "2:3" | "3:2" | "4:3" | "3:4";
type TransferType = "edit" | "canny" | "default";

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

export type ImageHistoryEntry = {
	url: string;
	prompt: string;
	createdAt: number;
	mode: "text-to-image" | "image-to-image";
};

type ArtStudioProps = {
	onGenerateImage: (inputParameters: ImageInputParameters) => Promise<string>;
	onGenerateImageFromImage: (inputParameters: ImageToImageInputParameters) => Promise<string>;
	imageHistory: ImageHistoryEntry[];
	onImageGenerated: (entry: ImageHistoryEntry) => Promise<void>;
	onImageDeleted: (url: string) => Promise<void>;
};

const aspectRatios: AspectRatio[] = ["1:1", "16:9", "9:16", "21:9", "9:21", "2:3", "3:2", "4:3", "3:4"];
const transferTypes: TransferType[] = ["default", "edit", "canny"];

export function ArtStudio({
	onGenerateImage,
	onGenerateImageFromImage,
	imageHistory,
	onImageGenerated,
	onImageDeleted,
}: ArtStudioProps) {
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
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
	const [transferType, setTransferType] = useState<TransferType>("default");
	const [removeBackground, setRemoveBackground] = useState(false);
	const [isImageToImage, setIsImageToImage] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [history, setHistory] = useState<ImageHistoryEntry[]>([]);
	const [activeImageUrl, setActiveImageUrl] = useState("");
	const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);
	const uploadInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		const nextHistory = Array.isArray(imageHistory)
			? imageHistory.filter((entry) => entry?.url).slice(0, 12)
			: [];

		setHistory(nextHistory);
		if (!activeImageUrl && nextHistory.length > 0) {
			setActiveImageUrl(nextHistory[0].url);
		}
	}, [imageHistory, activeImageUrl]);

	const canGenerate = useMemo(() => {
		if (isGenerating) {
			return false;
		}

		if (isImageToImage && activeImageUrl.trim().length === 0) {
			return false;
		}

		return true;
	}, [activeImageUrl, isGenerating, isImageToImage]);

	function handleRequestDeleteImage(url: string) {
		setPendingDeleteUrl((current) => (current === url ? null : url));
	}

	async function handleDeleteImage(url: string) {
		setHistory((current) => current.filter((item) => item.url !== url));
		if (activeImageUrl === url) {
			setActiveImageUrl("");
		}
		setPendingDeleteUrl(null);
		try {
			await onImageDeleted(url);
		} catch {
			setErrorMessage("Failed to save history after deletion.");
		}
	}

	async function handleGenerate() {
		setErrorMessage("");
		setIsGenerating(true);

		try {
			const generatedUrl = isImageToImage
				? await onGenerateImageFromImage({
					image: activeImageUrl,
					prompt: prompt.trim(),
					remove_background: removeBackground,
					transfer_type: transferType,
				})
				: await onGenerateImage({
					aspect_ratio: aspectRatio,
					prompt: prompt.trim(),
					remove_background: removeBackground,
				});

			if (!generatedUrl) {
				throw new Error("No image URL was returned.");
			}

			setActiveImageUrl(generatedUrl);

			const entry: ImageHistoryEntry = {
				url: generatedUrl,
				prompt: prompt.trim(),
				createdAt: Date.now(),
				mode: isImageToImage ? "image-to-image" : "text-to-image",
			};

			setHistory((currentHistory) => [entry, ...currentHistory.filter((item) => item.url !== generatedUrl)].slice(0, 12));

			try {
				await onImageGenerated(entry);
			} catch {
				setErrorMessage("Image generated, but failed to save image history.");
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Image generation failed.");
		} finally {
			setIsGenerating(false);
		}
	}

	function handleUploadClick() {
		uploadInputRef.current?.click();
	}

	function handleUploadImage(event: ChangeEvent<HTMLInputElement>) {
		const selectedFile = event.target.files?.[0];

		if (!selectedFile) {
			return;
		}

		if (!selectedFile.type.startsWith("image/")) {
			setErrorMessage("Please select a valid image file.");
			event.target.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = async () => {
			const uploadedImageUrl = typeof reader.result === "string" ? reader.result : "";

			if (!uploadedImageUrl) {
				setErrorMessage("Failed to read image file.");
				event.target.value = "";
				return;
			}

			setErrorMessage("");
			setActiveImageUrl(uploadedImageUrl);
			setIsImageToImage(true);

			const entry: ImageHistoryEntry = {
				url: uploadedImageUrl,
				prompt: `Uploaded: ${selectedFile.name}`,
				createdAt: Date.now(),
				mode: "image-to-image",
			};

			setHistory((currentHistory) => [entry, ...currentHistory.filter((item) => item.url !== uploadedImageUrl)].slice(0, 12));

			try {
				await onImageGenerated(entry);
			} catch {
				setErrorMessage("Image uploaded, but failed to save image history.");
			}

			event.target.value = "";
		};

		reader.onerror = () => {
			setErrorMessage("Failed to read image file.");
			event.target.value = "";
		};

		reader.readAsDataURL(selectedFile);
	}

	return (
		<ThemeProvider theme={theme}>
			<input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadImage} hidden />
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
											Art Studio
										</Typography>
										<Typography variant="h4" sx={{fontWeight: 800, lineHeight: 1.05, mt: 0.5}}>
											Generate brand new art or transform an existing image.
										</Typography>
										<Typography sx={{mt: 1, color: theme.palette.text.secondary}}>
											Switch between text-to-image and image-to-image from the selected image panel.
										</Typography>
									</Box>

									<TextField
										label="Prompt"
										value={prompt}
										onChange={(event) => setPrompt(event.target.value)}
										disabled={isGenerating}
										fullWidth
										multiline
										minRows={5}
										placeholder="Golden-hour cyberpunk skyline, watercolor bloom, soft haze"
									/>

									<FormControl fullWidth>
										<InputLabel id="mode-select-label">
											{isImageToImage ? "Transfer type" : "Aspect ratio"}
										</InputLabel>
										{isImageToImage ? (
											<Select
												labelId="mode-select-label"
												label="Transfer type"
												value={transferType}
												onChange={(event) => setTransferType(event.target.value as TransferType)}
												disabled={isGenerating}
											>
												{transferTypes.map((type) => (
													<MenuItem key={type} value={type}>
														{type}
													</MenuItem>
												))}
											</Select>
										) : (
											<Select
												labelId="mode-select-label"
												label="Aspect ratio"
												value={aspectRatio}
												onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
												disabled={isGenerating}
											>
												{aspectRatios.map((ratio) => (
													<MenuItem key={ratio} value={ratio}>
														{ratio}
													</MenuItem>
												))}
											</Select>
										)}
									</FormControl>

									<FormControlLabel
										control={
											<Switch
												checked={removeBackground}
												onChange={(event) => setRemoveBackground(event.target.checked)}
												disabled={isGenerating}
											/>
										}
										label="Remove background"
									/>

									<Button
										size="large"
										variant="contained"
										onClick={handleGenerate}
										disabled={!canGenerate}
										startIcon={isGenerating ? <BrushRoundedIcon /> : <AutoAwesomeRoundedIcon />}
										sx={{
											alignSelf: "flex-start",
											px: 3,
											py: 1.4,
											borderRadius: 999,
											minWidth: 230,
											boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.35)}`,
										}}
									>
										{isGenerating ? "Generating..." : isImageToImage ? "Generate Variation" : "Generate Image"}
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
												Selected Image
											</Typography>
											<Typography variant="h5" sx={{fontWeight: 800, mt: 0.5}}>
												{activeImageUrl ? "Ready for generation" : "Waiting for image"}
											</Typography>
										</Box>

										{activeImageUrl ? (
											<>
												<Box
													sx={{
														borderRadius: 3,
														overflow: "hidden",
														border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
														background: alpha(theme.palette.common.black, 0.28),
													}}
												>
													<Box component="img" src={activeImageUrl} alt="Selected image" sx={{display: "block", width: "100%"}} />
												</Box>
												<Button
													variant="outlined"
													onClick={handleUploadClick}
													disabled={isGenerating}
													startIcon={<UploadRoundedIcon />}
													sx={{alignSelf: "flex-start", borderRadius: 999}}
												>
													Upload Image
												</Button>
												<FormControlLabel
													control={
														<Switch
															checked={isImageToImage}
															onChange={(event) => setIsImageToImage(event.target.checked)}
															disabled={isGenerating}
														/>
													}
													label={isImageToImage ? "Image-to-image mode" : "Text-to-image mode"}
												/>
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
													Your generated image will appear here.
												</Typography>
													<Button
														variant="outlined"
														onClick={handleUploadClick}
														disabled={isGenerating}
														startIcon={<UploadRoundedIcon />}
														sx={{mt: 2, borderRadius: 999}}
													>
														Upload Image
													</Button>
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
											Image Gallery
										</Typography>
										<Typography variant="h6" sx={{fontWeight: 800}}>
											Recent images
										</Typography>
										<Divider />
										{history.length > 0 ? (
											<Stack spacing={1.25}>
												<AnimatePresence initial={false}>
													{history.map((entry) => (
														<motion.div key={`${entry.url}-${entry.createdAt}`} initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -8}}>
															<Paper
																variant="outlined"
																onClick={() => setActiveImageUrl(entry.url)}
																sx={{
																	p: 1.25,
																	borderRadius: 3,
																	display: "grid",
																	gridTemplateColumns: "72px 1fr auto",
																	alignItems: "center",
																	gap: 1.25,
																	cursor: "pointer",
																	borderColor: activeImageUrl === entry.url ? alpha(theme.palette.primary.main, 0.8) : alpha(theme.palette.divider, 0.8),
																	background: alpha(theme.palette.background.default, 0.36),
																}}
															>
																<Box
																	component="img"
																	src={entry.url}
																	alt="Generated history"
																	sx={{width: 72, height: 72, objectFit: "cover", borderRadius: 2}}
																/>
																<Box sx={{minWidth: 0}}>
																	<Typography variant="body2" sx={{fontWeight: 700, textTransform: "capitalize"}}>
																		{entry.mode.replace(/-/g, " ")}
																	</Typography>
																	<Typography variant="body2" color="text.secondary" noWrap>
																		{entry.prompt || "(No prompt)"}
																	</Typography>
																</Box>
																<Stack direction="row" spacing={0.5} onClick={(event) => event.stopPropagation()}>
																	{pendingDeleteUrl === entry.url ? (
																		<>
																			<Button size="small" color="error" variant="contained" onClick={() => handleDeleteImage(entry.url)}>
																				Delete
																			</Button>
																			<Button size="small" variant="text" onClick={() => setPendingDeleteUrl(null)}>
																				Cancel
																			</Button>
																		</>
																	) : (
																		<IconButton size="small" color="error" onClick={() => handleRequestDeleteImage(entry.url)}>
																			<DeleteOutlineRoundedIcon fontSize="small" />
																		</IconButton>
																	)}
																</Stack>
															</Paper>
														</motion.div>
													))}
												</AnimatePresence>
											</Stack>
										) : (
											<Typography color="text.secondary">
												No image history yet. Generate art to start building the gallery.
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
