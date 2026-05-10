// For now, using in-memory storage
// In production, replace with a database (MongoDB, PostgreSQL, etc.)
const configStore = new Map();

exports.handler = async (event) => {
    const { httpMethod, path, body } = event;
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET config
        if (httpMethod === 'GET') {
            const params = new URLSearchParams(event.rawQuery);
            const guildId = params.get('guildId');

            if (!guildId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing guildId' })
                };
            }

            const config = configStore.get(guildId) || {
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(config)
            };
        }

        // POST (save) config
        if (httpMethod === 'POST') {
            const config = JSON.parse(body);
            const { guildId } = config;

            if (!guildId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing guildId' })
                };
            }

            // Save config
            configStore.set(guildId, config);

            // In production, save to database:
            // await db.collection('configs').updateOne(
            //     { guildId },
            //     { $set: config },
            //     { upsert: true }
            // );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Config error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
