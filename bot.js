var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var jsonfile = require('jsonfile');

var MongoClient = require('mongodb').MongoClient;


var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR = './.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
var configfile = 'config.json'

var bot;
var BOT_CONFIG = {};
var BOT_CONFIG_PATH = './bot.settings.json';
var BOT_PUSHING = false;


fs.readFile(BOT_CONFIG_PATH, function(err, config) {
	if (err) {
		console.log(err);
	} else {
		BOT_CONFIG = JSON.parse(config);
		if ("token" in BOT_CONFIG)
		{
			init_bot(BOT_CONFIG["token"]);
		}
		else
		{
			console.log("Bot token not found on "+BOT_CONFIG_PATH);
		}
	}

});

function init_bot(token)
{
	bot = new TelegramBot(token, {polling: true});
	bot_commands(bot);
	if ("mongodb" in BOT_CONFIG)
	{
		MongoClient.connect(BOT_CONFIG["mongodb"], function(err, db) {
			if(!err) {
				console.log("MongoDB connection working.");
			}
			db.close();
		});
	}
	else
	{
		console.log("MongoDB info not found on "+BOT_CONFIG_PATH);
	}

}

function bot_commands(bot)
{
	bot.onText(/\/id$/, function (msg, match) {
		var chatId = msg.chat.id;
		bot.sendMessage(chatId, "ID do chat: "+chatId);
	});
}
