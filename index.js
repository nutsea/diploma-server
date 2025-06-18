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

const PORT = process.env.PORT || 5000

let options

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
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

start()

// telegram bot
const { Telegraf, Markup } = require('telegraf')

let token

token = process.env.BOT_TOKEN

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
            await ctx.reply('Привет! С помощью этого бота вы можете авторизоваться на сайте и получать уведомления о статусе вашего заказа 🙂')
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