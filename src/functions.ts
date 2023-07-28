const redis  = require( "./configs/redis");
const moment = require('moment-timezone');

// import * as webhook from './configs/webhook';
import fetch from 'node-fetch';
import {Client, Chat,Contact,GroupChat,MessageMedia} from 'whatsapp-web.js'
import {ChatOpened,MediaOptions} from './structs';



// async function endChatGroup(chatOpened: ChatOpened, chat: GroupChat ,closeBot = false ): Promise<boolean>{
//     try {
        
//         if(closeBot) closeBotConversa(chatOpened.cliente.id_bot);

//         exportChat(chatOpened);
//         redis.del(chatOpened.sender);
//         redis.del(chatOpened.receiver);
           
//         await chat.removeParticipants([chatOpened.agente.numero]);
        
//     } catch (error) {
//         console.log(error)
//     }
//     if('setSubject' in chat){
//         try{
//             chat.setSubject(BACKUPGROUPNAME);
//             chat.archive(); 
//             chat.revokeInvite();
//         }
//             catch(e){}
//     } 
//     return true;
    
// }
// async function exportChat(chatOpenedGroup: ChatOpened): Promise<void> {
//     chatOpenedGroup.metaData.timeEnded = moment().tz("America/Sao_Paulo").format('YYYY-MM-DD HH:mm:ss') 
//     const r = await fetch(
//         webhook.dump.url,
//         { 
//             method: 'POST',
//             body: JSON.stringify(chatOpenedGroup), 
//             headers: {'Content-Type': 'application/json', "API-KEY":webhook.dump.key} 
//         }
       
//     );
//     // console.log(r);
// }
// async function closeBotConversa(id_bot: string): Promise<void> {
//     const r = await fetch(
//         `https://backend.botconversa.com.br/api/v1/webhook/subscriber/${id_bot}/send_flow/`,
//         { 
//             method: 'POST',
//             body: JSON.stringify({ flow: Number(webhook.close.flowID) }), 
//             headers: {'Content-Type': 'application/json', "API-KEY":webhook.close.key} 
//         }
       
//     );
//     // console.log(r);
// }

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
// export async function updateChatOpened(chatOpened: ChatOpened): Promise<void>{
//     await redis.set(chatOpened.sender, JSON.stringify(chatOpened))
// }
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
// export async function notifyAdmin(error: string):Promise<void> {
//     const r = await fetch(
//         webhook.error.url,
//         { 
//             method: 'POST',
//             body: JSON.stringify({message: error}), 
//             headers: {'Content-Type': 'application/json', "API-KEY":webhook.dump.key} 
//         }
       
//     );
// } 

export {getRedisChat,setGroupPicture,messageMediaOptions}





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