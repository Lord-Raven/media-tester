import {useMemo, useState} from "react";
import {Box, Tab, Tabs} from "@mui/material";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import {alpha, createTheme, ThemeProvider} from "@mui/material/styles";
import {MusicStudio} from "./MusicStudio";
import {ArtStudio, ImageHistoryEntry} from "./ArtStudio";
import {VideoHistoryEntry, VideoStudio} from "./VideoStudio";

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
					borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
					backgroundColor: alpha(theme.palette.background.paper, 0.96),
				}}
			>
				<Box sx={{maxWidth: 1200, mx: "auto", px: {xs: 2, md: 4}}}>
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

			<Box>
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
