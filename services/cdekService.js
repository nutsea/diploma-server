const { $authCdekHost } = require('./index')

const getCityList = async () => {
    try {
        const { data } = await $authCdekHost.get('location/cities')
        return data
    } catch (e) {
        console.log(e)
        return e
    }
}

const getPointsList = async (type, country_code) => {
    try {
        const { data } = await $authCdekHost.get(`deliverypoints`, { params: { type, country_code } })
        return data
    } catch (e) {
        console.log(e)
        return e
    }
}

module.exports = { getCityList, getPointsList }