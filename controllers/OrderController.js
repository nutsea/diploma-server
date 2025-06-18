const { Order, OrderItem, Photo, OrderPhoto, Item, User } = require('../models/models')
const ApiError = require('../error/apiError')
const { Op, or } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')
const { Telegraf } = require('telegraf')
const os = require('os')

const token = process.env.BOT_TOKEN

const bot = new Telegraf(token)

const messages = {
    0: '♻️ Ваш заказ обрабатывается\n\n*Номер заказа - ',
    1: '👨🏻‍💻 Ваш заказ принят в работу!\n\nСкоро мы выкупим ваш заказ 🫡',
    2: '🧾 Ваш заказ выкуплен и уже едет на склад в Китае!\n\nОзнакомиться с отчётом о выкупе вы можете на сайте в разделе "Мои заказы" 😌',
    4: '📸 Ваш заказ прибыл на склад в Китае!\n\nВ течение пары дней мы упакуем и отправим заказ в Россию, а пока вы можете посмотреть фото отчёт на сайте в разделе "Мои заказы", всё остальное сделаем мы 😉',
    6: '🚀 Ваш заказ выехал со склада в Китае!',
    7: '📦 Ваш заказ прибыл в Москву\n\nНа данный момент заказ проходит сортировку и совсем скоро поедет к вам! 🙃',
    8: '🚛 Ваш заказ передан в CDEK\n\nТрек номер для отслеживания уже доступен на сайте в разделе "Мои заказы"',
    9: '💜 Спасибо за заказ!\n\nВидим, что Вы его забрали и надеемся, что Вам всё понравилось!',
    start10: '❗️Ваш заказ ',
    end10: ' требует уточнений.\n\nНапишите, пожалуйста, нашему [менеджеру](http://t.me/nutsea) для уточнений деталей заказа.',
    notReview: '💜 Спасибо за заказ!\n\nВидим, что Вы его забрали и надеемся, что Вам всё понравилось!',
    startContinue: '\nСвяжитесь с нашим менеджером [@nutsea](https://t.me/nutsea) для уточнения деталей заказа 🙂'
}

const scheduleMessage = (chat_id, message) => {
    const now = new Date()
    const currentHour = now.getHours()

    const delayUntilMorning = new Date()
    delayUntilMorning.setHours(10, 0, 0, 0)
    if (now.getHours() >= 22) {
        delayUntilMorning.setDate(delayUntilMorning.getDate() + 1)
    }

    if (currentHour >= 22 || currentHour < 10) {
        const tomorrowMorning = new Date()
        tomorrowMorning.setHours(10, 0, 0, 0)
        if (currentHour >= 22) {
            tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
        }

        const sendAt = Math.floor(tomorrowMorning.getTime() / 1000)

        bot.telegram.sendMessage(chat_id, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            disable_notification: false, // если нужно, можно выключить звук
            schedule_date: sendAt
        })
    } else {
        bot.telegram.sendMessage(chat_id, message, { parse_mode: 'Markdown', disable_web_page_preview: true })
    }
}

