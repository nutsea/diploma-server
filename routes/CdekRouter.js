const Router = require('express')
const router = new Router()
const cdekController = require('../controllers/CdekController')

router.get('/', cdekController.getCities)
router.get('/points', cdekController.getPoints)
router.post('/points', cdekController.setPointsList)

module.exports = router