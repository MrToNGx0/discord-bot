require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const Parser = require('rss-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const DISCORD_WEBHOOK_DONATE_URL = process.env.DISCORD_WEBHOOK_DONATE_URL;
const DISCORD_WEBHOOK_NEW_VIDEO_URL = process.env.DISCORD_WEBHOOK_NEW_VIDEO_URL;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const CHECK_INTERVAL = (parseInt(process.env.TIME_INTERVAL, 10) || 30) * 60 * 1000;
const LEADERBOARD_FILE = 'donators.json';

// ----------------------------
// ฟังก์ชัน Leaderboard
// ----------------------------
function loadLeaderboard() {
    try {
        const data = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveLeaderboard(leaderboard) {
    console.log(leaderboard);
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
}

// ----------------------------
// ฟังก์ชัน Leaderboard แบบเก็บเวลา
// ----------------------------
function addDonator(name, amount, time) {
    const leaderboard = loadLeaderboard();
    leaderboard.push({
        name,
        amount,
        time: time || new Date().toISOString(), // บันทึกเวลา donation
    });
    saveLeaderboard(leaderboard);
}

function getTopDonators(limit = 5) {
    const leaderboard = loadLeaderboard();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const filtered = leaderboard
        .filter((d) => new Date(d.time) >= sevenDaysAgo)
        .reduce((acc, d) => {
            const idx = acc.findIndex((x) => x.name === d.name);
            if (idx >= 0) {
                acc[idx].amount += d.amount;
            } else {
                acc.push({ name: d.name, amount: d.amount });
            }
            return acc;
        }, [])
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

    return filtered;
}

function createLeaderboardEmbed() {
    const topDonators = getTopDonators();
    if (topDonators.length === 0) return null;

    const description = topDonators.map((d, i) => `**#${i + 1}** - __${d.name}__ 💖 ${d.amount} บาท`).join('\n');

    return {
        embeds: [
            {
                title: '🏆 สุดยอดคนรักเดียวประจำสัปดาห์',
                description,
                color: 0xffc107,
                timestamp: new Date().toISOString(),
                footer: { text: 'ขอบคุณทุกการสนับสนุน ❤️' },
            },
        ],
    };
}

async function sendLeaderboardToDiscord() {
    const embed = createLeaderboardEmbed();
    if (!embed) return;
    try {
        const res = await fetch(DISCORD_WEBHOOK_DONATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed),
        });
        if (!res.ok) throw new Error(`Discord webhook error: ${res.statusText}`);
        console.log('ส่ง Leaderboard ไป Discord เรียบร้อย');
    } catch (err) {
        console.error(err);
    }
}

// ----------------------------
// ระบบแจ้งเตือนผู้สนับสนุน
// ----------------------------
app.post('/webhook', async (req, res) => {
    const data = req.body;

    function getGifByAmount(amount) {
        if (amount >= 0 && amount <= 50)
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDg5cjh2bnBweHRta2Y5M2I0ZGFrbDRvbnJibHdqbHZneDFlMmM3ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/HmO7FZjok6mhW/giphy.gif';
        else if (amount >= 51 && amount <= 100)
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDg5cjh2bnBweHRta2Y5M2I0ZGFrbDRvbnJibHdqbHZneDFlMmM3ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/CIe1iwzke30wU/giphy.gif';
        else if (amount >= 101 && amount <= 300)
            return 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajI4M2JhYnc2eWxnYW9oY2c0ZGgwOHp4cDV0aHZrY3Ewa2xmZDZqbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/11nuvoZGgSH3Ne/giphy.gif';
        else if (amount >= 301)
            return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanV5bzEzdTM5bHI5MjZtenBqbDdsMncyN3Mwb3JodTNtbWIzdG90ZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/rfqZyGGilNv20/giphy.gif';
        else return null;
    }

    function getTitleByAmount(amount) {
        if (amount >= 0 && amount <= 50) return 'ผู้สนับสนุนระดับหมอรำ!';
        else if (amount >= 51 && amount <= 100) return 'ผู้สนับสนุนระดับพิเศษ!';
        else if (amount >= 101 && amount <= 300) return 'ผู้สนับสนุนระดับซุปเปอร์!';
        else if (amount >= 301) return 'ผู้สนับสนุนระดับตำนาน!';
        else return 'ผู้สนับสนุน';
    }

    const gifUrl = getGifByAmount(data.amount || 0);
    const title = getTitleByAmount(data.amount || 0);

    const embed = {
        embeds: [
            {
                title: title,
                description:
                    `✨ __**${data.donatorName || 'ผู้สนับสนุน'}**__ ✨\n\n` +
                    `ร่วมสนับสนุนจำนวน **${data.amount || 0} บาท** 💖\n\n` +
                    `💬 **ข้อความจากผู้สนับสนุน:**\n> ${data.donateMessage || '-'}`,
                color: 0xffe066,
                timestamp: data.time || new Date().toISOString(),
                footer: { text: 'สนับสนุนเพิ่มเติมได้ที่: https://ezdn.app/mrtongx0' },
                image: gifUrl ? { url: gifUrl } : undefined,
            },
        ],
    };

    addDonator(data.donatorName || 'ผู้สนับสนุน', data.amount || 0);

    try {
        await fetch(DISCORD_WEBHOOK_DONATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed),
        });
        await sendLeaderboardToDiscord();

        res.status(200).send('Embed sent to Discord!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error sending embed to Discord');
    }
});

