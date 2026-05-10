// This uses the same logic as save-config but for GET requests
// Netlify will route based on function name

exports.handler = async (event) => {
    const configStore = new Map();
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const params = new URLSearchParams(event.rawQuery);
        const guildId = params.get('guildId');

        if (!guildId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing guildId' })
            };
        }

        // Default config
        const defaultConfig = {
            prefix: '!',
            automod: true,
            aiMood: 'default',
            channels: {},
            roles: {},
            features: {
                economy: true,
                leveling: true,
                aiChat: true,
                fame: true,
                kingdom: true,
                social: true
            }
        };

        // In production, fetch from database:
        // const config = await db.collection('configs').findOne({ guildId }) || defaultConfig;

        const config = configStore.get(guildId) || defaultConfig;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(config)
        };

    } catch (error) {
        console.error('Get config error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
