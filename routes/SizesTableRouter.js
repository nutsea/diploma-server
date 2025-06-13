const Router = require('express')
const router = new Router()
const sizesTableController = require('../controllers/SizesTableController')

router.post('/', sizesTableController.create)

module.exports = router