import { Client, GatewayIntentBits, Partials, GuildMember, TextChannel, Role, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, Invite } from 'discord.js';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { Canvas, loadImage } from '@napi-rs/canvas';
import { request } from 'undici';

// Load environment variables from .env file
dotenv.config();

// Initialize SQLite database for storing user preferences and settings
const db = new Database('./welcomebot.db');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    dm_opt_out BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS welcome_settings (
    guild_id TEXT PRIMARY KEY,
    background_image TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS role_welcome_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    message TEXT,
    channel_id TEXT,
    enabled BOOLEAN DEFAULT 1,
    UNIQUE(guild_id, role_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS welcome_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    component_type TEXT NOT NULL, -- 'button' or 'select'
    label TEXT NOT NULL,
    value TEXT, -- For buttons: custom_id, for selects: the value
    description TEXT, -- For selects: description of the option
    emoji TEXT, -- For buttons: emoji name or id
    style TEXT, -- For buttons: 'primary', 'secondary', 'success', 'danger'
    placeholder TEXT, -- For selects: placeholder text
    min_values INTEGER DEFAULT 1, -- For selects: minimum values
    max_values INTEGER DEFAULT 1, -- For selects: maximum values
    disabled BOOLEAN DEFAULT 0,
    position INTEGER DEFAULT 0, -- Order in which components appear
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// A/B Testing Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS ab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ab_test_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NOT NULL,
    name TEXT NOT NULL,
    message_text TEXT,
    weight INTEGER DEFAULT 1, -- Higher weight = more likely to be shown
    is_control BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS IF EXISTS ab_test_exposures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    exposed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clicked BOOLEAN DEFAULT 0,
    reacted BOOLEAN DEFAULT 0,
    FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ab_test_variants(id) ON DELETE CASCADE
  )
`);

// Invite Tracking Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS invite_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    invite_code TEXT NOT NULL,
    inviter_id TEXT, -- The user who created the invite
    uses INTEGER DEFAULT 0,
    max_uses INTEGER,
    temporary BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(guild_id, invite_code)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invite_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_code TEXT NOT NULL,
    user_id TEXT NOT NULL, -- The user who used the invite
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guild_id TEXT NOT NULL,
    FOREIGN KEY (invite_code) REFERENCES invite_tracking(invite_code) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS suspicious_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    invite_code TEXT NOT NULL,
    reason TEXT NOT NULL, -- Reason for flagging (e.g., 'rapid_joins', 'suspicious_accounts')
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1, -- Whether we're still monitoring this
    action_taken BOOLEAN DEFAULT 0, -- Whether we've taken action (deleted, etc.)
    UNIQUE(guild_id, invite_code)
  )
`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,      // For guild-related events
    GatewayIntentBits.GuildMembers, // For guild member events (like guildMemberAdd)
    GatewayIntentBits.GuildMessageReactions, // For reaction tracking
    GatewayIntentBits.DirectMessages, // For DM reactions
    GatewayIntentBits.GuildMessageTyping, // For typing indicators (engagement)
    GatewayIntentBits.GuildInvites, // For invite tracking
    GatewayIntentBits.GuildScheduledEvents, // For scheduled events
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildScheduledInvite], // Helps with uncached members/channels/messages/reactions/events/invites
});

// Cache for invites to track usage
const inviteCache = new Map();

// Welcome message template: can be customized via WELCOME_MESSAGE env var
// Placeholders: {user} = username, {mention} = member mention, {server} = guild name
const WELCOME_MESSAGE_TEMPLATE = process.env.WELCOME_MESSAGE
  || 'Welcome {mention} to the server! We\'re glad to have you here.';

// Welcome DM template
const WELCOME_DM_TEMPLATE = process.env.WELCOME_DM_MESSAGE
  || 'Hey {user}! Thanks for joining {server}! To stop receiving welcome DMs, react with ❌ to this message.';

// Function to check if user has opted out of DMs
function hasUserOptedOutOfDMs(userId: string): boolean {
  const row = db.prepare('SELECT dm_opt_out FROM user_preferences WHERE user_id = ?').get(userId);
  return row ? Boolean(row.dm_opt_out) : false;
}

// Function to set user's DM opt-out preference
function setUserDMOptOut(userId: string, optOut: boolean): void {
  db.prepare(`
    INSERT OR REPLACE INTO user_preferences (user_id, dm_opt_out)
    VALUES (?, ?)
  `).run(userId, optOut ? 1 : 0);
}

// Function to get welcome settings for a guild
function getWelcomeSettings(guildId: string) {
  return db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId);
}

// Function to set welcome settings for a guild
function setWelcomeSettings(ggid: string, backgroundImage: string | null, enabled: boolean): void {
  db.prepare(`
    INSERT OR REPLACE INTO welcome_settings (guild_id, background_image, enabled)
    VALUES (?, ?, ?)
  `).run(guildId, backgroundImage ?? null, enabled ? 1 : 0);
}

// Function to get role-specific welcome settings
function getRoleWelcomeSettings(ggid: string, roleId: string) {
  return db.prepare('SELECT * FROM role_welcome_settings WHERE guild_id = ? AND role_id = ? AND enabled = 1').get(guildId, roleId);
}

