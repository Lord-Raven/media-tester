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
	FormControlLabel,
	IconButton,
	LinearProgress,
	Paper,
	Stack,
	Switch,
	TextField,
	Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import {alpha, useTheme} from "@mui/material/styles";

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

type MusicStudioProps = {
	onGenerate: (inputParameters: MusicInputParameters) => Promise<string>;
};

const HISTORY_STORAGE_KEY = "music-studio-history";

export function MusicStudio({onGenerate}: MusicStudioProps) {
	const theme = useTheme();
	const [title, setTitle] = useState("");
	const [prompt, setPrompt] = useState("");
	const [lyrics, setLyrics] = useState("");
	const [tagDraft, setTagDraft] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [useLyricsAsPrompt, setUseLyricsAsPrompt] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [trackUrl, setTrackUrl] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [history, setHistory] = useState<TrackEntry[]>([]);

	useEffect(() => {
		try {
			const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
			if (savedHistory) {
				const parsed = JSON.parse(savedHistory) as TrackEntry[];
				if (Array.isArray(parsed)) {
					setHistory(parsed.filter((entry) => entry?.title && entry?.url));
				}
			}
		} catch {
			// Ignore malformed storage.
		}
	}, []);

	useEffect(() => {
		try {
			window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
		} catch {
			// Ignore storage failures in constrained environments.
		}
	}, [history]);

	const canGenerate = useMemo(() => {
		return title.trim().length > 0 && !isGenerating;
	}, [isGenerating, title]);

	function addTag(rawTag: string) {
		const normalizedTag = rawTag.trim();
		if (!normalizedTag) {
			return;
		}

		setTags((currentTags) => {
			if (currentTags.some((tag) => tag.toLowerCase() === normalizedTag.toLowerCase())) {
				return currentTags;
			}

			return [...currentTags, normalizedTag];
		});
	}

	function commitTagDraft() {
		addTag(tagDraft);
		setTagDraft("");
	}

	function removeTag(tagToRemove: string) {
		setTags((currentTags) => currentTags.filter((tag) => tag !== tagToRemove));
	}

	async function handleGenerate() {
		setErrorMessage("");
		setIsGenerating(true);

		const inputParameters: MusicInputParameters = {
			title: title.trim(),
			prompt: prompt.trim(),
			lyrics: useLyricsAsPrompt ? null : lyrics.trim() || null,
			lyrics_prompt: useLyricsAsPrompt ? lyrics.trim() || null : null,
			instrumental: !useLyricsAsPrompt && lyrics.trim().length === 0,
			tags,
		};

		try {
			const generatedUrl = await onGenerate(inputParameters);
			if (!generatedUrl) {
				throw new Error("No track URL was returned.");
			}

			setTrackUrl(generatedUrl);
			setHistory((currentHistory) => [
				{title: inputParameters.title, url: generatedUrl, createdAt: Date.now()},
				...currentHistory.filter((entry) => entry.url !== generatedUrl),
			].slice(0, 10));
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Track generation failed.");
		} finally {
			setIsGenerating(false);
		}
	}

	return (
		<Box
			sx={{
				minHeight: "100vh",
				width: "100%",
				px: {xs: 2, md: 4},
				py: {xs: 2, md: 4},
				background: `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.22)}, transparent 32%), radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 28%), linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
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
				<motion.div
					initial={{opacity: 0, y: 18}}
					animate={{opacity: 1, y: 0}}
					transition={{duration: 0.5, ease: "easeOut"}}
				>
					<Card
						elevation={0}
						sx={{
							borderRadius: 4,
							overflow: "hidden",
							border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
							backdropFilter: "blur(16px)",
							background: alpha(theme.palette.background.paper, 0.84),
							boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.18)}`,
						}}
					>
						{isGenerating ? <LinearProgress /> : <Box sx={{height: 4, background: alpha(theme.palette.primary.main, 0.08)}} />}
						<CardContent sx={{p: {xs: 2.2, md: 3}}}>
							<Stack spacing={2.5}>
								<Box>
									<Typography variant="overline" sx={{letterSpacing: 2, color: theme.palette.text.secondary}}>
										Music Studio
									</Typography>
									<Typography variant="h4" sx={{fontWeight: 800, lineHeight: 1.05, mt: 0.5}}>
										Build a track from a title, tags, style, and lyrics.
									</Typography>
									<Typography sx={{mt: 1, color: theme.palette.text.secondary}}>
										Shape the prompt, add removable tags, and launch generation from one clean surface.
									</Typography>
								</Box>

								<TextField
									label="Title"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									fullWidth
									disabled={isGenerating}
									placeholder="A midnight drive through neon rain"
								/>

								<Box>
									<Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
										<Typography variant="subtitle1" sx={{fontWeight: 700}}>
											Tags
										</Typography>
										<Typography variant="body2" color="text.secondary">
											Press Enter or comma to add.
										</Typography>
									</Stack>
									<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb: 1.5}}>
										<AnimatePresence initial={false}>
											{tags.map((tag) => (
												<motion.div
													key={tag}
													initial={{opacity: 0, scale: 0.85, y: -6}}
													animate={{opacity: 1, scale: 1, y: 0}}
													exit={{opacity: 0, scale: 0.8}}
													transition={{duration: 0.18}}
												>
													<Chip
														label={tag}
														onDelete={() => removeTag(tag)}
														deleteIcon={<DeleteOutlineRoundedIcon />}
														disabled={isGenerating}
														sx={{
															borderRadius: 999,
															px: 0.5,
															background: alpha(theme.palette.primary.main, 0.08),
														}}
													/>
												</motion.div>
											))}
										</AnimatePresence>
									</Stack>
									<Stack direction={{xs: "column", sm: "row"}} spacing={1}>
										<TextField
											label="Add a tag"
											value={tagDraft}
											onChange={(event) => setTagDraft(event.target.value)}
											onBlur={commitTagDraft}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === ",") {
													event.preventDefault();
													commitTagDraft();
												}
											}}
											fullWidth
											disabled={isGenerating}
											placeholder="cinematic, analog, nocturne"
										/>
										<Button
											variant="outlined"
											onClick={commitTagDraft}
											disabled={isGenerating || tagDraft.trim().length === 0}
											startIcon={<AddRoundedIcon />}
											sx={{minWidth: {xs: "100%", sm: 132}, whiteSpace: "nowrap"}}
										>
											Add Tag
										</Button>
									</Stack>
								</Box>

								<TextField
									label="Style prompt"
									value={prompt}
									onChange={(event) => setPrompt(event.target.value)}
									fullWidth
									disabled={isGenerating}
									multiline
									minRows={3}
									placeholder="Warm synths, soft percussion, distant choir, intimate and cinematic"
								/>

								<Paper
									variant="outlined"
									sx={{
										p: 2,
										borderRadius: 3,
										borderColor: alpha(theme.palette.divider, 0.85),
										background: alpha(theme.palette.background.default, 0.46),
									}}
								>
									<Stack spacing={1.5}>
										<Stack
											direction={{xs: "column", sm: "row"}}
											spacing={1}
											alignItems={{xs: "flex-start", sm: "center"}}
											justifyContent="space-between"
										>
											<Box>
												<Typography variant="subtitle1" sx={{fontWeight: 700}}>
													Lyrics
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Toggle whether this blank is literal lyrics or a lyrics-generation prompt.
												</Typography>
											</Box>
											<FormControlLabel
												control={
													<Switch
														checked={useLyricsAsPrompt}
														onChange={(event) => setUseLyricsAsPrompt(event.target.checked)}
														disabled={isGenerating}
													/>
												}
												label={useLyricsAsPrompt ? "Prompt mode" : "Lyrics mode"}
											/>
										</Stack>
										<TextField
											label={useLyricsAsPrompt ? "Lyrics prompt" : "Lyrics"}
											value={lyrics}
											onChange={(event) => setLyrics(event.target.value)}
											fullWidth
											disabled={isGenerating}
											multiline
											minRows={8}
											placeholder={
												useLyricsAsPrompt
													? "Describe the subject, mood, rhyme style, or story you want the model to write."
													: "Paste the lyrics verbatim here. Leave blank for an instrumental track."
											}
										/>
									</Stack>
								</Paper>

								<Button
									size="large"
									variant="contained"
									onClick={handleGenerate}
									disabled={!canGenerate}
									startIcon={isGenerating ? <MusicNoteRoundedIcon /> : <AutoAwesomeRoundedIcon />}
									sx={{
										alignSelf: "flex-start",
										px: 3,
										py: 1.4,
										borderRadius: 999,
										minWidth: 220,
										boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.35)}`,
									}}
								>
									{isGenerating ? "Generating..." : "Generate Track"}
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
											Now Playing
										</Typography>
										<Typography variant="h5" sx={{fontWeight: 800, mt: 0.5}}>
											{trackUrl ? title || "Generated track" : "Waiting for a track"}
										</Typography>
									</Box>

									{trackUrl ? (
										<>
											<Box
												sx={{
													borderRadius: 3,
													overflow: "hidden",
													border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
													background: alpha(theme.palette.common.black, 0.05),
												}}
											>
												<audio controls src={trackUrl} style={{width: "100%"}} />
											</Box>
											<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
												<Button
													href={trackUrl}
													target="_blank"
													rel="noreferrer"
													variant="outlined"
													startIcon={<OpenInNewRoundedIcon />}
												>
													Open URL
												</Button>
												<Button
													variant="outlined"
													startIcon={<ContentCopyRoundedIcon />}
													onClick={async () => {
														try {
															await navigator.clipboard.writeText(trackUrl);
														} catch {
															// Clipboard failures are non-fatal.
														}
													}}
												>
													Copy URL
												</Button>
											</Stack>
											<Typography
												variant="body2"
												sx={{
													wordBreak: "break-all",
													color: theme.palette.text.secondary,
												}}
											>
												{trackUrl}
											</Typography>
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
												Your generated track will appear here as soon as the URL is returned.
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
										Track History
									</Typography>
									<Typography variant="h6" sx={{fontWeight: 800}}>
										Recent tracks
									</Typography>
									<Divider />
									{history.length > 0 ? (
										<Stack spacing={1.25}>
											{history.map((entry) => (
												<Paper
													key={`${entry.url}-${entry.createdAt}`}
													variant="outlined"
													sx={{
														p: 1.5,
														borderRadius: 3,
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														gap: 1.5,
														background: alpha(theme.palette.background.default, 0.36),
													}}
												>
													<Box sx={{minWidth: 0}}>
														<Typography sx={{fontWeight: 700}} noWrap>
															{entry.title}
														</Typography>
														<Typography variant="body2" color="text.secondary" sx={{wordBreak: "break-all"}}>
															{entry.url}
														</Typography>
													</Box>
													<IconButton
														size="small"
														href={entry.url}
														target="_blank"
														rel="noreferrer"
													>
														<PlayArrowRoundedIcon fontSize="small" />
													</IconButton>
												</Paper>
											))}
										</Stack>
									) : (
										<Typography color="text.secondary">
											No track history yet. Generate a song to start building the list.
										</Typography>
									)}
								</Stack>
							</CardContent>
						</Card>
					</motion.div>
				</Stack>
			</Box>
		</Box>
	);
}
