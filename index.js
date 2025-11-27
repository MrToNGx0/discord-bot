require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const Parser = require('rss-parser');
const fs = require('fs');

// ----------------------------
// CONFIG (อ่านจาก ENV)
// ----------------------------
const config = {
    donateWebhook: process.env.DISCORD_WEBHOOK_DONATE_URL,
    videoWebhook: process.env.DISCORD_WEBHOOK_NEW_VIDEO_URL,
    youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID,
    leaderboardFile: process.env.LEADERBOARD_FILE || 'donators.json',

    checkInterval: (parseInt(process.env.TIME_INTERVAL, 10) || 30) * 60 * 1000,
    port: process.env.PORT || 3000,
    publicUrl: process.env.PUBLIC_URL || null,

    donateColor: parseInt(process.env.DONATE_COLOR || '0xffe066'),
    videoColor: parseInt(process.env.VIDEO_COLOR || '0x00ff00'),
    liveColor: parseInt(process.env.LIVE_COLOR || '0xff0000'),
    shortColor: parseInt(process.env.SHORT_COLOR || '0x00aaff'),

    leaderboardTitle: process.env.LEADERBOARD_TITLE || '🏆 สุดยอดผู้สนับสนุนประจำสัปดาห์',
    leaderboardFooter: process.env.LEADERBOARD_FOOTER || 'ขอบคุณทุกการสนับสนุน ❤️',

    donateLevels: process.env.DONATE_LEVELS
        ? JSON.parse(process.env.DONATE_LEVELS)
        : [
              { min: 0, max: 50, title: 'ผู้สนับสนุนระดับหมอรำ!', gif: 'https://media.giphy.com/media/HmO7FZjok6mhW/giphy.gif' },
              { min: 51, max: 100, title: 'ผู้สนับสนุนระดับพิเศษ!', gif: 'https://media.giphy.com/media/CIe1iwzke30wU/giphy.gif' },
              { min: 101, max: 300, title: 'ผู้สนับสนุนระดับซุปเปอร์!', gif: 'https://media.giphy.com/media/11nuvoZGgSH3Ne/giphy.gif' },
              { min: 301, max: 999999, title: 'ผู้สนับสนุนระดับตำนาน!', gif: 'https://media.giphy.com/media/rfqZyGGilNv20/giphy.gif' },
          ],
};

// ----------------------------
// Feature Toggle
// ----------------------------
const feature = {
    donation: process.env.FEATURE_DONATION !== 'false',
    leaderboard: process.env.FEATURE_LEADERBOARD !== 'false',
    youtube: process.env.FEATURE_YOUTUBE !== 'false',
    selfPing: process.env.FEATURE_SELF_PING !== 'false',
    autoLeaderboard: process.env.FEATURE_AUTO_LEADERBOARD !== 'false',
};

// ----------------------------
const app = express();
app.use(bodyParser.json());