// Function to set role-specific welcome settings
function setRoleWelcomeSettings(ggid: string, roleId: string, message: string | null, channelId: string | null, enabled: boolean): void {
  db.prepare(`
    INSERT OR REPLACE INTO role_welcome_settings (guild_id, role_id, message, channel_id, enabled)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, roleId, message ?? null, channelId ?? null, enabled ? 1 : 0);
}

// Function to get welcome components for a guild
function getWelcomeComponents(guildId: string) {
  return db.prepare('SELECT * FROM welcome_components WHERE guild_id = ? ORDER BY position').all(guildId);
}

// Function to add a welcome component
function addWelcomeComponent(guildId: string, componentType: string, label: string, value: string | null, description: string | null, emoji: string | null, style: string | null, placeholder: string | null, minValues: number, maxValues: number, disabled: boolean, position: number): void {
  db.prepare(`
    INSERT INTO welcome_components (guild_id, component_type, label, value, description, emoji, style, placeholder, min_values, max_values, disabled, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, componentType, label, value ?? null, description ?? null, emoji ?? null, style ?? null, placeholder ?? null, minValues, maxValues, disabled ? 1 : 0, position);
}

// Function to remove a welcome component
function removeWelcomeComponent(componentId: number): void {
  db.prepare('DELETE FROM welcome_components WHERE id = ?').run(componentId);
}

// Function to clear all welcome components for a guild
function clearWelcomeComponents(guildId: string): void {
  db.prepare('DELETE FROM welcome_components WHERE guild_id = ?').run(guildId);
}

// Function to get active A/B test for a guild
function getActiveAbTest(guildId: string) {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM ab_tests
    WHERE guild_id = ?
      AND is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(guildId, now, now);
}

// Function to get variants for an A/B test
function getAbTestVariants(testId: number) {
  return db.prepare(`
    SELECT * FROM ab_test_variants
    WHERE test_id = ?
    ORDER BY weight DESC
  `).all(testId);
}

// Function to select a variant based on weights
function selectAbTestVariant(variants: any[]) {
  if (variants.length === 0) return null;

  // Calculate total weight
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0);

  // If all weights are 0, default to equal distribution
  if (totalWeight === 0) {
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Select based on weight
  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    if (random < (variant.weight || 1)) {
      return variant;
    }
    random -= (variant.weight || 1);
  }

  // Fallback (shouldn't reach here)
  return variants[0];
}

// Function to log an exposure to an A/B test variant
function logAbTestExposure(testId: number, variantId: number, userId: string, guildId: string) {
  db.prepare(`
    INSERT INTO ab_test_exposures (test_id, variant_id, user_id, guild_id)
    VALUES (?, ?, ?, ?)
  `).run(testId, variantId, userId, guildId);
}

// Function to record engagement with an A/B test variant
function recordAbTestEngagement(exposureId: number, engagementType: 'click' | 'react') {
  const column = engagementType === 'click' ? 'clicked' : 'reacted';
  db.prepare(`
    UPDATE ab_test_exposures
    SET ${column} = 1
    WHERE id = ?
  `).run(exposureId);
}

// Function to get A/B test statistics
function getAbTestStats(testId: number) {
  return db.prepare(`
    SELECT
      v.id as variant_id,
      v.name as variant_name,
      v.is_control,
      COUNT(e.id) as exposures,
      SUM(CASE WHEN e.clicked = 1 THEN 1 ELSE 0 END) as clicks,
      SUM(CASE WHEN e.reacted = 1 THEN 1 ELSE 0 END) as reactions
    FROM ab_test_variants v
    LEFT JOIN ab_test_exposures e ON v.id = e.variant_id
    WHERE v.test_id = ?
    GROUP BY v.id, v.name, v.is_control
  `).all(testId);
}

