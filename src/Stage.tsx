import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {MusicStudio} from "./MusicStudio";


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
};

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    chatState: ChatStateType;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);

        this.chatState = {
            trackHistory: this.normalizeHistory(data.chatState?.trackHistory)
        };
    }

    private normalizeHistory(history: unknown): TrackHistoryEntry[] {
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

    private async addTrackToHistory(trackEntry: TrackHistoryEntry): Promise<void> {
        const updatedHistory = [
            trackEntry,
            ...this.chatState.trackHistory.filter((entry) => entry.url !== trackEntry.url),
        ].slice(0, 10);

        this.chatState.trackHistory = updatedHistory;
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

    /*
    // Typical inputParameters structure:
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


    render(): ReactElement {
        return <MusicStudio
            onGenerate={(inputParameters) => this.generateMusic(inputParameters)}
            trackHistory={this.chatState.trackHistory}
            onTrackGenerated={(trackEntry) => this.addTrackToHistory(trackEntry)}
        />;
    }

}
