import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message, Character} from "@chub-ai/stages-ts";
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

type CommentHistoryEntry = {
    context: string;
    text: string;
    speechUrl: string;
};

export type {CommentHistoryEntry};

type ChatStateType = {
    trackHistory: TrackHistoryEntry[];
    imageHistory: ImageHistoryEntry[];
    videoHistory: VideoHistoryEntry[];
    commentHistory: CommentHistoryEntry[];
};

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    chatState: ChatStateType;
    primaryCharacter: Character;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);

        this.primaryCharacter = Object.values(data.characters || {})[0] || {anonymizedId: "1"} as Character;

        this.chatState = {
            trackHistory: this.normalizeTrackHistory(data.chatState?.trackHistory),
            imageHistory: this.normalizeImageHistory(data.chatState?.imageHistory),
            videoHistory: this.normalizeVideoHistory(data.chatState?.videoHistory),
            commentHistory: this.normalizeCommentHistory(data.chatState?.commentHistory),
        };
    }

    private normalizeCommentHistory(history: unknown): CommentHistoryEntry[] {
        if (!Array.isArray(history)) {
            return [];
        }

        return history
            .filter((entry): entry is Partial<CommentHistoryEntry> => typeof entry === "object" && entry != null)
            .map((entry) => {
                const context = typeof entry.context === "string" ? entry.context.trim() : "";
                const text = typeof entry.text === "string" ? entry.text.trim() : "";
                const speechUrl = typeof entry.speechUrl === "string" ? entry.speechUrl.trim() : "";

                return {context: context, text, speechUrl};
            })
            .filter((entry) => entry.context.length > 0 && entry.text.length > 0 && entry.speechUrl.length > 0)
            .slice(0, 20);
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
    
    private async addCommentToHistory(commentEntry: CommentHistoryEntry): Promise<void> {
        const updatedHistory = [
            commentEntry,
            ...this.chatState.commentHistory.filter((entry) => entry.context !== commentEntry.context),
        ].slice(0, 20);

        this.chatState.commentHistory = updatedHistory;
        this.pushMessage(`Added comment to history: ${commentEntry.context} (${commentEntry.text})`);
        await this.save();
    }

    private async addTrackToHistory(trackEntry: TrackHistoryEntry): Promise<void> {
        const updatedHistory = [
            trackEntry,
            ...this.chatState.trackHistory.filter((entry) => entry.url !== trackEntry.url),
        ].slice(0, 10);

        this.chatState.trackHistory = updatedHistory;
        this.pushMessage(`Added track to history: ${trackEntry.title} (${trackEntry.url})`);
        await this.save();
    }

    private async addImageToHistory(imageEntry: ImageHistoryEntry): Promise<void> {
        const updatedHistory = [
            imageEntry,
            ...this.chatState.imageHistory.filter((entry) => entry.url !== imageEntry.url),
        ].slice(0, 12);

        this.chatState.imageHistory = updatedHistory;
        this.pushMessage(`Added image to history: ${imageEntry.prompt} (${imageEntry.url})`);
        await this.save();
    }

    private async addVideoToHistory(videoEntry: VideoHistoryEntry): Promise<void> {
        const updatedHistory = [
            videoEntry,
            ...this.chatState.videoHistory.filter((entry) => entry.url !== videoEntry.url),
        ].slice(0, 12);

        this.chatState.videoHistory = updatedHistory;
        this.pushMessage(`Added video to history: ${videoEntry.prompt} (${videoEntry.url})`);
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

    pushMessage(message: string) {
        this.messenger.impersonate({
            speaker_id: this.primaryCharacter.anonymizedId,
            is_main: false,
            parent_id: null,
            message: message
        });
    }

    async generateWitchDialogue(context: string): Promise<CommentHistoryEntry> {
        let dialogue = await this.generateText({
            prompt: `<WitchDialogueTask>` +
                `\n\t<Premise>The Witch is a character in a media creation application. The user creates content using generative tools, and the Witch generally comments upon what the user is up to.</Premise>` +
                `\n\t<Personality>The Witch is a sassy, fun-loving brewmaster who enjoys suggestive teasing about whatever the user is creating. ` +
                    `She has a rival: 'the Wizard'. The Wizard is known for creating content for supplicants, but he is a know-it-all buzzkill who frequently gets it wrong. ` +
                    `The Witch, on the other hand, loves lending the user her tools and letting them create directly as they see fit, content to sit back and banter while the user works. ` +
                    `The Witch is a bombshell with dark robes, loads of pale cleavage, and an oversized pointy hat. She has dark eyes, dark hair with pink highlights, and a mischievous smile. ` +
                    `</Personality>` +
                `\n\t<CommentHistory>${this.chatState.commentHistory.map(entry => `<Comment><Prompt>${entry.context}</Prompt><Response>${entry.text}[END]</Response></Comment>`).join('')}</CommentHistory>` +
                `\n\t<Context>${context}</Context>` +
                `\n\t<Instructions>The System will generate a short dialogue comment from the Witch character based on the provided Context. ` +
                    `This is a straight line of speech that will become voiced, so it cannot contain actions or prose. After completing the line, output [END].</Instructions>` +
                `\n\t<ExampleResponses>` +
                `\n\t\t<Response>Oooh, I see what you're brewing up! Let's add a pinch of magic and a dash of mischief.</Response>` +
                `\n\t\t<Response>Ha! The Wizard would never have thought to do it that way. You're a true master of your craft!</Response>` +
                `\n\t\t<Response>What, pray tell, do you have in mind for _that_?</Response>` +
                `\n\t</ExampleResponses>` +
                `\n</WitchDialogueTask>`});
        if (dialogue) {
            // If dialogue is in <Response>...</Response> tags, extract the text inside the tags or all text after <Response> if there's not closing tag.
            const responseMatch = dialogue.match(/<Response>(.*?)<\/Response>/s);
            if (responseMatch) {
                dialogue = responseMatch[1].trim();
            } else {
                const responseStart = dialogue.indexOf('<Response>');
                if (responseStart !== -1) {
                    dialogue = dialogue.substring(responseStart + 10).trim();
                }
            }

            const result = {context: context, text: dialogue, speechUrl: ''};
            // Asynchronous population of the speech URL.
            this.generateSpeech({transcript: dialogue, voice_id: '98bcf0b0-a0f7-4828-8686-4f8692293d68'}).then((speechUrl) => {
                result.speechUrl = speechUrl;
            }).catch((error) => {
                console.error('Error generating speech for Witch dialogue:', error);
            });
            
            void this.addCommentToHistory(result);
            return result;
        }

        return {context: context, text: '', speechUrl: ''};
    }

    async generateText(inputParameters: any): Promise<string> {
        // If inputParameters.prompt does not start with "{{messages}}", prepend it to the prompt so that the system can include the conversation history in the request
        if (typeof inputParameters.prompt === "string" && !inputParameters.prompt.startsWith("{{messages}}")) {
            inputParameters.prompt = `{{messages}}${inputParameters.prompt}`;
        }
        return (await this.generator.textGen({max_tokens: 400, include_history: true, stop: ['[END]'], ...inputParameters}))?.result ?? '';
    }

    async generateSpeech(inputParameters: any): Promise<string> {
        return (await this.generator.speak(inputParameters))?.url ?? '';
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
        // Lyric generation is very Chinese. So let's just do a text gen request here instead of relying on lyrics_prompt
        if (inputParameters.lyrics_prompt) {
            let lyricsResponse = await this.generateText({
                prompt: `<LyricGenerationTask>` +
                        `\n\t<MusicStyle>${inputParameters.prompt}</MusicStyle>` +
                        `\n\t<LyricPrompt>${inputParameters.lyrics_prompt}</LyricPrompt>` +
                        `\n\t<Instructions>The System will compose and output lyrics for a song with the provided MusicStyle and LyricPrompt. When complete, output [END].</Instructions>` +
                        `\n</LyricGenerationTask>`,
                max_tokens: 1200
            });
            // Strip prefixes like "Lyrics: " or "Here are the lyrics: " from the generated lyrics by searching for "lyrics:" and taking everything after it
            const lyricsLower = lyricsResponse.toLowerCase();
            const lyricsIndex = lyricsLower.indexOf('lyrics:');
            if (lyricsIndex !== -1) {
                lyricsResponse = lyricsResponse.substring(lyricsIndex + 'lyrics:'.length).trim();
            }
            inputParameters.lyrics = lyricsResponse;
            inputParameters.lyrics_prompt = null; // Clear lyrics_prompt to avoid confusion
        }

        // Kick off a Witch comment:
        void this.generateWitchDialogue(`The user is creating a song with the following parameters: Title: ${inputParameters.title}, Style: ${inputParameters.prompt}, Lyrics: ${inputParameters.lyrics ?? 'None'}, Instrumental Only: ${inputParameters.instrumental ? 'Yes' : 'No'}, Tags: ${inputParameters.tags.join(', ')}`);

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
        // Kick off a Witch comment:
        void this.generateWitchDialogue(`The user is creating an image with the following parameters: Aspect Ratio: ${inputParameters.aspect_ratio}, Style: ${inputParameters.prompt}, Remove Background: ${inputParameters.remove_background ? 'Yes' : 'No'}`);
        
        return (await this.generator.makeImage(inputParameters))?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        image: '' // Image URL for base image
        prompt: '', // Style prompt from style blank
        remove_background: false, // True if remove background checkbox is toggled, false otherwise
        transfer_type: 'edit'|'canny'|'face' // Transfer type from transfer type dropdown
    }
    */
   async generateImageFromImage(inputParameters: any): Promise<string> {
        // Kick off a Witch comment:
        void this.generateWitchDialogue(`The user is creating an image from an existing image with the following parameters: Base Image URL: ${inputParameters.image}, Style: ${inputParameters.prompt}, Remove Background: ${inputParameters.remove_background ? 'Yes' : 'No'}, Transfer Type: ${inputParameters.transfer_type}`);
        
        const imageResponseUrl = (inputParameters.prompt ? (await this.generator.imageToImage(inputParameters))?.url : inputParameters.image) ?? '';
        if (imageResponseUrl && inputParameters.remove_background) {
            // imageToImage doesn't handle background removal, so we need to call removeBackground separately
            const removeBackgroundResponse = await this.generator.removeBackground({
                image: imageResponseUrl
            });
            return removeBackgroundResponse?.url ?? '';
        }
        return imageResponseUrl;
    }

    /* Typical inputParameters structure:
    {
        prompt: '', // Style prompt from style blank
        seconds: number // Length of video in seconds from length input
    }
    */
    async generateVideo(inputParameters: any): Promise<string> {
        // Kick off a Witch comment:
        void this.generateWitchDialogue(`The user is creating a video with the following parameters: Prompt: ${inputParameters.prompt}, Length: ${inputParameters.seconds} seconds`);

        return (await this.generator.makeVideo(inputParameters))?.url ?? '';
    }

    /* Typical inputParameters structure:
    {
        image: '' // Image URL for base image
    }
    */
    async generateVideoFromImage(inputParameters: any): Promise<string> {
        // Kick off a Witch comment:
        void this.generateWitchDialogue(`The user is creating a video from an existing image with the following parameters: Base Image URL: ${inputParameters.image}`);
        
        return (await this.generator.animateImage({...inputParameters, cfg_scale: 1}))?.url ?? '';
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
            commentHistory={this.chatState.commentHistory}
        />;
    }

}