// Function to initialize invite tracking for a guild
async function initializeInviteTracking(guildId: string) {
  try {
    const invites = await client.guilds.cache.get(guildId)?.invites.fetch() || new Collection();

    invites.forEach(invite => {
      // Store invite in database if not already present
      const existing = db.prepare('SELECT * FROM invite_tracking WHERE guild_id = ? AND invite_code = ?').get(guildId, invite.code);

      if (!existing) {
        db.prepare(`
          INSERT INTO invite_tracking (guild_id, invite_code, inviter_id, uses, max_uses, temporary, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          guildId,
          invite.code,
          invite.inviter ? invite.inviter.id : null,
          invite.uses,
          invite.maxUses || 0,
          invite.temporary ? 1 : 0,
          invite.createdAt?.toISOString() || null,
          invite.expiresAt?.toISOString() || null
        );
      }

      // Update cache
      inviteCache.set(invite.code, {
        uses: invite.uses,
        maxUses: invite.maxUses,
        inviterId: invite.inviter ? invite.inviter.id : null,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt
      });
    });
  } catch (error) {
    console.error('Error initializing invite tracking:', error);
  }
}

// Function to update invite usage when a member joins
async function handleInviteUsage(member: GuildMember) {
  try {
    // Get current invites
    const newInvites = await member.guild.invoices.fetch() || new Collection();

    // Check which invite was used by comparing with cache
    const usedInvite = await findUsedInvite(member.guild.id, newInvites);

    if (usedInvite) {
      // Update invite usage in database
      const inviteCode = usedInvite.code;

      // Increment usage count in tracking table
      db.prepare(`
        UPDATE invite_tracking
        SET uses = uses + 1
        WHERE guild_id = ? AND invite_code = ?
      `).run(member.guild.id, inviteCode);

      // Record the usage
      db.prepare(`
        INSERT INTO invite_usage (invite_code, user_id, guild_id)
        VALUES (?, ?, ?)
      `).run(inviteCode, member.id, member.guild.id);

      // Update cache
      if (inviteCache.has(inviteCode)) {
        const cached = inviteCache.get(inviteCode);
        inviteCache.set(inviteCode, {
          ...cached,
          uses: (cached.uses || 0) + 1
        });
      }

      // Check for suspicious activity
      await checkForSuspiciousInvite(member.guild.id, inviteCode, member);
    }

    // Update cache with current invites
    updateInviteCache(newInvites);
  } catch (error) {
    console.error('Error handling invite usage:', error);
  }
}

// Function to find which invite was used by comparing old and new states
async function findUsedInvite(guildId: string, newInvites: Collection<string, Invite>): Promise<Invite | null> {
  try {
    const cachedInvites = inviteCache.get(guildId) || new Map();

    // Check for new invites or increased usage
    for (const [code, invite] of newInvites) {
      const cached = cachedInvites.get(code);

      if (!cached) {
        // New invite created
        return invite;
      }

      if (invite.uses > (cached.uses || 0)) {
        // Usage increased
        return invite;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding used invite:', error);
    return null;
  }
}

// Function to update the invite cache
function updateInviteCache(newInvites: Collection<string, Invite>) {
  newInvites.forEach(invite => {
    inviteCache.set(invite.code, {
      uses: invite.uses,
      maxUses: invite.maxUses,
      inviterId: invite.inviter ? invite.inviter.id : null,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt
    });
  });
}

// Function to check for suspicious invite patterns
async function checkForSuspiciousInvite(guildId: string, inviteCode: string, member: GuildMember) {
  try {
    // Get usage stats for this invite
    const usageCount = db.prepare(`
      SELECT COUNT(*) as count FROM invite_usage
      WHERE invite_code = ? AND guild_id = ?
    `).get(inviteCode, guildId).count;

    // Get recent usages (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentUsage = db.prepare(`
      SELECT COUNT(*) as count FROM invite_usage
      WHERE invite_code = ? AND guild_id = ? AND joined_at > ?
    `).get(inviteCode, guildId, oneHourAgo).count;

    // Check if inviter is a recent account (potential alt)
    const inviteInfo = db.prepare(`
      SELECT inviter_id FROM invite_tracking
      WHERE invite_code = ? AND guild_id = ?
    `).get(inviteCode, guildId);

    let isSuspect = false;
    let reason = '';

    // Rule 1: Too many joins in short time (potential raid)
    if (recentUsage >= 5) { // 5 or more joins in an hour
      isSuspect = true;
      reason = 'rapid_joins';
    }

    // Rule 2: Inviter account is very new (potential alt)
    if (inviteInfo && inviteInfo.inviter_id) {
      const inviter = await guild.members.fetch(inviteInfo.invitor_id).catch(() => null);
      if (inviter) {
        const accountAge = Date.now() - inviter.user.createdTimestamp;
        const oneWeekAgo = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

        if (accountAge < oneWeekAgo) { // Account less than 1 week old
          isSuspect = true;
          reason = 'new_account_inviter';
        }
      }
    }

    // Rule 3: Suspicious pattern of alternate accounts joining
    // Check if multiple recent joins have similar account ages
    if (usageCount >= 3) {
      const recentJoins = db.prepare(`
        SELECT iu.user_id, iu.joined_at
        FROM invite_usage iu
        WHERE iu.invite_code = ? AND iu.guild_id = ?
        ORDER BY iu.joined_at DESC
        LIMIT 10
      `).get(inviteCode, guildId);

      // This would require more complex analysis - for now we'll skip this check
    }

    // If suspicious, flag it
    if (isSuspect) {
      // Check if already flagged
      const existing = db.prepare(`
        SELECT * FROM suspicious_invites
        WHERE guild_id = ? AND invite_code = ? AND is_active = 1
      `).get(guildId, inviteCode);

      if (!existing) {
        // Flag as suspicious
        db.prepare(`
          INSERT INTO suspicious_invites (guild_id, invite_code, reason)
          VALUES (?, ?, ?)
        `).run(guildId, inviteCode, reason);

        // Log to console
        console.log(`⚠️ Suspicious invite detected: ${inviteCode} (reason: ${reason})`);

        # Consider auto-deleting the invite if it's highly suspicious
        # if (reason === 'rapid_joins' && recentUsage >= 10) {
        #   try {
        #     const invite = await guild.invites.fetch(inviteCode);
        #     if (invite) {
        #       await invite.delete('Suspected raid or bot activity');
        #       console.log(`🗑️ Deleted suspicious invite: ${inviteCode}`);
        #
        #       // Mark action as taken
        #       db.prepare(`
        #         UPDATE suspicious_invites
        #         SET action_taken = 1
        #         WHERE guild_id = ? AND invite_code = ?
        #       `).run(guildId, inviteCode);
        #     }
        #   } catch (error) {
        #     console.error(`Failed to delete suspicious invite ${inviteCode}:`, error);
        #   }
        # }
      }
    }
  } catch (error) {
    console.error('Error checking for suspicious invite:', error);
  }
}

// Function to create a welcome card
async function createWelcomeCard(member: GuildMember): Promise<Buffer> {
  const width = 1024;
  const height = 500;

  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Get user avatar
  let avatar;
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const response = await request(avatarURL);
    const arrayBuffer = await new Response(response.body).arrayBuffer();
    avatar = await loadImage(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Failed to load avatar:', error);
    // Use default avatar if fetch fails
    avatar = await loadImage(member.user.defaultAvatarURL);
  }

  // Draw avatar circle
  const avatarSize = 200;
  const avatarX = (width - avatarSize) / 2;
  const avatarY = 80;

  // Create circular clipping path for avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
  ctx.close();
  ctx.clip();

  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  // Add stroke around avatar
  ctx.strokeStyle = '#00bfff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
  ctx.close();
  ctx.stroke();

  // Welcome text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Welcome to`, width/2, avatarY + avatarSize + 80);

  ctx.font = 'bold 60px sans-serif';
  ctx.fillText(member.user.username, width/2, avatarY + avatarSize + 150);

  // Server name
  ctx.fillStyle = '#87ceeb';
  ctx.font = '28px sans-serif';
  ctx.fillText(`Welcome to ${member.guild.name}`, width/2, avatarY + avatarSize + 200);

  // Member count
  ctx.fillStyle = '#ffd700';
  ctx.font = '24px sans-serif';
  ctx.fillText(`You are member #${member.guild.memberCount}`, width/2, avatarY + avatarSize + 250);

  // Add some decorative elements
  ctx.strokeStyle = '#00bfff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, height - 50);
  ctx.lineTo(width - 100, height - 50);
  ctx.stroke();

  return canvas.encode('png');
}

client.once('ready', async () => {
  console.log(`🤖 Bot is online as ${client.user?.tag}`);

  // Set bot status to online with a custom activity
  client.user?.setPresence({
    activities: [{ name: 'welcoming new members', type: 0 }], // type 0 = Playing
    status: 'online',
  });

  # Initialize invite tracking for all guilds the bot is in
  for (const guild of client.guilds.cache.values()) {
    await initializeInviteTracking(guild.id);
  }
});

client.on('guildCreate', async (guild) => {
  // Initialize invite tracking when bot joins a new guild
  await initializeInviteTracking(guild.id);
});

client.on('guildMemberAdd', async (member: GuildMember) => {
  try {
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;

    if (!welcomeChannelId) {
      console.error('❌ WELCOME_CHANNEL_ID is not set in environment variables');
      return;
    }

    // Fetch the welcome channel (might not be cached)
    const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId) as TextChannel | null;

    // Validate that the channel exists and is a text-based channel
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      console.error(`❌ Welcome channel with ID ${welcomeChannelId} not found or is not a text channel`);
      return;
    }

    // Track invite usage for this member
    await handleInviteUsage(member);

    // Get welcome settings for this guild
    const welcomeSettings = getWelcomeSettings(member.guild.id);

    // Check if welcome cards are enabled
    const useWelcomeCard = welcomeSettings ? Boolean(welcomeSettings.enabled) : true;

    // Check for role-specific welcome settings
    let roleSpecificSetting = null;
    let highestPositionRole = null;
    let highestPosition = -1;

    // Check each role the member has (excluding @everyone)
    for (const [roleId, role] of member.roles.cache) {
      if (role.id === member.guild.id) continue; // Skip @everyone role

      const roleSettings = getRoleWelcomeSettings(member.guild.id, role.id);
      if (roleSettings && role.position > highestPosition) {
        highestPosition = role.position;
        highestPositionRole = role;
        roleSpecificSetting = roleSettings;
      }
    }

    // Get welcome components for this guild
    const welcomeComponents = getWelcomeComponents(member.guild.id);

    // Check for active A/B test
    const activeTest = getActiveAbTest(member.guild.id);
    let selectedVariant = null;
    let exposureId = null;

    if (activeTest) {
      const variants = getAbTestVariants(activeTest.id);
      selectedVariant = selectAbTestVariant(variants);

      if (selectedVariant) {
        // Log exposure to this variant
        const result = db.prepare(`
          INSERT INTO ab_test_exposures (test_id, variant_id, user_id, guild_id)
          VALUES (?, ?, ?, ?)
        `).run(activeTest.id, selectedVariant.id, member.id, member.guild.id);
        exposureId = result.lastInsertRowid;
      }
    }

    // Determine which message to use
    let finalMessage = WELCOME_MESSAGE_TEMPLATE;

    // Use A/B test variant if available
    if (selectedVariant && selectedVariant.message_text) {
      finalMessage = selectedVariant.message_text;
    }
    // Use role-specific settings if available
    else if (roleSpecificSetting && roleSpecificSetting.message) {
      finalMessage = roleSpecificSetting.message;
    }

    // Determine which channel to use
    let finalChannel = welcomeChannel;

    // Use role-specific channel if available
    if (roleSpecificSetting && roleSpecificSetting.channel_id) {
      const roleChannel = member.guild.channels.cache.get(roleSpecificSetting.channel_id);
      if (roleChannel && roleChannel.isTextBased()) {
        finalChannel = roleChannel as TextChannel;
      }
    }

    if (useWelcomeCard) {
      try {
        // Generate welcome card
        const welcomeCard = await createWelcomeCard(member);
        const attachment = new AttachmentBuilder(welcomeCard, { name: 'welcome-card.png' });

        // Replace placeholders in the message
        finalMessage = finalMessage.replace('{user}', member.user.username);
        finalMessage = finalMessage.replace('{mention}', member.toString());
        finalMessage = finalMessage.replace('{server}', member.guild.name);

        // Build action rows from components
        const actionRows = buildActionRows(welcomeComponents);

        // Send the welcome message with the card and components
        await finalChannel.send({
          content: finalMessage,
          files: [attachment],
          components: actionRows
        });
        console.log(`✅ Sent welcome card to ${member.user.tag} in #${finalChannel.name}`);

        // Track engagement if this was part of an A/B test
        if (exposureId !== null) {
          // We'll track engagement through button clicks and reactions
          // This is handled in the interaction and reaction listeners
        }
      } catch (cardError) {
        console.error(`❌ Failed to create/send welcome card for ${member.user.tag}:`, cardError);
        // Fallback to regular welcome message
        await sendRegularWelcome(member, welcomeSettings, roleSpecificSetting, welcomeChannel, welcomeComponents, exposureId);
      }
    } else {
      // Send regular welcome message
      await sendRegularWelcome(member, welcomeSettings, roleSpecificSetting, welcomeChannel, welcomeComponents, exposureId);
    }

    // Send welcome DM if user hasn't opted out
    if (!hasUserOptedOutOfDMs(member.id)) {
      try {
        let welcomeDM = WELCOME_DM_TEMPLATE;
        welcomeDM = welcomeDM.replace('{user}', member.user.username);
        welcomeDM = welcomeDM.replace('{server}', member.guild.name);

        const dmMessage = await member.send(welcomeDM);

        // Wait for user to react with ❌ to opt out of future DMs
        const filter = (reaction, user) =>
          user.id === member.id &&
          reaction.emoji.name === '❌';

        const collector = dmMessage.createReactionCollector({ filter, time: 300000 }); // 5 minute timeout

        collector.on('collect', (reaction, user) => {
          if (reaction.emoji.name === '❌') {
            setUserDMOptOut(user.id, true);
            user.send('You have opted out of receiving welcome DMs. You can opt back in anytime by reacting with ✅ to any future welcome DM.');
            collector.stop();
          }
        });

        collector.on('end', (collected, reason) => {
          if (reason === 'time') {
            // Remove the reaction collector message after timeout if no response
            dmMessage.delete().catch(console.error);
          }
        });

        console.log(`✅ Sent welcome DM to ${member.user.tag}`);
      } catch (dmError) {
        console.error(`❌ Failed to send welcome DM to ${member.user.tag}:`, dmError);
        // User might have DMs disabled, continue without crashing
      }
    } else {
      console.log(`ℹ️ Skipped welcome DM for ${member.user.tag} (user has opted out)`);
    }
  } catch (error) {
    console.error('❌ Failed to send welcome message:', error);
    // Important: Don't crash the bot on individual errors
  }
});

