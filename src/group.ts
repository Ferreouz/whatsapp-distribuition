import {ChatOpened} from './types';
import { Client, Chat, GroupChat, GroupParticipant } from 'whatsapp-web.js';
import { Redis } from 'ioredis';
import {redis} from "./configs/redis";

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

            const newGroup: any = {}//await this.client.createGroup(subject, [this.CONNECT_NUMBER]).catch(err => this.setError("ERRO AO CRIAR GRUPO COM CONTATO", false, err))
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

            this.agentChat.metaData.groupName = subject;

            /**SEND INVITE LINK */
            const inviteCode = await this.groupChat.getInviteCode();
            this.client.sendMessage(this.agentChat.agente.numero, subject + " https://chat.whatsapp.com/" + inviteCode);
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