class OrderController {
    async create(req, res, next) {
        try {
            const { name, social_media, checked_price, recipient, phone, address, ship_type, delivery_cost, is_split, course, fee, cost, discount_cost, discount, promo_code, items } = req.body
            const first_pay = is_split ? Math.ceil(cost / 2) : cost
            const second_pay = is_split ? Math.ceil(cost / 2) : 0
            const client = await User.findOne({ where: { id: req.user.id } })
            let newName = ''
            if (client.client !== null) {
                newName = client.client
            }
            if (newName.length === 0) {
                newName = recipient.split(' ', 2)[1]
            }
            let deliverySum = 0
            for (let i of items) {
                deliverySum += i.delivery_cost
            }
            const order = await Order.create({ name: newName, social_media: client.link, social_media_type: client.link_type, checked_price, recipient, phone, address, ship_type, delivery_cost: deliverySum, is_split, first_pay, second_pay, course, fee: fee * items.length, cost, discount_cost, discount, promo_code, client_id: req.user.id })
            for (let i of items) {
                await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                    await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                        item.orders = item.orders + 1
                        await item.save()
                        await OrderItem.create({
                            item_uid: i.item_uid,
                            name: i.name,
                            img: data.img,
                            category: item.category,
                            model: item.model ? item.model : '',
                            size: i.size,
                            ship: i.ship,
                            cny_cost: i.cny_cost,
                            rub_cost: Math.ceil(i.rub_cost),
                            order_id: order.id,
                            fee: i.fee,
                            delivery_cost: i.delivery_cost
                        })
                    })
                })
            }
            let orderNum = 'R' + order.id + '*'
            scheduleMessage(client.chat_id, messages[0] + orderNum + messages.startContinue)
            try {
                const channelMsg = 'Новый заказ *' + orderNum
                bot.telegram.sendMessage('-1002321184898', channelMsg, { parse_mode: 'Markdown', disable_web_page_preview: true })
            } catch (e) {
                console.log(e)
            }
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createCommon(req, res, next) {
        try {
            const { slow_shoes, slow_clothes, fast_shoes, fast_clothes, name, social_media, checked_price, recipient, phone, address, ship_type, is_split, course, fee, promo_code, discount } = req.body
            const client = await User.findOne({ where: { id: req.user.id } })
            let newName = ''
            if (client.client !== null) {
                newName = client.client
            }
            if (newName.length === 0) {
                newName = recipient.split(' ', 2)[1]
            }

            let first_pay, second_pay
            let discount_split = 0
            let order_nums = []
            if (slow_shoes && slow_shoes.items.length > 0) discount_split++
            if (slow_clothes && slow_clothes.items.length > 0) discount_split++
            if (fast_shoes && fast_shoes.items.length > 0) discount_split++
            if (fast_clothes && fast_clothes.items.length > 0) discount_split++

            if (slow_shoes && slow_shoes.items.length > 0) {
                let deliverySum = 0
                for (let i of slow_shoes.items) {
                    deliverySum += i.delivery_cost
                }
                first_pay = is_split ? Math.ceil(slow_shoes.cost / 2) : slow_shoes.cost
                second_pay = is_split ? Math.ceil(slow_shoes.cost / 2) : 0
                let discount_cost = slow_shoes.cost - (discount / discount_split)
                const order = await Order.create({ name: newName, social_media: client.link, social_media_type: client.link_type, checked_price, recipient, phone, address, ship_type, delivery_cost: deliverySum, is_split, first_pay, second_pay, course, fee: fee * slow_shoes.items.length, cost: slow_shoes.cost, discount_cost, discount: discount / discount_split, promo_code, client_id: req.user.id })
                order_nums.push(order.id)
                for (let i of slow_shoes.items) {
                    await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                        await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                            item.orders = item.orders + 1
                            await item.save()
                            await OrderItem.create({
                                item_uid: i.item_uid,
                                name: i.name,
                                img: data.img,
                                category: item.category,
                                model: item.model ? item.model : '',
                                size: i.size,
                                ship: i.ship,
                                cny_cost: i.cny_cost,
                                rub_cost: Math.ceil(i.rub_cost),
                                order_id: order.id,
                                fee: i.fee,
                                delivery_cost: i.delivery_cost
                            })
                        })
                    })
                }
            }

            if (slow_clothes && slow_clothes.items.length > 0) {
                let deliverySum = 0
                for (let i of slow_clothes.items) {
                    deliverySum += i.delivery_cost
                }
                first_pay = is_split ? Math.ceil(slow_clothes.cost / 2) : slow_clothes.cost
                second_pay = is_split ? Math.ceil(slow_clothes.cost / 2) : 0
                let discount_cost = slow_clothes.cost - (discount / discount_split)
                const order = await Order.create({ name: newName, social_media: client.link, social_media_type: client.link_type, checked_price, recipient, phone, address, ship_type, delivery_cost: deliverySum, is_split, first_pay, second_pay, course, fee: fee * slow_clothes.items.length, cost: slow_clothes.cost, discount_cost, discount: discount / discount_split, promo_code, client_id: req.user.id })
                order_nums.push(order.id)
                for (let i of slow_clothes.items) {
                    await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                        await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                            item.orders = item.orders + 1
                            await item.save()
                            await OrderItem.create({
                                item_uid: i.item_uid,
                                name: i.name,
                                img: data.img,
                                category: item.category,
                                model: item.model ? item.model : '',
                                size: i.size,
                                ship: i.ship,
                                cny_cost: i.cny_cost,
                                rub_cost: Math.ceil(i.rub_cost),
                                order_id: order.id,
                                fee: i.fee,
                                delivery_cost: i.delivery_cost
                            })
                        })
                    })
                }
            }

            if (fast_shoes && fast_shoes.items.length > 0) {
                let deliverySum = 0
                for (let i of fast_shoes.items) {
                    deliverySum += i.delivery_cost
                }
                first_pay = is_split ? Math.ceil(fast_shoes.cost / 2) : fast_shoes.cost
                second_pay = is_split ? Math.ceil(fast_shoes.cost / 2) : 0
                let discount_cost = fast_shoes.cost - (discount / discount_split)
                const order = await Order.create({ name: newName, social_media: client.link, social_media_type: client.link_type, checked_price, recipient, phone, address, ship_type, delivery_cost: deliverySum, is_split, first_pay, second_pay, course, fee: fee * fast_shoes.items.length, cost: fast_shoes.cost, discount_cost, discount: discount / discount_split, promo_code, client_id: req.user.id })
                order_nums.push(order.id)
                for (let i of fast_shoes.items) {
                    await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                        await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                            item.orders = item.orders + 1
                            await item.save()
                            await OrderItem.create({
                                item_uid: i.item_uid,
                                name: i.name,
                                img: data.img,
                                category: item.category,
                                model: item.model ? item.model : '',
                                size: i.size,
                                ship: i.ship,
                                cny_cost: i.cny_cost,
                                rub_cost: Math.ceil(i.rub_cost),
                                order_id: order.id,
                                fee: i.fee,
                                delivery_cost: i.delivery_cost
                            })
                        })
                    })
                }
            }

            if (fast_clothes && fast_clothes.items.length > 0) {
                let deliverySum = 0
                for (let i of fast_clothes.items) {
                    deliverySum += i.delivery_cost
                }
                first_pay = is_split ? Math.ceil(fast_clothes.cost / 2) : fast_clothes.cost
                second_pay = is_split ? Math.ceil(fast_clothes.cost / 2) : 0
                let discount_cost = fast_clothes.cost - (discount / discount_split)
                const order = await Order.create({ name: newName, social_media: client.link, social_media_type: client.link_type, checked_price, recipient, phone, address, ship_type, delivery_cost: deliverySum, is_split, first_pay, second_pay, course, fee: fee * fast_clothes.items.length, cost: fast_clothes.cost, discount_cost, discount: discount / discount_split, promo_code, client_id: req.user.id })
                order_nums.push(order.id)
                for (let i of fast_clothes.items) {
                    await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                        await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                            item.orders = item.orders + 1
                            await item.save()
                            await OrderItem.create({
                                item_uid: i.item_uid,
                                name: i.name,
                                img: data.img,
                                category: item.category,
                                model: item.model ? item.model : '',
                                size: i.size,
                                ship: i.ship,
                                cny_cost: i.cny_cost,
                                rub_cost: Math.ceil(i.rub_cost),
                                order_id: order.id,
                                fee: i.fee,
                                delivery_cost: i.delivery_cost
                            })
                        })
                    })
                }
            }

            let orderNum = 'R' + order_nums.join('-') + '*'
            scheduleMessage(client.chat_id, messages[0] + orderNum + messages.startContinue)
            try {
                const channelMsg = 'Новый заказ *' + orderNum
                bot.telegram.sendMessage('-1002321184898', channelMsg, { parse_mode: 'Markdown', disable_web_page_preview: true })
            } catch (e) {
                console.log(e)
            }
            return res.json(order_nums)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createByAdmin(req, res, next) {
        try {
            const { name, surname, social_media, recipient, phone, address, ship_type, is_split, first_pay, second_pay, first_paid, second_paid, paid, course, cost, discount, promo_code, comment, can_review, status, items, social_media_type, client_id } = req.body
            let fee = items.map(i => i.fee).reduce((a, b) => a + b)
            let delivery_cost = items.map(i => i.delivery_cost).reduce((a, b) => a + b)
            let order
            let formatPhone = phone.replace(/\D+/g, '')
            if (formatPhone[0] === '8') formatPhone = '7' + formatPhone.slice(1)
            order = await Order.create({
                name,
                surname,
                social_media,
                recipient,
                phone: formatPhone,
                address, ship_type,
                delivery_cost: Number(delivery_cost),
                is_split, first_pay: Number(first_pay),
                second_pay: Number(second_pay),
                first_paid, second_paid,
                paid: paid ? paid : 0,
                course,
                fee: Number(fee),
                cost: Number(cost),
                discount_cost: Number(cost) - Number(discount),
                discount: Number(discount),
                promo_code,
                comment,
                can_review,
                status,
                social_media_type,
                client_id,
                from: 'crm'
            })
            for (let i of items) {
                await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                    await OrderItem.create({
                        item_uid: i.item_uid,
                        name: i.name,
                        img: i.img,
                        category: item.category,
                        size: i.size,
                        ship: i.ship,
                        cny_cost: Number(i.cny_cost),
                        rub_cost: Math.ceil(Number(i.cny_cost) * course),
                        order_id: order.id,
                        fee: Number(i.fee),
                        delivery_cost: Number(i.delivery_cost)
                    })
                })
            }
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getIn(req, res, next) {
        try {
            const { search } = req.query
            const orders = await Order.findAll({
                where: {
                    status: 0,
                    ...(search && {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${search}%` } },
                            { recipient: { [Op.iLike]: `%${search}%` } },
                            { phone: { [Op.iLike]: `%${search}%` } },
                            { address: { [Op.iLike]: `%${search}%` } },
                        ]
                    })
                },
                order: [['createdAt', 'DESC']]
            })
            for (let i of orders) {
                await OrderItem.findAll({ where: { order_id: i.id } }).then(data => {
                    if (data.length > 0) {
                        i.dataValues.items = data
                        i.dataValues.ship = data[0].ship
                    }
                })
            }
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getAll(req, res, next) {
        try {
            const { search, statuses } = req.query
            const orders = await Order.findAll({
                where: {
                    status: { [Op.in]: statuses },
                    ...(search && {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${search}%` } },
                            { social_media: { [Op.iLike]: `%${search}%` } },
                            { recipient: { [Op.iLike]: `%${search}%` } },
                            { phone: { [Op.iLike]: `%${search}%` } },
                            { address: { [Op.iLike]: `%${search}%` } },
                            { ship_type: { [Op.iLike]: `%${search}%` } },
                            { promo_code: { [Op.iLike]: `%${search}%` } }
                        ]
                    })
                },
                order: [['createdAt', 'DESC']]
            })
            for (let i of orders) {
                await OrderItem.findAll({ where: { order_id: i.id } }).then(data => {
                    i.dataValues.items = data
                    i.dataValues.ship = data[0].ship
                })
            }
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOne(req, res, next) {
        try {
            const { id } = req.query
            const order = await Order.findOne({ where: { id } })
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getClientOrders(req, res, next) {
        try {
            const orders = await Order.findAll({ where: { client_id: req.user.id } })
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrdersByClientId(req, res, next) {
        try {
            const { id } = req.query
            const order = await Order.findAll({ where: { client_id: id } })
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getUserOrders(req, res, next) {
        try {
            const { id } = req.query
            const orders = await Order.findAll({ where: { client_id: id } })
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderItems(req, res, next) {
        try {
            const { id } = req.query
            const items = await OrderItem.findAll({ where: { order_id: id } })
            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderReport(req, res, next) {
        try {
            const { id, type } = req.query
            const report = await OrderPhoto.findAll({ where: { order_id: id, type } })
            return res.json(report)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderPhotos(req, res, next) {
        try {
            const { id } = req.query
            const report = await OrderPhoto.findAll({ where: { order_id: id } })
            return res.json(report)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { id, status } = req.body
            const order = await Order.findOne({ where: { id } })

            const orderItems = await OrderItem.findAll({ where: { order_id: id } })
            const orderPhotosBuy = await OrderPhoto.findAll({ where: { order_id: id, type: 'buy' } })
            const orderPhotosStock = await OrderPhoto.findAll({ where: { order_id: id, type: 'stock' } })

            let allow = true
            switch (status) {
                case 1:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 2:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 2) allow = false
                        if (!i.order_num) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 3:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 3) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 4:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 5:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 6:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 7:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 8:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 9:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 10:
                    if (order.status !== status && client && client.chat_id) {
                        let orderNum
                        if (order.paid > 0) {
                            orderNum = 'WP' + order.id
                        } else {
                            orderNum = 'R' + order.id
                        }
                        scheduleMessage(client.chat_id, messages.start10 + orderNum + messages.end10)
                    }
                    order.status = status
                    break

                case 11:
                    order.status = status
                    break

                default:
                    break
            }
            await order.save()
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateOrderItems(req, res, next) {
        try {
            const { idArr, statuses, orderNums, trackNums, pricesCNY, pricesRUB, fees, deliveries } = req.body
            for (let i = 0; i < idArr.length; i++) {
                const item = await OrderItem.findOne({ where: { id: idArr[i] } })
                item.status = statuses[i] ? statuses[i] : item.status
                item.order_num = orderNums[i] ? orderNums[i] : item.order_num
                item.track = trackNums[i] ? trackNums[i] : item.track
                item.cny_cost = pricesCNY[i] ? pricesCNY[i] : item.cny_cost
                item.rub_cost = pricesRUB[i] ? pricesRUB[i] : item.rub_cost
                item.rub_cost = Math.ceil(item.rub_cost)
                item.fee = fees && fees[i] ? fees[i] : item.fee
                item.fee = Math.ceil(item.fee)
                item.delivery_cost = deliveries && deliveries[i] ? deliveries[i] : item.delivery_cost
                item.delivery_cost = Math.ceil(item.delivery_cost)
                await item.save()
            }
            return res.json({ message: 'Позиции обновлены' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateOrder(req, res, next) {
        try {
            const { id, status, recipient, phone, ship_type, comment, address, track, cdekTrack, dimensions, cargo_cost, sdek_cost, first_pay, second_pay, firstPaid, secondPaid, paid, canReview, fee, cost, social_media_type, social_media, delivery_cost } = req.body
            const order = await Order.findOne({ where: { id } })
            order.recipient = recipient ? recipient : order.recipient
            order.phone = phone ? phone : order.phone
            order.ship_type = ship_type ? ship_type : order.ship_type
            order.comment = comment ? comment : order.comment
            order.address = address ? address : order.address
            order.track = track ? track : order.track
            order.sdek_track = cdekTrack ? cdekTrack : order.sdek_track
            order.dimensions = dimensions ? dimensions : order.dimensions
            order.cargo_cost = cargo_cost ? cargo_cost : order.cargo_cost
            order.sdek_cost = sdek_cost ? sdek_cost : order.sdek_cost
            order.first_pay = first_pay ? first_pay : order.first_pay
            order.second_pay = second_pay ? second_pay : order.second_pay
            order.first_paid = firstPaid !== undefined ? firstPaid : order.first_paid
            order.second_paid = secondPaid !== undefined ? secondPaid : order.second_paid
            order.paid = paid ? paid : order.paid
            order.can_review = canReview !== undefined ? canReview : order.can_review
            order.fee = fee ? fee : order.fee
            order.cost = cost ? cost : order.cost
            order.discount_cost = cost ? cost - order.discount : order.discount_cost
            order.social_media_type = social_media_type ? social_media_type : order.social_media_type
            order.social_media = social_media ? social_media : order.social_media
            order.delivery_cost = delivery_cost ? delivery_cost : order.delivery_cost
            let allow = true

            const orderItems = await OrderItem.findAll({ where: { order_id: id } })
            const orderPhotosBuy = await OrderPhoto.findAll({ where: { order_id: id, type: 'buy' } })
            const orderPhotosStock = await OrderPhoto.findAll({ where: { order_id: id, type: 'stock' } })
            const client = await User.findOne({ where: { id: order.client_id } })

            switch (status) {
                case 0:
                    order.status = status
                    order.manager = null

                case 1:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (allow) {
                        if (order.status !== status && client && client.chat_id) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 2:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 2) allow = false
                        if (!i.order_num) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 3:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 3) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 4:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 5:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 6:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 7:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 8:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            scheduleMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 9:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            if (order.can_review) {
                                scheduleMessage(client.chat_id, messages[status])
                            } else {
                                scheduleMessage(client.chat_id, messages.notReview)
                            }
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 10:
                    if (order.status !== status && client && client.chat_id) {
                        let orderNum
                        if (order.paid > 0) {
                            orderNum = 'WP' + order.id
                        } else {
                            orderNum = 'R' + order.id
                        }
                        scheduleMessage(client.chat_id, messages.start10 + orderNum + messages.end10)
                    }
                    order.status = status
                    break

                case 11:
                    order.status = status
                    break

                default:
                    break
            }
            await order.save()
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async setOrderPhoto(req, res, next) {
        try {
            const { id, type } = req.body
            const { img } = req.files
            let fileName = uuidv4() + ".jpg"
            img.mv(path.resolve(__dirname, '..', 'static', fileName))
            const photo = await OrderPhoto.create({ img: fileName, type, order_id: id })
            return res.json(photo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async addItemToOrder(req, res, next) {
        try {
            const { id, item_uid, img, name, category, size, ship, cny_cost, rub_cost, delivery_cost, fee } = req.body
            const order = await Order.findOne({ where: { id } })
            const item = await OrderItem.create({ item_uid, img, name, category, size, ship, cny_cost, rub_cost, order_id: order.id, delivery_cost, fee })
            order.delivery_cost = Number(order.delivery_cost) + Number(delivery_cost)
            order.delivery_cost = Math.ceil(order.delivery_cost)
            order.fee = Number(order.fee) + Number(fee)
            order.fee = Math.ceil(order.fee)
            order.cost = Number(order.cost) + Number(rub_cost) + Number(delivery_cost) + Number(fee)
            order.cost = Math.ceil(order.cost)
            order.discount_cost = Number(order.discount_cost) + Number(rub_cost) + Number(delivery_cost) + Number(fee)
            order.discount_cost = Math.ceil(order.discount_cost)
            await order.save()
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()