// Helper function to build action rows from components
function buildActionRows(components: any[]): any[] {
  // Group components by row (max 5 components per row, max 5 rows)
  const actionRows: any[] = [];
  let currentRow: any[] = [];

  for (const component of components) {
    let componentBuilder;

    if (component.component_type === 'button') {
      const button = new ButtonBuilder()
        .setCustomId(component.value || `button_${component.id}`)
        .setLabel(component.label);

      // Set style
      switch (component.style) {
        case 'primary':
          button.setStyle(ButtonStyle.Primary);
          break;
        case 'secondary':
          button.setStyle(ButtonStyle.Secondary);
          break;
        case 'success':
          button.setStyle(ButtonStyle.Success);
          break;
        case 'danger':
          button.setStyle(ButtonStyle.Danger);
          break;
        default:
          button.setStyle(ButtonStyle.Primary);
      }

      // Set emoji if provided
      if (component.emoji) {
        button.setEmoji(component.emoji);
      }

      // Set disabled state
      button.setDisabled(Boolean(component.disabled));

      componentBuilder = button;
    } else if (component.component_type === 'select') {
      const select = new StringSelectMenuBuilder()
        .setCustomId(component.value || `select_${component.id}`)
        .setPlaceholder(component.placeholder || 'Select an option')
        .setMinValues(component.min_values || 1)
        .setMaxValues(component.max_values || 1)
        .setDisabled(Boolean(component.disabled));

      // For simplicity, we'll add a single option. In a real implementation,
      // you might want to store options separately.
      if (component.description) {
        // Using label as the only option for simplicity
        // In practice, you'd want to store multiple options per select menu
        const optionLabel = component.label.length > 100 ? component.label.substring(0, 97) + '...' : component.label;
        const optionDescription = component.description.length > 100 ? component.description.substring(0, 97) + '...' : component.description;
        select.addOptions([
          {
            label: optionLabel,
            value: component.value || `option_${component.id}`,
            description: optionDescription
          }
        ]);
      }

      componentBuilder = select;
    }

    if (componentBuilder) {
      // If current row has 5 components, start a new row
      if (currentRow.length >= 5) {
        actionRows.push(new ActionRowBuilder().addComponents(currentRow));
        currentRow = [];
      }
      currentRow.push(componentBuilder);
    }
  }

  // Add any remaining components to a new row
  if (currentRow.length > 0) {
    actionRows.push(new ActionRowBuilder().addComponents(currentRow));
  }

  return actionRows;
}

