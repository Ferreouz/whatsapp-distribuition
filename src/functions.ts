const redis  = require( "./configs/redis");
const moment = require('moment-timezone');

import fetch from 'node-fetch';
import {Client, Chat,Contact,GroupChat,MessageMedia} from 'whatsapp-web.js'
import {ChatOpened,MediaOptions} from './structs';


export async function getRedisChat(chatId: string): Promise<false | ChatOpened>{
    const chatOpened = JSON.parse((await redis.get(chatId)));
    if(!chatOpened) return false;
    
    return chatOpened;
}
export async function setGroupPicture(client: Client, chat: Chat|GroupChat, chatOpened: ChatOpened){
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

export function messageMediaOptions(media: MessageMedia, quoted:string|boolean = false){
 
    const mediaOptions:MediaOptions = {
        sendAudioAsVoice: true,
        // caption: true
    }

    if(quoted !== false) mediaOptions.quotedMessageId =  quoted;
    //stickers
    if(media.mimetype.includes('webp')) mediaOptions.sendMediaAsSticker = true;
     
    return mediaOptions;
}
