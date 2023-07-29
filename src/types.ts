export type ChatOpened = {
    /** The number that the sending message should arrive*/
    receiver: string;
    /** Who is sending the message*/
    sender: string;//chat id
    type: 'group' | 'chat';//group or normal

    /** If the group photo was set*/
    hasPhoto?: 'yes' | 'no';
    /** If messages that were sent before the ChatOpened*/
    sentOldMsg?: 'yes' | 'no';

    /** Tag attributed when the chat was ended*/
    tag?: string;

    /**Client talking with the BOT */
    cliente: {
        /** Bot Conversa ID for exchange of information*/
        id_bot: string;
        nome: string;
    };
    /**Salesman/operator/agent */
    agente: {
        numero: string;
        nome: string;
        setor: string;
    };
    metaData: {
        /**Time chat started */
        timeStarted: string;
        /** Name of the group*/
        groupName?: string;
        [key: string]: any;
    };
}

export type MediaOptions = {
    sendAudioAsVoice: boolean;
    [key: string]: any;
}