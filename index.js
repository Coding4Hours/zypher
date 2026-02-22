import "dotenv/config"
import {
	Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, Colors, AuditLogEvent, Partials, ChannelType,
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildMembers,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const sendModLog = async (guild, embed) => {
	if (!guild) return;
	const logChannel = guild.channels.cache.find(channel => channel.name === 'mod-logs');
	if (logChannel) {
		try {
			await logChannel.send({ embeds: [embed] });
		} catch (error) {
			console.error('Failed to send mod log:', error);
		}
	}
};

client.on('guildAuditLogEntryCreate', async (auditLogEntry, guild) => {
	const { action, executorId, targetId, reason } = auditLogEntry;

	const executor = executorId ? await client.users.fetch(executorId).catch(() => null) : null;
	const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;

	let embed = new EmbedBuilder().setTimestamp();

	if (action === AuditLogEvent.MemberBanAdd) {
		embed
			.setTitle('User Banned')
			.setColor(Colors.DarkRed)
			.addFields(
				{ name: 'Target', value: target ? target.toString() : 'Unknown User', inline: true },
				{ name: 'Moderator', value: executor ? executor.toString() : 'Unknown Moderator', inline: true },
				{ name: 'Reason', value: reason || '*(No reason provided)*' },
			);
		if (target) embed.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() });
	} else if (action === AuditLogEvent.MemberBanRemove) {
		embed
			.setTitle('User Unbanned')
			.setColor(Colors.Green)
			.addFields(
				{ name: 'Target', value: target ? target.toString() : 'Unknown User', inline: true },
				{ name: 'Moderator', value: executor ? executor.toString() : 'Unknown Moderator', inline: true },
			);
		if (target) embed.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() });
	} else if (action === AuditLogEvent.MemberKick) {
		embed
			.setTitle('User Kicked')
			.setColor(Colors.Orange)
			.addFields(
				{ name: 'Target', value: target ? target.toString() : 'Unknown User', inline: true },
				{ name: 'Moderator', value: executor ? executor.toString() : 'Unknown Moderator', inline: true },
				{ name: 'Reason', value: reason || '*(No reason provided)*' },
			);
		if (target) embed.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() });
	} else {
		return;
	}

	await sendModLog(guild, embed);
});

const commands = [
	new SlashCommandBuilder()
		.setName('say')
		.setDescription('Repeats the text you provide.')
		.addStringOption(option =>
			option.setName('text')
				.setDescription('The text to say')
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Purges up to 100 messages.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption(option =>
			option.setName('amount')
				.setDescription('Number of messages to purge (1-100)')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100)
		),
	new SlashCommandBuilder()
		.setName('setup-modlogs')
		.setDescription('Sets up a #mod-logs channel for the server.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageDelete', async message => {
	if (message.partial) return;
	if (message.author?.bot) return;

	const embed = new EmbedBuilder()
		.setTitle('Message Deleted')
		.setColor(Colors.Red)
		.setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
		.addFields(
			{ name: 'Channel', value: message.channel.toString(), inline: true },
			{ name: 'Author', value: message.author.toString(), inline: true },
			{ name: 'Content', value: message.content || '*(No content)*' },
		)
		.setTimestamp();

	await sendModLog(message.guild, embed);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
	if (oldMessage.partial) return;
	if (oldMessage.author?.bot) return;
	if (oldMessage.content === newMessage.content) return;

	const embed = new EmbedBuilder()
		.setTitle('Message Edited')
		.setColor(Colors.Blue)
		.setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
		.addFields(
			{ name: 'Channel', value: oldMessage.channel.toString(), inline: true },
			{ name: 'Author', value: oldMessage.author.toString(), inline: true },
			{ name: 'Original', value: oldMessage.content || '*(No content)*' },
			{ name: 'New', value: newMessage.content || '*(No content)*' },
		)
		.setTimestamp();

	await sendModLog(oldMessage.guild, embed);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'say') {
		const text = interaction.options.getString('text');
		await interaction.reply(text);
	}

	if (interaction.commandName === 'setup-modlogs') {
		if (!interaction.guild) {
			return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
		}

		const existing = interaction.guild.channels.cache.find(c => c.name === 'mod-logs');
		if (existing) {
			return interaction.reply({ content: `A #mod-logs channel already exists: ${existing.toString()}`, flags: MessageFlags.Ephemeral });
		}

		try {
			const channel = await interaction.guild.channels.create({
				name: 'mod-logs',
				type: ChannelType.GuildText,
				permissionOverwrites: [
					{
						id: interaction.guild.id,
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: interaction.guild.members.me.id,
						allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
					},
				],
			});
			await interaction.reply({ content: `Created ${channel.toString()}! Make sure to give moderators permission to see it.`, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error('Setup modlogs error:', error);
			await interaction.reply({ content: 'Failed to create channel. Do I have "Manage Channels" permission?', flags: MessageFlags.Ephemeral });
		}
	}

	if (interaction.commandName === 'purge') {
		if (!interaction.guild) {
			return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
		}
		const targetChannel = interaction.channel;
		const amount = interaction.options.getInteger('amount');

		const botMember = interaction.guild.members.me;
		if (!targetChannel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
			return interaction.reply({ content: 'I don\'t have permission to manage messages in this channel.', flags: MessageFlags.Ephemeral });
		}

		try {
			await targetChannel.bulkDelete(amount, true).then(async messages => {
				await interaction.reply({ content: `Successfully purged ${messages.size} messages.`, flags: MessageFlags.Ephemeral });

				const logEmbed = new EmbedBuilder()
					.setTitle('Messages Purged')
					.setColor(Colors.Orange)
					.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
					.addFields(
						{ name: 'Channel', value: targetChannel.toString(), inline: true },
						{ name: 'Amount', value: messages.size.toString(), inline: true },
						{ name: 'Moderator', value: interaction.user.toString(), inline: true },
					)
					.setTimestamp();

				await sendModLog(interaction.guild, logEmbed);
			})
				.catch(console.error);
		} catch (error) {
			console.error('Purge error:', error);
			await interaction.reply({ content: 'There was an error while trying to purge messages. Make sure I have permissions to manage messages.', flags: MessageFlags.Ephemeral });
		}
	}
});

client.login(token);
