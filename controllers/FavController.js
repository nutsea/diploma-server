const { Fav, Item } = require('../models/models')
const ApiError = require('../error/apiError')

class FavController {
    async create(req, res, next) {
        try {
            const { item_uid, client_id } = req.body
            const favItem = await Fav.create({ item_uid, client_id })
            const item = await Item.findOne({ where: { id: item_uid } })
            console.log(item_uid)
            if (item) {
                item.fav++
                await item.save()
            }
            return res.json(favItem)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getUserFav(req, res, next) {
        try {
            const { client_id } = req.query
            const fav = await Fav.findAll({ where: { client_id } })
            return res.json(fav)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async deleteOne(req, res, next) {
        try {
            const { item_uid, client_id } = req.query
            const favItem = await Fav.findOne({ where: { item_uid, client_id } })
            const item = await Item.findOne({ where: { id: item_uid } })
            if (item) {
                if (item.fav > 0) item.fav--
                await item.save()
            }
            await favItem.destroy()
            return res.json(favItem)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new FavController()