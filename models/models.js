const sequelize = require('../db')
const { DataTypes } = require('sequelize')
const { v4: uuidv4 } = require('uuid')

const Item = sequelize.define('items', {
    id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    brand: { type: DataTypes.STRING },
    declension: { type: DataTypes.STRING },
    model: { type: DataTypes.STRING },
    item_uid: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    img: { type: DataTypes.STRING },
    min_price: { type: DataTypes.FLOAT },
    max_price: { type: DataTypes.FLOAT },
    fav: { type: DataTypes.INTEGER, defaultValue: 0 },
    cart: { type: DataTypes.INTEGER, defaultValue: 0 },
    watch: { type: DataTypes.INTEGER, defaultValue: 0 },
    photos_cleared: { type: DataTypes.BOOLEAN, defaultValue: false },
    fitId: { type: DataTypes.STRING },
})

const DeletedItems = sequelize.define('deleted_items', {
    id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true, allowNull: false, unique: true },
    item_uid: { type: DataTypes.STRING, allowNull: false },
    img: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    deletion_type: { type: DataTypes.STRING }
})

const ModelWatch = sequelize.define('model_watch', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    brand: { type: DataTypes.STRING, allowNull: false },
    model: { type: DataTypes.STRING, allowNull: false },
    watch: { type: DataTypes.INTEGER, defaultValue: 0 },
})

const Photo = sequelize.define('photos', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    img: { type: DataTypes.STRING, allowNull: false },
    item_uid: { type: DataTypes.STRING, allowNull: false }
})

const Size = sequelize.define('sizes', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    size: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    price_0: { type: DataTypes.FLOAT },
    price_2: { type: DataTypes.FLOAT },
    price_3: { type: DataTypes.FLOAT },
    price_12: { type: DataTypes.FLOAT },
    delivery_0: { type: DataTypes.STRING },
    delivery_2: { type: DataTypes.STRING },
    delivery_3: { type: DataTypes.STRING },
    delivery_12: { type: DataTypes.STRING },
    item_uid: { type: DataTypes.STRING, allowNull: false },
    size_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'EU' },
    size_default: { type: DataTypes.STRING },
    item_category: { type: DataTypes.STRING },
    brand: { type: DataTypes.STRING },
})

const User = sequelize.define('user', {
    id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true, allowNull: false, unique: true },
    client: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    surname: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    chat_id: { type: DataTypes.STRING },
    link: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'client' },
    password: { type: DataTypes.STRING },
    sync_key: { type: DataTypes.STRING },
    link_type: { type: DataTypes.STRING, defaultValue: 'tg' },
})

const Fav = sequelize.define('favs', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_uid: { type: DataTypes.STRING, allowNull: false },
})

const Cart = sequelize.define('cart', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_uid: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.STRING, allowNull: false },
    ship: { type: DataTypes.STRING, allowNull: false, defaultValue: 'slow' },
})

const Order = sequelize.define('orders', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nickname: { type: DataTypes.STRING, defaultValue: '' },
    name: { type: DataTypes.STRING, allowNull: false },
    social_media: { type: DataTypes.STRING },
    social_media_type: { type: DataTypes.STRING },
    status: { type: DataTypes.INTEGER, defaultValue: 0 },
    manager: { type: DataTypes.STRING, defaultValue: '' },
    comment: { type: DataTypes.STRING, defaultValue: '' },
    checked_price: { type: DataTypes.BOOLEAN, defaultValue: false },
    recipient: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    ship_type: { type: DataTypes.STRING, defaultValue: 'point' },
    track: { type: DataTypes.STRING, defaultValue: '' },
    cargo_cost: { type: DataTypes.FLOAT },
    sdek_cost: { type: DataTypes.FLOAT },
    cargo_track: { type: DataTypes.STRING, defaultValue: '' },
    sdek_track: { type: DataTypes.STRING, defaultValue: '' },
    delivery_cost: { type: DataTypes.FLOAT, defaultValue: 0 },
    dimensions: { type: DataTypes.STRING, defaultValue: '' },
    is_split: { type: DataTypes.BOOLEAN, defaultValue: false },
    first_pay: { type: DataTypes.FLOAT, defaultValue: 0 },
    second_pay: { type: DataTypes.FLOAT, defaultValue: 0 },
    first_paid: { type: DataTypes.BOOLEAN, defaultValue: false },
    second_paid: { type: DataTypes.BOOLEAN, defaultValue: false },
    paid: { type: DataTypes.FLOAT, defaultValue: 0 },
    course: { type: DataTypes.FLOAT, allowNull: false },
    fee: { type: DataTypes.FLOAT, allowNull: false },
    cost: { type: DataTypes.FLOAT, allowNull: false },
    discount_cost: { type: DataTypes.FLOAT, defaultValue: 0 },
    paid: { type: DataTypes.FLOAT, defaultValue: 0 },
    discount: { type: DataTypes.INTEGER, defaultValue: 0 },
    promo_code: { type: DataTypes.STRING, defaultValue: '' },
    can_review: { type: DataTypes.BOOLEAN, defaultValue: true },
    from: { type: DataTypes.STRING, defaultValue: 'site' }
})

const OrderItem = sequelize.define('order_items', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_uid: { type: DataTypes.STRING, allowNull: false },
    img: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    model: { type: DataTypes.STRING, defaultValue: '' },
    size: { type: DataTypes.STRING, allowNull: false },
    ship: { type: DataTypes.STRING, defaultValue: 'slow' },
    status: { type: DataTypes.INTEGER, defaultValue: 1 },
    cny_cost: { type: DataTypes.FLOAT, allowNull: false },
    rub_cost: { type: DataTypes.FLOAT, allowNull: false },
    order_num: { type: DataTypes.STRING, defaultValue: '' },
    track: { type: DataTypes.STRING, defaultValue: '' },
    fee: { type: DataTypes.FLOAT, allowNull: false },
    delivery_cost: { type: DataTypes.FLOAT, allowNull: false },
})

const OrderPhoto = sequelize.define('order_photos', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    img: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'buy' },
})

const Promo = sequelize.define('promos', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false },
    discount: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
})

const Story = sequelize.define('stories', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    img: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
})

const Auth = sequelize.define('auth', {
    id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true, allowNull: false, unique: true },
    code: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'wait' },
    chat_id: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING }
})

const CityPoint = sequelize.define('city_points', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, unique: true },
    city: { type: DataTypes.STRING, allowNull: false },
    city_code: { type: DataTypes.INTEGER, allowNull: false },
    work_time: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING, allowNull: false },
})

const Constants = sequelize.define('constants', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.FLOAT, allowNull: false },
    type: { type: DataTypes.STRING }
})

User.hasMany(Fav, { foreignKey: 'client_id' })
Fav.belongsTo(User, { foreignKey: 'client_id' })

User.hasMany(Cart, { foreignKey: 'client_id' })
Cart.belongsTo(User, { foreignKey: 'client_id' })

User.hasMany(Order, { foreignKey: 'client_id' })
Order.belongsTo(User, { foreignKey: 'client_id' })

Order.hasMany(OrderItem, { foreignKey: 'order_id' })
OrderItem.belongsTo(Order, { foreignKey: 'order_id' })

Order.hasMany(OrderPhoto, { foreignKey: 'order_id' })
OrderPhoto.belongsTo(Order, { foreignKey: 'order_id' })

module.exports = {
    Auth,
    Item,
    DeletedItems,
    ModelWatch,
    Photo,
    Size,
    User,
    Fav,
    Cart,
    Order,
    OrderItem,
    OrderPhoto,
    Promo,
    Story,
    CityPoint,
    Constants
}