// Helper function to send regular welcome message
async function sendRegularWelcome(member: GuildMember, welcomeSettings: any, roleSpecificSetting: any, defaultChannel: TextChannel, welcomeComponents: any[], exposureId: number | null = null) {
  // Determine which message and channel to use
  let finalMessage = WELCOME_MESSAGE_TEMPLATE;

  // Use A/B test variant if available
  if (exposureId !== null) {
    // We would look up the variant from the exposure, but for simplicity
    // we'll rely on the selection made earlier in the function
    // In a real implementation, we'd pass the selected variant down
  }

  // Use role-specific settings if available
  if (roleSpecificSetting && roleSpecificSetting.message) {
    finalMessage = roleSpecificSetting.message;
  }

  let finalChannel = defaultChannel;

  // Use role-specific channel if available
  if (roleSpecificSetting && roleSpecificSetting.channel_id) {
    const roleChannel = member.guild.channels.cache.get(roleSpecificSetting.channel_id);
    if (roleChannel && roleChannel.isTextBased()) {
      finalChannel = roleChannel as TextChannel;
    }
  }

  // Replace placeholders in the message
  finalMessage = finalMessage.replace('{user}', member.user.username);
  finalMessage = finalMessage.replace('{mention}', member.toString());
  finalMessage = finalMessage.replace('{server}', member.guild.name);

  // Build action rows from components
  const actionRows = buildActionRows(welcomeComponents);

  // Send the welcome message to the channel
  if (actionRows.length > 0) {
    await finalChannel.send({
      content: finalMessage,
      components: actionRows
    });
  } else {
    await finalChannel.send(finalMessage);
  }

  console.log(`✅ Sent welcome message to ${member.user.tag} in #${finalChannel.name}`);
}

