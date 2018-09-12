'use strict mode';

// Load all the required libraries
const Discord = require("discord.js");
const client = new Discord.Client();
const fs = require("fs");
const { promisify } = require('util');
const readdir = promisify(require("fs").readdir);
const Enmap = require('enmap');

// IBM Watson
const watsonAssistantV1 = require('watson-developer-cloud/assistant/v1');

// Initialize variables
client.commands = new Enmap();
client.prefix = "a$";
client.isChatting = false;
client.chatChannel = null;
client.watsonContext = {};

require('./functions.js')(client);
client.logger = require("./util/Logger");

// Load the .env file which contains the environment variables
if (process.env.NODE_ENV !== "production") {
    require('dotenv').load();
}

// Setup IBM Watson Assistant service wrapper
let service = new watsonAssistantV1({
    version: process.env.WATSON_VERSION,
    iam_apikey: process.env.WATSON_API_KEY,
    url: process.env.WATSON_URL
});

// Async wrapper. Courtesy of guidebot
const init = async () => {
    // Load commands
    const cmdFiles = await readdir("./commands/");
    cmdFiles.forEach(f => {
        if (!f.endsWith(".js")) return;
        const response = client.loadCommand(f);
        if (response) console.log(response);
    });

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    client.logger.log(`Loading a total of ${evtFiles.length} events.`);
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        // This line is awesome by the way. Just sayin'.
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });

};

init();

// This loop reads the /events/ folder and attaches each event file to the appropriate event.
fs.readdir("./events/", (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        let eventFunction = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        // super-secret recipe to call events with all their proper arguments *after* the `client` var.
        client.on(eventName, (...args) => eventFunction.run(client, ...args));
    });
});

client.on("message", (message) => {

    // Will not respond to a bot
    if (message.author.bot) return;

    let possibleGreetings = ["hello", "hi", "yo", "hey", "greetings", "good morning", "morning", "good afternoon",
        "afternoon", "good evening", "evening", "howdy", "sup", "wassup", "what's up"];
    let possibleReferences = ["alveria", "guys", "y'all", "all you", "everyone", "everybody"];

    // Respond to greetings
    possibleGreetings.forEach(greeting => {
        possibleReferences.forEach(reference => {
            if (message.content.toLowerCase().startsWith(greeting + " " + reference)) {
                if (client.isSaru(message)) {
                    message.reply("Hi...");
                } else if (!client.isSaru(message) && message.content.toLowerCase().startsWith("hoi " + reference)) {
                    message.reply("Hello, but please...don't");
                }
                else {
                    message.reply("Hello");
                }
                return;
            }
        });
    });

    // Respond to "I love you"
    let possibleLoves = ["i love you", "i love", "ily", "<3"];
    if (message.content.toLowerCase().startsWith(possibleLoves + " Alveria") && !client.isSaru(message)) {
        message.reply("I love you too!");
        return;
    }

    // If in chat mode and the message doesn't start with the prefix
    // communicate with IBM Watson
    if (client.isChatting && !message.content.startsWith(client.prefix)) {
        if (message.channel != client.chatChannel) {
            return;
        }

        if (message.content.length > 0) {
            if (client.isSaru(message)) {
                client.watsonContext.username = "Saru";
            } else {
                client.watsonContext.username = message.member.nickname? message.member.nickname : message.member.user.username;
            }

            service.message({
                workspace_id: process.env.WATSON_WORKSPACE_ID,
                input: { text: message.content },
                context: client.watsonContext
            }, (err, response) => {
                client.processWatsonResponse(message, err, response);
            });
        }
    }
    
    if (!message.content.startsWith(client.prefix)) return;

    // Split the prefix, command, and arguments
    // Courtesy of guidebot
    const args = message.content.slice(client.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // Check to see if input command is valid
    if (!client.commands.has(`${command}`)) {
        message.channel.send("Doesn't look like I know this command. Use a$help to see all my commands.");
        return;
    }

    // Try to run the command
    try {
        let commandFile = require(`./commands/${command}.js`);
        commandFile.run(client, message, args);
    } catch (err) {
        client.logger.error(err);
    }
});

// Bot login using the token, stored as an environment variable
client.login(process.env.TOKEN);