import "dotenv/config"
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

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

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'say') {
		const text = interaction.options.getString('text');
		await interaction.reply(text);
	}

	if (interaction.commandName === 'purge') {
		if (!interaction.guild) {
			return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
		}
		if (!interaction.channel || !interaction.channel.bulkDelete) {
			return interaction.reply({ content: 'I cannot purge messages in this channel.', ephemeral: true });
		}
		const amount = interaction.options.getInteger('amount');
		try {
			const deletedMessages = await interaction.channel.bulkDelete(amount, true);
			await interaction.reply({ content: `Successfully purged ${deletedMessages.size} messages.`, ephemeral: true });
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while trying to purge messages in this channel. Make sure I have permissions to manage messages.', ephemeral: true });
		}
	}
});

client.login(token);
