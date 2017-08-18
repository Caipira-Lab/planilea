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

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
 function authorize(credentials, callback) {
 	var clientSecret = credentials.installed.client_secret;
 	var clientId = credentials.installed.client_id;
 	var redirectUrl = credentials.installed.redirect_uris[0];
 	var auth = new googleAuth();
 	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
  	if (err) {
  		getNewToken(oauth2Client, callback);
  	} else {
  		oauth2Client.credentials = JSON.parse(token);
  		callback(oauth2Client);
  	}
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
 function getNewToken(oauth2Client, callback) {
 	var authUrl = oauth2Client.generateAuthUrl({
 		access_type: 'offline',
 		scope: SCOPES
 	});
 	console.log('Authorize this app by visiting this url: ', authUrl);
 	var rl = readline.createInterface({
 		input: process.stdin,
 		output: process.stdout
 	});
 	rl.question('Enter the code from that page here: ', function(code) {
 		rl.close();
 		oauth2Client.getToken(code, function(err, token) {
 			if (err) {
 				console.log('Error while trying to retrieve access token', err);
 				return;
 			}
 			oauth2Client.credentials = token;
 			storeToken(token);
 			callback(oauth2Client);
 		});
 	});
 }

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
 function storeToken(token) {
 	try {
 		fs.mkdirSync(TOKEN_DIR);
 	} catch (err) {
 		if (err.code != 'EEXIST') {
 			throw err;
 		}
 	}
 	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
 	console.log('Token stored to ' + TOKEN_PATH);
 }


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