// Handle reactions to welcome DMs for opting back in
client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Check if this is a reaction to a message we sent
  // we'll check if it's a ✅ reaction on a DM from the bot
  if (reaction.emoji.name === '✅' && reaction.message.channel.type === 'dm') {
    // Check if the message is from our bot (by checking if it contains our welcome DM pattern)
    const messageContent = reaction.message.content;
    if (messageContent.includes('Thanks for joining')) {
      setUserDMOptOut(user.id, false);
      try {
        await user.send('You have opted back in to receive welcome DMs!');
      } catch (error) {
        console.error(`Failed to send opt-in confirmation to ${user.tag}:`, error);
      }
    }
  }

  // Track reactions for A/B testing
  // We would need to map the message to an exposure record
  // This is simplified - in practice you'd want to store message IDs with exposures
});

// Handle button clicks and select menu interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // Defer the reply to avoid interaction failure
  await interaction.deferReply().catch(() => {}); // Ignore errors if interaction is already replied to

  try {
    // Handle button clicks
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Handle role selection buttons
      if (customId.startsWith('role_')) {
        const roleId = customId.substring(5); // Remove 'role_' prefix
        const role = interaction.guild?.roles.cache.get(roleId);

        if (role) {
          // Toggle the role
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            await interaction.editReply({ content: `Removed the **${role.name}** role!`, ephemeral: true });
          } else {
            await member.roles.add(roleId);
            await interaction.editReply({ content: `Added the **${role.name}** role!`, ephemeral: true });
          }
        } else {
          await interaction.editReply({ content: 'Role not found.', ephemeral: true });
        }
      }
    }

    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      const selectedValues = interaction.values;

      // Handle role selection menus
      if (customId.startsWith('role_select_')) {
        // This would typically map to a set of roles based on selected values
        // For simplicity, we'll just acknowledge the selection
        await interaction.editReply({
          content: `You have selected: ${selectedValues.join(', ')}`,
          ephemeral: true
        });
      }
      // Handle other select menus
      else {
        await interaction.editReply({
          content: `Selection received: ${selectedValues.join(', ')}`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing your interaction.', ephemeral: true });
      } else {
        await interaction.editReply({ content: 'An error occurred while processing your interaction.' });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
});

// Slash command handlers for admin features
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'welcomesetup') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      const guildId = interaction.guildId;

      const currentSettings = getWelcomeSettings(guildId) || { guild_id: guildId, background_image: null, enabled: true };
      setWelcomeSettings(guildId, currentSettings.background_image, enabled);

      await interaction.reply({
        content: `Welcome cards have been ${enabled ? 'enabled' : 'disabled'} for this server.`,
        ephemeral: true
      });
    } else if (subcommand === 'role') {
      const role = interaction.options.getRole('role');
      const enabled = interaction.options.getBoolean('enabled');
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel');

      if (!role) {
        await interaction.reply({ content: 'Please specify a role.', ephemeral: true });
        return;
      }

      const guildId = interaction.guildId;
      const channelId = channel ? channel.id : null;

      setRoleWelcomeSettings(guildId, role.id, message ?? null, channelId, enabled);

      await interaction.reply({
        content: `Welcome settings for role ${role.name} have been ${enabled ? 'enabled' : 'disabled'}.${message ? ' Message updated.' : ''}${channel ? ' Channel updated.' : ''}`,
        ephemeral: true
      });
    } else if (subcommand === 'component') {
      const componentType = interaction.options.getSubcommand();

      if (componentType === 'button_add') {
        const label = interaction.options.getString('label', true);
        const customId = interaction.options.getString('custom_id');
        const style = interaction.options.getString('style', false) || 'primary';
        const emoji = interaction.options.getString('emoji');
        const disabled = interaction.options.getBoolean('disabled') || false;

        const guildId = interaction.guildId;
        // Get next position
        const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM welcome_components WHERE guild_id = ?').get(guildId);
        const position = (maxPosRow.maxPos !== null ? maxPosRow.maxPos : -1) + 1;

        addWelcomeComponent(guildId, 'button', label, customId, null, emoji, style, null, 0, 0, disabled, position);

        await interaction.reply({
          content: `Button "${label}" added to welcome message.`,
          ephemeral: true
        });
      } else if (componentType === 'button_remove') {
        const componentId = interaction.options.getInteger('id', true);
        removeWelcomeComponent(componentId);
        await interaction.reply({
          content: `Button component removed.`,
          ephemeral: true
        });
      } else if (componentType === 'select_add') {
        const label = interaction.options.getString('label', true);
        const customId = interaction.options.getString('custom_id');
        const placeholder = interaction.options.getString('placeholder');
        const minValues = interaction.options.getInteger('min_values') || 1;
        const maxValues = interaction.options.getInteger('max_values') || 1;
        const disabled = interaction.options.getBoolean('disabled') || false;

        const guildId = interaction.guildId;
        // Get next position
        const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM welcome_components WHERE guild_id = ?').get(guildId);
        const position = (maxPosRow.maxPos !== null ? maxPosRow.maxPos : -1) + 1;

        addWelcomeComponent(guilId, 'select', label, customId, null, null, null, placeholder, minValues, maxValues, disabled, position);

        await interaction.reply({
          content: `Select menu "${label}" added to welcome message.`,
          ephemeral: true
        });
      } else if (componentType === 'select_remove') {
        const componentId = interaction.options.getInteger('id', true);
        removeWelcomeComponent(componentId);
        await interaction.reply({
          content: `Select menu component removed.`,
          ephemeral: true
        });
      } else if (componentType === 'clear') {
        const guildId = interaction.guildId;
        clearWelcomeComponents(guildId);
        await interaction.reply({
          content: `All welcome components cleared.`,
          ephemeral: true
        });
      } else if (componentType === 'list') {
        const guildId = interaction.guildId;
        let components = getWelcomeComponents(guildId);

        if (components.length === 0) {
          await interaction.reply({
            content: 'No welcome components configured.',
            ephemeral: true
          });
          return;
        }

        let response = 'Welcome Components:\n';
        components.forEach((comp: any, index: number) => {
          const typeEmoji = comp.component_type === 'button' ? '🔘' : '📋';
          response += `${index + 1}. ${typeEmoji} **${comp.label}** (${comp.component_type})`;
          if (comp.description) {
            response += ` - ${comp.description}`;
          }
          response += `\n`;
        });

        await interaction.reply({
          content: response,
          ephemeral: true
        });
      }
    } else if (subcommand === 'abtest') {
      const abTestSubcommand = interaction.options.getSubcommand();

      if (abTestSubcommand === 'create') {
        const name = interaction.options.getString('name', true);
        const description = interaction.options.getString('description');

        const guildId = interaction.guildId;

        // Check if there's already an active test
        const existingActive = getActiveAbTest(guildId);
        const isActive = !existingActive ? 1 : 0; // Only activate if no active test exists

        const result = db.prepare(`
          INSERT INTO ab_tests (guild_id, name, description, is_active)
          VALUES (?, ?, ?, ?)
        `).run(guildId, name, description ?? null, isActive);

        const testId = result.lastInsertRowid;

        await interaction.reply({
          content: `A/B test "${name}" created successfully. Use \`/welcomesetup abtest variant add\` to add variants.`,
          ephemeral: true
        });
      } else if (abTestSubcommand === 'variant') {
        const variantSubcommand = interaction.options.getSubcommand();

        if (variantSubcommand === 'add') {
          const testName = interaction.options.getString('test', true);
          const variantName = interaction.options.getString('name', true);
          const message = interaction.options.getString('message');
          const weight = interaction.options.getInteger('weight') || 1;
          const isControl = interaction.options.getBoolean('is_control') || false;

          const guildId = interaction.guildId;
          const test = db.prepare('SELECT id FROM ab_tests WHERE guild_id = ? AND name = ?').get(guildId, testName);

          if (!test) {
            await interaction.reply({ content: `A/B test "${testName}" not found.`, ephemeral: true });
            return;
          }

          const result = db.prepare(`
            INSERT INTO ab_test_variants (test_id, name, message_text, weight, is_control)
            VALUES (?, ?, ?, ?, ?)
          `).run(test.id, variantName, message ?? null, weight, isControl ? 1 : 0);

          await interaction.reply({
            content: `Variant "${variantName}" added to A/B test "${testName}".`,
            ephemeral: true
          });
        } else if (variantSubcommand === 'list') {
          const testName = interaction.options.getString('test', true);

          const guildId = interaction.guildId;
          const test = db.prepare('SELECT id FROM ab_tests WHERE guild_id = ? AND name = ?').get(guildId, testName);

          if (!test) {
            await interaction.reply({ content: `A/B test "${testName}" not found.`, ephemeral: true });
            return;
          }

          const variants = getAbTestVariants(test.id);

          if (varks.length === 0) {
            await interaction.reply({
              content: `No variants found for A/B test "${testName}".`,
              ephemeral: true
            });
            return;
          }

          let response = `Variants for A/B test "${testName}":\n`;
          variants.forEach((v: any, index: number) => {
            const controlBadge = v.is_control ? ' 🏆 (Control)' : '';
            response += `${index + 1}. **${v.name}** (Weight: ${v.weight})${controlbadge}\n`;
            if (v.message_text) {
              const preview = v.message_text.length > 50 ? v.message_text.substring(0, 47) + '...' : v.message_text;
              response += `   Preview: ${preview}\n`;
            }
          });

          await interaction.reply({
            content: response,
            ephemeral: true
          });
        } else if (variantSubcommand === 'remove') {
          const variantId = interaction.options.getInteger('id', true);

          // Get variant info before deleting
          const variant = db.prepare('SELECT v.name, t.name as test_name FROM ab_test_variants v JOIN ab_tests t ON v.test_id = t.id WHERE v.id = ?').get(variantId);

          if (!variant) {
            await interaction.reply({ content: 'Variant not found.', ephemeral: true });
            return;
          }

          db.prepare('DELETE FROM ab_test_variants WHERE id = ?').run(variantId);

          await interaction.reply({
            content: `Variant "${variant.name}" removed from A/B test "${variant.test_name}".`,
            ephemral: true
          });
        } else if (vbatSubcommand === 'start') {
          const testName = interaction.options.getString('test', true);

          const guildId = interaction.guildId;
          const test = db.prepare('SELECT id FROM ab_tests WHERE guild_id = ? AND name = ?').get(ggid, testName);

          if (!test) {
            await interaction.reply({ content: `A/B test "${testName}" not found.`, ephemeral: true });
            return;
          }

          // Deactivate any other active tests for this guild
          db.prepare('UPDATE ab_tests SET is_active = 0 WHERE guild_id = ? AND id != ?').run(guildId, test.id);

          // Activate this test
          db.prepare('UPDATE ab_tests SET is_active = 1 WHERE id = ?').run(test.id);

          await interaction.reply({
            content: `A/B test "${testName}" is now active.`,
            ephemeral: true
          });
        } else if (vbatSubcommand === 'stop') {
          const testName = interaction.options.getString('test', true);

          const guildId = interaction.guildId;
          const test = db.prepare('SELECT id FROM ab_tests WHERE guild_id = ? AND name = ?').get(guildId, testName);

          if (!test) {
            await interaction.reply({ content: `A/B test "${testName}" not found.`, ephemeral: true });
            return;
          }

          // Deactivate the test
          db.prepare('UPDATE ab_tests SET is_active = 0 WHERE id = ?').run(test.id);

          await interaction.reply({
            content: `A/B test "${testName}" has been stopped.`,
            ephemeral: true
          });
        } else if (vbatSubcommand === 'stats') {
          const testName = interaction.options.getString('test', true);

          const guildId = interaction.guildId;
          const test = db.prepare('SELECT id FROM ab_tests WHERE guild_id = ? AND name = ?').get(guildId, testName);

          if (!test) {
            await interaction.reply({ content: `A/B test "${testName}" not found.`, ephemeral: true });
            return;
          }

          const stats = getAbTestStats(test.id);

          if (stats.length === 0) {
            await interaction.reply({
              content: `No data available for A/B test "${testName}".`,
              ephemeral: true
            });
            return;
          }

          let response = `A/B Test Statistics for "${testName}":\n\n`;
          stats.forEach((s: any, index: number) => {
            const controlBadge = s.is_control ? ' 🏆 (Control)' : '';
            const conversionRate = s.exposures > 0 ?
              ((s.clicks + s.reactions) / s.exposures * 100).toFixed(2) + '%' : '0%';

            response += `${index + 1}. **${s.variant_name}**${controlbadge}\n`;
            response += `   Exposures: ${s.exposures}\n`;
            response += `   Clicks: ${s.clicks}\n`;
            response += `   Reactions: ${s.reactions}\n`;
            response += `   Engagement Rate: ${conversionRate}\n\n`;
          });

          await interaction.reply({
            content: response,
            ephemeral: true
          });
        }
      } else if (abTestSubcommand === 'background') {
        // This would handle setting a custom background image
        await interaction.reply({
          content: 'Background image setting coming soon!',
          ephemeral: true
        });
      }
    } else if (subcommand === 'invite') {
      const inviteSubcommand = interaction.options.getSubcommand();

      if (inviteSubcommand === 'stats') {
        const guildId = interaction.guildId;

        // Get overall invite stats
        const totalInvites = db.prepare('SELECT COUNT(*) as count FROM invite_tracking WHERE guild_id = ?').get(guildId).count;
        const totalUses = db.prepare('SELECT SUM(uses) as total FROM invite_tracking WHERE guild_id = ?').get(guildId).total || 0;
        const suspiciousCount = db.prepare('SELECT COUNT(*) as count FROM suspicious_invites WHERE guild_id = ? AND is_active = 1').get(guildId).count;

        let response = `Invite Statistics for ${interaction.guild?.name}:\n\n`;
        response += `Total Invites Tracked: ${totalInvites}\n`;
        response += `Total Uses: ${totalUses}\n`;
        response += `Suspicious Flags: ${suspiciousCount}\n\n`;

        // Get top used invites
        const topInvites = db.prepare(`
          SELECT it.invite_code, it.uses, u.username as inviter_name
          FROM invite_tracking it
          LEFT JOIN users u ON it.inviter_id = u.id
          WHERE it.guild_id = ?
          ORDER BY it.uses DESC
          LIMIT 5
        `).all(guildId);

        if (topInvites.length > 0) {
          response += `Top Used Invites:\n`;
          topInvites.forEach((invite: any, index: number) => {
            response += `${index + 1}. ${invite.invite_code} - ${invite.uses} uses`;
            if (invite.inviter_name) {
              response += ` (by ${invite.inviter_name})`;
            }
            response += '\n';
          });
        }

        // Get recent suspicious invites
        const recentSuspicious = db.prepare(`
          SELECT si.invite_code, si.reason, si.detected_at, u.username as inviter_name
          FROM suspicious_invites si
          LEFT JOIN invite_tracking it ON si.invite_code = it.invite_code AND si.guild_id = it.guild_id
          LEFT JOIN users u ON it.inviter_id = u.id
          WHERE si.guild_id = ? AND si.is_active = 1
          ORDER BY si.detected_at DESC
          LIMIT 5
        `).all(guildId);

        if (recentSuspicious.length > 0) {
          response += `\nRecent Suspicious Invites:\n`;
          recentSuspicious.forEach((suspect: any, index: number) => {
            response += `${index + 1}. ${suspect.invite_code} - ${suspect.reason}`;
            if (suspect.inviter_name) {
              response += ` (by ${suspect.inviter_name})`;
            }
            response += ` (${new Date(suspect.detected_at).toLocaleString()})\n`;
          });
        }

        await interaction.reply({
          content: response,
          ephemeral: true
        });
      } else if (inviteSubcommand === 'reset') {
        const guildId = interaction.guildId;

        // Clear suspicious flags (but keep tracking data)
        db.prepare('UPDATE suspicious_invites SET is_active = 0 WHERE guild_id = ?').run(guildId);

        await interaction.reply({
          content: 'Invite tracking data reset. All suspicious flags cleared.',
          ephemeral: true
        });
      }
    }
  }
});

// Login to Discord using the token from environment variables
client.login(process.env.DISCORD_TOKEN);