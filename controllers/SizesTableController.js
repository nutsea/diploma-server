const { SizesTable } = require('../models/models')
const ApiError = require('../error/apiError')

class SizesTableController {
    async create(req, res, next) {
        try {
            const { id, size_type, size_default, size, item_uid } = req.body
            const size_item = await SizesTable.create({ id, size_type, size_default, size, item_uid })
            return res.json(size_item)
        } catch (error) {
            console.log(error)
            return next(ApiError.badRequest(error.message))
        }
    }
}

module.exports = new SizesTableController()