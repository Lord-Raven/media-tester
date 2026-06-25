import {useMemo, useState} from "react";
import {Box, Paper, Tab, Tabs} from "@mui/material";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import {alpha, createTheme, ThemeProvider} from "@mui/material/styles";
import {MusicStudio} from "./MusicStudio";
import {ArtStudio, ImageHistoryEntry} from "./ArtStudio";

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

type StudioWorkspaceProps = {
	onGenerateMusic: (inputParameters: MusicInputParameters) => Promise<string>;
	trackHistory: TrackEntry[];
	onTrackGenerated: (trackEntry: TrackEntry) => Promise<void>;
	onGenerateImage: (inputParameters: ImageInputParameters) => Promise<string>;
	onGenerateImageFromImage: (inputParameters: ImageToImageInputParameters) => Promise<string>;
	imageHistory: ImageHistoryEntry[];
	onImageGenerated: (entry: ImageHistoryEntry) => Promise<void>;
};

export function StudioWorkspace({
	onGenerateMusic,
	trackHistory,
	onTrackGenerated,
	onGenerateImage,
	onGenerateImageFromImage,
	imageHistory,
	onImageGenerated,
}: StudioWorkspaceProps) {
	const [tab, setTab] = useState<"music" | "art">("music");

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

	return (
		<ThemeProvider theme={theme}>
			<Box
				sx={{
					position: "sticky",
					top: 0,
					zIndex: 20,
					px: {xs: 2, md: 4},
					pt: {xs: 2, md: 2.5},
					pointerEvents: "none",
				}}
			>
				<Box sx={{maxWidth: 1200, mx: "auto"}}>
					<Paper
						elevation={0}
						sx={{
							borderRadius: 999,
							backdropFilter: "blur(14px)",
							background: alpha(theme.palette.background.paper, 0.8),
							border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
							pointerEvents: "auto",
						}}
					>
						<Tabs
							value={tab}
							onChange={(_event, value: "music" | "art") => setTab(value)}
							variant="fullWidth"
							textColor="inherit"
							indicatorColor="primary"
							sx={{
								minHeight: 56,
								"& .MuiTab-root": {
									fontWeight: 700,
									letterSpacing: 0.2,
									minHeight: 56,
								},
							}}
						>
							<Tab icon={<MusicNoteRoundedIcon fontSize="small" />} iconPosition="start" label="Music Studio" value="music" />
							<Tab icon={<BrushRoundedIcon fontSize="small" />} iconPosition="start" label="Art Studio" value="art" />
						</Tabs>
					</Paper>
				</Box>
			</Box>

			<Box sx={{mt: {xs: -7, md: -8}}}>
				{tab === "music" ? (
					<MusicStudio onGenerate={onGenerateMusic} trackHistory={trackHistory} onTrackGenerated={onTrackGenerated} />
				) : (
					<ArtStudio
						onGenerateImage={onGenerateImage}
						onGenerateImageFromImage={onGenerateImageFromImage}
						imageHistory={imageHistory}
						onImageGenerated={onImageGenerated}
					/>
				)}
			</Box>
		</ThemeProvider>
	);
}
