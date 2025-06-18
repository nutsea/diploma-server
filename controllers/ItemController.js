const { Item, Photo, Size, Fav, Cart, Constants, ModelWatch, DeletedItems } = require('../models/models')
const ApiError = require('../error/apiError')
const { Op, where } = require('sequelize')
const { getPoizonItem, getPoizonIds, getByLink, getSimpleInfo } = require('../services/poizonService')
const { Sequelize } = require('../db')
const sequelize = require('../db')
const os = require('os');
const { filterString, filterSize, convertStringToArray, isUUID, formatSkus, validProperty, replaceValid, sortItemsBySize, getFirstPixelColor, isNumericString, allNumericSizes, getMidPixelColor, allNumericSizesSimple, formatSizeKeys } = require('../utils/itemUtilities')

class ItemController {
    async create(req, res, next) {
        try {
            const { name, item_uid, category, brand, model, orders, declension } = req.body
            const item = await Item.create({ name, item_uid, category, brand, model, declension, orders })
            let hasWatch = await ModelWatch.findOne({ where: { brand, model } })
            if (!hasWatch) {
                await ModelWatch.create({ brand, model })
            }
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createByLink(req, res, next) {
        try {
            const { link, category, timeElapsed, brand, model, declension, fast_ship, slow_ship } = req.body
            const item = await getByLink(link)
            let items = []
            let i = item.spuId
            try {
                await getPoizonItem(i, timeElapsed).then(async data => {
                    try {
                        let isItem = await Item.findOne({ where: { item_uid: i.toString() } })
                        if (!isItem) {
                            let custom = ''
                            if (data.detail.structureTitle.includes('【定制球鞋】')) {
                                if (filterString(data.detail.structureTitle)[0] === ' ') {
                                    custom = '[Custom]'
                                } else {
                                    custom = '[Custom] '
                                }
                            }
                            if (filterString(data.detail.structureTitle).length > 0) {
                                isItem = await Item.create({ name: custom + filterString(data.detail.structureTitle), item_uid: i.toString(), category, brand, model, declension, orders: 0, fitId: data.detail.fitId })
                            } else {
                                isItem = await Item.create({ name: brand + ' ' + model, item_uid: i.toString(), category, brand, model, declension, orders: 0, fitId: data.detail.fitId })
                            }
                            items.push(isItem)
                            let hasWatch = await ModelWatch.findOne({ where: { brand, model } })
                            if (!hasWatch) {
                                await ModelWatch.create({ brand, model })
                            }
                        }
                        if (category !== 'shoes') {
                            const fastShip = await Constants.findOne({ where: { name: brand, type: 'express' } })
                            if (fastShip) {
                                fastShip.value = fast_ship
                                await fastShip.save()
                            } else {
                                await Constants.create({ name: brand, value: fast_ship, type: 'express' })
                            }
                            const slowShip = await Constants.findOne({ where: { name: brand, type: 'standart' } })
                            if (slowShip) {
                                slowShip.value = slow_ship
                                await slowShip.save()
                            } else {
                                await Constants.create({ name: brand, value: slow_ship, type: 'standart' })
                            }
                        }
                        for (let j of data.image.spuImage.images) {
                            const pixel = await getFirstPixelColor(j.url)
                            const pixel2 = await getMidPixelColor(j.url)
                            if (category !== 'shoes' || ((pixel.r > 250 && pixel.g > 250 && pixel.b > 250 && pixel.a === 1) && (pixel2.r > 250 && pixel2.g > 250 && pixel2.b > 250 && pixel2.a === 1))) {
                                if (!isItem.img) {
                                    isItem.img = j.url
                                    await isItem.save()
                                }
                                const isPhoto = await Photo.findOne({ where: { img: j.url, item_uid: i.toString() } })
                                if (!isPhoto)
                                    await Photo.create({ img: j.url, item_uid: i.toString(), item_id: isItem.id })
                            }
                        }

                        let list = formatSizeKeys(data.sizeDto.sizeInfo.sizeTemplate.list)

                        if (allNumericSizes(data.skus, category)) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'invalid_sizes' })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to create ${i}`)
                        }

                        let noSizes = true
                        data.skus.filter(size => {
                            const { clientPrice } = formatSkus(size)
                            if (clientPrice) {
                                noSizes = false
                            }
                        })
                        if (noSizes) {
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()

                            const sizesToDelete = await Size.findAll({ where: { item_uid: i.toString() } })
                            for (let i of sizesToDelete) {
                                await i.destroy()
                            }

                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'no_sizes' })
                            } else {
                                isExist.img = data.image.spuImage.images[0].url
                                isExist.name = data.detail.structureTitle
                                isExist.deletion_type = 'no_sizes'
                                await isExist.save()
                            }
                            throw new Error(`Failed to update ${i}`)
                        }

                        isItem.min_price = 100000000
                        isItem.max_price = 0
                        for (let j = 0; j < data.skus.length; j++) {
                            if (data.skus[j] && !validProperty(data.skus[j])) {
                                const sizesToDelete = await Size.findAll({ where: { size: data.skus[j].properties[1].saleProperty.value, item_uid: i.toString() } })
                                for (let i of sizesToDelete) {
                                    await i.destroy()
                                }
                            }
                            if (data.skus[j] && validProperty(data.skus[j]) && !isNumericString(replaceValid(validProperty(data.skus[j])), category)) {
                                const { clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12 } = formatSkus(data.skus[j])
                                if ((!isItem.min_price || isItem.min_price === null || isItem.min_price > clientPrice) && clientPrice) {
                                    isItem.min_price = clientPrice
                                    isItem.save()
                                }
                                if ((!isItem.max_price || isItem.min_price === null || isItem.max_price < clientPrice) && clientPrice) {
                                    isItem.max_price = clientPrice
                                    isItem.save()
                                }
                                const defaultSize = validProperty(data.skus[j])
                                const sizeDef = replaceValid(defaultSize)
                                const sameSizes = await Size.findAll({ where: { size_default: sizeDef, item_uid: i.toString() } })
                                if (sameSizes && sameSizes.length > 0) {
                                    for (let k of sameSizes) {
                                        if (clientPrice) {
                                            k.price = clientPrice
                                            k.price_0 = price_0
                                            k.price_2 = price_2
                                            k.price_3 = price_3
                                            k.price_12 = price_12
                                            k.delivery_0 = delivery_0
                                            k.delivery_2 = delivery_2
                                            k.delivery_3 = delivery_3
                                            k.delivery_12 = delivery_12
                                            await k.save()
                                        } else {
                                            await k.destroy()
                                        }
                                    }
                                    const defaultTemplate = list[0].sizeValue
                                    const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                    for (let k of list) {
                                        const sizeDef = replaceValid(defaultSize)
                                        if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey) {
                                            const size = replaceValid(k.sizeValue[defaultIndex])
                                            const isSize = await Size.findOne({ where: { size, size_type: k.sizeKey, size_default: sizeDef, item_uid: i.toString() } })
                                            if (!isSize && clientPrice) {
                                                await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                                if (list[0].sizeKey !== 'EU' && k.sizeKey === 'FR') {
                                                    await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: isItem.brand })
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (clientPrice && list[0]) {
                                        const sizeDef = replaceValid(defaultSize)
                                        if (list[0] && list[0].sizeKey !== 'EU') {
                                            await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: "EU", size_default: sizeDef, item_category: category, brand: isItem.brand })
                                        } else {
                                            await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: list[0].sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                        }
                                        const defaultTemplate = list[0].sizeValue
                                        const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                        for (let k of list) {
                                            if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey && (category === 'clothes' ? k.sizeKey !== 'EU' : true)) {
                                                const size = replaceValid(k.sizeValue[defaultIndex])
                                                await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.log(e)
                    }
                    const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                    if (!hasAnySizes) {
                        const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                        if (!isExist) {
                            await DeletedItems.create({ item_uid: i.toString() })
                        }
                        const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                        await itemToDelete.destroy()
                        throw new Error(`Failed to create ${i}`)
                    }
                }).catch(async (e) => {
                    console.log(e)
                    const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                    if (!hasAnySizes) {
                        const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                        if (!isExist) {
                            await DeletedItems.create({ item_uid: i.toString() })
                        }
                        const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                        await itemToDelete.destroy()
                        throw new Error(`Failed to create ${i}`)
                    }
                })
            } catch (e) {
                console.log(e)
            }
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createBySpuId(req, res, next) {
        try {
            const { spuIdArr, category, timeElapsed, brand, model, declension, fast_ship, slow_ship } = req.body
            let items = []
            let error = false
            for (let i of spuIdArr) {
                try {
                    await getPoizonItem(i, timeElapsed).then(async data => {
                        try {
                            let isItem = await Item.findOne({ where: { item_uid: i.toString() } })
                            if (!isItem) {
                                let custom = ''
                                if (data.detail.structureTitle.includes('【定制球鞋】')) {
                                    custom = '[Custom] '
                                }
                                if (filterString(data.detail.structureTitle).length > 0) {
                                    isItem = await Item.create({ name: custom + filterString(data.detail.structureTitle).trim(), item_uid: i.toString(), category, brand, model, declension, orders: 0, fitId: data.detail.fitId })
                                } else {
                                    isItem = await Item.create({ name: brand + ' ' + model, item_uid: i.toString(), category, brand, model, declension, orders: 0, fitId: data.detail.fitId })
                                }
                                items.push(isItem)
                                let hasWatch = await ModelWatch.findOne({ where: { brand, model } })
                                if (!hasWatch) {
                                    await ModelWatch.create({ brand, model })
                                }
                            }
                            if (category !== 'shoes') {
                                const fastShip = await Constants.findOne({ where: { name: brand, type: 'express' } })
                                if (fastShip) {
                                    if (fast_ship)
                                        fastShip.value = fast_ship
                                    await fastShip.save()
                                } else {
                                    await Constants.create({ name: brand, value: fast_ship, type: 'express' })
                                }
                                const slowShip = await Constants.findOne({ where: { name: brand, type: 'standart' } })
                                if (slowShip) {
                                    if (slow_ship)
                                        slowShip.value = slow_ship
                                    await slowShip.save()
                                } else {
                                    await Constants.create({ name: brand, value: slow_ship, type: 'standart' })
                                }
                            }
                            isItem.min_price = 100000000
                            isItem.max_price = 0
                            for (let j of data.image.spuImage.images) {
                                const pixel = await getFirstPixelColor(j.url)
                                const pixel2 = await getMidPixelColor(j.url)
                                if (category !== 'shoes' || ((pixel.r > 250 && pixel.g > 250 && pixel.b > 250 && pixel.a === 1) && (pixel2.r > 250 && pixel2.g > 250 && pixel2.b > 250 && pixel2.a === 1))) {
                                    if (!isItem.img) {
                                        isItem.img = j.url
                                        await isItem.save()
                                    }
                                    const isPhoto = await Photo.findOne({ where: { img: j.url, item_uid: i.toString() } })
                                    if (!isPhoto)
                                        await Photo.create({ img: j.url, item_uid: i.toString(), item_id: isItem.id })
                                }
                            }

                            let list = formatSizeKeys(data.sizeDto.sizeInfo.sizeTemplate.list)
                            console.log('list', list)

                            if (allNumericSizes(data.skus, category)) {
                                const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                                if (!isExist) {
                                    await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'invalid_sizes' })
                                }
                                const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                                await itemToDelete.destroy()
                                throw new Error(`Failed to create ${i}`)
                            }

                            let noSizes = true
                            data.skus.filter(size => {
                                const { clientPrice } = formatSkus(size)
                                if (clientPrice) {
                                    noSizes = false
                                }
                            })
                            if (noSizes) {
                                const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                                await itemToDelete.destroy()

                                const sizesToDelete = await Size.findAll({ where: { item_uid: i.toString() } })
                                for (let i of sizesToDelete) {
                                    await i.destroy()
                                }

                                const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                                if (!isExist) {
                                    await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'no_sizes' })
                                } else {
                                    isExist.img = data.image.spuImage.images[0].url
                                    isExist.name = data.detail.structureTitle
                                    isExist.deletion_type = 'no_sizes'
                                    await isExist.save()
                                }
                                throw new Error(`Failed to update ${i}`)
                            }

                            for (let j = 0; j < data.skus.length; j++) {
                                if (data.skus[j] && !validProperty(data.skus[j])) {
                                    const sizesToDelete = await Size.findAll({ where: { size: data.skus[j].properties[1].saleProperty.value, item_uid: i.toString() } })
                                    for (let i of sizesToDelete) {
                                        await i.destroy()
                                    }
                                }
                                if (data.skus[j] && validProperty(data.skus[j]) && !isNumericString(replaceValid(validProperty(data.skus[j])), category)) {
                                    const { clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12 } = formatSkus(data.skus[j])
                                    if ((!isItem.min_price || isItem.min_price === null || isItem.min_price > clientPrice) && clientPrice) {
                                        isItem.min_price = clientPrice
                                        isItem.save()
                                    }
                                    if ((!isItem.max_price || isItem.min_price === null || isItem.max_price < clientPrice) && clientPrice) {
                                        isItem.max_price = clientPrice
                                        isItem.save()
                                    }
                                    const defaultSize = validProperty(data.skus[j])
                                    const sizeDef = replaceValid(defaultSize)
                                    const sameSizes = await Size.findAll({ where: { size_default: sizeDef, item_uid: i.toString() } })
                                    if (sameSizes && sameSizes.length > 0) {
                                        for (let k of sameSizes) {
                                            if (clientPrice) {
                                                k.price = clientPrice
                                                k.price_0 = price_0
                                                k.price_2 = price_2
                                                k.price_3 = price_3
                                                k.price_12 = price_12
                                                k.delivery_0 = delivery_0
                                                k.delivery_2 = delivery_2
                                                k.delivery_3 = delivery_3
                                                k.delivery_12 = delivery_12
                                                await k.save()
                                            } else {
                                                await k.destroy()
                                            }
                                        }
                                        const defaultTemplate = list[0].sizeValue
                                        const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                        for (let k of list) {
                                            if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey) {
                                                const size = replaceValid(k.sizeValue[defaultIndex])
                                                const isSize = await Size.findOne({ where: { size, size_type: k.sizeKey, size_default: sizeDef, item_uid: i.toString() } })
                                                if (!isSize && clientPrice) {
                                                    await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                                    if (list[0].sizeKey !== 'EU' && k.sizeKey === 'FR') {
                                                        await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: isItem.brand })
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        if (clientPrice && list[0]) {
                                            const sizeDef = replaceValid(defaultSize)
                                            if (list[0] && list[0].sizeKey !== 'EU') {
                                                await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: isItem.brand })
                                            } else {
                                                list[0] && await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: list[0].sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                            }
                                            const defaultTemplate = list[0].sizeValue
                                            const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                            for (let k of list) {
                                                if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey && (category === 'clothes' ? k.sizeKey !== 'EU' : true)) {
                                                    const size = replaceValid(k.sizeValue[defaultIndex])
                                                    await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: isItem.brand })
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(e)
                        }
                        const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                        if (!hasAnySizes) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString() })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to create ${i}`)
                        }
                    }).catch(async () => {
                        const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                        if (!hasAnySizes) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString() })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to create ${i}`)
                        }
                    })
                } catch (e) {
                    console.log(e)
                    error = true
                }
            }
            return res.json({ items, error })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateBrandAndModel(req, res, next) {
        try {
            const { spuIdArr, brand, model } = req.body
            const items = []
            for (let i of spuIdArr) {
                const item = await Item.findOne({ where: { item_uid: i.toString() } })
                if (item) {
                    item.brand = brand
                    item.model = model
                    await item.save()
                    items.push(item)
                    const sizes = await Size.findAll({ where: { item_uid: i.toString() } })
                    for (let i of sizes) {
                        i.brand = brand
                        await i.save()
                    }
                }
            }
            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async clearNonValidSizes(req, res, next) {
        try {
            const { spuIdArr } = req.query
            const sizes = await Size.findAll({ where: { item_uid: { [Op.in]: spuIdArr } } })
            for (let i of sizes) {
                if (!filterSize(i.size) || filterSize(i.size) !== i.size) {
                    await i.destroy()
                }
            }
            return res.json(sizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getSpuIds(req, res, next) {
        try {
            const { keyword, limit, page, timeElapsed } = req.query
            let ids = await getPoizonIds(keyword, limit, page, timeElapsed)
            console.log(ids)
            for (let i of ids.productList) {
                const isExist = await Item.findOne({ where: { item_uid: i.spuId.toString() } })
                if (isExist) i.isExist = true
                const isDeleted = await DeletedItems.findOne({ where: { item_uid: i.spuId.toString() } })
                if (isDeleted && !isDeleted.deletion_type) {
                    i.isTried = true
                }
                if (isDeleted && isDeleted.deletion_type === 'no_sizes') {
                    i.noSizes = true
                }
                if (isDeleted && isDeleted.deletion_type === 'invalid_sizes') {
                    i.invalidSizes = true
                }
            }
            return res.json(ids)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async checkCostPlug(req, res, next) {
        try {
            return res.json()
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async checkCost(req, res, next) {
        try {
            const { spuIdArr, timeElapsed } = req.query
            let ids = JSON.parse(spuIdArr)
            let sizes = []
            for (let i of ids) {
                let item = await Item.findOne({ where: { item_uid: i.toString() } })
                if (item.name.length === 0) {
                    item.name = item.brand + ' ' + item.model
                    await item.save()
                }
                const sizes = await Size.findAll({ where: { item_uid: i.toString() } })
                item.min_price = 100000000
                item.max_price = 0
                const category = item.dataValues.category
                try {
                    await getPoizonItem(i, timeElapsed).then(async data => {
                        item.img = data.image.spuImage.images[0].url
                        item.fitId = data.detail.fitId
                        await item.save()
                        for (let j of data.image.spuImage.images) {
                            const oldPhoto = await Photo.findOne({ where: { img: j.url, item_uid: i.toString() } })
                            if (oldPhoto)
                                await oldPhoto.destroy()
                        }
                        for (let j of data.image.spuImage.images) {
                            const pixel = await getFirstPixelColor(j.url)
                            const pixel2 = await getMidPixelColor(j.url)
                            if (category !== 'shoes' || ((pixel.r > 250 && pixel.g > 250 && pixel.b > 250 && pixel.a === 1) && (pixel2.r > 250 && pixel2.g > 250 && pixel2.b > 250 && pixel2.a === 1))) {
                                if (!item.img) {
                                    item.img = j.url
                                    await item.save()
                                }
                                const isPhoto = await Photo.findOne({ where: { img: j.url, item_uid: i.toString() } })
                                if (!isPhoto)
                                    await Photo.create({ img: j.url, item_uid: i.toString(), item_id: item.id })
                            }
                        }

                        let list = formatSizeKeys(data.sizeDto.sizeInfo.sizeTemplate.list)

                        if (allNumericSizes(data.skus, item.category)) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'invalid_sizes' })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to update ${i}`)
                        }

