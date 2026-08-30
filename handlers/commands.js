module.exports = function registerCommands(client, deps) {
  require('./modules/commandsA')(client, deps);
  require('./modules/commandsB')(client, deps);
  require('./modules/commandsC')(client, deps);
  require('./modules/commandsD')(client, deps);
};
