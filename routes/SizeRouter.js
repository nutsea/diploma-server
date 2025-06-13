const Router = require('express')
const router = new Router()
const sizeController = require('../controllers/SizeController')

router.post('/', sizeController.create)
router.get('/', sizeController.getAll)
router.get('/sizeprice', sizeController.getPrice)
router.get('/price', sizeController.getMinMaxPrice)

module.exports = router