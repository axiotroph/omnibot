const log = require('./log.js');

module.exports = function(client, db){
  const command = function (trigger, body){
    client.on('message', msg => {
      let found = msg.content.match(trigger)
      if(!msg.author.bot && found){
        body(found, msg).catch(err => msg.reply(err.stack));
      }
    });
  };

  const getIndex = function(){
    return db.get('index').catch(err => err.notFound ? Promise.resolve({}) : Promise.reject(err));
  }

  const assignID = function(index, user){
    let prefix = user.username.slice(0, 3).toLowerCase();
    let dis = 0;
    while(index[prefix+dis]){
      dis++;
    }

    return prefix+dis;
  }

  const lookup = function(index, ident){
    if(index[ident]){
      return ident;
    }

    let search = Object.keys(index).filter(k => index[k].name === ident);
    if(search.length == 1){
      return search[0];
    }else if(search.length == 0){
      console.dir(Object.keys(index));
      console.dir(index);
      throw Error("no module by that name or id");
    }else{
      throw Error("the name '" + ident + "' is ambiguous - matches module ids " + search.toString());
    }
  }

  const auth = function(indexEntry, sender){
    if(indexEntry.owner != sender.id && !sender.permissions.has("ADMINISTRATOR")){
      throw Error("you are not authorized to do that");
    }
  }

  command(/\$create (\w+)/, async (match, msg) => {
    let name = match[1];
    let index = await getIndex();
    let id = assignID(index, msg.author);

    index[id] = {
      'name': name,
      'owner': msg.author.id,
      'id': id,
      'up': false,
      'auth': false,
    };

    await db.put('index', index);
    await db.put(id, {});
    await msg.reply("created module " + name + " (" + id + ")");
  });

  command(/\$delete (\w+)/, async (match, msg) => {
    let index = await getIndex();
    let name = match[1]
    let id = lookup(index, name);
    auth(index[id], msg.member);

    delete index[id];
    await db.del(id);
    await db.put('index', index);
    await msg.reply("deleted module " + name + " (" + id + ")");
  });
}
