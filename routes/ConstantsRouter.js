const Router = require('express')
const router = new Router()
const constantsController = require('../controllers/ConstantsController')
const adminMiddleware = require('../middleware/adminMiddleware')

router.post('/', adminMiddleware, constantsController.update)
router.get('/', constantsController.getConstant)
router.get('/categories', constantsController.getCategoriesShip)
router.put('/category', adminMiddleware, constantsController.updateCategoryShip)

module.exports = router