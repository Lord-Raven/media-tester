import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";


type MessageStateType = any;

type ConfigType = any;

type InitStateType = any;

type ChatStateType = any;

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {


    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
        };
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
        return <div style={{
            width: '100vw',
            height: '100vh',
            display: 'grid',
            alignItems: 'stretch'
        }}>

        </div>;
    }

}
