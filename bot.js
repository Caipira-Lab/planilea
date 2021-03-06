var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var jsonfile = require('jsonfile');
var table = require('text-table');
var tableify = require('tableify');
var webshot = require('webshot');

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
	constructor(name,chat_id,sheet_id,format,range,standard=null)
	{
		super();
		this.name = name;
		this.chat_id = chat_id;
		this.sheet_id = sheet_id;
		this.format = format;
		this.range = range;
		this.standard = standard;
	}
	add()
	{
		if (!(this.chat_id in BOT_INTERFACES))
		{
			BOT_INTERFACES[this.chat_id]={};

		}
		if (!(this.name in BOT_INTERFACES[this.chat_id]))
		{
			BOT_INTERFACES[this.chat_id][this.name]={};
			BOT_INTERFACES[this.chat_id][this.name].sheet_id=this.sheet_id;
			BOT_INTERFACES[this.chat_id][this.name].format=this.format;
			BOT_INTERFACES[this.chat_id][this.name].range=this.range;
			if (this.standard === null)
			{
				BOT_INTERFACES[this.chat_id].standard = this.name;
			}
		}
		else
		{
			bot.sendMessage(this.chat_id,"Interface "+this.name+" ja existe.");
		}


	}
	remove()
	{
		if (this.chat_id in BOT_INTERFACES)
		{

			if (this.name in BOT_INTERFACES[this.chat_id])
			{
				delete BOT_INTERFACES[this.chat_id][this.name];
			}
		}
	}
	static get(chat_id,name)
	{
		if (chat_id in BOT_INTERFACES)
		{

			if (name in BOT_INTERFACES[chat_id])
			{
				return new Interface(name,chat_id,BOT_INTERFACES[chat_id][name].sheet_id,BOT_INTERFACES[chat_id][name].format,BOT_INTERFACES[chat_id][name].range,BOT_INTERFACES[chat_id].standard);
			}
		}
	}
	get_data(resolve)
	{
		var d = new Dataset(this.sheet_id,this.format,this.range);
		var p = new Promise(
			function(resolve, reject) {
				d.update(resolve);
			});

		p.then(

			function(val) {
				if (typeof resolve === "function")
				{
					resolve(val);
				}
			});
	}
	test_data()
	{
		var chat_id = this.chat_id;

		this.get_data(function(val)
		{
			if (val === null)
			{
				bot.sendMessage(chat_id,"Erro na planilha");
			}
		});
	}
	send_data()
	{
		var chat_id = this.chat_id;
		var format = this.format;

		this.get_data(function(val)
		{
			var f = new Format(val,{format:format});
			var buffer=[];

			if (format === INTERFACE_INFO)
			{
				bot.sendMessage(chat_id,f.result,{parse_mode:"markdown"});
			}
			else
			{


				var options =
				{
					siteType:'html',
					screenSize:{
						height: 100
					},
					shotSize:
					{
						height: 'all'
					}

				}

				var renderStream = webshot(f.result,null,options);

				renderStream.on('data', function(data) {
					buffer.push(data);
				});

				renderStream.on('end', function() {
					bot.sendPhoto(chat_id,Buffer.concat(buffer));
				});
			}
		});
	}
}

class Dataset extends Object
{
	constructor(sheet_id,format,range)
	{
		super();
		this.sheet_id=sheet_id;
		this.format=format;
		this.range=range;
		this.updated=false;
	}
	update(resolve)
	{
		var sheet_id = this.sheet_id;
		var range = this.range;
		var obj=this;
		fs.readFile('client_secret.json', function processClientSecrets(err, content) {
			if (err) {
				console.log('Error loading client secret file: ' + err);
				return;
			}
  			// Authorize a client with the loaded credentials, then call the
  			// Google Sheets API.
  			authorize(JSON.parse(content),
  				function retrieve(auth)
  				{
  					var sheets = google.sheets('v4');

  					sheets.spreadsheets.values.get({
  						auth: auth,
  						spreadsheetId: sheet_id,
  						range: range,
  					}, function(err, response) {
  						if (err) {
  							console.log('The API returned an error: ' + err);
  							return;
  						}

  						obj.data = response.values;
  						resolve(obj.data);

  					});
  				});
  		});
	}

}
class Format extends String
{
	constructor(dataset,options)
	{
		super();
		this.dataset = dataset;
		this.options = options;
		this.result = this.format();

	}
	format()
	{
		if (this.options.format === INTERFACE_INFO)
		{
			var result=table(this.dataset,{hsep:" | "});
			return "```\n"+result+"\n```";
		}
		else
		{
			var result=tableify(this.dataset);
			var css = "";
			this.height=(this.dataset.length*20)+20;
			css = "<style>table{width:100%;font-family:monospace}table tr:first-child{background-color:gray;color:#fff;font-weight:700}tr:nth-child(even){background-color:#d3d3d3}</style>";

			return css+result;
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
	bot.onText(/\/add (.*)/, function (msg, match) {
		var chatId = msg.chat.id;
		var standard = null;
		if (chatId in BOT_INTERFACES)
		{
			standard = BOT_INTERFACES[chatId].standard;
		}
		explode = match[1].split(" ");
		var inter = new Interface(explode[0],chatId,explode[1],parseInt(explode[2].replace("TABLE",INTERFACE_TABLE).replace("INFO",INTERFACE_INFO)),explode[3],standard);
		inter.add();

		inter.test_data();
	});
	bot.onText(/\/list$/, function (msg, match) {
		var chatId = msg.chat.id;

		if (chatId in BOT_INTERFACES)
		{
			var i = Interface.get(chatId,BOT_INTERFACES[chatId].standard);
			i.send_data();
		}
	});
	bot.onText(/\/list (.*)/, function (msg, match) {
		var chatId = msg.chat.id;
		if (chatId in BOT_INTERFACES)
		{
			if (match[1] in BOT_INTERFACES[chatId])
			{
				var i = Interface.get(chatId,match[1]);
				i.send_data();
			}
		}
	});
	bot.onText(/\/set (.*)/, function (msg, match) {
		var chatId = msg.chat.id;
		if (chatId in BOT_INTERFACES)
		{
			explode = match[1].split(" ");
			if (explode[0] === "standard")
			{
				if (explode[1] in BOT_INTERFACES[chatId])
				{
					BOT_INTERFACES[chatId].standard = explode[1];
					bot.sendMessage(chatId,"Planilha padrão para esse chat agora é "+explode[1]);
				}
			}
		}
	});
}
