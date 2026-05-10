# JandroCore Dashboard - Setup Guide

## 🚀 Complete Setup Instructions

This dashboard allows users to log in with Discord, select their server, and configure your bot through a web interface.

---

## 📋 Prerequisites

1. **Discord Bot** - Your JandroCore bot must be created in Discord Developer Portal
2. **Netlify Account** - Free account at https://netlify.com
3. **Bot Token** - From Discord Developer Portal

---

## 🔧 Step 1: Discord Developer Portal Setup

### 1. Go to [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Select your bot application

### 3. Configure OAuth2:
   - Go to **OAuth2** → **General**
   - Add Redirect URL: `https://your-site-name.netlify.app/callback`
   - Click **Save Changes**

### 4. Get your credentials:
   - **Client ID**: Copy from OAuth2 → General
   - **Client Secret**: Click "Reset Secret" and copy it (save it somewhere safe!)
   - **Bot Token**: Go to "Bot" tab, copy your token

---

## 📦 Step 2: Deploy to Netlify

### Option A: Deploy via Netlify UI (Easiest)

1. **Create a GitHub repository**:
   - Create a new repo on GitHub
   - Upload all the dashboard files to it

2. **Connect to Netlify**:
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select your repository
   - Click "Deploy site"

3. **Configure Environment Variables**:
   - Go to **Site settings** → **Environment variables**
   - Add these variables:
     ```
     DISCORD_CLIENT_ID = your_client_id_here
     DISCORD_CLIENT_SECRET = your_client_secret_here
     DISCORD_BOT_TOKEN = your_bot_token_here
     REDIRECT_URI = https://your-site-name.netlify.app/callback
     ```

4. **Redeploy**:
   - Go to **Deploys** tab
   - Click "Trigger deploy" → "Deploy site"

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

---

## ⚙️ Step 3: Update Configuration Files

### 1. Edit `app.js`:

Find this section at the top:

```javascript
const CONFIG = {
    CLIENT_ID: 'YOUR_BOT_CLIENT_ID_HERE',
    REDIRECT_URI: 'https://your-site.netlify.app/callback',
    PERMISSIONS: '1099780504646',
    API_ENDPOINT: '/.netlify/functions'
};
```

Replace:
- `YOUR_BOT_CLIENT_ID_HERE` with your actual Client ID
- `https://your-site.netlify.app` with your actual Netlify URL

### 2. Update Discord Developer Portal:

Go back to Discord Developer Portal → OAuth2 → General

Make sure the Redirect URI matches exactly:
```
https://your-actual-netlify-url.netlify.app/callback
```

---

## 🗄️ Step 4: Database Setup (Optional but Recommended)

The dashboard currently uses in-memory storage, which resets when Netlify restarts.

### For Persistent Storage, Use MongoDB (Free):

1. **Create MongoDB Atlas account**: https://www.mongodb.com/cloud/atlas

2. **Create a cluster** (free tier)

3. **Get connection string**

4. **Update `netlify/functions/save-config.js` and `get-config.js`**:

Replace the in-memory Map with MongoDB:

```javascript
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function getDb() {
    if (!db) {
        await client.connect();
        db = client.db('jandrocore');
    }
    return db;
}

exports.handler = async (event) => {
    const database = await getDb();
    const configs = database.collection('configs');
    
    // For GET:
    const config = await configs.findOne({ guildId }) || defaultConfig;
    
    // For POST:
    await configs.updateOne(
        { guildId },
        { $set: config },
        { upsert: true }
    );
    
    // ... rest of code
};
```

5. **Add to package.json**:
```json
"dependencies": {
  "node-fetch": "^2.6.7",
  "discord.js": "^14.14.1",
  "mongodb": "^6.3.0"
}
```

6. **Add environment variable in Netlify**:
```
MONGODB_URI = your_mongodb_connection_string
```

---

## 🤖 Step 5: Connect Your Bot to Read the Config

Your bot needs to read configurations from the dashboard.

### Option A: API Endpoint (Recommended)

Add this to your bot's code:

```python
import aiohttp
import os

DASHBOARD_URL = "https://your-site.netlify.app"

async def get_server_config(guild_id):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{DASHBOARD_URL}/.netlify/functions/get-config?guildId={guild_id}") as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                # Return default config
                return {
                    "prefix": "!",
                    "automod": True,
                    "aiMood": "default",
                    # ... defaults
                }

# Use in your bot:
config = await get_server_config(guild.id)
prefix = config.get("prefix", "!")
```

### Option B: Shared Database

If you're using MongoDB, your bot can read directly from the same database.

---

## ✅ Step 6: Test Everything

1. **Visit your Netlify URL**
2. **Click "Login with Discord"**
3. **You should be redirected to Discord OAuth**
4. **Authorize the app**
5. **You should see the dashboard with your servers**
6. **Select a server and configure settings**
7. **Click Save**
8. **Test that your bot reads the new config**

---

## 🐛 Troubleshooting

### "Failed to authenticate"
- Check that CLIENT_ID and CLIENT_SECRET are correct in Netlify environment variables
- Make sure REDIRECT_URI in Netlify matches Discord Developer Portal exactly

### "No servers showing"
- Make sure you're an admin in at least one server
- Your bot must be in the server

### "Failed to load channels/roles"
- Make sure your bot is in the server
- Check that DISCORD_BOT_TOKEN is correct in environment variables
- Bot needs proper permissions (View Channels, Manage Roles)

### "Configuration not saving"
- Check browser console for errors
- Check Netlify function logs
- If using MongoDB, verify connection string

---

## 📝 File Structure

```
jandrocore-dashboard/
├── index.html              # Main dashboard page
├── app.js                  # Frontend JavaScript (Discord OAuth logic)
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies
├── netlify/
│   └── functions/
│       ├── discord-auth.js  # OAuth token exchange
│       ├── discord-guild.js # Fetch guild channels/roles
│       ├── get-config.js    # Get server configuration
│       └── save-config.js   # Save server configuration
└── README.md              # This file
```

---

## 🔐 Security Notes

1. **Never commit secrets** - Use environment variables only
2. **CLIENT_SECRET** should never be in frontend code
3. **Validate user permissions** before allowing config changes
4. **Use HTTPS** (Netlify provides this automatically)

---

## 🎯 Next Steps

1. **Custom Domain**: Add your own domain in Netlify settings
2. **Database**: Set up MongoDB for persistent storage
3. **Bot Integration**: Update your bot to read from the dashboard API
4. **Analytics**: Add Netlify Analytics to track usage

---

## 📞 Support

If you run into issues:
1. Check Netlify function logs
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Make sure Discord OAuth redirect URI matches exactly

---

## 🎉 You're Done!

Your dashboard is now live! Users can:
- Log in with Discord
- Select their server
- Configure all bot settings
- Save configuration that your bot can read

Enjoy! 🚀
