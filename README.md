#Omnibot

The idea was to host a chat bot that allowed friends who like to code and
friends who like to learn to code to run their code on our shared server. This
bot is the realization of that idea. 

##Before you begin

In general, executing code that someone gave to your server over a public
interface is a Very Bad Idea. The purpose of this bot is to do just that. I
have implemented some basic security measures, but they are by no means
comprehensive and are primarily intended to prevent accidental damage. By
knowingly doing it anyway, I am trusting you all to be considerate.

Please, do not threaten that trust. Do not try to test or circumvent these
security measures. Do not try to 'sneak' something by me, even if it is benign.
If I find you intentionally doing so, I will ban you from the bot, and I will
be personally rather upset with you. If you were also trying to do something
malicious, then you will be banned from HnH as well. I apologize for the
bluntness of this statement, but it has to be made - as potentially malicious
acts threaten the privacy of everyone on HnH.

The bot will require admin approval before allowing any code to be run. Mostly,
I'm just going to be checking that it isn't obviously broken, but also that it
doesn't have the potential to break other modules or cause performance
troubles. Please don't take offense if this happens. I suggest making sure your
code is at least syntactically correct before submitting it - such as in your
browser's javascript console (ctrl+shift+k).

##Module api

User code is organized into *modules*, which are expected to correspond to
minimal features. Modules are implemented as Objects with the keys and values
all strings. The entry point for user code is the `start` key, which is
expected to map to a javascript... well, script. When the module is started (or
the bot reboots), the code in `start` is evaluated in the global context, with
the following variables available:
- `client`: the discord client, which can be used to interact with the server, such as
  ```
  client.on("message", msg => {
    msg.reply("you just said " + msg.content);
  });
  ``` See https://discord.js.org/#/docs/main/stable/general/welcome for full
  documentation on the client.
- `self`: the module itself - only relevant if you have keys other than `start`
  mapped. Changes made to this reference are not persistent across module
  restart.
- `moduleDB`: the database in which the modules are stored (you'll probably
  want to talk to me about the schema if you're touching this)
- `state`: a persistent key-value store for the use of modules. This is a
  single database across all modules, so make sure that your keys don't
  conflict. It implements get(key [, callback]), put(key, value [,callback),
  and delete(key, [,callback). Keys should be strings, values can be any type.
  If a callback is not provided, a promise will be returned.
- `metadata`: the metadata of this command, including its unique id.

If you want to do something that this api makes difficult, get in touch and we
can work on it.

###Expectations for user code
- do not pollute the global namespace without very good reason.
- user code should be free of potential memory leaks
- do not cause spam. In particular, if your module interacts with people who
  have not explicitly invoked it, you should make sure that it does not do so
  very often. You should also make sure that your module doesn't make too much
  output even when it is invoked, as this can be disruptive (see caramel
  dancer's $help...). If you have to display a lot of text, put it in context
  free or, better yet, dm the person who needs it.
- Modules should clean up after themselves. By that I mean, when the module is
  stopped and garbage collected, it should indeed be gone - no lingering
  listeners or callbacks. I have taken care of most of this: the `client` you
  get is actually a wrapper around the real `discord.js` client, which
  remembers and cleans up all event listeners you register on the client
  itself. However, it won't know if you register listeners or callbacks on
  something else. If you need to do manual cleanup, map `self.stop` to a
  function - if such a function exists, the wrapper will call it when the
  module is stopping, just before removing the event listeners.

##Built in commands

I intend to implement as much as possible with userspace modules, so the
builtin commands are only the minimum required to manage modules. All of these
commands can operate on a module by name, if that name is unique, or otherwise
by id (ids are always unique).

- `%create [modulename]`: create a new module (owned by you)
- `%delete [module]`: delete a module (owned by you)
- `%let [module] [key] [value]`: set the value of a module's property (such as
  `%start`). The value must be enclosed in backticks (`) or triple backticks.
- `%auth [module]`: request admin authorization, but do not start the module yet
- `%deauth [module]`: reset module's authorization
- `%up [module]`: enable module; it will be started immediately and restarted
  whenever the bot restarts. Will ask for authorization first if the module
  isn't yet authorized.
- `%down [module]`: stop the module, if it's currently running, and don't
  automatically restart it.
- `%source [module]`: show the source code and metadata of a module.

