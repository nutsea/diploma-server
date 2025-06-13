const { OrderPhoto } = require('../models/models')
const ApiError = require('../error/apiError')

class OrderPhotoController {
    async delete(req, res, next) {
        try {
            const { id } = req.query
            const photo = await OrderPhoto.findOne({ where: { id } })
            await photo.destroy()
            return res.json({ message: 'Photo deleted' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderPhotoController()