require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.post('/webhook', async (req, res) => {
    const data = req.body;

    function getGifByAmount(amount) {
        if (amount >= 0 && amount <= 50) {
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDg5cjh2bnBweHRta2Y5M2I0ZGFrbDRvbnJibHdqbHZneDFlMmM3ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/HmO7FZjok6mhW/giphy.gif';
        } else if (amount >= 51 && amount <= 100) {
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDg5cjh2bnBweHRta2Y5M2I0ZGFrbDRvbnJibHdqbHZneDFlMmM3ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/CIe1iwzke30wU/giphy.gif';
        } else if (amount >= 101 && amount <= 300) {
            return 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajI4M2JhYnc2eWxnYW9oY2c0ZGgwOHp4cDV0aHZrY3Ewa2xmZDZqbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/11nuvoZGgSH3Ne/giphy.gif';
        } else if (amount >= 301) {
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanV5bzEzdTM5bHI5MjZtenBqbDdsMncyN3Mwb3JodTNtbWIzdG90ZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/rfqZyGGilNv20/giphy.gif';
        } else {
            return null;
        }
    }

    function getTitleByAmount(amount) {
        if (amount >= 0 && amount <= 50) {
            return 'ผู้สนับสนุนระดับหมอรำ!';
        } else if (amount >= 51 && amount <= 100) {
            return 'ผู้สนับสนุนระดับพิเศษ!';
        } else if (amount >= 101 && amount <= 300) {
            return 'ผู้สนับสนุนระดับซุปเปอร์!';
        } else if (amount >= 301) {
            return 'ผู้สนับสนุนระดับตำนาน!';
        } else {
            return 'ผู้สนับสนุน';
        }
    }

    const gifUrl = getGifByAmount(data.amount || 0);
    const title = getTitleByAmount(data.amount || 0);

    const embed = {
        embeds: [
            {
                title: title,
                description:
                    `✨ __**${data.donatorName || 'ผู้สนับสนุน'}**__✨\n\n` +
                    `ร่วมสนับสนุนจำนวน **${data.amount || 0} บาท** 💖\n\n` +
                    `💬 **ข้อความจากผู้สนับสนุน:**\n> ${data.donateMessage || '-'}`,
                color: 0xffe066,
                timestamp: data.time || new Date().toISOString(),
                footer: {
                    text: 'สนับสนุนเพิ่มเติมได้ที่: https://ezdn.app/mrtongx0',
                },
                image: gifUrl ? { url: gifUrl } : undefined,
            },
        ],
    };

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed),
        });

        if (!response.ok) throw new Error(`Discord webhook error: ${response.statusText}`);

        res.status(200).send('Embed sent to Discord!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error sending embed to Discord');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
