// Configuration - REPLACE THESE WITH YOUR VALUES
const CONFIG = {
    CLIENT_ID: '1492875217440215061',
    REDIRECT_URI: 'https://jandrocoredashboard.netlify.app/callback',
    PERMISSIONS: '1099780504646', // All required permissions
    API_ENDPOINT: '/.netlify/functions' // Netlify Functions endpoint
};

// State management
let currentUser = null;
let userGuilds = [];
let selectedGuild = null;
let guildChannels = [];
let guildRoles = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on callback page
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        handleOAuthCallback(code);
    } else {
        // Check if user is already logged in (from localStorage)
        const storedToken = localStorage.getItem('discord_token');
        if (storedToken) {
            fetchUserData(storedToken);
        }
    }
    
    // Setup login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.onclick = (e) => {
            e.preventDefault();
            initiateDiscordLogin();
        };
    }
});

// Initiate Discord OAuth2 flow
function initiateDiscordLogin() {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    window.location.href = authUrl;
}

// Handle OAuth callback
async function handleOAuthCallback(code) {
    showLoading();
    
    try {
        // Exchange code for access token via serverless function
        const response = await fetch(`${CONFIG.API_ENDPOINT}/discord-auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        if (!response.ok) {
            throw new Error('Failed to authenticate');
        }
        
        const data = await response.json();
        localStorage.setItem('discord_token', data.access_token);
        
        // Clean URL
        window.history.replaceState({}, document.title, '/');
        
        // Fetch user data
        await fetchUserData(data.access_token);
    } catch (error) {
        console.error('OAuth error:', error);
        showError('Failed to authenticate with Discord. Please try again.');
        hideLoading();
    }
}

// Fetch user data from Discord
async function fetchUserData(token) {
    showLoading();
    
    try {
        // Fetch user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!userResponse.ok) {
            throw new Error('Failed to fetch user data');
        }
        
        currentUser = await userResponse.json();
        
        // Fetch guilds (servers)
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!guildsResponse.ok) {
            throw new Error('Failed to fetch guilds');
        }
        
        const allGuilds = await guildsResponse.json();
        
        // Filter guilds where user has admin permissions
        userGuilds = allGuilds.filter(guild => {
            // Check for ADMINISTRATOR permission (bit 3)
            return (guild.permissions & 0x8) === 0x8 || guild.owner;
        });
        
        if (userGuilds.length === 0) {
            showError('You need to be an administrator in at least one server to use this dashboard.');
            hideLoading();
            return;
        }
        
        showDashboard();
        hideLoading();
    } catch (error) {
        console.error('Error fetching user data:', error);
        showError('Failed to load your Discord data. Please try logging in again.');
        localStorage.removeItem('discord_token');
        hideLoading();
    }
}

// Show dashboard
function showDashboard() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('dashboardPage').classList.add('active');
    
    // Update nav
    const navButtons = document.getElementById('navButtons');
    const avatarUrl = currentUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    navButtons.innerHTML = `
        <div class="user-info">
            <img src="${avatarUrl}" alt="Avatar" class="user-avatar">
            <span>${currentUser.username}</span>
            <button class="logout-btn" onclick="logout()">Logout</button>
        </div>
    `;
    
    // Populate server selector
    const serverSelect = document.getElementById('serverSelect');
    serverSelect.innerHTML = userGuilds.map(guild => 
        `<option value="${guild.id}">${guild.name}</option>`
    ).join('');
    
    // Generate invite link
    document.getElementById('inviteLink').value = generateInviteLink();
    
    // Load first server
    loadServerConfig();
}

// Generate bot invite link
function generateInviteLink() {
    return `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&permissions=${CONFIG.PERMISSIONS}&scope=bot%20applications.commands`;
}

// Load server configuration
async function loadServerConfig() {
    const guildId = document.getElementById('serverSelect').value;
    selectedGuild = userGuilds.find(g => g.id === guildId);
    
    if (!selectedGuild) return;
    
    const token = localStorage.getItem('discord_token');
    
    try {
        // Fetch channels via bot (requires bot to be in server)
        const channelsResponse = await fetch(`${CONFIG.API_ENDPOINT}/discord-guild`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildId: guildId,
                type: 'channels'
            })
        });
        
        if (channelsResponse.ok) {
            guildChannels = await channelsResponse.json();
            populateChannelSelectors();
        }
        
        // Fetch roles via bot
        const rolesResponse = await fetch(`${CONFIG.API_ENDPOINT}/discord-guild`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildId: guildId,
                type: 'roles'
            })
        });
        
        if (rolesResponse.ok) {
            guildRoles = await rolesResponse.json();
            populateRoleSelectors();
        }
        
        // Load saved config from database
        await loadSavedConfig(guildId);
        
    } catch (error) {
        console.error('Error loading server config:', error);
        // Use fallback empty selectors
        populateChannelSelectors([]);
        populateRoleSelectors([]);
    }
}

// Populate channel selectors
function populateChannelSelectors(channels = guildChannels) {
    const textChannels = channels.filter(c => c.type === 0); // GUILD_TEXT
    
    const channelSelectors = [
        'welcomeChannel', 'goodbyeChannel', 'logChannel', 
        'levelChannel', 'applicationChannel', 'transcriptChannel'
    ];
    
    channelSelectors.forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '<option value="">Select a channel...</option>' + 
            textChannels.map(c => `<option value="${c.id}"># ${c.name}</option>`).join('');
    });
}

