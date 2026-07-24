import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,      // For guild-related events
    GatewayIntentBits.GuildMembers, // For guild member events (like guildMemberAdd)
  ],
  partials: [Partials.User, Partials.GuildMember], // Helps with uncached members
});

// Welcome message template: can be customized via WELCOME_MESSAGE env var
// Placeholders: {user} = username, {mention} = member mention, {server} = guild name
const WELCOME_MESSAGE_TEMPLATE = process.env.WELCOME_MESSAGE
  || 'Welcome {mention} to the server! We\'re glad to have you here.';

client.once('ready', () => {
  console.log(`🤖 Bot is online as ${client.user?.tag}`);

  // Set bot status to online with a custom activity
  client.user?.setPresence({
    activities: [{ name: 'welcoming new members', type: 0 }], // type 0 = Playing
    status: 'online',
  });
});

client.on('guildMemberAdd', async (member) => {
  try {
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;

    if (!welcomeChannelId) {
      console.error('❌ WELCOME_CHANNEL_ID is not set in environment variables');
      return;
    }

    // Fetch the welcome channel (might not be cached)
    const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId);

    // Validate that the channel exists and is a text-based channel
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      console.error(`❌ Welcome channel with ID ${welcomeChannelId} not found or is not a text channel`);
      return;
    }

    // Prepare the welcome message by replacing placeholders
    let welcomeMessage = WELCOME_MESSAGE_TEMPLATE;
    welcomeMessage = welcomeMessage.replace('{user}', member.user.username);
    welcomeMessage = welcomeMessage.replace('{mention}', member.toString());
    welcomeMessage = welcomeMessage.replace('{server}', member.guild.name);

    // Send the welcome message
    await welcomeChannel.send(welcomeMessage);
    console.log(`✅ Sent welcome message to ${member.user.tag} in #${welcomeChannel.name}`);
  } catch (error) {
    console.error('❌ Failed to send welcome message:', error);
    // Important: Don't crash the bot on individual errors
  }
});

// Login to Discord using the token from environment variables
client.login(process.env.DISCORD_TOKEN);