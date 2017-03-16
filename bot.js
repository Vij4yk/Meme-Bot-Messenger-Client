//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<footer id=\"gWidget\"></footer><script src=\"https://widget.glitch.me/widget.min.js\"></script></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message from user %d with message:", 
    senderID);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    if(textMatches(messageText, "meme"))
      sendMeme(senderID);
    else if(textMatches(messageText, "help"))
      sendHelp(senderID);
    else if(textMatches(messageText, "why"))
      sendWhy(senderID);
    else if(textMatches(messageText, "how"))
      sendHow(senderID);
    else
      sendWelcome(senderID);
  }
}

function textMatches(message, matchString) {
  return message.toLowerCase().indexOf(matchString) != -1;
}

//////////////////////////
// Sending helpers
//////////////////////////

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function logObject(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function sendWhy(recipientId) {
  var sendMsg = `why the hell not mate?!`;
  sendTextMessage(recipientId, sendMsg);
}

function sendHow(recipientId) {
  var sendMsg = `
  Here's how I work!
  https://github.com/benwinding/Messenger-Meme-Bot
`;
  sendTextMessage(recipientId, sendMsg);
}

function sendHelp(recipientId) {
  var apiDesc = `I'm glad you asked ( ͡° ͜ʖ ͡°), 
meme = sends a random meme image found on imgur.com
help = sends this message ...
why = sends the reason why I exist!
  `;
  sendTextMessage(recipientId, apiDesc);
}

function sendWelcome(recipientId) {
  request({
      url: 'https://graph.facebook.com/v2.6/' + recipientId 
        + '?access_token=' + process.env.PAGE_ACCESS_TOKEN
    },
    function (error, response, body) {
      if (error || response.statusCode != 200) return;
    
      var fbProfileBody = JSON.parse(body);
      var userName = fbProfileBody["first_name"];
      var welcomeMsg = `Hello ${userName}, 
I'm your personal memebot! 
type 'meme' and see what happens... 
¯\\_(ツ)_/¯ 
or 'help' for more details
      `;
      sendTextMessage(recipientId, welcomeMsg);
    }
  );
}

function sendMeme(recipientId) {
  request({
      url: 'https://api.imgur.com/3/gallery/t/meme',
      headers: {
        'Authorization': 'Client-ID ' + process.env.IMG_CLIENT_ID
      }
    },
    function (error, response, body) {
      if (error || response.statusCode != 200) return;

      var imgurApiResponse = JSON.parse(body);
      var randomGalleryItem = getRandomItemFromArray(imgurApiResponse.data.items);
      if(randomGalleryItem.is_album) {
         sendRandomAlbumnImage(recipientId, randomGalleryItem.id);
      }
      else {
         sendImage(recipientId, randomGalleryItem.link);
      }
    }
  );
}

function sendRandomAlbumnImage(recipientId, id) {
  request({
      url: "http://api.imgur.com/3/gallery/album/" + id,
      headers: {
        'Authorization': 'Client-ID ' + process.env.IMG_CLIENT_ID
      }
    },
    function (error, response, body) {
      if (error || response.statusCode != 200) return;

      var imgurApiResponse = JSON.parse(body);
      var randomAblumnImage = getRandomItemFromArray(imgurApiResponse.data.images);
      logObject(randomAblumnImage);
      sendImage(recipientId, randomAblumnImage.link);
    }
  );
}

function sendImage(recipientId, imageUrl) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: { 
        type: "image",
        payload: {
          url: imageUrl
        }
      }
    }
  }
  callSendAPI(messageData);
}

function getRandomItemFromArray(items) {
  var random_item = items[Math.floor(Math.random()*items.length)];
  return random_item;
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});