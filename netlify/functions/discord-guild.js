const { Client, GatewayIntentBits } = require('discord.js');

// Initialize Discord bot client
let botClient = null;

function getBotClient() {
    if (!botClient) {
        botClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers
            ]
        });
        botClient.login(process.env.DISCORD_BOT_TOKEN);
    }
    return botClient;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { guildId, type } = JSON.parse(event.body);

        if (!guildId || !type) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameters' })
            };
        }

        const client = getBotClient();

        // Wait for bot to be ready
        if (!client.isReady()) {
            await new Promise(resolve => client.once('ready', resolve));
        }

        const guild = await client.guilds.fetch(guildId);

        if (!guild) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Guild not found or bot not in guild' })
            };
        }

        let data;

        if (type === 'channels') {
            // Fetch channels
            const channels = await guild.channels.fetch();
            data = channels
                .filter(channel => channel.type === 0) // Text channels only
                .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type
                }));
        } else if (type === 'roles') {
            // Fetch roles
            const roles = await guild.roles.fetch();
            data = roles
                .filter(role => !role.managed && role.name !== '@everyone')
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    position: role.position
                }))
                .sort((a, b) => b.position - a.position);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid type' })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error fetching guild data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
