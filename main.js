const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

// Discord Webhook URL
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Endpoint รับ Webhook EasyDonate
app.post('/webhook', async (req, res) => {
    const data = req.body;

    // สร้าง Embed Payload สำหรับ Discord
    const embed = {
        embeds: [
            {
                title: '🎉 มีผู้สนับสนุนใหม่!',
                description: `🤍 ${data.donatorName} บริจาค ${data.amount} บาท 💖\n**ข้อความ:** ${data.donateMessage}`,
                color: 0xffa500,
                fields: [
                    { name: 'ช่องทางชำระเงิน', value: data.channelName, inline: true },
                    { name: 'เลขอ้างอิง', value: data.referenceNo, inline: true },
                ],
                timestamp: data.time,
                footer: { text: 'เข้าร่วมสนับสนุนเพื่อรับสิทธิพิเศษ!' },
            },
        ],
    };

    try {
        // ส่ง Embed ไป Discord Webhook
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

// รัน Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
