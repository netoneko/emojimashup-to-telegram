const Twitter = require("twitter");
const Jimp = require("jimp");
const replaceColor = require("replace-color");
const { get, map, filter, isString, isObject, slice } = require("lodash");
 
const twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const Telegraf = require("telegraf");
const telegraf = new Telegraf(process.env.BOT_TOKEN);
const stickerSetName = process.env.STICKER_SET || `emojimashupbot_test5_by_emojimashupstickersBot`;

async function getTweets() {
    const tweets = await twitter.get("statuses/user_timeline", {
        screen_name: "emojimashupbot",
    });

    return tweets;
}

function getMedia(tweet) {
    const media = get(tweet, "entities.media[0].media_url");
    const emoji = tweet.text.split(" ")[0];

    if (isString(media)) {
        return {
            emoji,
            media
        }
    }
}

async function getStickerBuffer(url) {
    const transparentImg = await replaceColor({
        image: url,
        colors: {
            type: "hex",
            targetColor: "#FFFFFF",
            replaceColor: "#00000000"
        },
        deltaE: 10,
    });

    transparentImg.autocrop();
    transparentImg.resize(512, 512);

    return transparentImg.getBufferAsync(Jimp.MIME_PNG);
}

async function buildStickerSet(stickers, ctx) {
    const sticker = stickers[0];
    // const pngSticker = filter(media, (m) => endsWith(m.media, ".png"))[0];
    // console.log(pngSticker)

    const imgBuffer = await getStickerBuffer(sticker.media);

    const alreadyExists = await ctx.createNewStickerSet(stickerSetName, "unofficial emoji mashup stickers test", {
        emojis: sticker.emoji,
        png_sticker: {
            source: imgBuffer,
        },
    });

    const allStickers = alreadyExists ? slice(stickers, 1) : alreadyExists;

    ctx.reply(`processing ${allStickers.length} stickers, please wait`);

    await Promise.all(map(allStickers, async (sticker) => {
        return ctx.addStickerToSet(stickerSetName, {
            emojis: sticker.emoji,
            png_sticker: {
                source: await getStickerBuffer(sticker.media),
            },
        });
    }));
    
    await ctx.reply(`https://t.me/addstickers/${stickerSetName}`);
}

function startTelegraf(stickers) {
    telegraf.start((ctx) => ctx.reply("Welcome!"))

    telegraf.help((ctx) => ctx.reply("Send me a sticker"))

    telegraf.on("sticker", (ctx) => ctx.reply("👍"))

    let lock = false;
    telegraf.hears("stickers", async (ctx) => {
        if (lock) {
            await ctx.reply(`rebuilding already!`);
            await ctx.reply(`https://t.me/addstickers/${stickerSetName}`);
            return;
        }

        lock = true;
        await ctx.reply(`rebuilding the sticker set...`);
        await buildStickerSet(stickers, ctx);
        lock = false;
    })

    telegraf.launch();
}

(async () => {
    const tweets = await getTweets();
    const media = filter(map(tweets, getMedia), isObject);

    console.log(media);

    console.log(telegraf);

    startTelegraf(media);
})();
