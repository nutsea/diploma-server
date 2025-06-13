const Router = require('express')
const router = new Router()
const promoController = require('../controllers/PromoController')
const adminMiddleware = require('../middleware/adminMiddleware')

// router.post('/', adminMiddleware, promoController.create)
router.post('/', promoController.create)
router.get('/', adminMiddleware, promoController.getAll)
router.get('/one', adminMiddleware, promoController.getOne)
router.get('/check', promoController.checkPromo)
router.put('/', adminMiddleware, promoController.update)
router.delete('/', adminMiddleware, promoController.delete)

module.exports = router