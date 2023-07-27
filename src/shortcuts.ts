import {Client,GroupChat, Message} from 'whatsapp-web.js'
import {ChatOpened,MediaOptions} from './structs';

export const emoteBot = '🤖';
export const emoteError = '❌';
export const shortcutKey = '#';

const {createGroup, getRedisChat, createRedisChat,endChatGroup,messageMediaOptions,setGroupPicture} = require( "./functions.ts");

export async function shortcuts( client: Client, chatOpenedGroup: ChatOpened, message: Message,shortcut: string): Promise<void>{
 
    let type = 'message';
    let success = false;
  

    switch(shortcut){
        //MESSAGE SHORTCUTS
        case 'dia':
            success = await bomDia(client, chatOpenedGroup, message);
            break;
        case 'tarde':
            success = await boaTarde(client, chatOpenedGroup, message);
            break;
        //END SHORTCUTS
        case 'fim':
            await message.react(emoteBot); 
            success = await finalizar(client, chatOpenedGroup, message);
            type = 'end';
            break;
    }
    
    if(success && type === "message") await message.react(emoteBot); 
    else if(!success && type === "message") await message.react(emoteError);

    return;
}

async function finalizar(client: Client, chatOpenedGroup: ChatOpened, message: Message): Promise<boolean>{
    try{
        const chat: GroupChat|any = await message.getChat();
        if(!('leave' in chat))throw new Error('Chat is not group'); 
        
        const ended = await endChatGroup(chatOpenedGroup, chat , true );
        // chat.leave();
        // chat.delete();
 
        return ended;
    }catch(e){
        console.log(e)
        return false;
    };

}

async function bomDia(client: Client, chatOpenedGroup: ChatOpened, message: Message): Promise<boolean>{
    const nome = chatOpenedGroup.cliente.nome;
    const nomeAgente = chatOpenedGroup.agente.nome;
    const setor = chatOpenedGroup.agente.setor;
    let msg: string = "";

    switch(setor){
        case 'SUPORTE':
            msg = `Bom dia ${nome}, como vai? Meu nome é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
        case 'VENDAS':
            msg = `Bom dia ${nome}, me chamo ${nomeAgente} sou da RastrearSat, tudo bem? Em qual bairro você mora?`;
            break;
        default:
            msg = `Bom dia ${nome}, como vai? Meu nome é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
    }

    const args = {
        client, message, 
        texto: msg, 
        sendTo: chatOpenedGroup.receiver
    }

    return await sendText(args)

}
async function boaTarde(client: Client, chatOpenedGroup: ChatOpened, message: Message): Promise<boolean>{
    const nome = chatOpenedGroup.cliente.nome;
    const nomeAgente = chatOpenedGroup.agente.nome;
    const setor = chatOpenedGroup.agente.setor;
    let msg: string = "";

    switch(setor){
        case 'SUPORTE':
            msg = `Boa tarde ${nome}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
        case 'VENDAS':
            msg = `Boa tarde ${nome}, me chamo ${nomeAgente} sou da RastrearSat, tudo bem? Em qual bairro você mora?`;
            break;
        default:
            msg = `Boa tarde ${nome}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
    }
    const args = {
        client, message, 
        texto: msg, sendTo: chatOpenedGroup.receiver
    }

    return await sendText(args)

}
async function tags(client: Client, chatOpenedGroup: ChatOpened, message: Message): Promise<boolean>{
    const nome = chatOpenedGroup.cliente.nome;
    const nomeAgente = chatOpenedGroup.agente.nome;
    const setor = chatOpenedGroup.agente.setor;
    let msg: string = "";

    switch(setor){
        case 'SUPORTE':
            msg = `Boa tarde ${nome}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
        case 'VENDAS':
            msg = `Boa tarde ${nome}, me chamo ${nomeAgente} sou da RastrearSat, tudo bem? Em qual bairro você mora?`;
            break;
        default:
            msg = `Boa tarde ${nome}, como vai? Aqui quem fala é ${nomeAgente} da RastrearSat👋. Em que posso te ajudar?`;
            break;
    }
    const args = {
        client, message, 
        texto: msg, sendTo: chatOpenedGroup.receiver
    }

    return await sendText(args)

}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
async function sendText(args: { client: Client; message:Message; texto: string; sendTo: string }): Promise<boolean>{
    let options:MediaOptions = { sendAudioAsVoice: true}

    // client, texto, message, sendTo
    try{
        if(args.message.hasQuotedMsg){
            const quoted = await args.message.getQuotedMessage();
            options.quotedMessageId =  quoted.id._serialized;
        }
        args.client.sendMessage(args.sendTo, args.texto, options);
        return true;
    }catch(e){
        return false;
    };

}