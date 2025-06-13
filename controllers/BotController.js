const bot = require('../index');

async function sendMessageToUser(userId, message) {
    try {
        await bot.telegram.sendMessage(userId, message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

module.exports = {
    sendMessageToUser,
}