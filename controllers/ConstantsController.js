const { Constants } = require('../models/models')
const ApiError = require('../error/apiError')

class ConstantsController {
    async update(req, res, next) {
        try {
            const { name, value } = req.body
            const constant = await Constants.findOne({ where: { name } })
            constant.value = value
            await constant.save()
            return res.json(constant)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getConstant(req, res, next) {
        try {
            const { name } = req.query
            const constant = await Constants.findOne({ where: { name } })
            return res.json(constant)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getCategoriesShip(req, res, next) {
        try {
            const fastConstants = await Constants.findAll({ where: { type: 'express' } })
            const slowConstants = await Constants.findAll({ where: { type: 'standart' } })
            return res.json({ fastConstants, slowConstants })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateCategoryShip(req, res, next) {
        try {
            const { category, fast_ship, slow_ship, type } = req.body
            const constant = await Constants.findOne({ where: { name: category, type } })
            switch (type) {
                case 'standart':
                    constant.value = slow_ship
                    await constant.save()
                    break

                case 'express':
                    constant.value = fast_ship
                    await constant.save()
                    break

                default:
                    break
            }
            return res.json(constant)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new ConstantsController()