const { Client, LocalAuth } = require('whatsapp-web.js');
const { createGroup, getRedisChat, createRedisChat, endChatGroup, messageMediaOptions, setGroupPicture, updateChatOpened } = require("./functions");
const qrcode = require('qrcode');
const { shortcuts, emoteBot, emoteError, shortcutKey } = require("./shortcuts")


import express, { Express, Request, Response } from 'express';
import { Chat, WAState, Contact, Message, MessageMedia, GroupNotification, GroupChat } from 'whatsapp-web.js';
import { ChatOpened, MediaOptions } from './structs';

let html: String = "<h3> Tudo de acordo </h3>";


const client = new Client({
    authStrategy: new LocalAuth({ clientId: "myself" }),
    puppeteer: {
        executablePath: '/usr/bin/google-chrome-stable',
    }
});
client.on('message', async (message: Message) => {
    const chatOpened: ChatOpened = await getRedisChat(message.from);
    const chat = await message.getChat();

    if (!(typeof chatOpened === 'object')) {
        console.log('Chat rejeitado')
        return;
    }
    const isGroup = (chatOpened.type === 'group');
    //SHORTCUTS
    if (isGroup && message.body.startsWith(shortcutKey)) {
        const shortcut = message.body.replace(/[^A-Za-z0-9]/g, '');
        shortcuts(client, chatOpened, message, shortcut);
        return;
    }
    //EXCHANGE of messages
    if (message.from === chatOpened.sender) {
        let msgOptions: MediaOptions = { sendAudioAsVoice: true }

        try {
            if (message.location) throw new Error('Location SENT!');

            //SEND CONTACT
            if ((message.type === 'multi_vcard') || (message.type === 'vcard')) {
                if (typeof message.vCards !== 'object') throw new Error('Error on Vcard!');
                if (message.hasQuotedMsg) {
                    const quoted = await message.getQuotedMessage();
                    msgOptions.quotedMessageId = quoted.id._serialized;
                }
                message.vCards.forEach(async (vcard: string) => {
                    let c = vcard.split("waid=").pop();
                    if (typeof c === 'undefined') throw new Error('Erro envio contato!');
                    c = c.split(":")[0];
                    const contact = await client.getContactById(c + "@c.us")

                    client.sendMessage(chatOpened.receiver, contact, msgOptions);
                });
            } else

                //image, video, audio, sticker   
                if (message.hasMedia) {
                    const attachmentData = await message.downloadMedia();

                    if (message.hasQuotedMsg) {
                        const quoted = await message.getQuotedMessage();
                        msgOptions = messageMediaOptions(attachmentData, quoted.id._serialized)
                    } else msgOptions = messageMediaOptions(attachmentData)
                    client.sendMessage(chatOpened.receiver, attachmentData, msgOptions);
                    //normal chat     
                } else {
                    if (message.hasQuotedMsg) {
                        const quoted = await message.getQuotedMessage();
                        msgOptions.quotedMessageId = quoted.id._serialized;
                    }
                    if (message.body !== '') client.sendMessage(chatOpened.receiver, message.body, msgOptions);
                }
        } catch (e) {
            console.error(e)
            if (isGroup) {
                message.react(emoteError);
            } else if (chatOpened.type === "chat") {
                client.sendMessage(chatOpened.receiver, emoteError + " MENSAGEM DO CLIENTE NAO ENVIADA");
            }
        }
    }

});
client.on('qr', (qr: String) => {
    console.log('QR RECEIVED');
    qrcode.toDataURL(qr, function (err: String, code: String) {
        if (err) return console.log("error");
        html = "<img src='" + code + "' />";
    })
});
client.on('group_join', async (notification: GroupNotification) => {
    const chat = await notification.getChat();
    const chatOpened: ChatOpened = await getRedisChat(notification.chatId);


    if (!chatOpened || !chat ) return;
    //UPDATE group photo
    if (!('hasPhoto' in chatOpened)) setGroupPicture(client, chat, chatOpened);

    if('sentOldMsg' in chatOpened) return;

    const fetchChat: Chat = await client.getChatById(chatOpened.receiver);
    const allMessages: Message[] = await fetchChat.fetchMessages({ limit: 10, fromMe: false });

    const emoteMessage = "👉 "
    let finalMessage: string = emoteBot + " *ULTIMAS MENSAGENS*\n\n";

    try {
        allMessages.forEach(async (oldMsg: Message) => {
            if (oldMsg.id.fromMe || oldMsg.location) return;

            //contacts
            if ((oldMsg.type === 'multi_vcard') || (oldMsg.type === 'vcard')) {
                finalMessage = finalMessage + emoteMessage + '_Contato_\n';

                if (typeof oldMsg.vCards !== 'object') throw new Error('Error on Vcard!');

                oldMsg.vCards.forEach(async (vcard: string) => {
                    let c = vcard.split("waid=").pop();
                    if (typeof c === 'undefined') throw new Error('Erro envio contato!');
                    c = c.split(":")[0];
                    const contact = await client.getContactById(c + "@c.us")
                    client.sendMessage(chatOpened.sender, contact);

                });

            } else
                if (oldMsg.hasMedia) {
                    finalMessage = finalMessage + emoteMessage + ` _${oldMsg.type.toUpperCase()}_\n`;
                    const attachmentData = await oldMsg.downloadMedia();
                    client.sendMessage(chatOpened.sender, attachmentData, messageMediaOptions(attachmentData));
                }
                else {
                    finalMessage = finalMessage + emoteMessage + `"${oldMsg.body}"\n`;
                }
        })

        client.sendMessage(chatOpened.sender, finalMessage);

        chatOpened.sentOldMsg = 'yes'
    } catch (e) {
        console.log(e)
        chatOpened.sentOldMsg = 'no'
        client.sendMessage(chatOpened.sender, emoteError + " MENSAGENS DO CLIENTE NÃO ENVIADAS");
    }
    updateChatOpened(chatOpened);


});
client.on('ready', async () => {
    html = "<h3> Tudo de acordo </h3>";
    // await client.sendMessage('553499679717@c.us', "teste numero");
    // const groups = await client.getChats();
    // groups.forEach(async (chat: Chat) => {
    //     if(chat.isGroup && (chat.name || "").includes('3432187041')){
    //         console.log( chat.name )
    //         // await chat.delete()
    //     }
    // });
    // console.log(groups)
    console.log("ON")
});
client.on('disconnected', async (reason: WAState | "NAVIGATION") => {
    console.log(reason)
});
client.on('group_leave', async (groupNotification: any) => {
    const chatOpened: false | ChatOpened = await getRedisChat(groupNotification.chatId);


    if (chatOpened) {
        // const chat = groupNotification.getChat();
        // await endChatGroup(chatOpened, true);
    }

});

