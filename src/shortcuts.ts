import { Client,  GroupChat, Message } from 'whatsapp-web.js'
import {ChatOpened, MediaOptions} from './types';
import {Functions} from './functions';

interface shortcut {
    type: 'message' | 'end' | 'both';
    entryPoint: string;
    text?: string;
    tag?: string;
}
interface messageShortcut extends shortcut {
    type: 'message';
    entryPoint: string;
    text: string;
}
interface endShortcut extends shortcut {
    type: 'end';
    entryPoint: string;
    tag?: string;
}
interface endWithMessageShortcut extends shortcut {
    type: 'both';
    entryPoint: string;
    text: string;
    tag?: string;
}

export class Shortcut {
    static KEY = "#"
    template = (tpl: string, args: any) => tpl.replace(/\${(\w+)}/g, (_, v) => args[v]);

    protected givenEntryPoint: string;

    protected chatOpen: ChatOpened;
    protected message: Message;
    protected client: Client;

    messageShortcuts: messageShortcut[] = [
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
       
    ];
    endShortcuts: endShortcut[] = [
        {
            entryPoint: 'fim',
            type: 'end',
            tag: 'FIM'
        }
    ] 
    endWithMessageShortcuts: endWithMessageShortcut[] = [] 

    constructor(client: Client, chatOpen: ChatOpened, message: Message, entryPoint: string) {

        this.givenEntryPoint = entryPoint.replace(Shortcut.KEY, '');

        this.chatOpen = chatOpen;
        this.message = message;


        if (!(client instanceof Client)) console.log('!(client instanceof Client) ERROR')
        this.client = client;


    }
    async check(): Promise<void> {
        let hasShortcut: shortcut | false = false;

        this.messageShortcuts.forEach(async (shortcut) => {if (this.givenEntryPoint.startsWith(shortcut.entryPoint)) hasShortcut = shortcut });
        if (!hasShortcut)
            this.endShortcuts.forEach(async (shortcut) => {if (this.givenEntryPoint.startsWith(shortcut.entryPoint)) hasShortcut = shortcut });
        if (!hasShortcut)
            this.endWithMessageShortcuts.forEach(async (shortcut) => {if (this.givenEntryPoint.startsWith(shortcut.entryPoint)) hasShortcut = shortcut });


        if (!hasShortcut){
            await this.message.react(Functions.EMOTE_ERROR);
            return;
        } 
        await this.message.react(Functions.EMOTE_BOT);
        
        if(hasShortcut['type'] === 'message' || hasShortcut['type'] === 'both') await this.sendText(hasShortcut['text'], this.chatOpen.receiver);
        if(hasShortcut['tag']) this.tag(hasShortcut['tag'] + this.givenEntryPoint.replace(hasShortcut['entryPoint'], ''));
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

    constructor(client: Client, chatOpen: ChatOpened, message: Message, entryPoint: string) {
        super(client, chatOpen, message, entryPoint);
        this.messageShortcuts.push({
            entryPoint: 'noite',
            type: 'message',
            text: "Boa noite ${nomeCliente}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?"
        });
        this.endShortcuts.push({
            entryPoint: 'venda',
            type: 'end',
            tag: 'VENDA'
        },
        {
            entryPoint: 'lead',
            type: 'end',
            tag: 'LEAD'
        }
        ,
        {
            entryPoint: 'seminteresse',
            type: 'end',
            tag: 'SEMINTERESSE'
        });
    }
    async check(): Promise<void> {
        const patternVendas = new RegExp('^'+ this.endShortcuts[0].entryPoint, 'i')
        if (patternVendas.test(this.givenEntryPoint)){
            const tag = 'VENDA' + this.givenEntryPoint.replace(/venda/i, '');
            await this.message.react(Functions.EMOTE_BOT);
            this.tag(tag);
            this.end();
            return;
        }
 
        super.check();

    }
   

}
export class FinanceiroShortcut extends Shortcut {

    messageShortcuts: messageShortcut[] = [
        {
            entryPoint: 'dia',
            type: 'message',
            text: `Bom dia!\nEm que posso ajudar?\nFavor informar nome completo e cpf.`
        },
        {
            entryPoint: 'anual',
            type: 'message',
            text: "Como o Sr(a) gostaria de realizar a sua renovação anual?\nRenovando no cartão de crédito pagando R$418,80 em 12x de R$34,90 sem juros, ou no boleto bancário R$478,80  em 12x de R$39,90."
        },
        {
            entryPoint: 'comercial',
            type: 'message',
            text: "Para falar com nossa equipe de consultores, favor entrar em contato através dos números abaixo.\n\nRenan\nComercial\n83 996271778\nsegunda a sexta das 08h as 17h\nsabado das 08h as 12h\n\nComercial\n83 996271778\n83 993684260\nsegunda a sexta das 08h as 17h\nsabado das 08h as 12h"
        },
        {
            entryPoint: 'suporte',
            type: 'message',
            text: "Para assuntos técnicos, favor entrar em contato com nosso suporte através dos números abaixo.\n\nSuporte Técnico\n83 998237731\nsegunda a sexta das 08h as 17h\nsabado das 08h as 12h\n\nSuporte 24h em caso de roubo\n83 996271778\n83 993684260"
        },
        {
            entryPoint: 'pix',
            type: 'message',
            text: "Segue chave PIX\nCNPJ 15521996000158\n\nRastrear Sat\n\nMauricio Almeida de Lucena"
        },

       
    ];
    constructor(client: Client, chatOpen: ChatOpened, message: Message, entryPoint: string) {
        super(client, chatOpen, message, entryPoint);
    }
    // async check(): Promise<void> {
    //     const patternVendas = new RegExp('^'+ this.endShortcuts[0].entryPoint, 'i')
    //     if (patternVendas.test(this.givenEntryPoint)){
    //         const tag = 'VENDA' + this.givenEntryPoint.replace(/venda/i, '');
    //         await this.message.react(Functions.EMOTE_BOT);
    //         this.tag(tag);
    //         this.end();
    //         return;
    //     }
 
    //     super.check();

    // }
   

}