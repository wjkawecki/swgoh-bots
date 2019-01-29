import helpers from '../../../helpers/helpers';

export default class Utulity {
	constructor(Client, config, channels) {
		this.Client = Client;
		this.config = config;
		this.channels = channels;
		this.guild = Client.guilds.first();

		this.listenToMessages();
		// this.listenToReactions();
	}

	listenToMessages() {
		this.Client.on('message', msg => {
			const args = msg.content.slice(this.config.commandPrefix.length).trim().split(/ +/g) || [];
			const command = args.shift().toLowerCase();

			if (!this.config.DEV && msg.channel.id === this.config.channels.bot_playground) return;
			if (msg.channel.type !== 'text') return;
			if (msg.content.indexOf(this.config.commandPrefix) !== 0) return;
			if (msg.author.bot) return;

			switch (command) {
				case '':
				case 'help':
					this.helpReply(msg);
					break;

				case 'echo':
					if (msg.member.roles.has(this.config.roles.officer))
						this.sendEcho(msg, command, args[0], args[1]);
					break;

				case 'fetchmessage':
				case 'fetch':
					if (msg.member.roles.has(this.config.roles.officer))
						this.fetchMessage(msg, args[0], args[1]);
					break;

				case 'dm':
					if (msg.member.roles.has(this.config.roles.member))
						this.sendDM(msg, command, args[0]);
					break;
			}
		});
	}

	listenToReactions() {
		this.Client.on('messageReactionAdd', (messageReaction, user) => {
			if (this.guild.members.get(user.id).roles.has(this.config.roles.officer) ||
				(this.config.DEV && this.guild.members.get(user.id).user.bot)) {
				if (this.hasReaction(messageReaction, '🔍') && this.config.DEV)
					this.addCheck(messageReaction, user, 30 * 1000);
			}
		});

		this.Client.on('messageReactionRemove', (messageReaction, user) => {
			if (this.guild.members.get(user.id).roles.has(this.config.roles.officer))
				this.deleteCheck(messageReaction, user);
		});
	}

	hasReaction(messageReaction, emojiName) {
		return messageReaction.emoji.name === emojiName;
	}

	fetchMessage(msg, messageId, channelId, cb) {
		const channel = this.Client.channels.get(channelId || msg.channel.id);

		channel.fetchMessage(messageId)
			.then((message) => cb ? cb.bind(this, msg, message)() : {})
			.then(() => msg.delete())
			.catch(err => {
				console.log(err);

				msg.react('🚫')
					.then(() => setTimeout(() => {
						msg.reactions.get('🚫') && msg.reactions.get('🚫').remove();
					}, 2000));
			});
	}

	sendEcho(msg, command, mentionString, channelString) {
		const attachmentsArray = [];
		let mention, channel = '';
		let {
			attachments,
			content
		} = msg;

		msg.react('⌛');

		mention = helpers.isMention(mentionString) || helpers.isRoleMention(mentionString) ? `${mentionString} ` : helpers.isSnowflake(mentionString) ? `<@${mentionString}> ` : '';

		if (channelString) {
			channel = helpers.isMention(channelString) ? channelString.substring(2, channelString.length - 1) : helpers.isSnowflake(channelString) ? channelString : msg.channel.id;
		} else {
			channel = msg.channel.id;
		}

		if (channelString && (helpers.isMention(channelString) || helpers.isSnowflake(channelString))) {
			content = content.split(`${channelString} `).pop();
		} else if (mentionString && (helpers.isMention(mentionString) || helpers.isSnowflake(mentionString))) {
			content = content.split(`${mentionString} `).pop();
		} else {
			content = content.split(`${this.config.commandPrefix}${command} `).pop();
		}

		content = `${mention}${content}`;
		attachments.forEach((attachment => attachmentsArray.push(attachment.url)));

		this.Client.channels.get(channel).send(content, {
				files: attachmentsArray
			})
			.then(() => msg.delete())
			.catch(() => msg.react('🚫'));
	}

	helpReply(msg) {
		msg.reply(`__CourtOfLaw__ commands:
\`-echo [userID/mention] [channelId/mention] message\` *- officer only*. Copy the message and remove original message. Tag a player/role (optional) and post in different channel (optional).
\`-fetch messageId [channelId]\` *- officer only*. Bot fetches specific message for further use.`);
	}

	sendDM(msg, command, mentionString) {
		const mention = helpers.isMention(mentionString) ? mentionString.substring(2, mentionString.length - 1) : helpers.isSnowflake(mentionString) ? mentionString : '';

		if (mention) {
			this.Client.fetchUser(mention)
				.then((user) => user.createDM()
					.then(channel => channel.send(msg.content.split(`${mentionString} `).pop()))
					.then(() => msg.delete())
					.catch(() => msg.react('🚫'))
				).catch(() => msg.react('🚫'));
		} else {
			msg.author.createDM()
				.then(channel => channel.send(msg.content.split(`${command} `).pop()))
				.then(() => msg.delete())
				.catch(() => msg.react('🚫'));
		}
	}
}
