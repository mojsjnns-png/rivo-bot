module.exports = function registerInteractions(client, deps) {
  require('./modules/earlyInteractions')(client, deps);
  require('./modules/shopInteractions')(client, deps);
  require('./modules/orderInteractions')(client, deps);
  require('./modules/lateInteractions')(client, deps);
  require('./modules/exchangeSystem')(client, deps);
  require('./modules/mzad2')(client, deps);
  require('./modules/apply')(client, deps);
};
