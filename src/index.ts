import { Client, GatewayIntentBits, Partials, GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,      // For guild-related events
    GatewayIntentBits.GuildMembers, // For guild member events (like guildMemberAdd)
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction], // Helps with uncached members/channels/messages/reactions
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
    const welchannel = welcomeChannel;

    // Check if welcome cards are enabled
    const useWelcomeCard = welcomeSettings ? Boolean(welcomeSettings.enabled) : true;

    if (useWelcomeCard) {
      try {
        // Generate welcome card
        const welcomeCard = await createWelcomeCard(member);
        const attachment = new AttachmentBuilder(welcomeCard, { name: 'welcome-card.png' });

        // Prepare the welcome message by replacing placeholders
        let welcomeMessage = WELCOME_MESSAGE_TEMPLATE;
        welcomeMessage = welcomeMessage.replace('{user}', member.user.username);
        welcomeMessage = welcomeMessage.replace('{mention}', member.toString());
        welcomeMessage = welcomeMessage.replace('{server}', member.guild.name);

        // Send the welcome message with the card
        await welchannel.send({
          content: welcomeMessage,
          files: [attachment]
        });
        console.log(`✅ Sent welcome card to ${member.user.tag} in #${welchannel.name}`);
      } catch (cardError) {
        console.error(`❌ Failed to create/send welcome card for ${member.user.tag}:`, cardError);
        // Fallback to regular welcome message
        await sendRegularWelcome(welchannel, member);
      }
    } else {
      // Send regular welcome message
      await sendRegularWelcome(welchannel, member);
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

// Helper function to send regular welcome message
async function sendRegularWelcome(channel: TextChannel, member: GuildMember) {
  // Prepare the welcome message by replacing placeholders
  let welcomeMessage = WELCOME_MESSAGE_TEMPLATE;
  welcomeMessage = welcomeMessage.replace('{user}', member.user.username);
  welcomeMessage = welcomeMessage.replace('{mention}', member.toString());
  welcomeMessage = welcomeMessage.replace('{server}', member.guild.name);

  // Send the welcome message to the channel
  await channel.send(welcomeMessage);
  console.log(`✅ Sent welcome message to ${member.user.tag} in #${channel.name}`);
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

// Slash command handlers for admin features
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'welcomesetup') {
    if (!interaction.memberPermissions?.has('Administrator')) {
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