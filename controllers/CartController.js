const { Cart, Item, Photo, Size } = require('../models/models')
const ApiError = require('../error/apiError')

class CartController {
    async create(req, res, next) {
        try {
            const { item_uid, size, client_id, ship } = req.body
            const cartItem = await Cart.create({ item_uid, size, client_id, ship })
            const item = await Item.findOne({ where: { item_uid } })
            item.cart++
            await item.save()
            return res.json(cartItem)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getUserCart(req, res, next) {
        try {
            const { client_id } = req.query
            const items = await Cart.findAll({ where: { client_id } })
            let newItems = []
            if (Array.isArray(items)) {
                for (let i of items) {
                    let item = await Item.findOne({ where: { item_uid: i.item_uid } })
                    if (item) {
                        const img = await Photo.findOne({ where: { item_uid: item.dataValues.item_uid } })
                        item.dataValues.img = img.dataValues.img
                        item.dataValues.size = i.size
                        item.dataValues.ship = i.ship
                        const price = await Size.findOne({ where: { item_uid: item.dataValues.item_uid, size: item.dataValues.size } })
                        if (price) {
                            newItems.push(item)
                        } else {
                            await i.destroy()
                        }
                    } else {
                        await i.destroy()
                    }
                }
                for (let i = 0; i < newItems.length; i++) {
                    const price = await Size.findOne({ where: { item_uid: newItems[i].dataValues.item_uid, size: newItems[i].dataValues.size } })
                    if (price) {
                        newItems[i].dataValues.price = price.dataValues.price
                    }
                }
            }
            return res.json(newItems)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async deleteOne(req, res, next) {
        try {
            const { id, size, user, ship } = req.query
            let cartItem
            if (ship) cartItem = await Cart.findOne({ where: { item_uid: id, size, client_id: user, ship } })
            else cartItem = await Cart.findOne({ where: { item_uid: id, size, client_id: user } })
            const item = await Item.findOne({ where: { item_uid: id } })
            if (item.cart > 0) item.cart--
            await item.save()
            await cartItem.destroy()
            return res.json(cartItem)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async clearUserCart(req, res, next) {
        try {
            const items = await Cart.findAll({ where: { client_id: req.user.id } })
            for (let i of items) {
                const item = await Item.findOne({ where: { item_uid: i.item_uid } })
                if (item.cart > 0) item.cart--
                await item.save()
                await i.destroy()
            }
            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CartController()