import { Client, Chat, Contact, GroupChat, MessageMedia, GroupParticipant, Message } from 'whatsapp-web.js'
import { Redis } from 'ioredis';
import fetch from 'node-fetch';
import * as webhook from './configs/webhook';

const redis = require("./configs/redis");
const moment = require('moment-timezone');

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
        [key: string]: any;
    };
}

export type MediaOptions = {
    sendAudioAsVoice: boolean;
    [key: string]: any;
}
// [key: string]: any; 
export class Group {
    static BACKUPGROUPNAME = "esperando-ser-usado";
    CONNECT_NUMBER: string;

    private clientChat: ChatOpened;
    private agentChat: ChatOpened;

    private client: Client;
    private redis: Redis;

    private groupChat?: GroupChat;

    private retorno = {
        created: true,
        message: ""
    }

    constructor(client: Client, redis: Redis, args: {
        agenteNumber: string, nomeAgente: string, setorAgente: string,
        nameCliente: string, clienteNumber: string, id_bot: string,
        timeStarted: string
    }, connected_number: string
    ) {
        const clienteID = this.formatId(args.clienteNumber, 'number');
        const agenteID = this.formatId(args.agenteNumber, 'number');
        this.CONNECT_NUMBER = this.formatId(connected_number, 'number');


        this.clientChat = {
            receiver: "", sender: clienteID,
            type: 'chat',
            cliente: {
                id_bot: args.id_bot, nome: args.nameCliente,
            },
            agente: {
                nome: args.nomeAgente,
                numero: agenteID,
                setor: args.setorAgente.toUpperCase()
            },
            metaData: {
                timeStarted: args.timeStarted
            }
        }
        this.agentChat = {
            receiver: clienteID, sender: "",
            type: 'group',
            cliente: {
                id_bot: args.id_bot, nome: args.nameCliente,
            },
            agente: {
                nome: args.nomeAgente,
                numero: agenteID,
                setor: args.setorAgente.toUpperCase()
            },
            metaData: {
                timeStarted: args.timeStarted
            }
        }

        if (!(client instanceof Client)) this.setError('!(client instanceof Client)'.toUpperCase(), true);
        this.client = client;

        if (!(redis instanceof Redis)) this.setError('!(redis instanceof Redis)'.toUpperCase(), true);
        this.redis = redis;
        // console.log(this)
    }

    async create(): Promise<typeof this.retorno> {
        await this.createNewGroup();
        // console.log(this)
        if (this.retorno.created !== false && (this.groupChat)) {
            const groupID = this.groupChat.id._serialized;
            this.agentChat.sender = groupID;
            this.clientChat.receiver = groupID;
            const created = await this.createRedisChat(groupID);
        }

        return this.retorno;
    }
    async createNewGroup(): Promise<void> {
        try {
            const clienteNumber = this.clientChat.sender.replace(/\D/g, '');
            const subject = this.agentChat.cliente.nome + " " + clienteNumber.slice(2);

            const newGroup = await this.client.createGroup(subject, [this.CONNECT_NUMBER]).catch(err => this.setError("ERRO AO CRIAR GRUPO COM CONTATO", false, err))
            // console.log("GROUP CREATED: ", newGroup)

            //Group not created
            if ((typeof newGroup !== 'object') || !('gid' in newGroup)) {
                const backupGroup = await this.getBackupGroup();
                // console.log("BACKUP GROUP: ", backupGroup)

                if (!backupGroup) {
                    this.setError('GROUP NOT CREATED AND HAS NO BACKUP GROUP AVAILABLE', true)
                    return;
                }
                this.groupChat = backupGroup;
                this.groupChat.setSubject(subject);
                if (this.groupChat.archived) this.groupChat.unarchive();

            } else {
                const chat: GroupChat | null = await this.getGroupById((newGroup.gid as any)._serialized);
                if (!chat) {
                    this.setError('NOT ABLE TO GET GROUP BY ID', true)
                    return;
                }
                this.groupChat = chat;
            }

            /*ANOTHER ATTEMPT TO ADD AGENT*/
            const participants = this.groupChat.participants;
            let agentInside = false;
            participants.forEach((participant: GroupParticipant) => {
                if (participant.id._serialized === this.agentChat.agente.numero) agentInside = true;
            });
            if (!agentInside) this.groupChat.addParticipants([this.agentChat.agente.numero]);

            /**SEND INVITE LINK */
            const inviteCode = await this.groupChat.getInviteCode();
            this.client.sendMessage(this.agentChat.agente.numero, "https://chat.whatsapp.com/" + inviteCode);
        } catch (e) {
            let error: string = ""; // error under useUnknownInCatchVariables 
            if (typeof e === "string") {
                error = e;
            } else if (e instanceof Error) {
                error = e.message // works, `e` narrowed to Error
            }
            this.setError('ERROR IN createNewGroup()', true, error)
        }


        return;

    }
    async createRedisChat(groupId: string): Promise<void> {

        try {
            redis.set(this.clientChat.sender, JSON.stringify(this.clientChat))
            redis.set(groupId, JSON.stringify(this.agentChat))
            /* Group created */

        } catch (e) {
            let error: string = ""; // error under useUnknownInCatchVariables 
            if (typeof e === "string") {
                error = e;
            } else if (e instanceof Error) {
                error = e.message // works, `e` narrowed to Error
            }
            this.setError('ERROR INSERTING REDIS', true, error);
        }

    }

