const { Photo } = require('../models/models')
const ApiError = require('../error/apiError')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')
const axios = require('axios')

async function getFirstPixelColor(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" })
        const { data } = await sharp(response.data)
            .ensureAlpha()
            .extract({ left: 0, top: 0, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: true })
        const [r, g, b, a] = data
        return a === 0 ? "transparent" : `rgb(${r}, ${g}, ${b})`
    } catch (error) {
        console.error("Ошибка обработки изображения:", error)
        return next(ApiError.badRequest(error.message))
    }
}

class PhotoController {
    async create(req, res, next) {
        try {
            const { item_uid, item_id } = req.body
            const { img } = req.files
            let fileName = uuidv4() + ".jpg"
            img.mv(path.resolve(__dirname, '..', 'static', fileName))
            const photo = await Photo.create({ img: fileName, item_uid, item_id })
            return res.json(photo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getPixel(req, res, next) {
        const { url } = req.body
        getFirstPixelColor(url)
            .then(color => {
                console.log('Цвет первого пикселя:', color)
                return res.json(color)
            })
            .catch(error => {
                console.error('Image is not defined', error)
                return next(ApiError.badRequest(error.message))
            })
    }

    async delete(req, res, next) {
        try {
            const { id } = req.query
            const photo = await Photo.findOne({ where: { id } })
            await photo.destroy()
            return res.json({ message: 'Photo deleted' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new PhotoController()