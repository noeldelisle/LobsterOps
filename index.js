const { LobsterOps } = require('./src/core/LobsterOps');
const { StorageFactory } = require('./src/storage/StorageFactory');
const { StorageAdapter } = require('./src/storage/StorageAdapter');
const { JsonFileStorage } = require('./src/storage/JsonFileStorage');
const { MemoryStorage } = require('./src/storage/MemoryStorage');
const { SQLiteStorage } = require('./src/storage/SQLiteStorage');

module.exports = {
  LobsterOps,
  StorageFactory,
  StorageAdapter,
  JsonFileStorage,
  MemoryStorage,
  SQLiteStorage
};
