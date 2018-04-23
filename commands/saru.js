exports.run = (client, message, args) => {
    // Read the phrases from a file
    var phrases = client.readFromFile("saru_phrases.txt");

    // Select one at random
    client.sendMessage(message, phrases.random());
}

exports.help = {
    name: "saru",
    description: "Returns a random Saru phrase",
    usage: "saru"
}