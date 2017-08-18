var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var jsonfile = require('jsonfile');

var MongoClient = require('mongodb').MongoClient;


const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_DIR = './.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
const configfile = 'config.json'

var bot;
var BOT_CONFIG = {};
const BOT_CONFIG_PATH = './bot.settings.json';
var BOT_PUSHING = false;

//Interface types
const INTERFACE_INFO = 1;
const INTERFACE_TABLE = 2;

var BOT_INTERFACES = {};

class Interface extends Object
{
	constructor(name,sheet_id,type,range)
	{
		this.name = name;
		this.sheet_id = sheet_id;
		this.type = type;
		this.range = range;
	}
	static add(name,chat_id,sheet_id,type,range)
	{
		if (!(chat_id in BOT_INTERFACES))
		{
			BOT_INTERFACES[chat_id]={};
			if (!(name in BOT_INTERFACES[chat_id]))
			{
				BOT_INTERFACES[chat_id][name]={};
			}
		}

		BOT_INTERFACES[chat_id][name].sheet_id=sheet_id;
		BOT_INTERFACES[chat_id][name].type=type;
		BOT_INTERFACES[chat_id][name].range=range;

	}
	static remove(name,chat_id)
	{
		if (chat_id in BOT_INTERFACES)
		{

			if (name in BOT_INTERFACES[chat_id])
			{
				delete BOT_INTERFACES[chat_id][name];
			}
		}
	}
}

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