    async getBackupGroup(): Promise<GroupChat | null> {
        const allchats: Chat[] = await this.client.getChats();
        let chosenChat: GroupChat | Chat | null = null;

        allchats.every((chat: GroupChat | Chat) => {
            if (chat.isGroup && chat.name.includes(Group.BACKUPGROUPNAME)) {
                chosenChat = chat;
                return false;
            } else return true;
        })
        return chosenChat;
    }
    async getGroupById(groupID: string): Promise<GroupChat | null> {
        const chat: any = await this.client.getChatById(groupID);
        // console.log("GET GROUP BY ID: ", chat)

        if (chat.isGroup) return chat;
        return null;
    }

    formatId(whatsappNumber: string, type: 'group' | 'number'): string {
        let id: string = whatsappNumber.replace(/\D/g, '');

        if (type === 'group') id = id + "@g.us"
        else id = id + "@c.us"

        return id;
    }

    async setError(error: string, critical = false, stack = ""): Promise<void> {
        if (critical) this.retorno.created = false;
        if (stack) stack = `STACK: ${stack}\n`

        this.retorno.message = this.retorno.message +
            `AGENT: ${this.agentChat.agente.numero}, CLIENT: ${this.agentChat.receiver}
        ERROR: ${error}\n${stack}`;

    }
}
export class Functions {
    static BACKUPGROUPNAME = "esperando-ser-usado"
    static EMOTE_BOT = "🤖"
    static EMOTE_ERROR = '❌'

    static async endChatGroup(chatOpened: ChatOpened, chat: GroupChat | Chat, closeBot = false): Promise<boolean> {
        try {
            if (!('removeParticipants' in chat)) return false;

            if (closeBot) this.closeBotConversa(chatOpened.cliente.id_bot);

            this.exportChat(chatOpened);
            redis.del(chatOpened.sender);
            redis.del(chatOpened.receiver);

            await chat.removeParticipants([chatOpened.agente.numero]);

        } catch (error) {
            console.log(error)
        }
        if ('setSubject' in chat) {
            try {
                chat.setSubject(this.BACKUPGROUPNAME);
                chat.archive();
                chat.revokeInvite();
            }
            catch (e) { }
        }
        return true;

    }
    static async closeBotConversa(id_bot: string): Promise<void> {
        const r = await fetch(
            `https://backend.botconversa.com.br/api/v1/webhook/subscriber/${id_bot}/send_flow/`,
            {
                method: 'POST',
                body: JSON.stringify({ flow: Number(webhook.close.flowID) }),
                headers: { 'Content-Type': 'application/json', "API-KEY": webhook.close.key }
            }

        );
        // console.log(r);
    }
    static async exportChat(chatOpenedGroup: ChatOpened): Promise<void> {
        chatOpenedGroup.metaData.timeEnded = moment().tz("America/Sao_Paulo").format('YYYY-MM-DD HH:mm:ss')
        const r = await fetch(
            webhook.dump.url,
            {
                method: 'POST',
                body: JSON.stringify(chatOpenedGroup),
                headers: { 'Content-Type': 'application/json', "API-KEY": webhook.dump.key }
            }

        );
        // console.log(r);
    }