// Populate role selectors
function populateRoleSelectors(roles = guildRoles) {
    const roleSelectors = [
        'ownerRole', 'managerRole', 'modRole', 'vipRole', 
        'bannedRole', 'verifiedRole', 'unverifiedRole', 'autoRole'
    ];
    
    roleSelectors.forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '<option value="">Select a role...</option>' + 
            roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    });
}

// Load saved configuration from database
async function loadSavedConfig(guildId) {
    try {
        const response = await fetch(`${CONFIG.API_ENDPOINT}/get-config?guildId=${guildId}`);
        
        if (response.ok) {
            const config = await response.json();
            applyConfig(config);
        } else {
            // No saved config, use defaults
            applyConfig({
                prefix: '!',
                automod: true,
                aiMood: 'default'
            });
        }
    } catch (error) {
        console.error('Error loading saved config:', error);
        // Use defaults
        applyConfig({
            prefix: '!',
            automod: true,
            aiMood: 'default'
        });
    }
}

// Apply configuration to UI
function applyConfig(config) {
    // Basic settings
    document.getElementById('prefix').value = config.prefix || '!';
    document.getElementById('aiMood').value = config.aiMood || 'default';
    
    if (config.automod !== undefined) {
        const toggle = document.getElementById('automodToggle');
        if (config.automod) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
    
    // Channels
    if (config.channels) {
        Object.keys(config.channels).forEach(key => {
            const element = document.getElementById(key + 'Channel');
            if (element && config.channels[key]) {
                element.value = config.channels[key];
            }
        });
    }
    
    // Roles
    if (config.roles) {
        Object.keys(config.roles).forEach(key => {
            const element = document.getElementById(key + 'Role');
            if (element && config.roles[key]) {
                element.value = config.roles[key];
            }
        });
    }
    
    // Features
    if (config.features) {
        Object.keys(config.features).forEach(key => {
            const toggle = document.getElementById(key + 'Toggle');
            if (toggle) {
                if (config.features[key]) {
                    toggle.classList.add('active');
                } else {
                    toggle.classList.remove('active');
                }
            }
        });
    }
}

// Save configuration
async function saveConfig() {
    if (!selectedGuild) {
        alert('Please select a server first');
        return;
    }
    
    const config = {
        guildId: selectedGuild.id,
        prefix: document.getElementById('prefix').value,
        automod: document.getElementById('automodToggle').classList.contains('active'),
        aiMood: document.getElementById('aiMood').value,
        channels: {
            welcome: document.getElementById('welcomeChannel').value,
            goodbye: document.getElementById('goodbyeChannel').value,
            log: document.getElementById('logChannel').value,
            level: document.getElementById('levelChannel').value,
            application: document.getElementById('applicationChannel').value,
            transcript: document.getElementById('transcriptChannel').value
        },
        roles: {
            owner: document.getElementById('ownerRole').value,
            manager: document.getElementById('managerRole').value,
            mod: document.getElementById('modRole').value,
            vip: document.getElementById('vipRole').value,
            banned: document.getElementById('bannedRole').value,
            verified: document.getElementById('verifiedRole').value,
            unverified: document.getElementById('unverifiedRole').value,
            auto: document.getElementById('autoRole').value
        },
        features: {
            economy: document.getElementById('economyToggle').classList.contains('active'),
            leveling: document.getElementById('levelingToggle').classList.contains('active'),
            aiChat: document.getElementById('aiChatToggle').classList.contains('active'),
            fame: document.getElementById('fameToggle').classList.contains('active'),
            kingdom: document.getElementById('kingdomToggle').classList.contains('active'),
            social: document.getElementById('socialToggle').classList.contains('active')
        }
    };
    
    try {
        const response = await fetch(`${CONFIG.API_ENDPOINT}/save-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            alert('✅ Configuration saved successfully!');
        } else {
            throw new Error('Failed to save configuration');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        alert('❌ Failed to save configuration. Please try again.');
    }
}

// Toggle switch
function toggleSwitch(element) {
    element.classList.toggle('active');
}

// Copy invite link
function copyInviteLink() {
    const input = document.getElementById('inviteLink');
    input.select();
    document.execCommand('copy');
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.background = 'var(--success)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = 'var(--accent-primary)';
    }, 2000);
}

// Logout
function logout() {
    localStorage.removeItem('discord_token');
    currentUser = null;
    userGuilds = [];
    selectedGuild = null;
    
    document.getElementById('landingPage').style.display = 'flex';
    document.getElementById('dashboardPage').classList.remove('active');
    
    const navButtons = document.getElementById('navButtons');
    navButtons.innerHTML = `
        <a href="#" class="login-btn" id="loginBtn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Login with Discord
        </a>
    `;
    
    // Re-attach login handler
    document.getElementById('loginBtn').onclick = (e) => {
        e.preventDefault();
        initiateDiscordLogin();
    };
}

// UI helpers
function showLoading() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('loadingPage').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingPage').classList.remove('active');
}

function showError(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <h3 style="color: var(--error); margin-bottom: 0.5rem;">❌ Error</h3>
        <p>${message}</p>
        <button class="login-btn" onclick="location.href='/';" style="margin-top: 1rem;">Go Back</button>
    `;
    container.innerHTML = '';
    container.appendChild(errorDiv);
}
