const axios = require('axios')
const { config } = require('dotenv')

const $cdekHost = axios.create({
    baseURL: process.env.CDEK_URL,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
})

const $authCdekHost = axios.create({
    baseURL: process.env.CDEK_URL,
})

const $authPoizonHost = axios.create({
    baseURL: process.env.POIZON_URL
})

const $poizonHost = axios.create({
    baseURL: process.env.POIZON_URL
})

const poizonInterceptor = async (config, timeElapsed) => {
    config.headers.apiKey = process.env.POIZON_API_KEY
    if (timeElapsed) {
        config.params.timeElapsed = timeElapsed
    }
    return config
}

$authPoizonHost.interceptors.request.use(poizonInterceptor)

const cdekInterceptor = async config => {
    await getToken().then(token => {
        config.headers.authorization = `Bearer ${token}`
        return config
    })
    return config
}

$authCdekHost.interceptors.request.use(cdekInterceptor)

const getToken = async () => {
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', process.env.CLIENT_ID)
    params.append('client_secret', process.env.CLIENT_SECRET)

    const { data } = await $cdekHost.post('oauth/token', params)
    return data.access_token
}

module.exports = { $authCdekHost, $authPoizonHost, $poizonHost }