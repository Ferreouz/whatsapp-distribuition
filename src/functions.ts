
import { Client, Chat, GroupChat, MessageMedia,} from 'whatsapp-web.js'
import { Redis } from 'ioredis';
import fetch from 'node-fetch';
import * as webhook from './configs/webhook';
import {ChatOpened, MediaOptions} from './types';
import {redis} from "./configs/redis";
const moment = require('moment-timezone');

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
    
    static async getRedisChat(chatId: string): Promise<false | ChatOpened>{
        const chatOpened = JSON.parse((await redis.get(chatId)));
        if(!chatOpened) return false;
        
        return chatOpened;
    }
    static async setGroupPicture(client: Client, chat: Chat|GroupChat, chatOpened: ChatOpened){
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
    static messageMediaOptions(media: MessageMedia, quoted:string|boolean = false){
 
        const mediaOptions:MediaOptions = {
            sendAudioAsVoice: true,
            // caption: true
        }
    
        if(quoted !== false) mediaOptions.quotedMessageId =  quoted;
        //stickers
        if(media.mimetype.includes('webp')) mediaOptions.sendMediaAsSticker = true;
         
        return mediaOptions;
    }

}