    static async notifyAdmin(error: string): Promise<void> {
        const r = await fetch(
            webhook.error.url,
            {
                method: 'POST',
                body: JSON.stringify({ message: error }),
                headers: { 'Content-Type': 'application/json', "API-KEY": webhook.dump.key }
            }

        );
    }
    static async updateChatOpened(chatOpened: ChatOpened): Promise<void> {
        await redis.set(chatOpened.sender, JSON.stringify(chatOpened))
    }

}
interface shortcut {
    type: 'message' | 'end' | 'both';
    entryPoint: string;
    text?: string;
    tag?: string;

}
export class Shortcut {
    static KEY = "#"
    template = (tpl: string, args: any) => tpl.replace(/\${(\w+)}/g, (_, v) => args[v]);

    private givenEntryPoint: string;

    private chatOpen: ChatOpened;
    private message: Message;

    private client: Client;
    private redis: Redis;

    shortcuts: shortcut[] = [
        {
            entryPoint: 'dia',
            type: 'message',
            text: "Bom dia ${nomeCliente}, como vai? Meu nome é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?"
        },
        {
            entryPoint: 'tarde',
            type: 'message',
            text: "Boa tarde ${nomeCliente}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?"
        }
        ,
        {
            entryPoint: 'fim',
            type: 'end',
            tag: 'fim normal'
            // text: "Boa tarde ${nomeCliente}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?"
        }
    ];

    constructor(client: Client, redis: Redis, chatOpen: ChatOpened, message: Message, entryPoint: string) {

        this.givenEntryPoint = entryPoint.replace(Shortcut.KEY, '');

        this.chatOpen = chatOpen;
        this.message = message;


        if (!(client instanceof Client)) console.log('!(client instanceof Client) ERROR')
        this.client = client;

        if (!(redis instanceof Redis)) console.log('!(redis instanceof Redis) ERROR');
        this.redis = redis;


    }
    async check(): Promise<void> {
        let hasShortcut: shortcut | false = false;
        this.shortcuts.forEach(async (shortcut) => {
            if (shortcut.entryPoint === this.givenEntryPoint) hasShortcut = shortcut;
        })
        if (!hasShortcut){
            await this.message.react(Functions.EMOTE_ERROR);
            return;
        } 
        await this.message.react(Functions.EMOTE_BOT);
        
        if(hasShortcut['type'] === 'message' || hasShortcut['type'] === 'both') await this.sendText(hasShortcut['text'], this.chatOpen.receiver);
        if(hasShortcut['tag']) this.tag(hasShortcut['tag']);
        if(hasShortcut['type'] === 'end'|| hasShortcut['type'] === 'both') this.end();

    }
    async sendText(text: string, sendTo: string): Promise<boolean> {
        let options: MediaOptions = { sendAudioAsVoice: true }

        const vars = {
            'nomeAgente': this.chatOpen.agente.nome,
            'nomeCliente': this.chatOpen.cliente.nome
        }

        text = this.template(
            text, 
            vars
        )
        // client, texto, message, sendTo
        try {
            if (this.message.hasQuotedMsg) {
                const quoted = await this.message.getQuotedMessage();
                options.quotedMessageId = quoted.id._serialized;
            }
            this.client.sendMessage(sendTo, text, options);
            return true;
        } catch (e) {
            return false;
        };

    }
    async end(): Promise<void> {
        try {
            const chat: GroupChat | any = await this.message.getChat();
            if (!('leave' in chat)) throw new Error('Chat is not group');

            await Functions.endChatGroup(this.chatOpen, chat, true);
            // chat.leave();
            // chat.delete();
        } catch (e) {
            console.log(e)
        };

    }

    async tag(tag: string): Promise<void> {
        this.chatOpen.tag = tag;
    }


}
export class VendasShortcut extends Shortcut {
    constructor(client: Client, redis: Redis, chatOpen: ChatOpened, message: Message, entryPoint: string) {
        super(client, redis, chatOpen, message, entryPoint);
        this.shortcuts.push({
            entryPoint: 'noite',
            type: 'message',
            text: "Boa noite ${nomeCliente}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?"
        })
    }
}