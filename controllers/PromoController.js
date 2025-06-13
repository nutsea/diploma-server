const { Promo } = require('../models/models')
const ApiError = require('../error/apiError')

class PromoController {
    async create(req, res, next) {
        try {
            const { code, discount, status } = req.body
            const promo = await Promo.create({ code, discount: Number(discount), status })
            return res.json(promo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getAll(req, res, next) {
        try {
            const promos = await Promo.findAll()
            return res.json(promos)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOne(req, res, next) {
        try {
            const { id } = req.query
            const promo = await Promo.findOne({ where: { id } })
            return res.json(promo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async checkPromo(req, res, next) {
        try {
            const { promo_code } = req.query
            const promo = await Promo.findOne({ where: { code: promo_code.toLowerCase() } })
            return res.json(promo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async update(req, res, next) {
        try {
            const { id, code, discount, status } = req.body
            const promo = await Promo.update({ code, discount, status }, { where: { id } })
            return res.json(promo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.query
            const promo = await Promo.destroy({ where: { id } })
            return res.json(promo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new PromoController()