const app = express();
app.use(express.json());
app.get("/", async (req: Request, res: Response) => {

    res.set('Content-Type', 'text/html');
    res.set('Refresh', '5');
    res.send(Buffer.from(html));

});
app.post("/new", async (req: Request, res: Response) => {
    try {
        const clienteNumber: string = req.body.clienteNumber;
        let clienteNome: string = req.body.clienteNome || "";
        const id_bot: string = req.body.id_bot;
        const agenteNumber: string = req.body.agenteNumber// '553499679717'
        const nomeAgente: string = req.body.agenteNome//'Gabriel'


        if (!clienteNumber || !id_bot || !agenteNumber) {
            return res.sendStatus(400);
        }

        if (clienteNome === "") {
            const contact: Contact = await client.getContactById(clienteNumber.replace(/\D/g, '') + '@c.us');
            clienteNome = contact.name || contact.pushname || contact.shortName || contact.verifiedName || "";
        }

        const group: object = await createGroup(client, agenteNumber, clienteNome, clienteNumber);
        //HANDLE group not created
        if ('id' in group) {
            const groupID: string = (group.id as any)._serialized;
            const created: boolean = await createRedisChat(clienteNumber, clienteNome, groupID, id_bot, nomeAgente, agenteNumber);
            if (!created) throw new Error('Group not created! 2');
        } else throw new Error('Group not created! 1');


    } catch (e) {
        console.log(e);
        return res.sendStatus(400);
    }

    res.sendStatus(201);
});

client.initialize();
app.listen(3001, '0.0.0.0');