// ----------------------------
// ระบบแจ้งเตือนคลิป YouTube
// ----------------------------
const parser = new Parser();
let lastVideoId = null;

async function checkYoutubeFeed() {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
    try {
        const feed = await parser.parseURL(feedUrl);
        if (!feed.items || feed.items.length === 0) return;

        const latest = feed.items[0];
        const videoId = latest.id.replace('yt:video:', '');
        if (videoId === lastVideoId) return;
        lastVideoId = videoId;

        let type = 'Video';
        let color = 0x00ff00;
        if (latest.title.toLowerCase().includes('live')) {
            type = 'Live';
            color = 0xff0000;
        } else if (latest.link.includes('shorts')) {
            type = 'Short';
            color = 0x00aaff;
        }

        const thumbnail = latest['media:group']?.['media:thumbnail']?.['$']?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        const embed = {
            embeds: [
                {
                    title: `📢 ${type} ใหม่จากช่อง YouTube!`,
                    description: `[คลิกเพื่อชมคลิป!](https://www.youtube.com/watch?v=${videoId})\n\n**${latest.title}**`,
                    color: color,
                    timestamp: latest.pubDate,
                    image: { url: thumbnail },
                    footer: {
                        text: 'ติดตามเพิ่มเติมได้ที่ YouTube ของเรา',
                        icon_url: 'https://www.youtube.com/s/desktop/6d62f0d2/img/favicon_144.png',
                    },
                },
            ],
        };

        await fetch(DISCORD_WEBHOOK_NEW_VIDEO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed),
        });

        console.log(`ส่งแจ้งเตือนคลิปใหม่: ${latest.title}`);
    } catch (err) {
        console.error('Error checking YouTube RSS:', err);
    }
}

setInterval(checkYoutubeFeed, CHECK_INTERVAL);

// ----------------------------
// Express server สำหรับ Render
// ----------------------------
app.get('/', (req, res) => {
    res.send('Discord Bot running with donations, leaderboard & YouTube notifications!');
});

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    checkYoutubeFeed();

    setInterval(() => {
        if (PUBLIC_URL) {
            fetch(PUBLIC_URL)
                .then(() => console.log('Self-ping keep-alive'))
                .catch(() => console.error('Self-ping failed'));
        }
    }, 10 * 60 * 1000);
});
