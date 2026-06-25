import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {ImageHistoryEntry} from "./ArtStudio";
import {VideoHistoryEntry} from "./VideoStudio";
import {StudioWorkspace} from "./StudioWorkspace";


type MessageStateType = any;

type ConfigType = any;

type InitStateType = any;

type TrackHistoryEntry = {
    title: string;
    url: string;
    createdAt: number;
};

type ChatStateType = {
    trackHistory: TrackHistoryEntry[];
    imageHistory: ImageHistoryEntry[];
    videoHistory: VideoHistoryEntry[];
};

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    chatState: ChatStateType;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);

        this.chatState = {
            trackHistory: this.normalizeTrackHistory(data.chatState?.trackHistory),
            imageHistory: this.normalizeImageHistory(data.chatState?.imageHistory),
            videoHistory: this.normalizeVideoHistory(data.chatState?.videoHistory),
        };
    }

    private normalizeTrackHistory(history: unknown): TrackHistoryEntry[] {
        if (!Array.isArray(history)) {
            return [];
        }

        return history
            .filter((entry): entry is Partial<TrackHistoryEntry> => typeof entry === "object" && entry != null)
            .map((entry) => {
                const title = typeof entry.title === "string" ? entry.title.trim() : "";
                const url = typeof entry.url === "string" ? entry.url.trim() : "";
                const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : Date.now();

                return {title, url, createdAt};
            })
            .filter((entry) => entry.title.length > 0 && entry.url.length > 0)
            .slice(0, 10);
    }

    private normalizeImageHistory(history: unknown): ImageHistoryEntry[] {
        if (!Array.isArray(history)) {
            return [];
        }

        return history
            .filter((entry): entry is Partial<ImageHistoryEntry> => typeof entry === "object" && entry != null)
            .map((entry) => {
                const url = typeof entry.url === "string" ? entry.url.trim() : "";
                const prompt = typeof entry.prompt === "string" ? entry.prompt.trim() : "";
                const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : Date.now();
                const mode: ImageHistoryEntry["mode"] = entry.mode === "image-to-image" ? "image-to-image" : "text-to-image";

                return {url, prompt, createdAt, mode};
            })
            .filter((entry) => entry.url.length > 0)
            .slice(0, 12);
    }

    private normalizeVideoHistory(history: unknown): VideoHistoryEntry[] {
        if (!Array.isArray(history)) {
            return [];
        }

        return history
            .filter((entry): entry is Partial<VideoHistoryEntry> => typeof entry === "object" && entry != null)
            .map((entry) => {
                const url = typeof entry.url === "string" ? entry.url.trim() : "";
                const prompt = typeof entry.prompt === "string" ? entry.prompt.trim() : "";
                const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : Date.now();
                const seconds = typeof entry.seconds === "number" ? entry.seconds : 8;
                const mode: VideoHistoryEntry["mode"] = entry.mode === "image-to-video" ? "image-to-video" : "text-to-video";
                const sourceImageUrl = typeof entry.sourceImageUrl === "string" ? entry.sourceImageUrl.trim() : undefined;

                return {url, prompt, seconds, createdAt, mode, sourceImageUrl};
            })
            .filter((entry) => entry.url.length > 0)
            .slice(0, 12);
    }

    private async addTrackToHistory(trackEntry: TrackHistoryEntry): Promise<void> {
        const updatedHistory = [
            trackEntry,
            ...this.chatState.trackHistory.filter((entry) => entry.url !== trackEntry.url),
        ].slice(0, 10);

        this.chatState.trackHistory = updatedHistory;
        await this.save();
    }

    private async addImageToHistory(imageEntry: ImageHistoryEntry): Promise<void> {
        const updatedHistory = [
            imageEntry,
            ...this.chatState.imageHistory.filter((entry) => entry.url !== imageEntry.url),
        ].slice(0, 12);

        this.chatState.imageHistory = updatedHistory;
        await this.save();
    }

    private async addVideoToHistory(videoEntry: VideoHistoryEntry): Promise<void> {
        const updatedHistory = [
            videoEntry,
            ...this.chatState.videoHistory.filter((entry) => entry.url !== videoEntry.url),
        ].slice(0, 12);

        this.chatState.videoHistory = updatedHistory;
        await this.save();
    }

    private async removeTrackFromHistory(url: string): Promise<void> {
        this.chatState.trackHistory = this.chatState.trackHistory.filter((entry) => entry.url !== url);
        await this.save();
    }

    private async removeImageFromHistory(url: string): Promise<void> {
        this.chatState.imageHistory = this.chatState.imageHistory.filter((entry) => entry.url !== url);
        await this.save();
    }

    private async removeVideoFromHistory(url: string): Promise<void> {
        this.chatState.videoHistory = this.chatState.videoHistory.filter((entry) => entry.url !== url);
        await this.save();
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: this.chatState,
        };
    }

    async save() {
        await this.messenger.updateChatState(this.chatState);
    }

    async setState(state: MessageStateType): Promise<void> {
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        return {};
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {

        return {};
    }

    /* Typical inputParameters structure:
    {
        title: '', // Title from title input
        prompt: '', // Style prompt from style blank
        lyrics: null, // Lyrics from lyrics blank, if prompt mode not toggled
        lyrics_prompt: null, // Style prompt from lyrics blank, if prompt mode toggled
        instrumental: false, // True if lyrics blank is empty, false if lyrics blank has text
        tags: [], // Tags from tags input
    }
     */
    async generateMusic(inputParameters: any): Promise<string> {
        return (await this.generator.makeMusic(inputParameters))?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        aspect_ratio: '1:1'|'16:9'|'9:16'|'21:9'|'9:21'|'2:3'|'3:2'|'4:3'|'3:4', // Aspect ratio from aspect ratio dropdown
        prompt: '', // Style prompt from style blank
        remove_background: false, // True if remove background checkbox is toggled, false otherwise
    }
    */
    async generateImage(inputParameters: any): Promise<string> {
        return (await this.generator.makeImage(inputParameters))?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        image: '' // Image URL for base image
        prompt: '', // Style prompt from style blank
        remove_background: false, // True if remove background checkbox is toggled, false otherwise
        transfer_type: 'edit'|'canny'|'default' // Transfer type from transfer type dropdown
    }
    */
   async generateImageFromImage(inputParameters: any): Promise<string> {
        const imageResponse = await this.generator.imageToImage(inputParameters);
        if (imageResponse && imageResponse.url && inputParameters.remove_background) {
            // imageToImage doesn't handle background removal, so we need to call removeBackground separately
            const removeBackgroundResponse = await this.generator.removeBackground({
                image: imageResponse.url
            });
            return removeBackgroundResponse?.url ?? '';
        }
        return imageResponse?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        prompt: '', // Style prompt from style blank
        seconds: number // Length of video in seconds from length input
    }
    */
    async generateVideo(inputParameters: any): Promise<string> {
        return (await this.generator.makeVideo(inputParameters))?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        image: '' // Image URL for base image
    }
    */
    async generateVideoFromImage(inputParameters: any): Promise<string> {
        return (await this.generator.animateImage(inputParameters))?.url ?? '';
    }

    async generateModel(inputParameters: any): Promise<string> {
        return (await this.generator.modelGen(inputParameters))?.url ?? '';
    }


    render(): ReactElement {
        return <StudioWorkspace
            onGenerateMusic={(inputParameters) => this.generateMusic(inputParameters)}
            trackHistory={this.chatState.trackHistory}
            onTrackGenerated={(trackEntry) => this.addTrackToHistory(trackEntry)}
            onTrackDeleted={(url) => this.removeTrackFromHistory(url)}
            onGenerateImage={(inputParameters) => this.generateImage(inputParameters)}
            onGenerateImageFromImage={(inputParameters) => this.generateImageFromImage(inputParameters)}
            imageHistory={this.chatState.imageHistory}
            onImageGenerated={(imageEntry) => this.addImageToHistory(imageEntry)}
            onImageDeleted={(url) => this.removeImageFromHistory(url)}
            onGenerateVideo={(inputParameters) => this.generateVideo(inputParameters)}
            onGenerateVideoFromImage={(inputParameters) => this.generateVideoFromImage(inputParameters)}
            videoHistory={this.chatState.videoHistory}
            onVideoGenerated={(videoEntry) => this.addVideoToHistory(videoEntry)}
            onVideoDeleted={(url) => this.removeVideoFromHistory(url)}
        />;
    }

}
