const setup = require('./management.js');

const discord = require('discord.js');
const client = new discord.Client();
const fs = require('fs').promises
const level = require('level')

function connect(){
  var handle;
  return fs.open('token', 'r')
    .then(h => {
      handle = h; 
      return handle.readFile('utf8');
    })
    .finally(() => handle ? handle.close() : {})
    .then(token => client.login(token.trim()))
    .then(() => client)
};

const wrapDB = function(ldb){
  return {
    'get': key => {return ldb.get(key).then(JSON.parse)},
    'put': (key, value) => ldb.put(key, JSON.stringify(value)),
    'del': key => ldb.del(key)
  }
}

connect().then(client => setup(client, wrapDB(level('./modules')), wrapDB(level('./state'))));
