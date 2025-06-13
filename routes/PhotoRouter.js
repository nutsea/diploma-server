const Router = require('express')
const router = new Router()
const photoController = require('../controllers/PhotoController')
const adminMiddleware = require('../middleware/adminMiddleware')

router.post('/', photoController.create)
router.post('/test', photoController.getPixel)
router.delete('/', adminMiddleware, photoController.delete)

module.exports = router