// ----------------------------
// Leaderboard Functions
// ----------------------------
function loadLeaderboard() {
    try {
        const data = fs.readFileSync(config.leaderboardFile, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveLeaderboard(leaderboard) {
    fs.writeFileSync(config.leaderboardFile, JSON.stringify(leaderboard, null, 2));
}

function addDonator(name, amount, time) {
    if (!feature.leaderboard) return;
    const leaderboard = loadLeaderboard();
    leaderboard.push({
        name,
        amount,
        time: time || new Date().toISOString(),
    });
    saveLeaderboard(leaderboard);
}

function getTopDonators(limit = 5) {
    const leaderboard = loadLeaderboard();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return leaderboard
        .filter((item) => new Date(item.time) >= sevenDaysAgo)
        .reduce((acc, d) => {
            const found = acc.find((x) => x.name === d.name);
            if (found) found.amount += d.amount;
            else acc.push({ name: d.name, amount: d.amount });
            return acc;
        }, [])
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
}

function createLeaderboardEmbed() {
    if (!feature.leaderboard) return null;

    const list = getTopDonators();
    if (list.length === 0) return null;

    return {
        embeds: [
            {
                title: config.leaderboardTitle,
                description: list.map((d, i) => `**#${i + 1}** - __${d.name}__ 💖 ${d.amount} บาท`).join('\n'),
                color: 0xffc107,
                timestamp: new Date().toISOString(),
                footer: { text: config.leaderboardFooter },
            },
        ],
    };
}

async function sendLeaderboardToDiscord() {
    if (!feature.leaderboard || !feature.autoLeaderboard) return;

    const embed = createLeaderboardEmbed();
    if (!embed) return;

    await fetch(config.donateWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed),
    });
}

// ----------------------------
// Donation Level Helper
// ----------------------------
function getDonateLevel(amount) {
    return config.donateLevels.find((l) => amount >= l.min && amount <= l.max) || config.donateLevels[0];
}

// ----------------------------
// Donation Endpoint
// ----------------------------
app.post('/webhook', async (req, res) => {
    if (!feature.donation) return res.status(503).send('Donation feature disabled.');

    const { donatorName, amount, donateMessage, time } = req.body;
    const level = getDonateLevel(amount || 0);

    const embed = {
        embeds: [
            {
                title: level.title,
                description:
                    `✨ __**${donatorName || 'ผู้สนับสนุน'}**__ ✨\n\n` +
                    `ร่วมสนับสนุนจำนวน **${amount || 0} บาท** 💖\n\n` +
                    `💬 ข้อความ:\n> ${donateMessage || '-'}`,
                color: config.donateColor,
                timestamp: time || new Date().toISOString(),
                image: level.gif ? { url: level.gif } : undefined,
            },
        ],
    };

    addDonator(donatorName || 'ผู้สนับสนุน', amount || 0);

    try {
        await fetch(config.donateWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed),
        });

        await sendLeaderboardToDiscord();
        res.send('OK');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error');
    }
});

// ----------------------------
// YouTube Checker
// ----------------------------
const parser = new Parser();
let lastVideoId = null;

async function checkYoutubeFeed() {
    if (!feature.youtube) return;

    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${config.youtubeChannelId}`;
    try {
        const feed = await parser.parseURL(url);
        const latest = feed.items?.[0];
        if (!latest) return;

        const videoId = latest.id.replace('yt:video:', '');
        if (videoId === lastVideoId) return;
        lastVideoId = videoId;

        let color = config.videoColor;
        let type = 'Video';

        if (latest.title.toLowerCase().includes('live')) {
            color = config.liveColor;
            type = 'Live';
        } else if (latest.link.includes('shorts')) {
            color = config.shortColor;
            type = 'Short';
        }

        const thumbnail = latest['media:group']?.['media:thumbnail']?.['$']?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        await fetch(config.videoWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [
                    {
                        title: `📢 มี${type} ใหม่แล้ว!`,
                        description: `[คลิกเพื่อดูคลิป](https://youtu.be/${videoId})\n\n**${latest.title}**`,
                        color,
                        timestamp: latest.pubDate,
                        image: { url: thumbnail },
                    },
                ],
            }),
        });

        console.log('Sent YouTube notify:', latest.title);
    } catch (err) {
        console.error('YouTube Error:', err);
    }
}

if (feature.youtube) setInterval(checkYoutubeFeed, config.checkInterval);

// ----------------------------
// Home route
// ----------------------------
app.get('/', (req, res) => {
    res.send('Discord Bot Running...');
});

// ----------------------------
// Start server
// ----------------------------
app.listen(config.port, () => {
    console.log('Server on port', config.port);

    if (feature.youtube) checkYoutubeFeed();

    if (feature.selfPing && config.publicUrl) {
        setInterval(() => {
            fetch(config.publicUrl).catch(() => {});
        }, 10 * 60 * 1000);
    }
});
