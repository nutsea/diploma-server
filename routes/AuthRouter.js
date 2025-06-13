const Router = require('express')
const router = new Router()
const authController = require('../controllers/AuthController')

router.post('/', authController.create)
router.post('/browser', authController.createForBrowser)
router.get('/', authController.authUser)
router.get('/browser', authController.authUserBrowser)

module.exports = router