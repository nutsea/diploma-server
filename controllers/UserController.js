const { User, Order } = require('../models/models')
const ApiError = require('../error/apiError')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { Op, or } = require('sequelize')
const { v4: uuidv4 } = require('uuid')

const generateJwt = (id, name, role) => {
    return jwt.sign(
        { id, name, role },
        process.env.SECRET_KEY,
        { expiresIn: '30d' }
    )
}

class UserController {
    async create(req, res, next) {
        try {
            const { name, phone, link, link_type } = req.body
            let formatPhone = phone.replace(/\D+/g, '')
            if (formatPhone[0] === '8') formatPhone = '7' + formatPhone.slice(1)
            const user = await User.create({ client: name, phone: formatPhone, link, link_type })
            return res.json(user)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async checkUser(req, res, next) {
        try {
            const user = await User.findOne({ where: { id: req.user.id } })
            const token = generateJwt(req.user.id, req.user.chat_id, user.role)
            return res.json({ token, user })
        } catch (e) {
            return next(ApiError.forbidden(e))
        }
    }

    async update(req, res, next) {
        try {
            const { name, surname, phone } = req.body
            const user = await User.findOne({ where: { id: req.user.id } })
            if (name) user.name = name
            // else user.name = ''
            if (surname) user.surname = surname
            else user.surname = ''
            if (phone && phone.length === 11) user.phone = phone
            else user.phone = ''
            await user.save()
            return res.json(user)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async updateByAdmin(req, res, next) {
        try {
            const { id, name, surname, phone, link, link_type, role, client } = req.body
            const user = await User.findOne({ where: { id } })
            if (name) user.name = name
            if (surname) user.surname = surname
            if (client) user.client = client
            if (phone && phone.length === 11) user.phone = phone
            if (link) user.link = link
            if (link_type) user.link_type = link_type
            if (role && req.user.id !== id && user.role !== 'main') user.role = role
            await user.save()
            return res.json(user)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async setPassword(req, res, next) {
        try {
            const { password } = req.body
            const user = await User.findOne({ where: { id: req.user.id } })
            const hashPassword = await bcrypt.hash(password, 5)
            user.password = hashPassword
            await user.save()
            return res.json({ user, error: false, message: 'Пароль успешно установлен' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async changePassword(req, res, next) {
        try {
            const { oldPass, newPass } = req.body
            const user = await User.findOne({ where: { id: req.user.id } })
            let comparePassword = bcrypt.compareSync(oldPass, user.password)
            if (comparePassword) {
                const hashPassword = await bcrypt.hash(newPass, 5)
                user.password = hashPassword
                await user.save()
                return res.json({ user, error: false, message: 'Пароль успешно изменен' })
            } else {
                return res.json({ error: true, message: 'Неверный пароль' })
            }
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async login(req, res, next) {
        try {
            const { phone, password } = req.query
            const user = await User.findOne({ where: { phone } })
            if (!user) {
                return next(ApiError.badRequest('Пользователь не найден'))
            }
            let comparePassword = bcrypt.compareSync(password, user.password)
            if (!comparePassword) {
                return next(ApiError.badRequest('Неверный пароль'))
            }
            const token = generateJwt(user.id, user.chat_id, user.role)
            return res.json({ token, user })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async getUser(req, res, next) {
        try {
            const { id } = req.query
            const user = await User.findOne({ where: { id } })
            return res.json(user)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async getAll(req, res, next) {
        try {
            const { search } = req.query
            const users = await User.findAll({
                where: {
                    ...(search && {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${search}%` } },
                            { surname: { [Op.iLike]: `%${search}%` } },
                            { email: { [Op.iLike]: `%${search}%` } },
                            { phone: { [Op.iLike]: `%${search}%` } },
                            { link: { [Op.iLike]: `%${search}%` } },
                            { link_type: { [Op.iLike]: `%${search}%` } },
                        ]
                    })
                },
                order: [['createdAt', 'DESC']]
            })
            return res.json(users)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async getUsers(req, res, next) {
        try {
            const users = await User.findAll()
            return res.json(users)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async updateRoles(req, res, next) {
        try {
            const { idArr, role } = req.body
            const users = await User.findAll({ where: { id: { [Op.in]: idArr } } })
            for (let i of users) {
                if (i.id !== req.user.id) {
                    i.role = role
                    await i.save()
                }
            }
            return res.json(users)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async generateKey(req, res, next) {
        try {
            const { id } = req.body
            const user = await User.findOne({ where: { id } })
            const sync_key = uuidv4()
            user.sync_key = sync_key
            await user.save()
            return res.json(user)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async syncUsers(req, res, next) {
        try {
            const { sync_key } = req.body
            const oldUser = await User.findOne({ where: { sync_key } })
            if (!oldUser) {
                return next(ApiError.badRequest('Пользователь не найден'))
            }
            if (oldUser.role === 'admin' || oldUser.role === 'main' || oldUser.role === 'dev') {
                return next(ApiError.badRequest('Нет разрешения'))
            }
            let newUser = await User.findOne({ where: { id: req.user.id } })
            let orders = await Order.findAll({ where: { client_id: oldUser.id } })
            let orders2 = await Order.findAll({ where: { client_id: newUser.id } })
            for (let i of orders2) {
                orders.push(i)
            }
            if (oldUser.client) newUser.client = oldUser.client
            if (!newUser.phone) newUser.phone = oldUser.phone
            if (oldUser.link) newUser.link = oldUser.link
            if (!newUser.link_type) newUser.link_type = oldUser.link_type
            for (let i of orders) {
                i.client_id = newUser.id
                if (oldUser.client) {
                    i.name = oldUser.client
                }
                // if (oldUser.surname) {
                //     i.name += ' ' + oldUser.surname
                // }
                if (i.name.length === 0) {
                    i.name === newUser.link
                }
                if (!i.social_media) {
                    i.social_media = newUser.link
                }
                if (!i.social_media_type) {
                    i.social_media_type = newUser.link_type
                }
                await i.save()
            }
            await newUser.save()
            await oldUser.destroy()
            return res.json({ newUser })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }
}

module.exports = new UserController()