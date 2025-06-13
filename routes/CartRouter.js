const Router = require('express')
const router = new Router()
const cartController = require('../controllers/CartController')
const authMiddleware = require('../middleware/authMiddleware')

router.post('/', cartController.create)
router.get('/', cartController.getUserCart)
router.delete('/', cartController.deleteOne)
router.delete('/clear', authMiddleware, cartController.clearUserCart)

module.exports = router