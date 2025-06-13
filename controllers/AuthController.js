const { Auth, User } = require('../models/models')
const ApiError = require('../error/apiError')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')

const generateJwt = (id, name, role) => {
    return jwt.sign(
        { id, name, role },
        process.env.SECRET_KEY,
        { expiresIn: '30d' }
    )
}

class AuthController {
    async create(req, res, next) {
        try {
            const { code } = req.body
            const auth = await Auth.create({ code })
            return res.json(auth)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async createForBrowser(req, res, next) {
        try {
            const authCode = uuidv4()
            const auth = await Auth.create({ code: authCode })
            return res.json(auth)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async authUser(req, res, next) {
        try {
            const { code } = req.query
            const auth = await Auth.findOne({ where: { code: code } })
            if (auth) {
                const user = await User.findOne({ where: { phone: auth.phone } })
                const token = generateJwt(user.id, user.chat_id, user.role)
                await auth.destroy()
                return res.json({ token, user })
            } else {
                console.log('Error: Auth not found')
                return next(ApiError.badRequest())
            }
        } catch (e) {
            // console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async authUserBrowser(req, res, next) {
        try {
            const { code } = req.query
            const auth = await Auth.findOne({ where: { code: code } })
            console.log(auth)
            if (auth && auth.status === 'authentificated') {
                const user = await User.findOne({ where: { chat_id: auth.chat_id } })
                const token = generateJwt(user.id, user.chat_id, user.role)
                return res.json({ token, user })
            } else {
                // console.log('Error: Auth not found')
                return next(ApiError.badRequest())
            }
        } catch (e) {
            // console.log(e)
            return next(ApiError.badRequest(e))
        }
    }
}

module.exports = new AuthController()