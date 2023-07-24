// const request = require('request');

const redis  = require( "./configs/redis");
// const webhook  = require( "./configs/webhook");
const moment = require('moment-timezone');

import * as webhook from './configs/webhook';
import fetch from 'node-fetch';
import {Client, Chat,Contact,GroupChat,MessageMedia} from 'whatsapp-web.js'
import {ChatOpened,MediaOptions} from './structs';
// import {Request as request} from 'request';

async function createGroup(client: Client, agenteNumber: string, nameCliente: string, clienteNumber: string): Promise<Object| boolean>{
    const contactId = agenteNumber.replace(/\D/g, '') + "@c.us"
    // const clienteId = clienteNumber.replace(/\D/g, '') + "@c.us"
    try{
        await client.sendMessage(contactId, 'test');
        const group = await client.createGroup(nameCliente + " " + clienteNumber.slice(2), [contactId])
        .catch(err=>
            console.log("ERRO AO CRIAR GRUPO COM CONTATO "+ err)
        )
        // const group = await client.createGroup(nameCliente + " " + clienteNumber.slice(2), ['553499679717@c.us']).catch(err=> console.log(err))
        // console.log("HEY HO "+group)
        if(typeof group === 'object'){

            if( contactId in group.missingParticipants) return {result: false, id: group.gid};
            return {result: true, id: group.gid}

        } else return false;

    }catch(e){
        console.log(e)
        // client.sendMessage("553499679717@c.us", "Transferir deu erro" + e);
        /**Message wasnt sent */
        return false;
    }
    
}
async function createRedisChat(clienteNumber: string,nomeCliente : string,group: string,id_bot: string,nomeAgente: string,agenteNumber:string): Promise<boolean> {

   
    try {
        const clienteId = clienteNumber.replace(/\D/g, '') + "@c.us";
        const groupId = group.replace(/\D/g, '') + "@g.us";

    
        const clienteChatOpened: ChatOpened = {
            receiver: groupId, sender: clienteId, 
            type: 'chat',
            cliente:{
                id_bot: id_bot, nome: nomeCliente,
            },
            agente:{
                nome: nomeAgente, 
                numero: agenteNumber,
            },
            metaData:{
                timeStarted: moment().tz("America/Sao_Paulo")
            } 
        }
        const agenteChatOpened: ChatOpened = {
            receiver: clienteId, sender: groupId, 
            type: 'group', 
            cliente:{
                id_bot: id_bot, nome: nomeCliente,
            },
            agente:{
                nome: nomeAgente, 
                numero: agenteNumber,
            },
            metaData:{
                timeStarted: moment().tz("America/Sao_Paulo")
            } 
        }
        
        redis.set(clienteId, JSON.stringify(clienteChatOpened))
        redis.set(groupId, JSON.stringify(agenteChatOpened))
        /* Group created */
        return true;
    } catch (error) {
        console.log("Error REDIS")
        /* Group NOT created */
        return false;
    }
  

}
async function endChatGroup(chatOpened: ChatOpened, closeBotConversa = false ): Promise<boolean>{
    try {
        
        const r = await fetch(
            `https://backend.botconversa.com.br/api/v1/webhook/subscriber/${chatOpened.cliente.id_bot}/send_flow/`,
            { 
                method: 'POST',
                body: JSON.stringify({ flow: Number(webhook.close.flowID) }), 
                headers: {'Content-Type': 'application/json', "API-KEY":webhook.close.key} 
            }
           
        );
        // console.log(r)
        exportChat(chatOpened);
        await redis.del(chatOpened.sender);
        await redis.del(chatOpened.receiver);
        return true;

    } catch (error) {
        return false;
    }
    
}
async function exportChat(chatOpenedGroup: ChatOpened): Promise<void> {
    chatOpenedGroup.metaData.timeEnded = moment().tz("America/Sao_Paulo") 
    const r = await fetch(
        webhook.dump.url,
        { 
            method: 'POST',
            body: JSON.stringify(chatOpenedGroup), 
            headers: {'Content-Type': 'application/json', "API-KEY":webhook.dump.key} 
        }
       
    );
    // console.log(r);
}
async function getRedisChat(chatId: string): Promise<false | ChatOpened>{
    const chatOpened = JSON.parse((await redis.get(chatId)));
    if(!chatOpened) return false;
    
    return chatOpened;
}
async function setGroupPicture(client: Client, chat: Chat|GroupChat, chatOpened: ChatOpened){
    try {
        const url = await client.getProfilePicUrl(chatOpened.receiver);
        const media:MessageMedia = await MessageMedia.fromUrl(url);
        media.mimetype = "image/png";
        media.filename = "CustomImageName.png";

        if(!('setPicture' in chat)){
            chatOpened.hasPhoto = 'no';
        }else {
            await chat.setPicture(media)
            chatOpened.hasPhoto = 'yes';    
        }
       
        await redis.set(chatOpened.sender, JSON.stringify(chatOpened))
        console.log("setFoto" + chatOpened.hasPhoto)
     
        return true;//
    } catch (error) {
        console.log(error)
        return false
    }
 
}
export async function updateChatOpened(chatOpened: ChatOpened): Promise<void>{
    await redis.set(chatOpened.sender, JSON.stringify(chatOpened))
}
function messageMediaOptions(media: MessageMedia, quoted:string|boolean = false){
 // caption: true
 
    const mediaOptions:MediaOptions = {
        sendAudioAsVoice: true
    }

    if(quoted !== false) mediaOptions.quotedMessageId =  quoted;
    //stickers
    if(media.mimetype.includes('webp')) mediaOptions.sendMediaAsSticker = true;
     
    return mediaOptions;
}

export {getRedisChat,endChatGroup,createGroup,createRedisChat,setGroupPicture,messageMediaOptions}





// module.exports = {
//     createGroup, getRedisChat, createRedisChat,endChatGroup,messageOptions,setGroupPicture
// }
// {
//     gid: {
//       server: 'g.us',
//       user: '120363144367477878',
//       _serialized: '120363144367477878@g.us'
//     },
//     missingParticipants: {}
//   }
// const chat: Chat = await client.getChatById(groupID);
// console.log(await chat.delete());