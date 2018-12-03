const log = require('./log.js');

module.exports = function(template, client){
  let listeners = [];

  template.start = Function("self", "moduleDB", "state", "client", "metadata", template.start || "");

  let start = function(moduleDB, localDB, metadata){
    let specialClient = Object.create(client);
    specialClient.on = function(target, handler){
      let innerHandler = function(e){
        try{
          handler(e);
        }catch(err){
          log("uncaught error: " + err.stack);
        };
      }
      listeners.push([target, innerHandler]);
      client.on(target, innerHandler);
    }

    template.start(template, moduleDB, localDB, specialClient, metadata);
  }

  let stop = function(){
    if(template.stop){
      template.stop();
    }

    while(listeners.length > 0){
      let pair = listeners.pop();
      client.removeListener(pair[0], pair[1]);
    }
  }

  return {
    'start': start,
    'stop': stop,
  }
}
