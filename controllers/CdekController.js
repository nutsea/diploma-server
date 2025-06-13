const { Sequelize } = require('../db');
const ApiError = require('../error/apiError');
const { CityPoint } = require('../models/models')
const { getPointsList } = require("../services/cdekService");

class CdekController {
    async getCities(req, res, next) {
        try {
            const cities = await CityPoint.findAll({
                attributes: [
                    'city',
                    'city_code'
                ],
                group: ['city', 'city_code'],
                order: [
                    [Sequelize.col('city'), 'ASC']
                ]
            })
            return res.json(cities)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getPoints(req, res, next) {
        try {
            const points = await CityPoint.findAll()
            return res.json(points)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e))
        }
    }

    async setPointsList(req, res, next) {
        try {
            const points = await getPointsList('PVZ', 'RU')
            for (let point of points) {
                const isExist = await CityPoint.findOne({ where: { id: point.uuid } })
                if (!isExist) {
                    await CityPoint.create({
                        id: point.uuid,
                        city: point.location.city,
                        city_code: point.location.city_code,
                        work_time: point.work_time,
                        address: point.location.address
                    })
                } else {
                    isExist.city = point.location.city
                    isExist.city_code = point.location.city_code
                    isExist.work_time = point.work_time
                    isExist.address = point.location.address
                    await isExist.save()
                }
            }
            // return res.json(points)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CdekController()