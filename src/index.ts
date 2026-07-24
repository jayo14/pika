import { Client, GatewayIntentBits, Partials, GuildMember, TextChannel, Role, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,      // For guild-related events
    GatewayIntentBits.GuildMembers, // For guild member events (like guildMemberAdd)
    GatewayIntentBits.GuildMessageReactions, // For reaction tracking
    GatewayIntentBits.DirectMessages, // For DM reactions
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildScheduledEvent], // Helps with uncached members/channels/messages/reactions/events
});

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
function setWelcomeSettings(guildId: string, backgroundImage: string | null, enabled: boolean): void {
  db.prepare(`
    INSERT OR REPLACE INTO welcome_settings (guild_id, background_image, enabled)
    VALUES (?, ?, ?)
  `).run(guildId, backgroundImage ?? null, enabled ? 1 : 0);
}

// Function to get role-specific welcome settings
function getRoleWelcomeSettings(guildId: string, roleId: string) {
  return db.prepare('SELECT * FROM role_welcome_settings WHERE guild_id = ? AND role_id = ? AND enabled = 1').get(guildId, roleId);
}

// Function to set role-specific welcome settings
function setRoleWelcomeSettings(guildId: string, roleId: string, message: string | null, channelId: string | null, enabled: boolean): void {
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

client.once('ready', () => {
  console.log(`🤖 Bot is online as ${client.user?.tag}`);

  // Set bot status to online with a custom activity
  client.user?.setPresence({
    activities: [{ name: 'welcoming new members', type: 0 }], // type 0 = Playing
    status: 'online',
  });
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

    if (useWelcomeCard) {
      try {
        // Generate welcome card
        const welcomeCard = await createWelcomeCard(member);
        const attachment = new AttachmentBuilder(welcomeCard, { name: 'welcome-card.png' });

        // Determine which message and channel to use
        let finalMessage = WELCOME_MESSAGE_TEMPLATE;
        let finalChannel = welcomeChannel;

        // Use role-specific settings if available
        if (roleSpecificSetting) {
          if (roleSpecificSetting.message) {
            finalMessage = roleSpecificSetting.message;
          }
          if (roleSpecificSetting.channel_id) {
            const roleChannel = member.guild.channels.cache.get(roleSpecificSetting.channel_id);
            if (roleChannel && roleChannel.isTextBased()) {
              finalChannel = roleChannel as TextChannel;
            }
          }
        }

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
      } catch (cardError) {
        console.error(`❌ Failed to create/send welcome card for ${member.user.tag}:`, cardError);
        // Fallback to regular welcome message
        await sendRegularWelcome(member, welcomeSettings, roleSpecificSetting, welcomeChannel, welcomeComponents);
      }
    } else {
      // Send regular welcome message
      await sendRegularWelcome(member, welcomeSettings, roleSpecificSetting, welcomeChannel, welcomeComponents);
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
async function sendRegularWelcome(member: GuildMember, welcomeSettings: any, roleSpecificSetting: any, defaultChannel: TextChannel, welcomeComponents: any[]) {
  // Determine which message and channel to use
  let finalMessage = WELCOME_MESSAGE_TEMPLATE;
  let finalChannel = defaultChannel;

  // Use role-specific settings if available
  if (roleSpecificSetting) {
    if (roleSpecificSetting.message) {
      finalMessage = roleSpecificSetting.message;
    }
    if (roleSpecificSetting.channel_id) {
      const roleChannel = member.guild.channels.cache.get(roleSpecificSetting.channel_id);
      if (roleChannel && roleChannel.isTextBased()) {
        finalChannel = roleChannel as TextChannel;
      }
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
      // Handle rules agreement buttons
      else if (customId === 'rules_accepted') {
        // Give a "Verified" role or similar
        const verifiedRole = interaction.guild?.roles.cache.find(r =>
          r.name.toLowerCase().includes('verified') ||
          r.name.toLowerCase().includes('member')
        );

        if (verifiedRole) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.roles.add(verifiedRole.id);
          await interaction.editReply({ content: 'You have been verified! Welcome to the community!', ephemeral: true });
        } else {
          await interaction.editReply({ content: 'Thank you for agreeing to the rules!', ephemeral: true });
        }
      }
      // Handle other button types
      else {
        await interaction.editReply({ content: `Button clicked: ${customId}`, ephemeral: true });
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

        addWelcomeComponent(guildId, 'select', label, customId, null, null, null, placeholder, minValues, maxValues, disabled, position);

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
        const components = getWelcomeComponents(guildId);

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
    } else if (subcommand === 'background') {
      // This would handle setting a custom background image
      await interaction.reply({
        content: 'Background image setting coming soon!',
        ephemeral: true
      });
    }
  }
});

// Login to Discord using the token from environment variables
client.login(process.env.DISCORD_TOKEN);