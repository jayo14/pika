import { Client, GatewayIntentBits, Partials, GuildMember, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

// Load environment variables from .env file
dotenv.config();

// Initialize SQLite database for storing user preferences
const db = new Database('./welcomebot.db');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    dm_opt_out BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,      // For guild-related events
    GatewayIntentBits.GuildMembers, // For guild member events (like guildMemberAdd)
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Channel], // Helps with uncached members/channels
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

    // Prepare the welcome message by replacing placeholders
    let welcomeMessage = WELCOME_MESSAGE_TEMPLATE;
    welcomeMessage = welcomeMessage.replace('{user}', member.user.username);
    welcomeMessage = welcomeMessage.replace('{mention}', member.toString());
    welcomeMessage = welcomeMessage.replace('{server}', member.guild.name);

    // Send the welcome message to the channel
    await welcomeChannel.send(welcomeMessage);
    console.log(`✅ Sent welcome message to ${member.user.tag} in #${welcomeChannel.name}`);

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

// Handle reactions to welcome DMs for opting back in
client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Check if this is a reaction to a message we sent (we could store message IDs, but for simplicity)
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

// Login to Discord using the token from environment variables
client.login(process.env.DISCORD_TOKEN);