const { Size } = require('../models/models')
const ApiError = require('../error/apiError')
const { Op } = require('sequelize')

class SizeController {
    async create(req, res, next) {
        try {
            const { id, size, price, item_uid, size_type, size_default, item_category, item_id } = req.body
            const default_size = size_default || size
            const size_item = await Size.create({ id, size, price, item_uid, size_type, size_default: default_size, item_category, item_id })
            return res.json(size_item)
        } catch (error) {
            console.log(error)
            return next(ApiError.badRequest(error.message))
        }
    }

    // async getAll(req, res, next) {
    //     try {
    //         const { size_type, item_category } = req.query
    //         const sizes = await Size.findAll({
    //             attributes: ['size'],
    //             where: {
    //                 size_type,
    //                 ...(item_category && { item_category })
    //             },
    //             group: ['size'],
    //             raw: true
    //         })
    //         return res.json(sizes)
    //     } catch (e) {
    //         console.log(e)
    //         return next(ApiError.badRequest(e.message))
    //     }
    // }

    async getAll(req, res, next) {
        try {
            // const { size_type, item_category } = req.query
            const { brand, size_type, item_category } = req.query
            const whereClause = {
                size_type,
                ...(item_category && { item_category }),
                brand
                // ...(size_type === 'EU' && {
                //     brand: { [Op.notILike]: '%adidas%' }
                // }),
            }

            const sizes = await Size.findAll({
                attributes: ['size'],
                where: whereClause,
                group: ['size'],
                raw: true
            })
            return res.json(sizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getPrice(req, res, next) {
        try {
            const { size_type, item_category, size } = req.query
            const price = await Size.findOne({
                attributes: ['price'],
                where: {
                    size_type,
                    item_category,
                    size
                }
            })
            return res.json(price)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getMinMaxPrice(req, res, next) {
        try {
            const { item_category } = req.query
            const min = await Size.min('price', { where: { ...(item_category && { item_category }) } })
            const max = await Size.max('price', { where: { ...(item_category && { item_category }) } })
            return res.json({ min, max })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new SizeController()