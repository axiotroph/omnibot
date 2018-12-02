const log = require('./log.js');
const buildModule = require ('./module.js');
const authTimeout = 48*60*60*1000; // two days

module.exports = function(client, db, stateDB){
  let running = {};

  const command = function (trigger, body){
    client.on('message', msg => {
      let found = msg.content.match(trigger)
      if(!msg.author.bot && found){
        body(found, msg).catch(err => msg.channel.send("unhandled error:" + "```"+err.stack+"```"));
      }
    });
  };

  const onStart = async function(){
    let index = await getIndex();
    for(let k in index){
      let v = index[k];
      if(v.up){
        up(index, k);
      }
    }
  }

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
      throw Error("no module by that name or id");
    }else{
      throw Error("the name '" + ident + "' is ambiguous - matches module ids " + search.toString());
    }
  }

  const memberIsAdmin = function(member){
    return member.permissions.has("ADMINISTRATOR");
  }

  const userIsAdmin = function(user, guild){
    return memberIsAdmin(guild.member(user));
  }

  const checkOwner = function(indexEntry, sender){
    if(indexEntry.owner != sender.id && !memberIsAdmin(sender)){
      throw Error("you are not authorized to do that");
    }
  }

  const commonLookup = async function(match){
    let index = await getIndex();
    let name = match[1]
    let id = lookup(index, name);
    return {
      'index': index, 
      'name': name, 
      'id': id,
      'fullName': name + " (" + id + ")"
    }
  }

  command(/^\%create (\w+)$/, async (match, msg) => {
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
    await msg.channel.send("created module " + name + " (" + id + ")");
  });

  const auth = async function(index, id, msg){
    if(index[id].auth){
      return Promise.resolve(true);
    }

    let authmsg = await msg.channel.send("requesting auth for module " + id);
    await authmsg.react('✅');
    await authmsg.react('❎');

    let collector = authmsg.createReactionCollector(
      (reaction, user) => !user.bot && userIsAdmin(user, msg.guild),
      {time: authTimeout});

    let onTimeout = err => {
      msg.reply("auth request timed out for module " + id)
        .then(Promise.resolve(false));
    };

    let onAnswer = answer => {
      if(answer.emoji.name == '✅'){ 
        return getIndex()
          .then(index => {index[id].auth = true; db.put('index', index)})
          .then(() => msg.reply("auth confirmed for module " + id))
          .then(() => Promise.resolve(true));
      }else{
        return msg.reply("auth declined for module " + id)
          .then(() => Promise.resolve(false));
      }
    };

    return collector.next.then(onAnswer, onTimeout);
  }

  command(/^\%auth (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);

    return await auth(data.index, data.id, msg);
  });

  command(/^\%deauth (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);
    checkOwner(data.index[data.id], msg.member);

    data.index[data.id].auth = false;
    await db.put('index', data.index);
    msg.channel.send("module " + data.fullName + " deauthed");
  });

  command(/^\%up (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);
    checkOwner(data.index[data.id], msg.member);
    let allowed = await auth(data.index, data.id, msg);
    if(allowed){
      await up(data.index, data.id, msg);
    }
  });

  command(/^\%down (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);
    checkOwner(data.index[data.id], msg.member);
    await down(data.index, data.id, msg);
  });

  const up = async function(index, id, msg){
    if(!index[id].up){
      await getIndex().then(index => {index[id].up = true; db.put('index', index)});
    }

    if(running[id]){
      return;
    }

    let template = await db.get(id);
    running[id] = buildModule(template, client);
    running[id].start(db, stateDB, index[id]);
    if(msg){
      await msg.channel.send("started module " + id);
    }
  }

  const down = async function(index, id, msg){
    if(index[id].up){
      await getIndex().then(index => {index[id].up = false; db.put('index', index)});
    }

    if(running[id]){
      running[id].stop();
      delete running[id];
      if(msg){
        await msg.channel.send("stopped module " + id);
      }
    }
  }

  command(/^\%delete (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);
    checkOwner(data.index[data.id], msg.member);

    down(data.index, data.id, msg);
    delete data.index[data.id];
    await db.del(data.id);
    await db.put('index', data.index);
    await msg.channel.send("deleted module " + data.fullName);
  });

  command(/^\%source (\w+)$/, async (match, msg) => {
    let data = await commonLookup(match);
    let source = await db.get(data.id);

    let result = "";
    result += "```metadata: " + JSON.stringify(data.index[data.id], null, 2) + "```";
    for(let k in source){
      result += "```" + k + ": " + source[k] + "```";
    }

    await msg.channel.send(result);
  });

  command(/^\%let (\w+) (\w+) (`{3}|`)([\s\S]*)(\3)$/, async (match, msg) => {
    let data = await commonLookup(match);
    checkOwner(data.index[data.id], msg.member);

    if(data.index[data.id].auth){
      data.index[data.id].auth = false;
      await db.put('index', data.index);
    }

    let module = await db.get(data.id);
    if(match[3] == "undefined" || match[4].match(/^\s*$/)){
      delete module[match[2]];
    }else{
      module[match[2]] = match[4];
    }
    await db.put(data.id, module);

    await msg.channel.send("assigned property " + match[2] + " on " + data.fullName);
  });

  onStart();
}
