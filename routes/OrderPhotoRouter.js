const Router = require('express')
const router = new Router()
const orderPhotoController = require('../controllers/OrderPhotoController')
const adminMiddleware = require('../middleware/adminMiddleware')

// router.post('/', orderPhotoController.create)
router.delete('/', adminMiddleware, orderPhotoController.delete)

module.exports = router