                        let noSizes = true
                        data.skus.filter(size => {
                            const { clientPrice } = formatSkus(size)
                            if (clientPrice) {
                                noSizes = false
                            }
                        })
                        if (noSizes) {
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()

                            const sizesToDelete = await Size.findAll({ where: { item_uid: i.toString() } })
                            for (let i of sizesToDelete) {
                                await i.destroy()
                            }

                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString(), img: data.image.spuImage.images[0].url, name: data.detail.structureTitle, deletion_type: 'no_sizes' })
                            } else {
                                isExist.img = data.image.spuImage.images[0].url
                                isExist.name = data.detail.structureTitle
                                isExist.deletion_type = 'no_sizes'
                                await isExist.save()
                            }
                            throw new Error(`Failed to update ${i}`)
                        }

                        for (let j = 0; j < data.skus.length; j++) {
                            if (data.skus[j] && !validProperty(data.skus[j])) {
                                const sizesToDelete = await Size.findAll({ where: { size: data.skus[j].properties[1].saleProperty.value, item_uid: i.toString() } })
                                for (let i of sizesToDelete) {
                                    await i.destroy()
                                }
                            }
                            if (data.skus[j] && validProperty(data.skus[j]) && isNumericString(replaceValid(validProperty(data.skus[j])), item.category)) {
                                const sizesToDelete = await Size.findAll({ where: { size: replaceValid(validProperty(data.skus[j])) } })
                                for (let i of sizesToDelete) {
                                    await i.destroy()
                                }
                            }
                            if (data.skus[j] && validProperty(data.skus[j]) && !isNumericString(replaceValid(validProperty(data.skus[j])), item.category)) {
                                const { clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12 } = formatSkus(data.skus[j])
                                if ((!item.min_price || item.min_price === null || item.min_price > clientPrice) && clientPrice) {
                                    item.min_price = clientPrice
                                    item.save()
                                }
                                if ((!item.max_price || item.max_price === null || item.max_price < clientPrice) && clientPrice) {
                                    item.max_price = clientPrice
                                    item.save()
                                }
                                const defaultSize = validProperty(data.skus[j])
                                const sizeDef = replaceValid(defaultSize)
                                const sameSizes = await Size.findAll({ where: { size_default: sizeDef, item_uid: i.toString() } })
                                if (sameSizes && sameSizes.length > 0) {
                                    for (let k of sameSizes) {
                                        if (clientPrice) {
                                            k.price = clientPrice
                                            k.price_0 = price_0
                                            k.price_2 = price_2
                                            k.price_3 = price_3
                                            k.price_12 = price_12
                                            k.delivery_0 = delivery_0
                                            k.delivery_2 = delivery_2
                                            k.delivery_3 = delivery_3
                                            k.delivery_12 = delivery_12
                                            await k.save()
                                        } else {
                                            await k.destroy()
                                        }
                                    }
                                    const defaultTemplate = list[0].sizeValue
                                    const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                    for (let k of list) {
                                        if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey) {
                                            const size = replaceValid(k.sizeValue[defaultIndex])
                                            const isSize = await Size.findOne({ where: { size, size_type: k.sizeKey, size_default: sizeDef, item_uid: i.toString() } })
                                            if (!isSize && clientPrice) {
                                                await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: item.brand })
                                                if (list[0].sizeKey !== 'EU' && k.sizeKey === 'FR') {
                                                    await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: item.brand })
                                                }
                                            } else if (list[0].sizeKey !== 'EU' && k.sizeKey === 'FR') {
                                                const isDefaultSize = await Size.findOne({ where: { size, size_type: 'EU', size_default: sizeDef, item_uid: i.toString() } })
                                                if (!isDefaultSize) {
                                                    await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: item.brand })
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (clientPrice && list[0]) {
                                        const sizeDef = replaceValid(defaultSize)
                                        if (list && list[0].sizeKey !== 'EU') {
                                            await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: 'EU', size_default: sizeDef, item_category: category, brand: item.brand })
                                        } else {
                                            await Size.create({ size: sizeDef, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: list[0].sizeKey, size_default: sizeDef, item_category: category, brand: item.brand })
                                        }
                                        const defaultTemplate = list[0].sizeValue
                                        const defaultIndex = defaultTemplate.findIndex(item => item === defaultSize)
                                        for (let k of list) {
                                            if (k.sizeValue[defaultIndex] && (k.sizeValue[defaultIndex] !== defaultSize || k.sizeKey === 'FR') && k.sizeKey && (category === 'clothes' ? k.sizeKey !== 'EU' : true)) {
                                                const size = replaceValid(k.sizeValue[defaultIndex])
                                                await Size.create({ size, price: clientPrice, price_0, price_2, price_3, price_12, delivery_0, delivery_2, delivery_3, delivery_12, item_uid: i.toString(), size_type: k.sizeKey, size_default: sizeDef, item_category: category, brand: item.brand })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        for (let i of sizes) {
                            const wasParsed = !data.skus.some(sku => replaceValid(validProperty(sku)) == i.size_default)
                            if (wasParsed) await i.destroy()
                        }
                        const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                        if (!hasAnySizes) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString() })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to update ${i}`)
                        }
                    }).catch(async () => {
                        const hasAnySizes = await Size.findOne({ where: { item_uid: i.toString() } })
                        if (!hasAnySizes) {
                            const isExist = await DeletedItems.findOne({ where: { item_uid: i.toString() } })
                            if (!isExist) {
                                await DeletedItems.create({ item_uid: i.toString() })
                            }
                            const itemToDelete = await Item.findOne({ where: { item_uid: i.toString() } })
                            await itemToDelete.destroy()
                            throw new Error(`Failed to update ${i}`)
                        }
                    })
                } catch (e) {
                    console.log(e)
                }
            }
            return res.json(sizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async checkSize(req, res, next) {
        try {
            const { item_uid, size } = req.query
            const item = await Size.findOne({ where: { item_uid, size } })
            if (!item) {
                return next(ApiError.badRequest(e.message))
            }
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOne(req, res, next) {
        try {
            const { id } = req.query
            let item = await Item.findOne({ where: { id } })
            const images = await Photo.findAll({ where: { item_uid: item.dataValues.item_uid } })
            item.dataValues.img = images
            let sizes = await Size.findAll({ where: { item_uid: item.dataValues.item_uid } })
            for (let i of sizes) {
                const orders = await Cart.findAll({ where: { item_uid: item.dataValues.item_uid, size: i.dataValues.size_default } })
                i.dataValues.orders = orders.length
            }
            item.dataValues.sizes = sizes
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOneBySpu(req, res, next) {
        try {
            const { spu } = req.query
            let item = await Item.findOne({ where: { item_uid: spu } })
            if (!item) return res.json({ message: 'Item not found' })
            const images = await Photo.findAll({ where: { item_uid: item.dataValues.item_uid } })
            item.dataValues.img = images
            let sizes = await Size.findAll({ where: { item_uid: item.dataValues.item_uid } })
            item.dataValues.sizes = sizes

            const sizesToSort = sizes.filter(size => size.size_type === 'EU')
            const sortedSizes = sortItemsBySize(sizesToSort)
            item.dataValues.min_size = sortedSizes[0].size
            item.dataValues.max_size = sortedSizes[sortedSizes.length - 1].size
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getPopular(req, res, next) {
        try {
            let items = await Item.findAll({
                order: [['watch', 'DESC']],
                limit: 10
            })

            for (let i = 0; i < items.length; i++) {
                const img = await Photo.findOne({ where: { item_uid: items[i].dataValues.item_uid } })
                items[i].dataValues.img = img.dataValues.img
            }

            for (let i of items) {
                const fav = await Fav.findAll({ where: { item_uid: i.dataValues.id } })
                const cart = await Cart.findAll({ where: { item_uid: i.dataValues.item_uid } })
                i.dataValues.fav = fav.length
                i.dataValues.cart = cart.length
            }

            let newItems = {
                count: items.length,
                rows: items
            }

            return res.json(newItems)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getAll(req, res, next) {
        try {
            const { category, brands, models, sizes, size_type, prices, sort, limit, page, search } = req.query
            let sortCondition = []
            switch (sort) {
                case 'new':
                    sortCondition = [['createdAt', 'DESC']]
                    break;

                case 'old':
                    sortCondition = [['createdAt', 'ASC']]
                    break;

                case 'priceUp':
                    sortCondition = [[Sequelize.literal('min_price'), 'ASC']]
                    break;

                case 'priceDown':
                    sortCondition = [[Sequelize.literal('min_price'), 'DESC']]
                    break;

                case 'popular':
                    sortCondition = [['watch', 'DESC']]
                    break;

                default:
                    break;
            }
            let sortConditionSizes = []
            switch (sort) {
                case 'priceUp':
                    sortConditionSizes = [[Sequelize.literal('price'), 'ASC']]
                    break;

                case 'priceDown':
                    sortConditionSizes = [[Sequelize.literal('price'), 'DESC']]
                    break;

                default:
                    break;
            }
            const course = await Constants.findOne({ where: { name: 'course' } })
            const sizesDB = await Size.findAll({
                where: {
                    ...(category && { item_category: category }),
                    size_type,
                    ...(sizes && { size: { [Op.in]: sizes } }),
                    ...(prices && { price: { [Op.gte]: Number(prices[0]), [Op.lte]: Number(prices[1]) } }),
                },
            })
            let pageClient = Number(page) || 1
            let limitClient = Number(limit) || 18
            let offset = Number(pageClient) * Number(limitClient) - Number(limitClient)
            let conditions = {}
            if (models && brands) {
                conditions = {
                    [Op.or]: [
                        ...models.map(m => ({
                            brand: m.brand,
                            model: m.model
                        })),
                        {
                            brand: {
                                [Op.in]: brands.filter(b => !models.some(m => m.brand === b))
                            }
                        }
                    ]
                }
            } else if (brands) {
                conditions = { ...(brands && { brand: { [Op.in]: brands } }) }
            }

            let formattedSearch

            if (search) {
                formattedSearch = search
                    .split(' ')
                    .filter(word => word.trim() !== '')
                    .map(word => `${word}:*`)
                    .join(' & ')
            }

            if (!sizes) {
                let items = await Item.findAndCountAll({
                    where: {
                        ...(category && { category }),
                        ...(sizesDB && { item_uid: { [Op.in]: sizesDB.map(item => item.item_uid) } }),
                        ...(brands && conditions),
                        ...(search && {
                            [Op.or]: Sequelize.literal(`
                                to_tsvector('simple', "name") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "brand") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "model") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "item_uid") @@ to_tsquery('simple', '${formattedSearch}')
                            `)
                        }),
                    },
                    order: sortCondition.length ? sortCondition : [['createdAt', 'ASC']],
                    offset,
                    limit: limitClient
                })

                return res.json({ items })
            } else {
                let items = await Item.findAll({
                    where: {
                        ...(category && { category }),
                        ...(sizesDB && { item_uid: { [Op.in]: sizesDB.map(item => item.item_uid) } }),
                        ...(brands && conditions),
                        ...(search && {
                            [Op.or]: Sequelize.literal(`
                                to_tsvector('simple', "name") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "brand") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "model") @@ to_tsquery('simple', '${formattedSearch}') OR 
                                to_tsvector('simple', "item_uid") @@ to_tsquery('simple', '${formattedSearch}')
                            `)
                        }),
                    },
                    order: sortCondition.length ? sortCondition : [['createdAt', 'ASC']],
                })

                for (let i of items) {
                    let minimal = 100000000
                    if (sizesDB) {
                        const found = sizesDB.filter(j => j.item_uid === i.item_uid)
                        for (let j of found) {
                            if (j.price < minimal) minimal = j.price
                        }
                    }
                    i.dataValues.price = minimal
                }

                switch (sort) {
                    case 'priceUp':
                        items.sort((a, b) => a.dataValues.price - b.dataValues.price);
                        break

                    case 'priceDown':
                        items.sort((a, b) => b.dataValues.price - a.dataValues.price);
                        break

                    default:
                        break
                }

                const paginatedItems = items.slice(offset, offset + limitClient)

                items = {
                    count: items.length,
                    rows: paginatedItems
                }

                return res.json({ items })
            }
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getAllAdmin(req, res, next) {
        try {
            const { category, brands, models, sort, limit, page, search } = req.query
            let pageClient = Number(page) || 1
            let limitClient = Number(limit) || 18
            let offset = Number(pageClient) * Number(limitClient) - Number(limitClient)
            let conditions = {}
            if (models && brands) {
                conditions = {
                    [Op.or]: [
                        ...models.map(m => ({
                            brand: m.brand,
                            model: m.model
                        })),
                        {
                            brand: {
                                [Op.in]: brands.filter(b => !models.some(m => m.brand === b))
                            }
                        }
                    ]
                }
            } else if (brands) {
                conditions = { ...(brands && { brand: { [Op.in]: brands } }) }
            }

            let formattedSearch

            if (search) {
                formattedSearch = search
                    .split(' ')
                    .filter(word => word.trim() !== '')
                    .map(word => `${word}:*`)
                    .join(' & ')
            }

            let items = await Item.findAndCountAll({
                where: {
                    ...(category && { category }),
                    ...(brands && conditions),
                    ...(search && {
                        [Op.or]: Sequelize.literal(`
                            to_tsvector('simple', "name") @@ to_tsquery('simple', '${formattedSearch}') OR 
                            to_tsvector('simple', "brand") @@ to_tsquery('simple', '${formattedSearch}') OR 
                            to_tsvector('simple', "model") @@ to_tsquery('simple', '${formattedSearch}') OR 
                            to_tsvector('simple', "category") @@ to_tsquery('simple', '${formattedSearch}') OR 
                            to_tsvector('simple', "item_uid") @@ to_tsquery('simple', '${formattedSearch}')
                        `)
                    }),
                },
                order: [['createdAt', 'DESC']],
                offset,
                limit: limitClient
            })

            for (let i of items.rows) {
                let minimal = 100000000
                i.dataValues.price = minimal

                const sizes = await Size.findAll({ where: { item_uid: i.item_uid, size_type: 'EU' } })
                const sortedSizes = sortItemsBySize(sizes)
                i.dataValues.min_size = sortedSizes[0]?.size
                i.dataValues.max_size = sortedSizes[sortedSizes.length - 1]?.size
            }

            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getDeletedAdmin(req, res, next) {
        try {
            const { limit, page } = req.query
            let pageClient = Number(page) || 1
            let limitClient = Number(limit) || 18
            let offset = Number(pageClient) * Number(limitClient) - Number(limitClient)

            let items = await DeletedItems.findAndCountAll({
                where: {
                    name: { [Op.ne]: null },
                    img: { [Op.ne]: null },
                    deletion_type: {
                        [Op.and]: [
                            { [Op.ne]: null },
                            { [Op.ne]: 'no_sizes' }
                        ]
                    },
                },
                order: [['createdAt', 'DESC']],
                offset,
                limit: limitClient
            })

            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getByIds(req, res, next) {
        try {
            const { id_arr } = req.query
            let ids = JSON.parse(id_arr)
            ids = ids.filter(id => isUUID(id))
            let items = await Item.findAll({ where: { id: { [Op.in]: ids } } })
            for (let i = 0; i < items.length; i++) {
                const isExist = await Size.findOne({ where: { item_uid: items[i].dataValues.item_uid } })
                if (!isExist) {
                    items.splice(i, 1)
                    i--
                } else {
                    const img = await Photo.findOne({ where: { item_uid: items[i].dataValues.item_uid } })
                    items[i].dataValues.img = img.dataValues.img
                }
            }
            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getCartItems(req, res, next) {
        try {
            const { items_arr } = req.query
            let items = JSON.parse(items_arr)
            let newItems = []
            if (Array.isArray(items)) {
                for (let i of items) {
                    let item = await Item.findOne({ where: { item_uid: i.item_uid } })
                    if (item) {
                        const img = await Photo.findOne({ where: { item_uid: item.dataValues.item_uid } })
                        item.dataValues.img = img.dataValues.img
                        item.dataValues.size = i.size
                        item.dataValues.ship = i.ship
                        const price = await Size.findOne({ where: { item_uid: item.dataValues.item_uid, size: item.dataValues.size } })
                        if (price) {
                            newItems.push(item)
                        }
                    }
                }
                for (let i = 0; i < newItems.length; i++) {
                    const price = await Size.findOne({ where: { item_uid: newItems[i].dataValues.item_uid, size: newItems[i].dataValues.size } })
                    if (price) {
                        newItems[i].dataValues.price = price.dataValues.price
                    }
                }
            }
            return res.json(newItems)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getBrandsAndModels(req, res, next) {
        try {
            const { category } = req.query
            let brands = await Item.findAll({
                attributes: [
                    [sequelize.fn('MIN', sequelize.col('item_uid')), 'item_uid'],
                    'brand'
                ],
                group: ['brand'],
                where: { ...(category && { category }) }
            })
            for (let i = 0; i < brands.length; i++) {
                const models = await Item.findAll({ attributes: ['model'], group: ['model'], where: { brand: brands[i].dataValues.brand, ...(category && { category }) } })
                brands[i].dataValues.models = models
                for (let j of brands[i].dataValues.models) {
                    j.brand = brands[i].brand
                }
            }
            return res.json(brands)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getBrands(req, res, next) {
        try {
            const { category } = req.query
            let brands = await Item.findAll({ attributes: ['brand'], group: ['brand'], where: { ...(category && { category }) } })
            return res.json(brands)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getModels(req, res, next) {
        try {
            const { brand, category } = req.query
            let models = await Item.findAll({ attributes: ['model'], group: ['model'], where: { brand, ...(category && { category }) } })
            return res.json(models)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async addWatch(req, res, next) {
        try {
            const { id } = req.body
            let item = await Item.findOne({ where: { id } })
            item.watch++
            await item.save()
            let model = await ModelWatch.findOne({ where: { brand: item.brand, model: item.model } })
            if (!model) {
                await ModelWatch.create({ brand: item.brand, model: item.model, watch: 1 })
            } else {
                model.watch++
                await model.save()
            }
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async compareSearchWord(req, res, next) {
        try {
            const { search } = req.query
            const brands = await Item.findAll({
                attributes: ['brand'],
                group: ['brand'],
                where: Sequelize.literal(`SIMILARITY("brand", '${search}') > 0.2 OR "brand" ILIKE '%${search}%'`),
                order: [
                    [Sequelize.literal(`CASE WHEN "brand" ILIKE '${search}%' THEN 0 ELSE 1 END`), 'ASC'],
                    [Sequelize.literal(`SIMILARITY("brand", '${search}')`), 'DESC'],
                    ['brand', 'ASC'],
                ]
            })
            let formattedBrands = brands.map(brand => ({ type: 'brand', brand: brand.dataValues.brand }))
            let models = await ModelWatch.findAll({
                attributes: ['model', 'brand', 'watch'],
                group: ['model', 'brand', 'watch'],
                where: Sequelize.literal(`SIMILARITY("model", '${search}') > 0.2 OR "model" ILIKE '%${search}%'`),
                order: [['watch', 'DESC']]
            })
            let formattedModels = models.map(model => ({ type: 'model', brand: model.dataValues.brand, model: model.dataValues.model, }))
            let match = formattedBrands.concat(formattedModels)
            return res.json(match)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createAllWatches(req, res, next) {
        try {
            const { category } = req.body
            const models = await Item.findAll({
                attributes: ['brand', 'model'],
                group: ['brand', 'model'],
                where: { ...(category && { category }) }
            })
            for (let i of models) {
                let hasWatch = await ModelWatch.findOne({ where: { brand: i.brand, model: i.model } })
                if (!hasWatch) {
                    await ModelWatch.create({ brand: i.brand, model: i.model })
                }
            }
            return res.json(models)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateCategoryShip(req, res, next) {
        try {
            const { category, slow_ship, fast_ship } = req.body
            const items = await Item.findAll({ where: { brand: category } })
            for (let i of items) {
                if (slow_ship) i.slow_ship = slow_ship
                if (fast_ship) i.fast_ship = fast_ship
                await i.save()
            }
            return res.json(category)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async convertClothesSizes(req, res, next) {
        try {
            const sizePatterns = [
                '6XS', '5XS', '4XS', '3XS', '2XS', '2XL', '3XL', '4XL', '5XL', '6XL'
            ]
            const sizeRegex = /^\d+\/(XXXXS|XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)$/
            const sizes = await Size.findAll({
                where: {
                    [Op.or]: [
                        { size: { [Op.in]: sizePatterns } },
                        { size: { [Op.regexp]: sizeRegex.source } },
                        { size_default: { [Op.in]: sizePatterns } },
                        { size_default: { [Op.regexp]: sizeRegex.source } }
                    ]
                }
            })
            for (let i of sizes) {
                i.size = replaceValid(i.size)
                i.size_default = replaceValid(i.size_default)
                await i.save()
            }
            return res.json(sizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async deleteClothesDigitalSizes(req, res, next) {
        try {
            const sizes = await Size.findAll({ where: { item_category: 'clothes' } })
            for (let i of sizes) {
                if (isNumericString(i.size), 'clothes') {
                    const allSizesUid = await Size.findAll({ where: { item_uid: i.item_uid } })
                    allSizesUid.forEach(async j => await j.destroy())
                }
            }
            return res.json(sizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async addCustomMark(req, res, next) {
        try {
            const items = await Item.findAll()
            const ids = items.map(i => Number(i.item_uid))
            for (let i = 0; i < ids.length; i += 10) {
                const { data } = await getSimpleInfo(ids.slice(i, i + 10))
                for (let j of data) {
                    let custom = ''
                    const item = items.find(item => item.item_uid == j.spuId)
                    if (j.title.includes('【定制球鞋】') && !item.name.includes('[Custom]')) {
                        custom = '[Custom] '
                        item.name = custom + item.name
                        await item.save()
                    }
                }
            }
            return res.json({ ids })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async findAutoDeclension(req, res, next) {
        try {
            const { brand } = req.query
            const item = await Item.findOne({ where: { brand } })
            if (item && item.declension) {
                return res.json(item.declension)
            } else {
                return res.json('')
            }
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async findAutoConstants(req, res, next) {
        try {
            const { name } = req.query
            const constants = await Constants.findAll({ where: { name } })
            return res.json(constants)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async clearModelsPhotos(req, res, next) {
        try {
            const shoes = await Item.findAll({ where: { category: 'shoes', photos_cleared: false }, limit: 300 })
            const shoesIds = shoes.map(i => i.item_uid)

            console.log('Started clearing photos...')

            for (let i of shoesIds) {
                const photos = await Photo.findAll({ where: { item_uid: i } })
                for (let j of photos) {
                    const pixel = await getFirstPixelColor(j.img)
                    const pixel2 = await getMidPixelColor(j.img)
                    if (((pixel.r < 250 || pixel.g < 250 || pixel.b < 250) && pixel.a === 1) && ((pixel2.r < 250 || pixel2.g < 250 || pixel2.b < 250) && pixel2.a === 1)) {
                        j.dataValues.color = pixel
                        await j.destroy()
                    }
                }
                const item = await Item.findOne({ where: { item_uid: i } })
                item.photos_cleared = true
                await item.save()
                console.log(`Cleared photos for item ${i}`)
            }

            const shoesAmount = await Item.count({ where: { category: 'shoes' } })
            const shoesCleared = await Item.count({ where: { category: 'shoes', photos_cleared: true } })

            if (shoesAmount - shoesCleared > 0) {
                throw new Error('Not all items cleared')
            }

            return res.json({ shoesAmount })
        } catch (e) {
            try {
                const shoesAmount = await Item.count({ where: { category: 'shoes' } })
                const shoesCleared = await Item.count({ where: { category: 'shoes', photos_cleared: true } })
                console.log('Was cleared', shoesCleared)
            } catch (e) {
                console.log(e)
                return next(ApiError.badRequest(e.message))
            }

            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async deleteNonValidItems(req, res, next) {
        try {
            const sizes = await Size.findAll({ where: { item_category: 'clothes' } })
            const nonValidSizes = sizes.filter(size => isNumericString(size.size, 'clothes'))
            for (let i of nonValidSizes) {
                const isExist = await DeletedItems.findOne({ where: { item_uid: i.item_uid.toString() } })
                if (!isExist) {
                    await DeletedItems.create({ item_uid: i.item_uid.toString() })
                }
                const itemToDelete = await Item.findOne({ where: { item_uid: i.item_uid.toString() } })
                if (itemToDelete) {
                    await itemToDelete.destroy()
                }
            }
            return res.json(nonValidSizes)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next) {
        try {
            const { idArr } = req.query
            for (let id of idArr) {
                const item = await Item.findOne({ where: { item_uid: id } })
                const photos = await Photo.findAll({ where: { item_uid: item.dataValues.item_uid } })
                const sizes = await Size.findAll({ where: { item_uid: item.dataValues.item_uid } })
                await item.destroy()
                for (let i of photos) {
                    await i.destroy()
                }
                for (let i of sizes) {
                    await i.destroy()
                }
            }
            return res.json({ message: 'Items deleted' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new ItemController()