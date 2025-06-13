const Router = require('express')
const router = new Router()
const favController = require('../controllers/FavController')

router.post('/', favController.create)
router.get('/', favController.getUserFav)
router.delete('/', favController.deleteOne)

module.exports = router