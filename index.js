import "dotenv/config"
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
	new SlashCommandBuilder()
		.setName('say')
		.setDescription('Repeats the text you provide.')
		.addStringOption(option =>
			option.setName('text')
				.setDescription('The text to say')
				.setRequired(true)
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

client.once('clientReady', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'say') {
		const text = interaction.options.getString('text');
		await interaction.reply(text);
	}
});

client.login(token);
