require('dotenv').config()
const express = require('express')
const sequelize = require('./db')
const models = require('./models/models')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const router = require('./routes/index')
const path = require('path')
const https = require('https')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const cron = require('node-cron')
const { setPointsList } = require('./controllers/CdekController')
const os = require('os')

const PORT = os.platform() === 'linux' ? (process.env.PORT_LINUX || 5001) : (process.env.PORT || 5000)

let options
if (os.platform() === 'linux') {
    options = {
        key: fs.readFileSync('/etc/letsencrypt/live/server.kicksie.ru/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/server.kicksie.ru/cert.pem')
    }
}

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.resolve(__dirname, 'static')))
app.use(fileUpload({}))
app.use('/api', router)
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        message: err.message || 'Произошла ошибка'
    })
})

const server = https.createServer(options, app)

const start = async () => {
    try {
        await sequelize.authenticate()
        await sequelize.sync()

        if (os.platform() === 'linux') {
            server.listen(PORT, () => console.log(`Server started on port ${PORT} (Linux)`))
        } else {
            app.listen(PORT, () => console.log(`Server started on port ${PORT} (Non-Linux)`))
        }

        const course = await models.Constants.findOne({ where: { name: 'course' } })
        if (!course) {
            await models.Constants.create({ name: 'course', value: 15 })
        }

        const standartShip = await models.Constants.findOne({ where: { name: 'standartShip' } })
        if (!standartShip) {
            await models.Constants.create({ name: 'standartShip', value: 2000 })
        }

        const expressShip = await models.Constants.findOne({ where: { name: 'expressShip' } })
        if (!expressShip) {
            await models.Constants.create({ name: 'expressShip', value: 3500 })
        }

        const fee = await models.Constants.findOne({ where: { name: 'fee' } })
        if (!fee) {
            await models.Constants.create({ name: 'fee', value: 1000 })
        }
    } catch (e) {
        console.log(e)
    }
}

start()

// telegram bot
const { Telegraf, Markup } = require('telegraf')
const { getFirstPixelColor, getMidPixelColor } = require('./utils/itemUtilities')

let token

if (os.platform() === 'linux') {
    token = process.env.BOT_TOKEN_LINUX
} else {
    token = process.env.BOT_TOKEN
}

const bot = new Telegraf(token)

const removeEmojis = (str) => {
    return str.replace(/[\p{Emoji_Presentation}\p{Emoji}\p{Extended_Pictographic}]/gu, '');
}

bot.start(async (ctx) => {
    try {
        const code = ctx.payload
        const auth = await models.Auth.findOne({ where: { code } })
        if (auth) {
            const user = await models.User.findOne({ where: { chat_id: ctx.chat.id.toString() } })
            if (user) {
                checkAuth(auth, ctx)
                user.link_type = ctx.message.from.username
                if (!user.client || user.client.length === 0) user.client = removeEmojis(ctx.message.from.first_name.toString())
                await user.save()
            } else {
                await models.User.create({
                    chat_id: ctx.chat.id.toString(),
                    link_type: ctx.message.from.username?.toString(),
                    client: removeEmojis(ctx.message.from.first_name?.toString())
                })
                checkAuth(auth, ctx)
            }
        } else {
            await ctx.reply('Привет! С помощью этого бота вы можете авторизоваться на сайте kicksie.ru и получать уведомления о статусе вашего заказа 🙂')
        }
    } catch (e) {
        console.log(e)
    }
})

const checkAuth = async (auth, ctx) => {
    auth.status = 'authentificated'
    auth.chat_id = ctx.chat.id
    await auth.save()
    ctx.reply(`Вы прошли авторизацию!`)
}

bot.launch()

async function sendMessageToUser(userId, message) {
    try {
        await bot.telegram.sendMessage(userId, message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

module.exports = {
    sendMessageToUser,
}

console.log('Бот запущен')

cron.schedule('0 0 * * *', setPointsList, {
    timezone: "Europe/Moscow"
})